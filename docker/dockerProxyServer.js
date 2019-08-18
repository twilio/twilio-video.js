/* eslint-disable no-else-return */
/* eslint-disable quotes */
/* eslint-disable no-console */
'use strict';

const http = require('http');
const DEFAULT_SERVER_PORT = 3032;
const cors = require('cors');
const isDocker = require('is-docker')();
const version = 0.01;
const defaultNetwork = 'twilio-videojs_default';

// TODO: move to api version 1.32
// Travis supports API version:  1.32 (minimum version 1.12)

// borrowed from: https://github.com/twilio/rtc-cpp/blob/feature/5.0.0/common/test/support/net_handoff_utils.cpp
class DockerProxyServer {

  constructor(port) {
    this._serverPort = port || DEFAULT_SERVER_PORT;
    this._requestId = 4000;
    this._containerId = null;
    this._server = null;
    this._instanceLabel = 'dockerProxy' + (new Date()).toISOString();
    this._originalNetworkPromise = this.getCurrentNetworks();
  }

  stopServer() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  startServer() {
    return this.getCurrentNetworks().then((originalNetworks) => {
      console.log("makarand: original networks = ", originalNetworks);
      this._originalNetworks = originalNetworks;
      return new Promise(resolve => {
        const express = require('express');
        const app = express();
        app.use(cors());

        [
          { path: '/version', implfn: 'version' },
          { path: '/isDocker', implfn: 'isDocker' },
          { path: '/getCurrentContainerId', implfn: 'getCurrentContainerId' },
          { path: '/getContainers', implfn: 'getContainers' },
          { path: '/getActiveInterface', implfn: 'getActiveInterface' },
          { path: '/disconnect/:networkId', implfn: 'disconnectFromNetwork' },
          { path: '/disconnectFromAllNetworks', implfn: 'disconnectFromAllNetworks' },
          { path: '/connect/:networkId', implfn: 'connectToNetwork' },
          { path: '/createNetwork/:networkName', implfn: 'createNetwork' },
          { path: '/resetNetwork', implfn: 'resetNetwork' },
          { path: '/inspectCurrentContainer', implfn: 'inspectCurrentContainer' },
          { path: '/connectToDefaultNetwork', implfn: 'connectToDefaultNetwork' },
          { path: '/getAllNetworks', implfn: 'getAllNetworks' },
          { path: '/getCurrentNetworks', implfn: 'getCurrentNetworks' },
        ].forEach((route) => {
          app.get(route.path, (req, res, next) => {
            this[route.implfn](req.params).then(data => res.send(data)).catch(error => {
              console.warn('Failed @ ' + route.path, error);
              next(error);
            });
          });
        });

        this._server = app.listen(this._serverPort, () => {
          console.log(`DockerProxyServer listening on port ${this._serverPort}!`);
          resolve();
        });
      });
    });
  }

  // resets network to default state
  // default state is "twilio-video-default-network" as
  // only connected network.
  resetNetwork() {
    return this.disconnectFromAllNetworks()
        .then(() => this.connectToDefaultNetwork())
        .then(() => this._pruneNetworks());
  }

