'use strict';

const assert = require('assert');

const defaults = require('../../../lib/defaults');
const { isFirefox } = require('../../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../../lib/rest');
const getToken = require('../../../lib/token');

const {
  getRegionalizedIceServers,
  randomName,
  waitToGoOffline,
  waitToGoOnline,
  smallVideoConstraints,
  waitFor,
  waitOnceForRoomEvent
} = require('../../../lib/util');

const DockerProxyClient = require('../../../../docker/dockerProxyClient');
const { connect } = require('../../../../lib');
const { flatMap } = require('../../../../lib/util');

const {
  MediaConnectionError,
  SignalingConnectionDisconnectedError
} = require('../../../../lib/util/twilio-video-errors');

const ONE_MINUTE = 60 * 1000;
const VALIDATE_MEDIA_FLOW_TIMEOUT = ONE_MINUTE;
const RECONNECTING_TIMEOUT = 5 * ONE_MINUTE;
const RECONNECTED_TIMEOUT = 5 * ONE_MINUTE;
const DISCONNECTED_TIMEOUT = 10 * ONE_MINUTE;

const DOCKER_PROXY_TURN_REGIONS = ['au1', 'us1', 'us2'];
const DOCKER_PROXY_TURN_IP_RANGES = {
  au1: [
    '13.210.2.128-13.210.2.159',
    '54.252.254.64-54.252.254.127'
  ],
  us1: [
    '34.203.254.0-34.203.254.255',
    '54.172.60.0-54.172.61.255',
    '34.203.250.0-34.203.251.255'
  ],
  us2: [
    '34.216.110.128-34.216.110.159',
    '54.244.51.0-54.244.51.255'
  ]
};


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
 * @param {string[]} identities - Identities
 * @param {object} [extraOptions={}] - Optional extra options for the first Participant.
 * @param {boolean} [regions=null] - Optional TURN region for each identity.
 * @returns {Promise<Room[]>}
 */
async function setup(identities, extraOptions = {}, regions = null) {
  const name = randomName();
  const sid = await waitFor(createRoom(name, defaults.topology), `${name}: created Room`);
  return waitFor(identities.map(async (identity, i) => {
    const options = Object.assign({
      audio: true,
      fake: true,
      name: sid,
      video: smallVideoConstraints
    }, i === 0 ? extraOptions : {}, defaults);

    const token = getToken(identity);

    if (regions && regions[i]) {
      options.iceServers = await waitFor(
        getRegionalizedIceServers(token, regions[i], options),
        `${sid}: get TURN servers regionalized to ${regions[i]}`);
      options.iceTransportPolicy = 'relay';
    }

    const room = await waitFor(connect(token, options), `${sid}: ${identity} connected`);

    const { iceTransportPolicy, iceServers } = options;
    const shouldWaitForTracksStarted = iceTransportPolicy !== 'relay'
      || !Array.isArray(iceServers)
      || iceServers.length > 0;

    const nTracks = (identities.length - 1) * 2;
    if (shouldWaitForTracksStarted) {
      await waitFor(waitForTracksToStart(room, nTracks), `${sid}: ${nTracks} Tracks started`);
    }
    return room;
  }), 'Rooms to get connected, and Tracks to be started');
}

function getTotalBytesReceived(statReports) {
  let totalBytesReceived = 0;
  statReports.forEach(statReport => {
    ['remoteVideoTrackStats', 'remoteAudioTrackStats'].forEach(trackType => {
      statReport[trackType].forEach(trackStats => {
        totalBytesReceived += trackStats.bytesReceived;
      });
    });
  });
  return totalBytesReceived;
}

// validates that media was flowing in given rooms.
async function validateMediaFlow(room) {
  const testTimeMS = 6000;
  // wait for some time.
  await new Promise(resolve => setTimeout(resolve, testTimeMS));

  // get StatsReports.
  const statsBefore = await room.getStats();
  const bytesReceivedBefore = getTotalBytesReceived(statsBefore);

  // wait for some more time.
  await new Promise(resolve => setTimeout(resolve, testTimeMS));

  // get StatsReports again.
  const statsAfter = await room.getStats();
  const bytesReceivedAfter = getTotalBytesReceived(statsAfter);

  if (bytesReceivedAfter <= bytesReceivedBefore) {
    throw new Error('no media flow detected');
  }
}

// reads and prints list of current networks.
// returns currentNetworks array.
function readCurrentNetworks(dockerAPI) {
  return waitFor(dockerAPI.getCurrentNetworks(), 'getCurrentNetworks');
}

