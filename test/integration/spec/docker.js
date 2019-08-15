/* eslint-disable no-else-return */
/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const DockerProxyClient = require('../../../docker/DockerProxyClient');

// wait to go online or offline.
// param: online - if true waits to go online, if false waits to go offline.
let callNumber = 0;
function waitToGoOnline(online) {
  const thisCallNumber = callNumber++;
  const onlineOrOffline = online ? 'online' : 'offline';
  console.log(`${thisCallNumber}]: Waiting for network to go: ${onlineOrOffline}`);
  return Promise.resolve().then(() => {
    if (window.navigator.onLine !== online) {
      return new Promise((resolve) => {
        setTimeout(function _waitforIt() {
          console.log('window.navigator.onLine =  ', window.navigator.onLine);
          if (window.navigator.onLine === online) {
            resolve();
          }
          setTimeout(_waitforIt, 100);
        }, 100);
        window.addEventListener(onlineOrOffline, () => {
          console.log(`${thisCallNumber}]: Done, went ${onlineOrOffline}`);
          resolve();
        }, { once: true });
      });
    } else {
      console.log(`${thisCallNumber}]: Done, already ${onlineOrOffline}`);
      // eslint-disable-next-line consistent-return
      return;
    }
  });
}

describe('docker tests', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(async function () {
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  beforeEach(async function () {
    if (!isRunningInsideDocker) {
      // eslint-disable-next-line no-invalid-this
      // all tests in this file are for running inside docker.
      // if we are not then skip them.
      this.skip();
    } else {
      await dockerAPI.resetNetwork();
    }
  });

  afterEach(async function () {
    if (isRunningInsideDocker) {
      // reset to original network settings.
      await dockerAPI.resetNetwork();
    }
  });

  it('can return container id', async () => {
    const resultPromise = dockerAPI.getCurrentContainerId();
    const response = await resultPromise;
    assert(typeof response.containerId === 'string' );
    assert(response.containerId.length > 5 );
  });

  it('can return active interface', async () => {
    const resultPromise = dockerAPI.getActiveInterface();
    const response = await resultPromise;
    assert(typeof response.activeInterface === 'string' );
    assert(response.activeInterface.length > 0);
  });

  it('can enumerate containers', async () => {
    const containers = await dockerAPI.getContainers();
    assert(containers.length > 0);

    const idObj = await dockerAPI.getCurrentContainerId();

    const thisContainer = containers.find(container => container.Id === idObj.containerId);
    assert(thisContainer);
  });

  it('can inspectCurrentContainer', async () => {
    const idObj = await dockerAPI.getCurrentContainerId();
    const currentContainer = await dockerAPI.inspectCurrentContainer();

    assert.equal(currentContainer.Id, idObj.containerId);
    assert.equal(currentContainer.State.Status, 'running');
  });

  it('can create network and connect to it', async () => {
    await waitToGoOnline(true /* online */);

    const newNetwork = await dockerAPI.createNetwork();
    await dockerAPI.disconnectFromAllNetworks();

    await waitToGoOnline(false /* offline */);

    await dockerAPI.connectToNetwork(newNetwork.Id);
    await waitToGoOnline(true /* online */);
  });

  it('can disconnect and reconnect from networks', async () => {
    await waitToGoOnline(true /* online */);


    const containers = await dockerAPI.getContainers();
    assert(containers.length > 0);

    const idObj = await dockerAPI.getCurrentContainerId();

    const thisContainer = containers.find(container => container.Id === idObj.containerId);
    const networks = Object.keys(thisContainer.NetworkSettings.Networks);
    const networkIds = networks.map((network) => thisContainer.NetworkSettings.Networks[network].NetworkID);
    const disconnectPromises = [];
    networkIds.forEach((networkId) => {
      disconnectPromises.push(dockerAPI.disconnectFromNetwok(networkId));
    });
    await Promise.all(disconnectPromises);

    await waitToGoOnline(false /* offline */);

    const activeInterfaceAfterDisconnect = await dockerAPI.getActiveInterface();
    assert(!activeInterfaceAfterDisconnect.activeInterface);

    // reconnect to networks.
    const reconnectPromises = [];
    networkIds.forEach((networkId) => {
      reconnectPromises.push(dockerAPI.connectToNetwork(networkId));
    });

    await Promise.all(reconnectPromises);

    const activeInterfaceAfterReconnect = await  dockerAPI.getActiveInterface();
    assert(activeInterfaceAfterReconnect.activeInterface.length > 0);

    await waitToGoOnline(true /* online */);
  });

  it('during network handoff receives a reconnecting message', () => {
    // bob joins a room
    // alice joins a room

    // network disconnects

    // another network connects.

    // expect reconnecting event.
  })
});
