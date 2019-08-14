/* eslint-disable no-else-return */
/* eslint-disable quotes */
/* eslint-disable no-console */
'use strict';

const http = require('http');
const defaultServerUrl = 'http://localhost:3032/';

// borrowed from: https://github.com/twilio/rtc-cpp/blob/feature/5.0.0/common/test/support/net_handoff_utils.cpp
class DockerProxyClient {

  constructor(serverUrl) {
      this._requestId = 200;
      this._serverUrl = serverUrl || defaultServerUrl;
  }

  getCurrentContainerId() {
    return this.makeRequest(this._serverUrl + 'getCurrentContainerId');
  }

  getActiveInterface() {
    return this.makeRequest(this._serverUrl + 'getActiveInterface');
  }

  isDocker() {
    return this.makeRequest(this._serverUrl + 'isDocker').then((isDockerResp) => {
      return isDockerResp.isDocker;
    }).catch((err) => {
      console.error('isDocker call failed..is DockerProxyServer running? ', err);
      return false;
    });
  }

  getVersion() {
    return this.makeRequest(this._serverUrl + 'version');
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
    return this.makeRequest(this._serverUrl + 'getContainers');
  }

  connectToNetwork({ networkId, containerId }) {
    return this.makeRequest(this._serverUrl + `connect/${networkId}/${containerId}`);
  }

  disconnectFromNetwok({ networkId, containerId }) {
    return this.makeRequest(this._serverUrl + `disconnect/${networkId}/${containerId}`);
  }
}

// To quick check this implementation
// load this file interactively with the server url.
if (module.parent === null) {
  console.log("DockerProxy loaded interactively");
  if (process.argv.length !== 3) {
    console.log('Usage: node dockerProxyClient.js <serverurl>')
    console.log('       where serverUrl is where dockerProxyServer is running');
    console.log('       Example: node dockerProxyClient.js http://localhost:3032/');
    return;
  }
  const client = new DockerProxyClient(process.argv[2]);
  const promises = [
    'isDocker',
    'getVersion',
    'getContainers',
    'getActiveInterface',
    'getCurrentContainerId'
  ].map(func => {
    return client[func]().then(( result ) => {
      console.info(`${func} returned:`, result);
    }).catch((err) => {
      console.error(`${func} failed with:`, err);
    });
  });

  Promise.all(promises).then(() => {
    console.log("done with all client calls.")
  });
}

module.exports = DockerProxyClient;