describe('Reconnection states and events', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(8 * ONE_MINUTE);

  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;

  before(async () => {
    isRunningInsideDocker = await dockerAPI.isDocker();
  });

  it('DockerProxyClient can determine if running inside docker', () => {
    // We skip docker dependent tests when not running inside docker.
    // this test is included mainly to ensure that not all tests in this file
    // are skipped. karma returns failures if all tests in a file were skipped :)
    assert.equal(typeof isRunningInsideDocker, 'boolean');
  });

  context('should be able to', () => {
    let rooms;

    before(async function() {
      if (!isRunningInsideDocker) {
        // eslint-disable-next-line no-invalid-this
        this.skip();
      } else {
        rooms = await setup(['Alice', 'Bob', 'Charlie'], {
          iceTransportPolicy: 'relay'
        }, DOCKER_PROXY_TURN_REGIONS);
      }
    });

    after(async () => {
      if (rooms) {
        rooms.forEach(room => room.disconnect());
        await completeRoom(rooms[0].sid);
        rooms = null;
      }
    });

    it('validate media flow', () => {
      return waitFor(rooms.map(validateMediaFlow), 'validate media flow', VALIDATE_MEDIA_FLOW_TIMEOUT);
    });

    (defaults.environment === 'prod' ? it : it.skip)('block all TURN regions', async () => {
      const reconnectingPromises = rooms.map(room => waitOnceForRoomEvent(room, 'reconnecting'));
      const reconnectedPromises = rooms.map(room => waitOnceForRoomEvent(room, 'reconnected'));

      const ipRanges = flatMap(DOCKER_PROXY_TURN_REGIONS, region => DOCKER_PROXY_TURN_IP_RANGES[region]);
      await dockerAPI.blockIpRanges(ipRanges);
      await waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT);

      await dockerAPI.unblockIpRanges(ipRanges);
      return waitFor(reconnectedPromises, 'reconnectedPromises', RECONNECTED_TIMEOUT);
    });

    (defaults.environment === 'prod' ? it : it.skip)('block specific TURN regions', async () => {
      const turnRegionsToBlock = DOCKER_PROXY_TURN_REGIONS.slice(1);
      const ipRanges = flatMap(turnRegionsToBlock, region => DOCKER_PROXY_TURN_IP_RANGES[region]);
      const blockedRooms = rooms.slice(1);
      const reconnectingPromises = blockedRooms.map(room => waitOnceForRoomEvent(room, 'reconnecting'));
      const reconnectedPromises = blockedRooms.map(room => waitOnceForRoomEvent(room, 'reconnected'));

      await dockerAPI.blockIpRanges(ipRanges);
      await waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT);
      await dockerAPI.unblockIpRanges(ipRanges);
      return waitFor(reconnectedPromises, 'reconnectedPromises', RECONNECTING_TIMEOUT);
    });
  });

  [['Alice'], ['Alice', 'Bob']].forEach(identities => {
    describe(`${identities.length} Participant(s)`, () => {
      let rooms = [];
      let currentNetworks = null;

      beforeEach(async function() {
        if (!isRunningInsideDocker) {
          // eslint-disable-next-line no-invalid-this
          this.skip();
        } else {
          await waitFor(dockerAPI.resetNetwork(), 'reset network');
          await waitToGoOnline();
          currentNetworks = await readCurrentNetworks(dockerAPI);
          rooms = await waitFor(setup(identities), 'setup Rooms');
        }
      });

      afterEach(async () => {
        if (isRunningInsideDocker) {
          const sid = rooms[0].sid;
          rooms.forEach(room => room.disconnect());
          rooms = [];
          await waitFor(dockerAPI.resetNetwork(), 'reset network after each');
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

        beforeEach(async () => {
          if (isRunningInsideDocker) {
            disconnectedPromises = rooms.map(room => new Promise(resolve => room.once('disconnected', resolve)));
            localParticipantDisconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('disconnected', resolve)));
            localParticipantReconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnected', resolve)));
            localParticipantReconnectingPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnecting', resolve)));
            reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
            reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
            await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from all networks');
            await waitToGoOffline();
          }
        });

        it('should emit "reconnecting" on the Rooms and LocalParticipants', () => {
          return Promise.all([
            waitFor(localParticipantReconnectingPromises, 'localParticipantReconnectingPromises', RECONNECTING_TIMEOUT),
            waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT)
          ]);
        });

        context('that is longer than the session timeout', () => {
          it(`should emit "disconnected" on the Rooms and LocalParticipants${isFirefox ? ' - @unstable' : ''}`, async () => {
            await Promise.all([
              waitFor(localParticipantReconnectingPromises, 'localParticipantReconnectingPromises', RECONNECTING_TIMEOUT),
              waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT)
            ]);
            return Promise.all([
              waitFor(localParticipantDisconnectedPromises, 'localParticipantDisconnectedPromises', DISCONNECTED_TIMEOUT),
              waitFor(disconnectedPromises, 'disconnectedPromises', DISCONNECTED_TIMEOUT)
            ]);
          });
        });

        context('that recovers before the session timeout', () => {
          it(`should emit "reconnected" on the Rooms and LocalParticipants${isFirefox ? ' - @unstable' : ''}`, async () => {
            await Promise.all([
              waitFor(localParticipantReconnectingPromises, 'localParticipantReconnectingPromises', RECONNECTING_TIMEOUT),
              waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT)
            ]);

            await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.connectToNetwork(networkId)), 'reconnect to original networks');
            await readCurrentNetworks(dockerAPI);
            await waitToGoOnline();

            await Promise.all([
              waitFor(localParticipantReconnectedPromises, 'localParticipantReconnectedPromises', RECONNECTED_TIMEOUT),
              waitFor(reconnectedPromises, 'reconnectedPromises', RECONNECTED_TIMEOUT)
            ]);

            if (identities.length > 1) {
              await waitFor(rooms.map(validateMediaFlow), 'validate media flow', VALIDATE_MEDIA_FLOW_TIMEOUT);
            }
          });
        });
      });

      // NOTE: network handoff does not work Firefox because of following known issues
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1546562))
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1548318))
      (isFirefox ? describe.skip : describe)('Network handoff reconnects to new network', () => {
        it('@unstable: Scenario 1 (jump): connected interface switches off and then a new interface switches on',  async () => {
          const localParticipantReconnectedPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnected', resolve)));
          const localParticipantReconnectingPromises = rooms.map(({ localParticipant }) => new Promise(resolve => localParticipant.once('reconnecting', resolve)));
          const reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
          const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');

          await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from networks');
          await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');
          await readCurrentNetworks(dockerAPI);

          await Promise.all([
            waitFor(localParticipantReconnectingPromises, 'localParticipantReconnectingPromises', RECONNECTING_TIMEOUT),
            waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT)
          ]);
          await Promise.all([
            waitFor(localParticipantReconnectedPromises, 'localParticipantReconnectedPromises', RECONNECTED_TIMEOUT),
            waitFor(reconnectedPromises, 'reconnectedPromises', RECONNECTED_TIMEOUT)
          ]);

          if (identities.length > 1) {
            await waitFor(rooms.map(validateMediaFlow), 'validate media flow', VALIDATE_MEDIA_FLOW_TIMEOUT);
          }
        });

        it('@unstable: Scenario 2 (step) : new interface switches on and then the connected interface switches off', async () => {
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
            waitFor(localParticipantReconnectingPromises, 'localParticipantReconnectingPromises', RECONNECTING_TIMEOUT),
            waitFor(reconnectingPromises, 'reconnectingPromises', RECONNECTING_TIMEOUT)
          ]);
          await Promise.all([
            waitFor(localParticipantReconnectedPromises, 'localParticipantReconnectedPromises', RECONNECTED_TIMEOUT),
            waitFor(reconnectedPromises, 'reconnectedPromises', RECONNECTED_TIMEOUT)
          ]);

          if (identities.length > 1) {
            await waitFor(rooms.map(validateMediaFlow), 'validate media flow', VALIDATE_MEDIA_FLOW_TIMEOUT);
          }
        });
      });

      // eslint-disable-next-line no-warning-comments
      // TODO (mmalavalli): Remove environment check once RemoteParticipant "reconnecting"
      // state is available in prod version of Room Service.
      (identities.length > 1 && defaults.environment !== 'prod' ? describe : describe.skip)('RemoteParticipant reconnection events', () => {
        it('should emit "reconnecting" and "reconnected" events on the RemoteParticipant which recovers from signaling connection disruption', async () => {
          const [aliceRoom, bobRoom] = rooms;
          const aliceRemote = bobRoom.participants.get(aliceRoom.localParticipant.sid);

          const eventPromises = new Promise(resolve => {
            const eventsEmitted = [];
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
          // events are fired.
          aliceRoom._signaling._transport._twilioConnection._close({ code: 3005, reason: 'foo' });
          const eventsEmitted = await eventPromises;

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
        });
      });
    });
  });

  describe('ICE gathering timeout', () => {
    let room;

    before(async function() {
      if (!isRunningInsideDocker) {
        // eslint-disable-next-line no-invalid-this
        this.skip();
      } else {
        // NOTE(mmalavalli): We can simulate ICE gathering timeout by forcing TURN
        // relay and passing an empty RTCIceServers[]. This way, no relay candidates
        // are gathered, and should force an ICE gathering timeout.
        [room] = await waitFor(setup(defaults.topology === 'peer-to-peer' ? ['Alice', 'Bob'] : ['Alice'], {
          iceServers: [],
          iceTransportPolicy: 'relay'
        }), 'Room setup');
      }
    });

    it('should transition Room .state to "reconnecting" for the first timeout', async () => {
      if (room.state !== 'reconnecting') {
        const reconnectingPromise = new Promise(resolve => room.once('reconnecting', error => resolve(error)));
        const error = await waitFor(reconnectingPromise, 'Room#reconnecting');
        assert(error instanceof MediaConnectionError);
      }
    });

    it('should eventually transition Room .state to "disconnected"', async () => {
      if (room.state !== 'disconnected') {
        const disconnectedPromise = new Promise(resolve => room.once('disconnected', (room, error) => resolve(error)));
        const error = await waitFor(disconnectedPromise, 'Room#disconnected');
        assert(error instanceof MediaConnectionError);
      }
    });

    after(async () => {
      if (isRunningInsideDocker && room) {
        room.disconnect();
        await completeRoom(room.sid);
      }
    });
  });
});
