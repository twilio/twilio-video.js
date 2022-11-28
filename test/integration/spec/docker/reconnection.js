/* eslint-disable no-invalid-this */
/* eslint-disable no-console */
'use strict';

const assert = require('assert');

const defaults = require('../../../lib/defaults');
const { isFirefox } = require('../../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  getRegionalizedIceServers,
  randomName,
  validateMediaFlow,
  waitForMediaFlow,
  waitToGoOffline,
  waitToGoOnline,
  smallVideoConstraints,
  waitFor,
  waitOnceForRoomEvent
} = require('../../../lib/util');

const DockerProxyClient = require('../../../../docker/dockerProxyClient');
const { connect } = require('../../../../es5');
const { flatMap } = require('../../../../es5/util');

const {
  SignalingConnectionError,
  MediaConnectionError,
  SignalingConnectionDisconnectedError
} = require('../../../../es5/util/twilio-video-errors');

const ONE_MINUTE = 60 * 1000;
const VALIDATE_MEDIA_FLOW_TIMEOUT = ONE_MINUTE;
const RECONNECTING_TIMEOUT = 5 * ONE_MINUTE;
const RECONNECTED_TIMEOUT = 5 * ONE_MINUTE;
const DISCONNECTED_TIMEOUT = 10 * ONE_MINUTE;
const RESET_NETWORK_TIMEOUT = 4 * ONE_MINUTE;

const DOCKER_PROXY_TURN_REGIONS = ['au1', 'us1', 'us2'];
const DOCKER_PROXY_TURN_IP_RANGES = {
  au1: [
    '54.66.191.192-54.66.191.223'
  ],
  us1: [
    '54.172.63.130-54.172.63.189'
  ],
  ie1: [
    '34.245.252.62',
    '108.128.209.209',
    '34.246.65.40',
    '34.251.149.213'
  ]
  // au1: [
  //   '13.210.2.128-13.210.2.159',
  //   '54.252.254.64-54.252.254.127'
  // ],
  // us1: [
  //   '34.203.254.0-34.203.254.255',
  //   '54.172.60.0-54.172.61.255',
  //   '34.203.250.0-34.203.251.255'
  // ],
  // us2: [
  //   '34.216.110.128-34.216.110.159',
  //   '54.244.51.0-54.244.51.255'
  // ]
};

// similar to waitFor, but takes an extra disconnectPromise as 1st argument
// if disconnectPromise resolves before promiseOrArray the function rejects.
// this helps in fail fast - Typical use would be do not wait for reconnect promises,
// if room is already disconnected.
function waitWhileNotDisconnected(disconnectPromise, promiseOrArray, message, timeoutMS, verbose = false) {
  var realPromise = waitFor(promiseOrArray, message, timeoutMS, verbose);
  return Promise.race([realPromise, disconnectPromise.then(() => {
    throw new Error(`disconnected while: ${message}`);
  })]);
}

// Resolves when room received n track started events.
function waitForTracksToStart(room, n) {
  return n <= 0 ? Promise.resolve() : new Promise(resolve => {
    room.on('trackStarted', function trackStarted() {
      if (--n <= 0) {
        room.removeListener('trackStarted', trackStarted);
        resolve();
      }
    });
  });
}

/**
 * Set up a Room for the given number of people.
 * @param {Array<{identity: string, options?: object, region?: string}>} setupOptions
 * @returns {Promise<Room[]>}
 */
async function setup(setupOptions) {
  const name = randomName();
  const sid = await waitFor(createRoom(name, defaults.topology), `${name}: created Room`);
  return waitFor(setupOptions.map(async ({ identity, options = {}, region = null }) => {
    options = Object.assign({
      audio: true,
      fake: true,
      name: sid,
      logLevel: 'debug',
      video: smallVideoConstraints
    }, options, defaults);

    const token = getToken(identity);

    if (region) {
      options.iceTransportPolicy = 'relay';
      options.region = region;
    }

    const room = await waitFor(connect(token, options), `${sid}: ${identity} connected`);

    const { iceTransportPolicy, iceServers } = options;
    const shouldWaitForTracksStarted = iceTransportPolicy !== 'relay'
      || !Array.isArray(iceServers)
      || iceServers.length > 0;

    const nTracks = (setupOptions.length - 1) * 2;
    if (shouldWaitForTracksStarted) {
      await waitFor(waitForTracksToStart(room, nTracks), `${sid}: ${nTracks} Tracks started`);
    }
    return room;
  }), `Rooms to get connected, and Tracks to be started: ${sid}`, 3 * ONE_MINUTE);
}


