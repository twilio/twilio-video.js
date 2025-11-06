'use strict';

const assert = require('assert');
const DockerProxyClient = require('../../../../docker/dockerProxyClient');

const {
  waitToGoOnline, waitToGoOffline, waitFor
} = require('../../../lib/util');


async function testNetwork() {
  await fetch('http://www.google.com', { mode: 'no-cors' });
}

function readCurrentNetworks(dockerAPI) {
  return waitFor(dockerAPI.getCurrentNetworks(), 'getCurrentNetworks');
}

describe('dockerProxy', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);

  let dockerAPI = null;
  let isRunningInsideDocker = false;

  before(async () => {
    dockerAPI = new DockerProxyClient();
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  it('can fetch from network', async () => {
    await testNetwork();
  });

  it('DockerProxyClient can determine if running inside docker', () => {
    // We skip docker dependent tests when not running inside docker.
    // this test is included mainly to ensure that not all tests in this file
    // are skipped. karma returns failures if all tests in a file were skipped :)
    assert.equal(typeof isRunningInsideDocker, 'boolean');
  });

  describe('docker dependent APIs', () => {
    beforeEach(async function() {
      if (!isRunningInsideDocker) {
        // if not running inside docker skip the test.
        // eslint-disable-next-line no-invalid-this
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
      const response = await dockerAPI.getCurrentContainerId();
      assert(typeof response.containerId === 'string');
      assert(response.containerId.length > 5);
    });

    it('getActiveInterface: returns active interface', async () => {
      const response = await dockerAPI.getActiveInterface();
      assert(typeof response.activeInterface === 'string');
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
        assert(Id.length > 0);

        assert.equal(typeof Name, 'string');
        assert(Name.length > 0);
      });
    });

    it('getCurrentNetworks: enumerates networks container is connected to', async () => {
      const networks = await dockerAPI.getCurrentNetworks();
      assert(networks.length > 0);
      networks.forEach(({ Id, Name }) => {
        assert.equal(typeof Id, 'string');
        assert(Id.length > 0);

        assert.equal(typeof Name, 'string');
        assert(Name.length > 0);
      });
    });

    it('disconnectFromAllNetworks: disconnects from all networks', async () => {
      await waitToGoOnline();
      await testNetwork();
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
      await waitToGoOnline();
      await dockerAPI.disconnectFromAllNetworks();
      await waitToGoOffline();

      const newNetwork = await dockerAPI.createNetwork();
      await dockerAPI.connectToNetwork(newNetwork.Id);
      await waitToGoOnline();

      const currentNetworks = await dockerAPI.getCurrentNetworks();
      assert.equal(currentNetworks.length, 1);
      assert.equal(currentNetworks[0].Id, newNetwork.Id);
    });

    it('resetNetwork: can cleanup networks created', async () => {
      const newNetwork = await dockerAPI.createNetwork();

      let networks = await dockerAPI.getAllNetworks();
      let found = networks.find(network => network.Id === newNetwork.Id);
      assert(found.Name.length > 0);

      await dockerAPI.resetNetwork();

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
      await waitToGoOnline();
    });

    describe('can simulate network changes', () => {
      it('Scenario 1 (jump): connected interface switches off and then a new interface switches on', async () => {
        const currentNetworks = await readCurrentNetworks(dockerAPI);
        const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');

        await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from networks');
        await waitToGoOffline();

        await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');
        await waitToGoOnline();
      });

      it('Scenario 2 (step) : new interface switches on and then the connected interface switches off', async () => {
        const currentNetworks = await readCurrentNetworks(dockerAPI);
        const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');
        await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');

        await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from networks');
        await waitToGoOnline();
      });
    });
  });
});
