/* eslint-disable no-console */
'use strict';

const http = require('http');
const defaultServerUrl = 'http://localhost:3032/';

/**
 * Provides interface to communicate with docker
 * via {@link DockerProxyServer}
*/
class DockerProxyClient {
  /**
   * Construct a new {@link DockerProxyClient}.
   * @param {string} serverUrl - url pointing to an instance of {@link DockerProxyServer}
   */
  constructor(serverUrl) {
    this._requestId = 200;
    this._serverUrl = serverUrl || defaultServerUrl;
  }

  /**
   * @returns {Promise<boolean>} promise that resolves to true if caller is running inside docker instance.
   */
  async isDocker() {
    try {
      const isDockerResp = await this._makeRequest('isDocker');
      return isDockerResp.isDocker;
    }
    catch (err) {
      console.error('isDocker call failed..is DockerProxyServer running? ', err);
      return false;
    }
  }

  /**
   * @returns {Promise<{containerId: string}>} - Promise that resolves to object containing containerId.
   */
  getCurrentContainerId() {
    return this._makeRequest('getCurrentContainerId');
  }

  /**
   * @returns {Promise<{activeInterface: string}>} - Promise that resolves to object containing activeInterface.
   */
  getActiveInterface() {
    return this._makeRequest('getActiveInterface');
  }

  /**
   * @returns {Promise<{version: string}>} - Promise that resolves to object containing containerId.
   */
  getVersion() {
    return this._makeRequest('version');
  }

  /**
   * @returns {Promise<[{Id: string}]>} - Promise that resolves to an array of active currently container objects.
   */
  getContainers() {
    return this._makeRequest('getContainers');
  }

  /**
   * @returns {Promise<void>} - Promise that resolves to an object containing properties of
   *     container that caller is running inside.
   */
  inspectCurrentContainer() {
    return this._makeRequest('inspectCurrentContainer');
  }

  /**
   * @returns {Promise<void>} - Promise that resolves after connecting to given network
   * @param {string} networkId - identifies network to be connected.
   */
  connectToNetwork(networkId) {
    return this._makeRequest(`connect/${networkId}`);
  }

  /**
   * @returns {Promise<void>} - Promise that resolves after disconnecting to given network
   * @param {string} networkId - identifies network to be disconnected from.
   */
  disconnectFromNetwork(networkId) {
    return this._makeRequest(`disconnect/${networkId}`);
  }

  /**
   * @returns {Promise<void>} - Promise that resolves after disconnecting from all networks
   *   that current container is connected to
   */
  disconnectFromAllNetworks() {
    return this._makeRequest('disconnectFromAllNetworks');
  }

  /**
   * @returns {Promise<{Id:string}>} - Promise that resolves after creating a network.
   *  returns object containing Id for the newly created network. This id can later be used to connect/disconnect
   *  to/from the netowrk.
   * @param {string} networkName - name of the network to be created. if not provided a random name is generated.
   */
  createNetwork(networkName) {
    networkName = networkName || 'random-' + (new Date()).toISOString();
    return this._makeRequest(`createNetwork/${networkName}`);
  }

  /**
   * @returns {Promise<void>} - disconnects for all networks,and reconnects to default (original) networks
   *  also deletes any network created by the instance.
   */
  resetNetwork() {
    return this._makeRequest('resetNetwork');
  }

  /**
   * @returns {Promise<[{Id: string, Name: string}]>} - return array of all docker networks.
   */
  getAllNetworks() {
    return this._makeRequest('getAllNetworks');
  }

  /**
   * @returns {Promise<[{Id: string, Name: string}]>} - return array of docker networks that current container is connected to
   */
  getCurrentNetworks() {
    return this._makeRequest('getCurrentNetworks');
  }

  _makeRequest(api, postdata) {
    return fetch(this._serverUrl + api)
      .then(res => res.text())
      .then(text => text ? JSON.parse(text) : {})
      .catch((err) => {
        console.error(`"fetch ${api} threw  : `, err );
        throw err;
      });
  }
}

// NOTE(mpatwardhan):To quick test the implementation
// load this file interactively with the server url.
if (module.parent === null) {
  console.log('DockerProxy loaded interactively');
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
    return client[func]({}).then(result => {
      console.info(`${func} returned:`, JSON.stringify(result, null, 4));
    }).catch((err) => {
      console.error(`${func} failed with:`, err);
    });
  });

  Promise.all(promises).then(() => {
    console.log('done with all client calls.');
  });
}

module.exports = DockerProxyClient;

