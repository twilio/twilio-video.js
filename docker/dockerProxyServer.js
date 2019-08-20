/* eslint-disable no-console */
'use strict';

const http = require('http');
const DEFAULT_SERVER_PORT = 3032;
const cors = require('cors');
const isDocker = require('is-docker')();
const version = 1.00;

/**
 * Provides webserver interface to communicate with
 * docker socket. This provides simple inteface for
 * use from browser to write network depenent tests.
 * via {@link DockerProxyServer}
*/
class DockerProxyServer {
  constructor(port) {
    this._serverPort = port || DEFAULT_SERVER_PORT;
    this._requestId = 4000;
    this._containerId = null;
    this._server = null;
    this._instanceLabel = 'dockerProxy' + (new Date()).toISOString();
  }

  /**
   * stops the server
   */
  stopServer() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  /**
   * starts the webserver server, and starts listening for incoming requests.
   */
  async startServer() {
    this._originalNetworks = await this.getCurrentNetworks();
    return new Promise(resolve => {
      const express = require('express');
      const app = express();
      app.use(cors());

      [
        { endpoint: '/version', handleRequest: 'version' },
        { endpoint: '/isDocker', handleRequest: 'isDocker' },
        { endpoint: '/getCurrentContainerId', handleRequest: 'getCurrentContainerId' },
        { endpoint: '/getContainers', handleRequest: 'getContainers' },
        { endpoint: '/getActiveInterface', handleRequest: 'getActiveInterface' },
        { endpoint: '/disconnect/:networkId', handleRequest: 'disconnectFromNetwork' },
        { endpoint: '/disconnectFromAllNetworks', handleRequest: 'disconnectFromAllNetworks' },
        { endpoint: '/connect/:networkId', handleRequest: 'connectToNetwork' },
        { endpoint: '/createNetwork/:networkName', handleRequest: 'createNetwork' },
        { endpoint: '/resetNetwork', handleRequest: 'resetNetwork' },
        { endpoint: '/inspectCurrentContainer', handleRequest: 'inspectCurrentContainer' },
        { endpoint: '/connectToDefaultNetwork', handleRequest: 'connectToDefaultNetwork' },
        { endpoint: '/getAllNetworks', handleRequest: 'getAllNetworks' },
        { endpoint: '/getCurrentNetworks', handleRequest: 'getCurrentNetworks' },
      ].forEach((route) => {
        app.get(route.endpoint, (req, res, next) => {
          this[route.handleRequest](req.params).then(data => res.send(data)).catch(error => {
            console.warn('Failed @ ' + route.endpoint, error);
            next(error);
          });
        });
      });

      this._server = app.listen(this._serverPort, () => {
        console.log(`DockerProxyServer listening on port ${this._serverPort}!`);
        resolve();
      });
    });
  }

  // resets network to default state
  async resetNetwork() {
    await this.disconnectFromAllNetworks();
    await this.connectToDefaultNetwork();
    await this._pruneNetworks();
  }

  // removes all unused networks (created by this instance)
  _pruneNetworks() {
    const filters = encodeURIComponent(JSON.stringify({
      label: { [this._instanceLabel]: true }
    }));
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.32/networks/prune?filters=${filters}`,
      method: 'POST',
    });
  }

  getCurrentContainerId() {
    if (!this._containerId) {
      const cmd = 'cat /proc/self/cgroup | grep "pids:/" | sed \'s/\\([0-9]*\\):pids:\\/docker\\///g\'';
      return this._runCommand(cmd).then((output) => {
        const containerId = output.replace('\n', '');
        this._containerId = containerId;
        return { containerId };
      });
    }
    return Promise.resolve({ containerId: this._containerId });

  }

  getActiveInterface() {
    const cmd = 'ip route show default | grep default | awk {\'print $5\'}';
    return this._runCommand(cmd).then((output) => {
      const activeInterface = output.replace('\n', '');
      return { activeInterface };
    });
  }

  getContainers() {
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.32/containers/json',
      method: 'GET',
    });
  }

  inspectCurrentContainer() {
    return this.getCurrentContainerId().then(({ containerId }) => {
      return this._makeRequest({
        socketPath: '/var/run/docker.sock',
        path: `/v1.32/containers/${containerId}/json`,
        method: 'GET',
      });
    });
  }

  connectToDefaultNetwork() {
    const connectPromises = this._originalNetworks.map(({ Id }) => this.connectToNetwork({ networkId: Id }));
    return Promise.all(connectPromises);
  }

  getAllNetworks() {
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.32/networks',
      method: 'GET',
    });
  }

  connectToNetwork({ networkId }) {
    return this.getCurrentContainerId().then(({ containerId }) => {
      return this._connectToNetwork({ networkId, containerId });
    });
  }

  // returns Promise<[{ Name, Id }]>
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
    // Note: we tag the networks created by this instance of proxy
    // with a label, so that we can prune specific networks during cleanup.
    const instanceId = (new Date()).toDateString();
    const postData = JSON.stringify({
      'Name': networkName,
      'Labels': {
        'dockerProxy': instanceId,
        [this._instanceLabel]: instanceId,
      }
    });
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: '/v1.32/networks/create',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  isDocker() {
    return Promise.resolve({ isDocker });
  }

  version() {
    return Promise.resolve({ version });
  }

  _connectToNetwork({ networkId, containerId }) {
    const postData = JSON.stringify({
      'Container': containerId,
    });

    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.32/networks/${networkId}/connect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  _disconnectFromNetwork({ networkId, containerId }) {
    const postData = JSON.stringify({
      'Container': containerId,
      'Force': false
    });
    return this._makeRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v1.32/networks/${networkId}/disconnect`,
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

// NOTE(mpatwardhan):To quick test the implementation
// start server, and then dockerProxyClient.js interactively
// 1) node dockerProxyServer.js
// 2) node docker/dockerProxyClient.js http://localhost:3032/
if (module.parent === null) {
  console.log('DockerProxy loaded interactively');
  const server = new DockerProxyServer();
  server.startServer().then(() => {
    console.log('started server');
  });
}

module.exports = DockerProxyServer;

