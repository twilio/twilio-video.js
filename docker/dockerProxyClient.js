/* eslint-disable no-console */
'use strict';

const DOCKER_PROXY_SERVER_URL = 'http://localhost:3032/';
let requestNumber = 0;
/**
 * Provides interface to communicate with docker via DockerProxyServer
 * via {@link DockerProxyServer}
*/
class DockerProxyClient {
  /**
   * Construct a new {@link DockerProxyClient}.
   * @param {string} serverUrl - url pointing to an instance of {@link DockerProxyServer}
   */
  constructor(serverUrl) {
    this._serverUrl = serverUrl || DOCKER_PROXY_SERVER_URL;
  }

  /**
   * @returns {Promise<boolean>} - Resolves to true if caller is running inside docker instance.
   *   resolves to false if not running inside docker, or if it failed to connect to DockerProxyServer
   */
  async isDocker() {
    try {
      const isDockerResp = await this._makeRequest('isDocker');
      return isDockerResp.isDocker;
    } catch (err) {
      console.error('isDocker call failed..is DockerProxyServer running? ', err);
      return false;
    }
  }

  /**
   * Block the given IP ranges.
   * @param {Array<string>} ipRanges - ex: ['1.2.3.4-1.2.3.8', '15.16.17.18-15.17.0.0']
   * @param {Array<string>} [protocols=['tcp', 'udp']]
   * @returns {Promise<void>}
   */
  blockIpRanges(ipRanges, protocols = ['tcp', 'udp']) {
    return this._makeRequest([
      'blockIpRanges',
      protocols.join(','),
      ipRanges.join(',')
    ].map(encodeURIComponent).join('/'));
  }

  /**
   * Unblock the given IP ranges.
   * @param {Array<string>} ipRanges - ex: ['1.2.3.4-1.2.3.8', '15.16.17.18-15.17.0.0']
   * @param {Array<string>} [protocols=['tcp', 'udp']]
   * @returns {Promise<void>}
   */
  unblockIpRanges(ipRanges, protocols = ['tcp', 'udp']) {
    return this._makeRequest([
      'unblockIpRanges',
      protocols.join(','),
      ipRanges.join(',')
    ].map(encodeURIComponent).join('/'));
  }

  /**
   * @returns {Promise<{containerId: string}>} - Resolves to object containing containerId.
   */
  getCurrentContainerId() {
    return this._makeRequest('getCurrentContainerId');
  }

  /**
   * @returns {Promise<{activeInterface: string}>} - Resolves to object containing activeInterface.
   */
  getActiveInterface() {
    return this._makeRequest('getActiveInterface');
  }

  /**
   * @returns {Promise<{version: string}>} - Resolves to object containing version of the {@link DockerProxyServer}.
   */
  getVersion() {
    return this._makeRequest('version');
  }

  /**
   * @returns {Promise<[{Id: string}]>} - Resolves to an array of container objects.
   */
  getContainers() {
    return this._makeRequest('getContainers');
  }

  /**
   * @returns {Promise<void>} - Resolves to an object containing properties of
   *     container that caller is running inside.
   */
  inspectCurrentContainer() {
    return this._makeRequest('inspectCurrentContainer');
  }

  /**
   * @returns {Promise<void>} - Resolves after connecting to given network
   * @param {string} networkId - identifies network to be connected.
   */
  connectToNetwork(networkId) {
    return this._makeRequest(`connect/${networkId}`);
  }

  /**
   * @returns {Promise<void>} - Resolves after disconnecting to given network
   * @param {string} networkId - identifies network to be disconnected from.
   */
  disconnectFromNetwork(networkId) {
    return this._makeRequest(`disconnect/${networkId}`);
  }

  /**
   * @returns {Promise<void>} - Resolves after disconnecting from all networks
   *   that current container is connected to
   */
  disconnectFromAllNetworks() {
    return this._makeRequest('disconnectFromAllNetworks');
  }

  /**
   * @returns {Promise<{Id: string}>} - Resolves after creating a network.
   *  returns object containing `Id` for the newly created network. This `Id` can later be used to connect/disconnect
   *  to/from the netowrk.
   * @param {string} networkName - name of the network to be created. if not provided a random name is generated.
   */
  createNetwork(networkName) {
    networkName = networkName || 'random-' + (new Date()).toISOString();
    return this._makeRequest(`createNetwork/${networkName}`);
  }

  /**
   * @returns {Promise<void>} - disconnects from all networks and reconnects to default (original) networks
   *  also deletes any network created by the instance of the {@link DockerProxyServer}.
   */
  resetNetwork() {
    return this._makeRequest('resetNetwork');
  }

  /**
   * @returns {Promise<[{Id: string, Name: string}]>} - returns an array of all docker networks.
   */
  getAllNetworks() {
    return this._makeRequest('getAllNetworks');
  }

  /**
   * @returns {Promise<[{Id: string, Name: string}]>} - returns an array of docker networks that current container is connected to
   */
  getCurrentNetworks() {
    return this._makeRequest('getCurrentNetworks');
  }

  async _makeRequest(api) {
    const thisRequestNumber = requestNumber++;
    const logPrefix = `DockerProxyClient [${thisRequestNumber}]: `;
    try {
      console.log(logPrefix + 'Requesting: ', api);
      const res = await fetch(this._serverUrl + api);
      const text = await res.text();
      const json = text ? JSON.parse(text) : {};
      console.log(logPrefix + 'Done: ', api, json);
      return json;
    } catch (err) {
      console.error(logPrefix + 'Threw  : ', err);
      throw err;
    }
  }
}

module.exports = DockerProxyClient;