  // removes all unused networks (created by this instance)
  _pruneNetworks() {
    const filters = encodeURIComponent(JSON.stringify({
      'label': { [this._instanceLabel]: true }
    }));
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.26/networks/prune?filters=${filters}`,
      method: 'POST',
    });
  }

  getCurrentContainerId() {
    if (!this._containerId) {
      const cmd = "cat /proc/self/cgroup | grep \"pids:/\" | sed 's/\\([0-9]*\\):pids:\\/docker\\///g'";
      return this._runCommand(cmd).then((output) => {
        const containerId = output.replace('\n', '');
        console.info("container id = ", containerId);
        this._containerId = containerId;
        return { containerId };
      });
    } else {
      return Promise.resolve({ containerId: this._containerId });
    }
  }

  getActiveInterface() {
    const cmd = "ip route show default | grep default | awk {'print $5'}";
    return this._runCommand(cmd).then((output) => {
      const activeInterface = output.replace('\n', '');
      return { activeInterface };
    });
  }

  getContainers() {
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.26/containers/json',
      method: 'GET',
    });
  }

  inspectCurrentContainer() {
    return this.getCurrentContainerId().then(({ containerId }) => {
      return this._makeRequest({
        socketPath: '/var/run/docker.sock',
        path: `/v1.26/containers/${containerId}/json`,
        method: 'GET',
      });
    });
  }

  connectToDefaultNetwork() {
    const connectPromises = this._originalNetworks.map(({ Id }) => this.connectToNetwork({ networkId: Id }) );
    return Promise.all(connectPromises);
  }

  getAllNetworks() {
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.26/networks',
      method: 'GET',
    });
  }

  connectToNetwork({ networkId }) {
    return this.getCurrentContainerId().then(({ containerId }) => {
      return this._connectToNetwork({ networkId, containerId });
    });
  }

  // return Promise<[{networkName, networkId}]>
  getCurrentNetworks() {
    return this.inspectCurrentContainer().then((currentContainer) => {
      const networkNames = Object.keys(currentContainer.NetworkSettings.Networks);
      return networkNames.map((networkName) => {
        return {
          Name: networkName,
          Id: currentContainer.NetworkSettings.Networks[networkName].NetworkID
        };
      });
    });
  }

  disconnectFromAllNetworks() {
    return this.getCurrentNetworks().then((networks) => {
      const disconnectPromises = networks.map(({ Id }) => this.disconnectFromNetwork({ networkId: Id }));
      return Promise.all(disconnectPromises);
    });
  }

  disconnectFromNetwork({ networkId }) {
    return this.getCurrentContainerId().then(({ containerId }) => {
      return this._disconnectFromNetwork({ networkId, containerId });
    });
  }

  createNetwork({ networkName }) {
    // POST /networks/create
    // {
    //   "Name":"NetoworkNameToCreate"
    //   "Driver": "bridge",
    //   ...
    // }

    // Note: we tag the networks created by this instance of proxy
    // with a label, so that we can prune specific networks during cleanup.
    const instanceId = (new Date()).toDateString();
    const postData = JSON.stringify({
      "Name": networkName,
      "Labels": {
        'dockerProxy': instanceId,
        [this._instanceLabel]: instanceId,
      }
    });
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.26/networks/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData).then((res) => {
      return res;
    });
  }

  isDocker() {
    return Promise.resolve({ isDocker });
  }

  version() {
    return Promise.resolve({ version });
  }

  _connectToNetwork({ networkId, containerId }) {
    // POST /v1.24/networks/22be93d5babb089c5aab8dbc369042fad48ff791584ca2da2100db837a1c7c30/connect HTTP/1.1
    // Content-Type: application/json
    // Content-Length: 12345
    // {
    //   "Container":"3613f73ba0e4",
    //   "EndpointConfig": {
    //     "IPAMConfig": {
    //         "IPv4Address":"172.24.56.89",
    //         "IPv6Address":"2001:db8::5689"
    //     }
    //   }
    // }
    const postData = JSON.stringify({
      "Container": containerId,
    });

    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.26/networks/${networkId}/connect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  _disconnectFromNetwork({ networkId, containerId }) {
    // POST /networks/(id or name)/disconnect
    // {
    //   "Container":"3613f73ba0e4",
    //   "Force":false
    // }
    const postData = JSON.stringify({
      "Container": containerId,
      "Force": false
    });
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.26/networks/${networkId}/disconnect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  _makeRequest(options, postdata) {
    const thisRequest = this._requestId++;
    return new Promise((resolve, reject) => {
      let clientRequest = http.request(options, (res) => {
        const requestFailed = res.statusCode !== 200 && res.statusCode !== 201;
        if (requestFailed) {
          console.warn(`${thisRequest}: request returned:`, res.statusCode, options, postdata);
        }
        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => {
            rawData += chunk;
        });
        res.on('end', () => {
          try {
            let parsedData;
            if (rawData) {
              parsedData = JSON.parse(rawData);
            }
            if (requestFailed) {
              console.warn(`${thisRequest}: request failed with:`, res.statusCode, parsedData);
            }
            resolve(parsedData);
          } catch (e) {
            console.warn(`${thisRequest}: error parsing data:`, rawData);
            reject(e);
          }
        });
      });
      clientRequest.on('error', (e) => {
          console.warn(`${thisRequest}: request failed`, e);
          reject(e);
      });

      if (postdata) {
        clientRequest.write(postdata);
      }
      clientRequest.end();
    });
  }

  _runCommand(cmd) {
    return Promise.resolve().then(() => {
      const { execSync } = require('child_process');
      const output  = execSync(cmd);
      return output.toString();
    });
  }
}

// test code when called interactively.
if (module.parent === null) {
  console.log("DockerProxy loaded interactively");
  const server = new DockerProxyServer(/* server */);
  server.startServer().then(() => {
    console.log("started server");
  });
}

module.exports = DockerProxyServer;

