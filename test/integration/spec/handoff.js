/* eslint-disable no-else-return */
/* eslint-disable no-console */
'use strict';

const assert = require('assert');
const DockerProxyClient = require('../../../docker/dockerProxyClient');

const { createRoom, completeRoom } = require('../../lib/rest');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const {
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('../../../lib');

const {
  capitalize,
  combinationContext,
  participantsConnected,
  randomName,
  tracksSubscribed,
  tracksPublished,
  tracksUnpublished,
  trackStarted,
  waitForTracks
} = require('../../lib/util');



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

describe('NetworkHandoff', function() {
  // eslint-disable-next-line no-invalid-this
  const minute = 1 * 60 * 1000;
  this.timeout(5 * minute);

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
    await waitToGoOnline();
    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    const newNetwork = await dockerAPI.createNetwork();
    await dockerAPI.connectToNetwork(newNetwork.Id);
    await waitToGoOnline();
  });

  it('on network disconnect room emits a disconnected message', async () => {
    await waitToGoOnline();

    const options = Object.assign({ name: randomName() }, defaults);
    const thisRoom = await connect(getToken(randomName()), options);
    thisRoom.once('disconnected', () => console.log("makarand received disconnected"));
    thisRoom.once('reconnecting', () => console.log("makarand received reconnecting"));
    thisRoom.once('reconnected', () => console.log("makarand received reconnected"));

    const disconnectPromise = new Promise(resolve => thisRoom.once('disconnected', resolve));
    const reconnectingPromise = new Promise(resolve => thisRoom.once('reconnecting', resolve));

    await dockerAPI.disconnectFromAllNetworks();
    await waitToGoOffline();

    // should fire reconnecting.
    await reconnectingPromise;

    // but end up disconnected eventually.
    await disconnectPromise;
  });

  it('on network switch reconnects', async () => {
    await waitToGoOnline();

    const options = Object.assign({ name: randomName() }, defaults);
    const thisRoom = await connect(getToken(randomName()), options);
    thisRoom.once('disconnected', () => console.log("makarand received disconnected"));
    thisRoom.once('reconnecting', () => console.log("makarand received reconnecting"));
    thisRoom.once('reconnected', () => console.log("makarand received reconnected"));

    const disconnectPromise = new Promise(resolve => thisRoom.once('disconnected', resolve));
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
    await disconnectPromise;
  });
});