// reads and prints list of current networks.
// returns currentNetworks array.
function readCurrentNetworks(dockerAPI) {
  return waitFor(dockerAPI.getCurrentNetworks(), 'getCurrentNetworks');
}

describe('VIDEO-8315: IceConnectionMonitor Test', function() {
  // alice joins the room with audio video tracks
  // network interrupts for 10 seconds, and then restores.
  // alice validates media flow.
  this.timeout(8 * ONE_MINUTE);
  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(this.title, async function() {
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  this.beforeEach(function() {
    if (!isRunningInsideDocker || isFirefox || defaults.topology === 'peer-to-peer') {
      this.skip();
    }
  });
  this.afterEach(async function() {
    await waitFor(dockerAPI.resetNetwork(), 'reset network after each', RESET_NETWORK_TIMEOUT);
  });

  it('media connection restores even when participant is not subscribed to media', async () => {
    await waitFor(dockerAPI.resetNetwork(), 'reset network', RESET_NETWORK_TIMEOUT);
    await waitToGoOnline();
    let currentNetworks = await readCurrentNetworks(dockerAPI);
    const sid = await createRoom(name, defaults.topology);
    const options = Object.assign({
      audio: true,
      fake: true,
      name: sid,
      video: smallVideoConstraints
    }, defaults);

    const room = await connect(getToken('Alice'), options);
    await waitForMediaFlow(room, true);

    // disconnect network
    await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), `disconnect from all networks: ${room.sid}`);
    await waitToGoOffline();

    // wait for media flow to stop
    await waitForMediaFlow(room, false);

    // re-attach network
    await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.connectToNetwork(networkId)), `reconnect to original networks: ${room.sid}`);
    await readCurrentNetworks(dockerAPI);
    await waitToGoOnline();

    // wait upto a minute for media flow to begin again.
    await waitForMediaFlow(room, true, 60000);
  });
});

