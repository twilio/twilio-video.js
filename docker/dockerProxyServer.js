/* eslint-disable no-console */
'use strict';

const cors = require('cors');
const isDocker = require('is-docker')();
const fetchRequest = require('./fetchRequest');

const DOCKER_PROXY_SERVER_PORT = 3032;
const DOCKER_PROXY_VERSION = 1.00;
const DOCKER_API_VERSION = '1.40';

console.log('DockerProxyServer: os.userInfo:', require('os').userInfo());

/**
 * Provides webserver interface to communicate with the docker socket.
 * Clients running in browser can load {@link DockerProxyServer}
 * to use this interface.
*/
class DockerProxyServer {
  constructor(port) {
    this._serverPort = port || DOCKER_PROXY_SERVER_PORT;
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
    this._originalNetworks = await this._getCurrentNetworks();
    const express = require('express');
    const app = express();
    app.use(cors());
    let requestNumber = 0;
    [
      { endpoint: '/version', handleRequest: '_version' },
      { endpoint: '/isDocker', handleRequest: '_isDocker' },
      { endpoint: '/blockIpRanges/:protocols/:ipRanges', handleRequest: '_blockIpRanges' },
      { endpoint: '/unblockIpRanges/:protocols/:ipRanges', handleRequest: '_unblockIpRanges' },
      { endpoint: '/getCurrentContainerId', handleRequest: '_getCurrentContainerId' },
      { endpoint: '/getContainers', handleRequest: '_getContainers' },
      { endpoint: '/getActiveInterface', handleRequest: '_getActiveInterface' },
      { endpoint: '/disconnect/:networkId', handleRequest: '_disconnectFromNetwork' },
      { endpoint: '/disconnectFromAllNetworks', handleRequest: '_disconnectFromAllNetworks' },
      { endpoint: '/connect/:networkId', handleRequest: '_connectToNetwork' },
      { endpoint: '/createNetwork/:networkName', handleRequest: '_createNetwork' },
      { endpoint: '/resetNetwork', handleRequest: '_resetNetwork' },
      { endpoint: '/inspectCurrentContainer', handleRequest: '_inspectCurrentContainer' },
      { endpoint: '/connectToDefaultNetwork', handleRequest: '_connectToDefaultNetwork' },
      { endpoint: '/getAllNetworks', handleRequest: '_getAllNetworks' },
      { endpoint: '/getCurrentNetworks', handleRequest: '_getCurrentNetworks' },
    ].forEach(({ endpoint, handleRequest }) => {
      app.get(endpoint, async ({ params }, res, next) => {
        const thisRequestNumber = requestNumber++;
        const logPrefix = `DockerProxyServer [${thisRequestNumber}]: `;
        console.log(logPrefix + 'Executing: ', endpoint, params);
        try {
          const data = await this[handleRequest](params);
          console.log(logPrefix + 'Done executing: ', endpoint, params);
          return res.send(data);
        } catch (err) {
          console.error(logPrefix + 'Error executing: ', endpoint, params);
          return next(err);
        }
      });
    });

    return new Promise((resolve, reject) => {
      this._server = app.listen(this._serverPort, () => {
        console.log(`DockerProxyServer listening on port ${this._serverPort}!`);
        resolve();
      });
      this._server.once('error', reject);
    });
  }

  _ipTables(modifier, target, protocols, ipRanges) {
    const iptableCommands = [];

    ipRanges.forEach(ipRange =>
      [['INPUT', 'src'], ['OUTPUT', 'dst']].forEach(([chain, direction]) =>
        protocols.forEach(protocol =>
          iptableCommands.push(
            'sudo iptables'
            + ` --${modifier} ${chain}`
            + ` --protocol ${protocol}`
            + ' --match iprange'
            + ` --${direction}-range ${ipRange}`
            + ` --jump ${target}`
          )
        )));

    return this._runCommand(iptableCommands.join(' && '));
  }

  // block the given IP address ranges
  _blockIpRanges({ ipRanges, protocols }) {
    return this._ipTables(
      'append',
      'DROP',
      protocols.split(','),
      ipRanges.split(','));
  }

