/* eslint-disable no-invalid-this */
/* eslint-disable no-console */
'use strict';

const assert = require('assert');

const defaults = require('../../../lib/defaults');
const { isFirefox } = require('../../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  randomName,
  validateMediaFlow,
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

const DOCKER_PROXY_REGIONS = ['au1', 'us1', 'us2'];

const DOCKER_PROXY_VSG_IP_RANGES = {
  au1: [
    '52.65.124.94-52.65.124.94',
    '54.79.169.174-54.79.169.174'
  ],
  us1: [
    '18.214.223.92-18.214.223.92',
    '34.199.163.120-34.199.163.120',
    '35.170.161.214-35.170.161.214'
  ],
  us2: [
    '44.240.99.173-44.240.99.173',
    '44.241.246.215-44.241.246.215',
    '54.214.154.157-54.214.154.157'
  ]
};

const DOCKER_PROXY_TURN_IP_RANGES = {
  au1: [
    '13.210.2.128-13.210.2.159',
    '54.252.254.64-54.252.254.127',
    '3.25.42.128-3.25.42.255'
  ],
  us1: [
    '34.203.254.0-34.203.254.255',
    '54.172.60.0-54.172.61.255',
    '34.203.250.0-34.203.251.255',
    '3.235.111.128-3.235.111.255'
  ],
  us2: [
    '34.216.110.128-34.216.110.159',
    '54.244.51.0-54.244.51.255',
    '44.234.69.0-44.234.69.12'
  ]
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

function getStartedPublications(room) {
  return flatMap(room.participants, participant => {
    return Array.from(participant.tracks.values()).filter(({ track }) => {
      return track && track.isStarted;
    });
  });
}

// Resolves when room received n track started events.
async function waitForTracksToStart(room, n) {
  while (getStartedPublications(room).length < n) {
    /* eslint-disable no-await-in-loop */
    await waitOnceForRoomEvent(room, 'trackStarted');
  }
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
      video: smallVideoConstraints
    }, options, defaults);

    const token = getToken(identity);

    if (region) {
      options.region = region;
      options.iceTransportPolicy = 'relay';
    }

    const room = await waitFor(connect(token, options), `${sid}: ${identity} connected`);
    const { iceTransportPolicy, iceServers } = options;

    const shouldWaitForTracksStarted = iceTransportPolicy !== 'relay' || (
      (!Array.isArray(iceServers) || iceServers.length > 0)
        && defaults.topology !== 'peer-to-peer'
    );

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

describe('Network Reconnection', function() {
  this.retries(2);
  this.timeout(10 * ONE_MINUTE);
  let dockerAPI;
  let isRunningInsideDocker = false;

  before(this.title, async function() {
    dockerAPI = new DockerProxyClient();
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  this.beforeEach(function() {
    if (!isRunningInsideDocker) {
      this.skip();
    }
  });

  it('connect rejects when network is down', async () => {
    const currentNetworks = await readCurrentNetworks(dockerAPI);
    const sid = await createRoom(name, defaults.topology);

    const options = Object.assign({
      audio: true,
      fake: true,
      name: sid,
      video: smallVideoConstraints
    }, defaults);

    await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from all networks');
    await waitToGoOffline();

    let connectError;
    let room;

    try {
      room = await connect(getToken('Alice'), options);
    } catch (error) {
      connectError = error;
    } finally {
      if (room) {
        room.disconnect();
        await completeRoom(room.sid);
      }
      await waitFor(dockerAPI.resetNetwork(), 'resetting network', RESET_NETWORK_TIMEOUT);
      await waitToGoOnline();
    }
    assert(typeof room === 'undefined', `Unexpectedly joined a Room ${room && room.sid}`);
    assert(connectError instanceof SignalingConnectionError
      || connectError instanceof MediaConnectionError);
  });

  // TODO(mmalavalli): Investigate why this test is failing on Peer-to-Peer Rooms in Firefox.
  (isFirefox &&  defaults.topology === 'peer-to-peer' ? describe.skip : describe)('Media Reconnection (@unstable: JSDK-2810)', () => {
    let rooms;
    let disconnected;

    before(this.title, async function() {
      if (!isRunningInsideDocker) {
        this.skip();
        return;
      }
      rooms = await setup(['Alice', 'Bob', 'Charlie'].map((identity, i) => {
        return { identity, region: DOCKER_PROXY_REGIONS[i] };
      }));
      disconnected = Promise.all(rooms.map(room => new Promise(resolve => room.once('disconnected', resolve))));
      await waitWhileNotDisconnected(disconnected, rooms.map(room => validateMediaFlow(room)), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
    });

    after(async () => {
      if (rooms) {
        rooms.forEach(room => room.disconnect());
        if (rooms.length > 0) {
          await completeRoom(rooms[0].sid);
        }
        rooms = null;
        await waitFor(dockerAPI.resetNetwork(), 'resetting network', RESET_NETWORK_TIMEOUT);
        await waitToGoOnline();
      }
    });

    it('the Rooms of Participants whose TURN regions are blocked should emit reconnecting and reconnected events', async () => {
      const turnRegionsToBlock = DOCKER_PROXY_REGIONS.slice(1);
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

  describe('Signaling Reconnection', () => {
    let rooms = [];
    let currentNetworks = null;
    let disconnected;

    beforeEach(async function() {
      if (!isRunningInsideDocker) {
        this.skip();
        return;
      }
      const setupOptions = [
        { identity: 'Alice', region: 'us1' },
        { identity: 'Bob', region: 'us2' }
      ];
      currentNetworks = await readCurrentNetworks(dockerAPI);
      rooms = await setup(setupOptions);
      disconnected = Promise.all(rooms.map(room => new Promise(resolve => room.once('disconnected', resolve))));
    });

    afterEach(async () => {
      let sid = null;
      if (!window.navigator.onLine) {
        await waitFor(dockerAPI.resetNetwork(), 'reset network', RESET_NETWORK_TIMEOUT);
        await waitToGoOnline();
      }
      rooms.forEach(room => {
        if (room) {
          room.disconnect();
          sid = room.sid;
        }
      });
      rooms = [];
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
          return;
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
          await waitWhileNotDisconnected(disconnected, rooms.map(room => validateMediaFlow(room)), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
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
        await waitWhileNotDisconnected(disconnected, rooms.map(room => validateMediaFlow(room)), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
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

        await waitWhileNotDisconnected(disconnected, rooms.map(room => validateMediaFlow(room)), `validate media flow: ${rooms[0].sid}`, VALIDATE_MEDIA_FLOW_TIMEOUT);
      });
    });

    describe('RemoteParticipant reconnection events (@unstable: JSDK-2815)', () => {
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

        // Block Alice's signaling traffic.
        await dockerAPI.blockIpRanges(DOCKER_PROXY_VSG_IP_RANGES[aliceRoom.localParticipant.signalingRegion], ['tcp']);

        // Wait for Bob's Room to emit participantReconnecting event for Alice.
        await waitOnceForRoomEvent(bobRoom, 'participantReconnecting');

        // Unblock Alice's signaling traffic.
        await dockerAPI.unblockIpRanges(DOCKER_PROXY_VSG_IP_RANGES[aliceRoom.localParticipant.signalingRegion], ['tcp']);

        try {
          await waitFor(eventPromises, 'event promises', 2 * ONE_MINUTE);
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
          console.log('events emitted:', eventsEmitted.map(({ event }) => event));
          throw err;
        }
      });
    });
  });

  describe('ICE gathering timeout (@unstable: JSDK-2816)', () => {
    let room;
    let disconnected;

    before(this.title, async function() {
      if (!isRunningInsideDocker) {
        this.skip();
        return;
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
