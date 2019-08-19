/* eslint-disable no-invalid-this */
/* eslint-disable no-else-return */
/* eslint-disable no-console */
'use strict';

const DockerProxyClient = require('../../../docker/dockerProxyClient');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const {
  connect,
} = require('../../../lib');

const {
  randomName, waitToGoOnline, waitToGoOffline
} = require('../../lib/util');


describe('NetworkHandoff', function() {
  // eslint-disable-next-line no-invalid-this
  const minute = 1 * 60 * 1000;
  // eslint-disable-next-line no-invalid-this
  this.timeout(5 * minute);

  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(async () => {
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  beforeEach(async function() {
    if (!isRunningInsideDocker) {
      // eslint-disable-next-line no-invalid-this
      // if not running inside docker skip the test.
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

  it('on network disconnect room emits a disconnected message', async () => {
    await waitToGoOnline();

    const options = Object.assign({ name: randomName() }, defaults);
    const thisRoom = await connect(getToken(randomName()), options);
    thisRoom.on('disconnected', () => console.log('room received disconnected'));
    thisRoom.on('reconnecting', () => console.log('room received reconnecting'));
    thisRoom.on('reconnected', () => console.log('room received reconnected'));

    const disconnectPromise = new Promise(resolve => thisRoom.once('disconnected', resolve));
    const reconnectingPromise = new Promise(resolve => thisRoom.once('reconnecting', resolve));

    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    // should fire reconnecting.
    await reconnectingPromise;

    // but end up disconnected eventually.
    await disconnectPromise;
  });

  it('on network switch reconnects and emits reconnecting followed by reconnected', async () => {
    await waitToGoOnline();

    const options = Object.assign({ name: randomName() }, defaults);
    const thisRoom = await connect(getToken(randomName()), options);
    thisRoom.on('disconnected', () => console.log('room received disconnected'));
    thisRoom.on('reconnecting', () => console.log('room received reconnecting'));
    thisRoom.on('reconnected', () => console.log('room received reconnected'));

    const reconnectPromise = new Promise(resolve => thisRoom.once('reconnected', resolve));
    const reconnectingPromise = new Promise(resolve => thisRoom.once('reconnecting', resolve));

    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    // create and connect to new network
    const newNetwork = await dockerAPI.createNetwork();
    await dockerAPI.connectToNetwork(newNetwork.Id);
    await waitToGoOnline();

    await reconnectingPromise;
    await reconnectPromise;
  });
});