  // unblock the given IP address ranges
  _unblockIpRanges({ ipRanges, protocols }) {
    return this._ipTables(
      'delete',
      'DROP',
      protocols.split(','),
      ipRanges.split(','));
  }

  // resets network to default state
  async _resetNetwork() {
    try {
      await this._disconnectFromAllNetworks();
      await this._connectToDefaultNetwork();
      await this._pruneNetworks();
    } catch (err) {
      console.error('Error in _resetNetwork:', err);
    }
  }

  // removes all unused networks (created by this instance)
  _pruneNetworks() {
    const filters = encodeURIComponent(JSON.stringify({
      label: { [this._instanceLabel]: true }
    }));
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/networks/prune?filters=${filters}`,
      method: 'POST',
    });
  }

  async _getCurrentContainerId() {
    if (!this._containerId) {
      const cmd = 'cat /proc/self/cgroup | grep "pids:/" | sed \'s/\\([0-9]*\\):pids:\\/docker\\///g\'';
      const output = await this._runCommand(cmd);
      const containerId = output.replace('\n', '');
      this._containerId = containerId;
      return { containerId };
    }
    return Promise.resolve({ containerId: this._containerId });

  }

  async _getActiveInterface() {
    const cmd = 'ip route show default | grep default | awk {\'print $5\'}';
    const output = await this._runCommand(cmd);
    const activeInterface = output.replace('\n', '');
    return { activeInterface };
  }

  _getContainers() {
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/containers/json`,
      method: 'GET',
    });
  }

  async _inspectCurrentContainer() {
    const { containerId } = await this._getCurrentContainerId();
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/containers/${containerId}/json`,
      method: 'GET',
    });
  }

  _connectToDefaultNetwork() {
    const connectPromises = this._originalNetworks.map(({ Id }) => this._connectToNetwork({ networkId: Id }));
    return Promise.all(connectPromises);
  }

  _getAllNetworks() {
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/networks`,
      method: 'GET',
    });
  }

  async _connectToNetwork({ networkId }) {
    const { containerId } = await this._getCurrentContainerId();
    return this._internalConnectToNetwork({ networkId, containerId });
  }

  // returns Promise<[{ Name, Id }]>
  async _getCurrentNetworks() {
    const currentContainer = await this._inspectCurrentContainer();
    const networkNames = Object.keys(currentContainer.NetworkSettings.Networks);
    return networkNames.map(networkName => {
      return {
        Name: networkName,
        Id: currentContainer.NetworkSettings.Networks[networkName].NetworkID
      };
    });
  }

  async _disconnectFromAllNetworks() {
    const networks = await this._getCurrentNetworks();
    const disconnectPromises = networks.map(({ Id }) => this._disconnectFromNetwork({ networkId: Id }));
    return Promise.all(disconnectPromises);
  }

  async _disconnectFromNetwork({ networkId }) {
    const { containerId } = await this._getCurrentContainerId();
    return this._internalDisconnectFromNetwork({ networkId, containerId });
  }

  _createNetwork({ networkName }) {
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
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/networks/create`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  _isDocker() {
    return Promise.resolve({ isDocker });
  }

  _version() {
    return Promise.resolve({ version: DOCKER_PROXY_VERSION });
  }

  _internalConnectToNetwork({ networkId, containerId }) {
    const postData = JSON.stringify({
      'Container': containerId,
    });

    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/networks/${networkId}/connect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  _internalDisconnectFromNetwork({ networkId, containerId }) {
    const postData = JSON.stringify({
      'Container': containerId,
      'Force': false
    });
    return fetchRequest({
      socketPath: '/var/run/docker.sock',
      path: `/v${DOCKER_API_VERSION}/networks/${networkId}/disconnect`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    }, postData);
  }

  async _runCommand(cmd) {
    await Promise.resolve();
    const { execSync } = require('child_process');
    const output = execSync(cmd);
    return output.toString();
  }
}

module.exports = DockerProxyServer;

