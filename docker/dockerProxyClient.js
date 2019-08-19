/* eslint-disable no-else-return */
/* eslint-disable quotes */
/* eslint-disable no-console */
'use strict';

const http = require('http');
const defaultServerUrl = 'http://localhost:3032/';

class DockerProxyClient {

  constructor(serverUrl) {
      this._requestId = 200;
      this._serverUrl = serverUrl || defaultServerUrl;
  }

  // returns true if running inside a docker container.
  isDocker() {
    return this.makeRequest('isDocker').then((isDockerResp) => {
      return isDockerResp.isDocker;
    }).catch((err) => {
      console.error('isDocker call failed..is DockerProxyServer running? ', err);
      return false;
    });
  }

  getCurrentContainerId() {
    return this.makeRequest('getCurrentContainerId');
  }

  getActiveInterface() {
    return this.makeRequest('getActiveInterface');
  }

  getVersion() {
    return this.makeRequest('version');
  }

  getContainers() {
    return this.makeRequest('getContainers');
  }

  inspectCurrentContainer() {
    return this.makeRequest('inspectCurrentContainer');
  }

  connectToNetwork(networkId) {
    return this.makeRequest(`connect/${networkId}`);
  }

  disconnectFromNetwok(networkId) {
    return this.makeRequest(`disconnect/${networkId}`);
  }

  disconnectFromAllNetworks() {
    return this.makeRequest('disconnectFromAllNetworks');
  }

  createNetwork(networkName) {
    networkName = networkName || 'random-' + (new Date()).toISOString();
    return this.makeRequest(`createNetwork/${networkName}`);
  }

  resetNetwork() {
    return this.makeRequest('resetNetwork');
  }

  getAllNetworks() {
    return this.makeRequest('getAllNetworks');
  }

  getCurrentNetworks() {
    return this.makeRequest('getCurrentNetworks');
  }

  makeRequest(api, postdata) {
    const url = this._serverUrl + api;
    const thisRequest = this._requestId++;
    return new Promise((resolve, reject) => {
      let clientRequest = http.request(url, (res) => {
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
}

// To quick test the implementation
// load this file interactively with the server url.
if (module.parent === null) {
  console.log("DockerProxy loaded interactively");
  if (process.argv.length !== 3) {
    console.log('Usage: node dockerProxyClient.js <serverurl>');
    console.log('       where serverUrl is where dockerProxyServer is running');
    console.log('       Example: node dockerProxyClient.js http://localhost:3032/');
    return;
  }
  const client = new DockerProxyClient(process.argv[2]);
  const promises = [
    'isDocker',
    'getVersion',
    'getAllNetworks',
    'getCurrentNetworks',
    'getContainers',
    'getActiveInterface',
    'getCurrentContainerId',
    'createNetwork',
    'inspectCurrentContainer',
    'resetNetwork',
  ].map(func => {
    return client[func]({}).then(( result ) => {
      console.info(`${func} returned:`, JSON.stringify(result, null, 4));
    }).catch((err) => {
      console.error(`${func} failed with:`, err);
    });
  });

  Promise.all(promises).then(() => {
    console.log("done with all client calls.");
  });
}

module.exports = DockerProxyClient;

