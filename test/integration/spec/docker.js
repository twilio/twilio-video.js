'use strict';

const assert = require('assert');
const DockerProxyClient = require('../../../docker/DockerProxyClient');

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

  it('can disconnect and reconnect from networks', async () => {
    const containers = await dockerAPI.getContainers();
    assert(containers.length > 0);

    const idObj = await dockerAPI.getCurrentContainerId();

    const thisContainer = containers.find(container => container.Id === idObj.containerId);
    const networks = Object.keys(thisContainer.NetworkSettings.Networks);
    const networkIds = networks.map((network) => thisContainer.NetworkSettings.Networks[network].NetworkID)
    const disconnectPromises = [];
    const containerId = thisContainer.Id;
    networkIds.forEach((networkId) => {
      console.log('disconnecting network:', networkId);
      disconnectPromises.push(dockerAPI.disconnectFromNetwok({ networkId, containerId }));
    });
    await Promise.all(disconnectPromises);

    const activeInterfaceAfterDisconnect = await dockerAPI.getActiveInterface();
    console.log('active interface after disconnect = ', activeInterfaceAfterDisconnect.activeInterface);
    assert(!activeInterfaceAfterDisconnect.activeInterface);

    // reconnect to networks.
    const reconnectPromises = [];
    networkIds.forEach((networkId) => {
      console.log('reconnecting network:', networkId);
      reconnectPromises.push(dockerAPI.connectToNetwork({ networkId, containerId }));
    });

    await Promise.all(reconnectPromises);

    const activeInterfaceAfterReconnect = await  dockerAPI.getActiveInterface();
    console.log('active interface after reconnect = ', activeInterfaceAfterReconnect.activeInterface);
    assert(activeInterfaceAfterReconnect.activeInterface.length > 0);
  });
});
