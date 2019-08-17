/* eslint-disable no-else-return */
/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const DockerProxyClient = require('../../../docker/dockerProxyClient');

// wait to go online or offline.
// param: onlineOrOffline (string) 'online|offline'
let callNumber = 0;
function waitToGo(onlineOrOffline) {
  const thisCallNumber = callNumber++;
  const wantonline = onlineOrOffline === 'online';
  return Promise.resolve().then(() => {
    if (window.navigator.onLine !== wantonline) {
      return new Promise((resolve) => {
        console.log(`${thisCallNumber}]: Waiting for network to go: ${onlineOrOffline}`);
        window.addEventListener(onlineOrOffline, () => {
          console.log(`${thisCallNumber}]: Done, now ${onlineOrOffline}`);
          resolve();
        }, { once: true });
      });
    }
  });
}

function waitToGoOnline() {
  return waitToGo('online');
}

function waitToGoOffline() {
  return waitToGo('offline');
}

describe('dockerProxy', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(async () => {
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

  afterEach(async () => {
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

  it('can disconnect from networks', async () => {
    await waitToGoOnline();
    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();
  });

  it('can inspectCurrentContainer', async () => {
    const idObj = await dockerAPI.getCurrentContainerId();
    const currentContainer = await dockerAPI.inspectCurrentContainer();

    assert.equal(currentContainer.Id, idObj.containerId);
    assert.equal(currentContainer.State.Status, 'running');
  });

  it('can create new network and connect to it', async () => {
    const newNetwork = await dockerAPI.createNetwork();

    await waitToGoOnline();
    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    await dockerAPI.connectToNetwork(newNetwork.Id);
    await waitToGoOnline();
  });

  it('can disconnect and reconnect from networks', async () => {
    await waitToGoOnline();
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

    await waitToGoOffline();

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

    await waitToGoOnline();
  });

  it('during network handoff receives a reconnecting message', () => {
    thisRoom = await connect(getToken(randomName()), Object.assign({ tracks: thisTracks }, options, { networkQuality: nqConfig }));
    // bob joins a room
    // alice joins a room

    // network disconnects

    // another network connects.

    // expect reconnecting event.
  });
});
