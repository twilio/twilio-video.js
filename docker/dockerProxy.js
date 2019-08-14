/* eslint-disable no-else-return */
/* eslint-disable quotes */
/* eslint-disable no-console */
'use strict';

const http = require('http');
const PORT = 3032;
const cors = require('cors');
const isDocker = require('is-docker')();

// borrowed from: https://github.com/twilio/rtc-cpp/blob/feature/5.0.0/common/test/support/net_handoff_utils.cpp
class DockerProxy {

  constructor(serverMode) {
      this._requestId = serverMode ? 200  : 400;
      this._serverUrl = serverMode ? null : `http://localhost:${PORT}/`;

      // cache the container id
      // we can do this only when running the service inside docker
      this._containerId = null;
      this._server = null;
  }


  _runCommand(cmd) {
    return Promise.resolve().then(() => {
      const { execSync } = require('child_process');
      const output  = execSync(cmd);
      return output.toString();
    });
  }

  getCurrentContainerId() {
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + 'getCurrentContainerId');
    } else if (!this._containerId) {
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
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + 'getActiveInterface');
    } else {
      const cmd = "ip route show default | grep default | awk {'print $5'}";
      return this._runCommand(cmd).then((output) => {
        const activeInterface = output.replace('\n', '');
        return { activeInterface };
      });
    }
  }

  isDocker() {
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + 'isDocker');
    } else {
      return Promise.resolve({ isDocker });
    }
  }

  getHello() {
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + 'hello');
    } else {
      return Promise.resolve({ hello: 1 });
    }
  }

  makeRequest(options, postdata) {
    const thisRequest = this._requestId++;
    return new Promise((resolve, reject) => {
      let clientRequest = http.request(options, (res) => {
        if (res.statusCode !== 200) {
          console.warn(`${thisRequest}: request returned:`, res.statusCode);
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
        console.log(`${thisRequest}: posting on request:`, postdata);
        clientRequest.write(postdata);
      }
      clientRequest.end();
    });
  }

  getContainers() {
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + 'getContainers');
    } else {
      return this.makeRequest({
        socketPath: '/var/run/docker.sock',
        path: '/v1.26/containers/json',
        method: 'GET',
      });
    }
  }

  connectToNetwork({ networkId, containerId }) {
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
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + `connect/${networkId}/${containerId}`);
    } else {
      const postData = JSON.stringify({
        "Container": containerId,
      });
      return this.makeRequest({
        socketPath: '/var/run/docker.sock',
        path: `/v1.26/networks/${networkId}/connect`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      }, postData);
    }

  }

  disconnectFromNetwok({ networkId, containerId }) {
    // POST /networks/(id or name)/disconnect
    // {
    //   "Container":"3613f73ba0e4",
    //   "Force":false
    // }
    if (this._serverUrl) {
      return this.makeRequest(this._serverUrl + `disconnect/${networkId}/${containerId}`);
    } else {
      const postData = JSON.stringify({
        "Container": containerId,
        "Force": false
      });
      return this.makeRequest({
        socketPath: '/var/run/docker.sock',
        path: `/v1.26/networks/${networkId}/disconnect`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': postData.length
        }
      }, postData);
    }
  }

  stopServer() {
    if (this._server) {
      this._server.close();
      this._server = null;
    }
  }

  startServer() {
    return new Promise(resolve => {
      const express = require('express');
      const app = express();
      app.use(cors());

      [
        { path: '/hello', implfn: 'getHello' },
        { path: '/isDocker', implfn: 'isDocker' },
        { path: '/getCurrentContainerId', implfn: 'getCurrentContainerId' },
        { path: '/getContainers', implfn: 'getContainers' },
        { path: '/getActiveInterface', implfn: 'getActiveInterface' },
        { path: '/disconnect/:networkId/:containerId', implfn: 'disconnectFromNetwok' },
        { path: '/connect/:networkId/:containerId', implfn: 'connectToNetwork' },
      ].forEach((route) => {
        app.get(route.path, (req, res, next) => {
          this[route.implfn](req.params).then(data => res.send(data)).catch(error => {
            console.warn('Failed @ ' + route.path, error);
            next(error);
          });
        });
      });

      this._server = app.listen(PORT, () => {
        console.log(`DockerProxy listening on port ${PORT}!`);
        resolve();
      });
    });
  }
}

// test code when called interactively.
if (module.parent === null) {
  console.log("DockerProxy loaded interactively");
  const server = new DockerProxy(true /* server */);
  server.startServer().then(() => {
    const client = new DockerProxy(false /* client */);
    client.getHello().then(() => {
      client.getContainers();
    });
  });
}

module.exports = DockerProxy;