describe('network:', function() {
  this.retries(2);
  this.timeout(8 * ONE_MINUTE);
  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(this.title, async function() {
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  this.beforeEach(function() {
    if (!isRunningInsideDocker) {
      this.skip();
    }
  });

  it('connect rejects when network is down', async () => {
    await waitFor(dockerAPI.resetNetwork(), 'reset network', RESET_NETWORK_TIMEOUT);
    await waitToGoOnline();
    let currentNetworks = await readCurrentNetworks(dockerAPI);
    const sid = await createRoom(name, defaults.topology);
    const options = Object.assign({
      audio: true,
      fake: true,
      name: sid,
      video: smallVideoConstraints
    }, defaults);

    await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from all networks');
    await waitToGoOffline();

    const start = new Date();
    let room = null;
    try {
      room = await connect(getToken('Alice'), options);
    } catch (error) {
      // this exception is expected.
      const end = new Date();
      const seconds = (end.getTime() - start.getTime()) / 1000;
      console.log(error.message, error.stack, error);
      assert(error instanceof SignalingConnectionError || error instanceof MediaConnectionError);
      console.log(`Connect rejected after ${seconds} seconds:`, error.message);
      return;
    } finally {
      console.log('resetting network');
      await waitFor(dockerAPI.resetNetwork(), 'resetting network', RESET_NETWORK_TIMEOUT);
    }
    throw new Error(`Unexpectedly succeeded joining a room: ${room.sid}`);
  });

  describe('turn region blocking tests (@unstable: JSDK-2810)', () => {
    let rooms;
    let disconnected;

    before(this.title, async function() {
      if (!isRunningInsideDocker) {
        this.skip();
      }
      rooms = await setup(['Alice', 'Bob', 'Charlie'].map((identity, i) => {
        return { identity, region: DOCKER_PROXY_TURN_REGIONS[i] };
      }));
      disconnected = Promise.all(rooms.map(room => new Promise(resolve => room.once('disconnected', resolve))));
    });

    after(async () => {
      if (rooms) {
        rooms.forEach(room => room.disconnect());
        if (rooms.length > 0) {
          await completeRoom(rooms[0].sid);
        }
        rooms = null;
      }
    });

    it('validate media flow', () => {
      return waitWhileNotDisconnected(disconnected, rooms.map(validateMediaFlow), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
    });

    it('block all TURN regions', async () => {
      const reconnectingPromises = rooms.map(room => waitOnceForRoomEvent(room, 'reconnecting'));
      const reconnectedPromises = rooms.map(room => waitOnceForRoomEvent(room, 'reconnected'));

      const ipRanges = flatMap(DOCKER_PROXY_TURN_REGIONS, region => DOCKER_PROXY_TURN_IP_RANGES[region]);
      await dockerAPI.blockIpRanges(ipRanges);
      await waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT);

      await dockerAPI.unblockIpRanges(ipRanges);
      return waitWhileNotDisconnected(disconnected, reconnectedPromises, `reconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT);
    });

    it('block specific TURN regions', async () => {
      const turnRegionsToBlock = DOCKER_PROXY_TURN_REGIONS.slice(1);
      const ipRanges = flatMap(turnRegionsToBlock, region => DOCKER_PROXY_TURN_IP_RANGES[region]);
      const blockedRooms = rooms.slice(1);
      const reconnectingPromises = blockedRooms.map(room => waitOnceForRoomEvent(room, 'reconnecting'));
      const reconnectedPromises = blockedRooms.map(room => waitOnceForRoomEvent(room, 'reconnected'));

      await dockerAPI.blockIpRanges(ipRanges);
      await waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT);
      await dockerAPI.unblockIpRanges(ipRanges);
      return waitWhileNotDisconnected(disconnected, reconnectedPromises, `reconnectedPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT);
    });
  });


  [['Alice'], ['Alice', 'Bob']].forEach(identities => {
    describe(`${identities.length} Participant(s)`, () => {
      let rooms = [];
      let currentNetworks = null;
      let disconnected;

      beforeEach(async function() {
        if (!isRunningInsideDocker) {
          this.skip();
        }

        await waitFor(dockerAPI.resetNetwork(), 'reset network', RESET_NETWORK_TIMEOUT);
        await waitToGoOnline();
        currentNetworks = await readCurrentNetworks(dockerAPI);
        const setupOptions = identities.map(identity => ({ identity }));
        rooms = await setup(setupOptions);
        disconnected = Promise.all(rooms.map(room => new Promise(resolve => room.once('disconnected', resolve))));
      });

      afterEach(async () => {
        let sid = null;
        rooms.forEach(room => {
          if (room) {
            room.disconnect();
            sid = room.sid;
          }
        });
        rooms = [];
        await waitFor(dockerAPI.resetNetwork(), 'reset network after each', RESET_NETWORK_TIMEOUT);
        if (sid) {
          await completeRoom(sid);
        }
      });

      describe('Network interruption', () => {
        let disconnectedPromises;
        let localParticipantDisconnectedPromises;
        let localParticipantReconnectedPromises;
        let localParticipantReconnectingPromises;
        let reconnectedPromises;
        let reconnectingPromises;

        beforeEach(async function() {
          if (!isRunningInsideDocker) {
            this.skip();
          }
          disconnectedPromises = rooms.map(room => new Promise(resolve => room.once('disconnected', resolve)));
          localParticipantDisconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('disconnected', resolve)));
          localParticipantReconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnected', resolve)));
          localParticipantReconnectingPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnecting', resolve)));
          reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
          reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from all networks');
          await waitToGoOffline();
        });

        it('should emit "reconnecting" on the Rooms and LocalParticipants', () => {
          return Promise.all([
            waitWhileNotDisconnected(disconnected, localParticipantReconnectingPromises, `localParticipantReconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT),
            waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT)
          ]);
        });

        context('that is longer than the session timeout', () => {
          it(`should emit "disconnected" on the Rooms and LocalParticipants${isFirefox ? ' - @unstable: JSDK-2811' : ''}`, async () => {
            await Promise.all([
              waitWhileNotDisconnected(disconnected, localParticipantReconnectingPromises, `localParticipantReconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT),
              waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT)
            ]);
            return Promise.all([
              waitFor(localParticipantDisconnectedPromises, `localParticipantDisconnectedPromises: ${rooms[0].sid}`, DISCONNECTED_TIMEOUT),
              waitFor(disconnectedPromises, `disconnectedPromises: ${rooms[0].sid}`, DISCONNECTED_TIMEOUT)
            ]);
          });
        });

        context('that recovers before the session timeout', () => {
          it('should emit "reconnected" on the Rooms and LocalParticipants (@unstable: JSDK-2812)', async () => {
            await waitWhileNotDisconnected(disconnected, localParticipantReconnectingPromises, `localParticipantReconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT);
            await waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT);

            await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.connectToNetwork(networkId)), 'reconnect to original networks');
            await readCurrentNetworks(dockerAPI);
            await waitToGoOnline();

            await waitWhileNotDisconnected(disconnected, localParticipantReconnectedPromises, `localParticipantReconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT);
            await waitWhileNotDisconnected(disconnected, reconnectedPromises, `reconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT);

            if (identities.length > 1) {
              await waitWhileNotDisconnected(disconnected, rooms.map(validateMediaFlow), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
            }
          });
        });
      });

      // NOTE: network handoff does not work Firefox because of following known issues
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1546562))
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1548318))
      (isFirefox ? describe.skip : describe)('Network handoff reconnects to new network', () => {
        it('Scenario 1 (jump): connected interface switches off and then a new interface switches on (@unstable: JSDK-2813)',  async () => {
          const localParticipantReconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnected', resolve)));
          const localParticipantReconnectingPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnecting', resolve)));
          const reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
          const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');

          await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from networks');
          await waitToGoOffline();
          await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');
          await waitToGoOnline();
          console.log('current networks:', await readCurrentNetworks(dockerAPI));

          await Promise.all([
            waitWhileNotDisconnected(disconnected, localParticipantReconnectingPromises, `localParticipantReconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT),
            waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT)
          ]);
          await Promise.all([
            waitWhileNotDisconnected(disconnected, localParticipantReconnectedPromises, `localParticipantReconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT),
            waitWhileNotDisconnected(disconnected, reconnectedPromises, `reconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT)
          ]);

          if (identities.length > 1) {
            await waitWhileNotDisconnected(disconnected, rooms.map(validateMediaFlow), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
          }
        });

        it('Scenario 2 (step) : new interface switches on and then the connected interface switches off (@unstable: JSDK-2814) ', async () => {
          const localParticipantReconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnected', resolve)));
          const localParticipantReconnectingPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnecting', resolve)));
          const reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));

          // create and connect to new network
          const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');
          await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');
          await readCurrentNetworks(dockerAPI);

          // disconnect from current network(s).
          await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from network');

          await readCurrentNetworks(dockerAPI);
          await waitToGoOnline();

          await Promise.all([
            waitWhileNotDisconnected(disconnected, localParticipantReconnectingPromises, `localParticipantReconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT),
            waitWhileNotDisconnected(disconnected, reconnectingPromises, `reconnectingPromises: ${rooms[0].sid}`, RECONNECTING_TIMEOUT),
            waitWhileNotDisconnected(disconnected, localParticipantReconnectedPromises, `localParticipantReconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT),
            waitWhileNotDisconnected(disconnected, reconnectedPromises, `reconnectedPromises: ${rooms[0].sid}`, RECONNECTED_TIMEOUT)
          ]);

          if (identities.length > 1) {
            await waitWhileNotDisconnected(disconnected, rooms.map(validateMediaFlow), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
          }
        });
      });

      // eslint-disable-next-line no-warning-comments
      // TODO (mmalavalli): Remove environment check once RemoteParticipant "reconnecting"
      // state is available in prod version of Room Service.
      (identities.length > 1 ? describe : describe.skip)('RemoteParticipant reconnection events (@unstable: JSDK-2815)', () => {
        it('should emit "reconnecting" and "reconnected" events on the RemoteParticipant which recovers from signaling connection disruption', async () => {
          const [aliceRoom, bobRoom] = rooms;
          const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);
          const eventsEmitted = [];

          const eventPromises = new Promise(resolve => {
            const resolveIfAllEventsFired = () => eventsEmitted.length === 8 && resolve(eventsEmitted);
            aliceRoom.localParticipant.on('reconnecting', () => {
              eventsEmitted.push({ event: 'LocalParticipant#reconnecting' });
              resolveIfAllEventsFired();
            });

            aliceRoom.localParticipant.on('reconnected', () => {
              eventsEmitted.push({ event: 'LocalParticipant#reconnected' });
              resolveIfAllEventsFired();
            });

            aliceRoom.on('reconnecting', error => {
              eventsEmitted.push({ event: 'LocalRoom#reconnecting', error });
              resolveIfAllEventsFired();
            });

            aliceRoom.on('reconnected', () => {
              eventsEmitted.push({ event: 'LocalRoom#reconnected' });
              resolveIfAllEventsFired();
            });

            aliceRemote.on('reconnecting', () => {
              eventsEmitted.push({ event: 'RemoteParticipant#reconnecting' });
              resolveIfAllEventsFired();
            });

            aliceRemote.on('reconnected', () => {
              eventsEmitted.push({ event: 'RemoteParticipant#reconnected' });
              resolveIfAllEventsFired();
            });

            bobRoom.on('participantReconnecting', participant => {
              eventsEmitted.push({ event: 'RemoteRoom#participantReconnecting', participant });
              resolveIfAllEventsFired();
            });

            bobRoom.on('participantReconnected', participant => {
              eventsEmitted.push({ event: 'RemoteRoom#participantReconnected', participant });
              resolveIfAllEventsFired();
            });
          });

          // NOTE(mmalavalli): Simulate a signaling connection interruption by
          // closing Alice's WebSocket transport. Then, wait until all the expected
          // events are fired. NOTE: this does not work if connected quickly. Also this test is
          // should not be in network tests.
          aliceRoom._signaling._transport._twilioConnection._close({ code: 3005, reason: 'foo' });
          try {
            await waitFor(eventPromises, 'waiting for event promises', 2 * ONE_MINUTE);

            assert.equal(eventsEmitted.length, 8);
            eventsEmitted.forEach(item => {
              switch (item.event) {
                case 'LocalRoom#reconnecting':
                  assert(item.error instanceof SignalingConnectionDisconnectedError);
                  break;
                case 'RemoteRoom#participantReconnecting':
                case 'RemoteRoom#participantReconnected':
                  assert.equal(item.participant, aliceRemote);
                  break;
              }
            });
          } catch (err) {
            console.log('eventsEmitted:', eventsEmitted);
            throw err;
          }
        });
      });
    });
  });

  describe('ICE gathering timeout (@unstable: JSDK-2816)', () => {
    let room;
    let disconnected;

    before(this.title, async function() {
      if (!isRunningInsideDocker) {
        this.skip();
      }

      const identities = defaults.topology === 'peer-to-peer'
        ? ['Alice', 'Bob']
        : ['Alice'];

      const setupOptions = identities.map((identity, i) => i === 0
        ? { identity, options: { iceServers: [], iceTransportPolicy: 'relay' } }
        : { identity });

      // NOTE(mmalavalli): We can simulate ICE gathering timeout by forcing TURN
      // relay and passing an empty RTCIceServers[]. This way, no relay candidates
      // are gathered, and should force an ICE gathering timeout.
      [room] = await setup(setupOptions);
      disconnected = new Promise(resolve => room.once('disconnected', resolve));
    });

    it('should transition Room .state to "reconnecting" for the first timeout', async () => {
      if (room.state !== 'reconnecting') {
        const reconnectingPromise = new Promise(resolve => room.once('reconnecting', error => resolve(error)));
        const error = await waitWhileNotDisconnected(disconnected, reconnectingPromise, `Room#reconnecting: ${room.sid}`);
        assert(error instanceof MediaConnectionError);
      }
    });

    it('should eventually transition Room .state to "disconnected"', async () => {
      if (room.state !== 'disconnected') {
        const disconnectedPromise = new Promise(resolve => room.once('disconnected', (room, error) => resolve(error)));
        const error = await waitFor(disconnectedPromise, `Room#disconnected: ${room.sid}`);
        assert(error instanceof MediaConnectionError);
      }
    });

    after(async () => {
      if (room) {
        room.disconnect();
        await completeRoom(room.sid);
      }
    });
  });
});
