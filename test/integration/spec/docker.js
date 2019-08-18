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

  it('getCurrentContainerId: returns current container id', async () => {
    const resultPromise = dockerAPI.getCurrentContainerId();
    const response = await resultPromise;
    assert(typeof response.containerId === 'string' );
    assert(response.containerId.length > 5 );
  });

  it('getActiveInterface: returns active interface', async () => {
    const resultPromise = dockerAPI.getActiveInterface();
    const response = await resultPromise;
    assert(typeof response.activeInterface === 'string' );
    assert(response.activeInterface.length > 0);
  });

  it('getContainers: enumerates containers', async () => {
    const containers = await dockerAPI.getContainers();
    assert(containers.length > 0);

    const idObj = await dockerAPI.getCurrentContainerId();
    const thisContainer = containers.find(container => container.Id === idObj.containerId);
    assert(thisContainer);
  });

  it('getAllNetworks: enumerates all networks', async () => {
    const networks = await dockerAPI.getAllNetworks();
    assert(networks.length > 0);
    networks.forEach(({ Id, Name }) => {
      assert.equal(typeof Id, 'string');
      assert(Id.length > 0 );

      assert.equal(typeof Name, 'string');
      assert(Name.length > 0 );
    });
  });

  it('getCurrentNetworks: enumerates networks container is connected to', async () => {
    const networks = await dockerAPI.getCurrentNetworks();
    assert(networks.length > 0);
    networks.forEach(({ Id, Name }) => {
      assert.equal(typeof Id, 'string');
      assert(Id.length > 0 );

      assert.equal(typeof Name, 'string');
      assert(Name.length > 0 );
    });
  });


  it('disconnectFromAllNetworks: disconnects from all networks', async () => {
    await waitToGoOnline();

    let networks = await dockerAPI.getCurrentNetworks();
    assert(networks.length > 0);

    await dockerAPI.disconnectFromAllNetworks();
    networks = await dockerAPI.getCurrentNetworks();
    assert.equal(networks.length, 0);
    await waitToGoOffline();
  });

  it('inspectCurrentContainer: returns details of current container', async () => {
    const idObj = await dockerAPI.getCurrentContainerId();
    const currentContainer = await dockerAPI.inspectCurrentContainer();

    assert.equal(currentContainer.Id, idObj.containerId);
    assert.equal(currentContainer.State.Status, 'running');
  });

  it('createNetwork, connectToNetwork: creates new network and connect to it', async () => {
    const newNetwork = await dockerAPI.createNetwork();
    await waitToGoOnline();
    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    await dockerAPI.connectToNetwork(newNetwork.Id);
    await waitToGoOnline();

    const currentNetworks = await dockerAPI.getCurrentNetworks();
    assert.equal(currentNetworks.length, 1);
    assert.equal(currentNetworks[0].Id, newNetwork.Id);
  });

  it('resetNetwork: can cleanup networks created', async () => {
    // create a new network
    const newNetwork = await dockerAPI.createNetwork();

    // ensure that it shows up in getAllNetworks.
    let networks = await dockerAPI.getAllNetworks();
    let found = networks.find(network => network.Id === newNetwork.Id);
    assert.equal(found.name, newNetwork.name);

    // now ask dockerProxy to cleanup networks.
    await dockerAPI.resetNetwork();

    // ensure that newNetork does not show up in list anymore.
    networks = await dockerAPI.getAllNetworks();
    found = networks.find(network => network.Id === newNetwork.Id);
    assert.equal(found, undefined);
  });

  it('resetNetwork: connects back to default networks', async () => {
    const initialNetworks = await dockerAPI.getCurrentNetworks();
    assert(initialNetworks.length > 0);

    await dockerAPI.disconnectFromAllNetworks();
    const networksAfterDisconnect  = await dockerAPI.getCurrentNetworks();
    assert(networksAfterDisconnect.length === 0);
    waitToGoOffline();

    await dockerAPI.resetNetwork();
    const networksAfterReset  = await dockerAPI.getCurrentNetworks();
    assert.equal(initialNetworks.length, networksAfterReset.length);
    waitToGoOnline();
  });
});
