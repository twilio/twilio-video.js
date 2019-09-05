/* eslint-disable no-console */
'use strict';
const assert = require('assert');
const DockerProxyClient = require('../../../../docker/dockerProxyClient');
const defaults = require('../../../lib/defaults');
const getToken = require('../../../lib/token');
const {
  connect,
  createLocalTracks,
} = require('../../../../lib');
const { isFirefox } = require('../../../lib/guessbrowser');

const {
  // participantsConnected,
  randomName,
  waitToGoOnline,
  smallVideoConstraints,
  waitFor,
  // waitToGoOffline
} = require('../../../lib/util');

const minute = 1 * 60 * 1000;

// returns Promise<[room]> - sets up and returns room with nPeople
async function setup(nPeople) {
  console.log(`setting up for ${nPeople} participants`);

  const constraints = { audio: true, video: smallVideoConstraints, fake: true };
  const tracks = await createLocalTracks(constraints);
  const options = Object.assign({ name: randomName(), tracks: tracks }, defaults);

  const people = ['Alice', 'Bob', 'Charlie', 'Mak'];
  people.splice(nPeople);

  const rooms = await waitFor(people.map(userName => connect(getToken(userName), options)), 'rooms to get connected');

  // eslint-disable-next-line no-warning-comments
  // TODO: debug only code to watch the events.
  rooms.forEach((room) => {
    const roomStr = room.localParticipant.identity + ':' + room.sid;
    console.log('connected to Room: ' + roomStr);
    room.on('disconnected', () => console.log(roomStr + ': room received disconnected'));
    room.on('reconnecting', () => console.log(roomStr + ': room received reconnecting'));
    room.on('reconnected', () => console.log(roomStr + ': room received reconnected'));
  });

  return rooms;
}

function getTotalBytesReceived(statReports) {
  let totalBytesReceived = 0;
  statReports.forEach((statReport) => {
    ['remoteVideoTrackStats', 'remoteAudioTrackStats'].forEach((trackType) => {
      statReport[trackType].forEach((trackStats) => {
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

  const statsAfter = await room.getStats();
  const bytesReceivedAfter = getTotalBytesReceived(statsAfter);
  console.log(`Total Bytes Received in ${room.localParticipant.identity}'s Room: ${bytesReceivedBefore} => ${bytesReceivedAfter} `);
  if (bytesReceivedAfter <= bytesReceivedBefore) {
    throw new Error('no media flow detected');
  }
}

// reads and prints list of current networks.
// returns currentNetworks array.
async function readCurrentNetworks(dockerAPI) {
  const currentNetworks = await waitFor(dockerAPI.getCurrentNetworks(), 'getCurrentNetworks');
  console.log('currentNetworks: ', currentNetworks);
  return currentNetworks;
}

describe('Reconnection states and events', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(8 * minute);

  let dockerAPI = new DockerProxyClient();
  let isRunningInsideDocker = false;
  before(async () => {
    isRunningInsideDocker = await dockerAPI.isDocker();
    console.log('isRunningInsideDocker = ', isRunningInsideDocker);
  });

  it('DockerProxyClient can determine if running inside docker', () => {
    // We skip docker dependent tests when not running inside docker.
    // this test is included mainly to ensure that not all tests in this file
    // are skipped. karma returns failures if all tests in a file were skipped :)
    assert.equal(typeof isRunningInsideDocker, 'boolean');
  });

  it('can detect media flow', async () => {
    const rooms =  await setup(2);
    await waitFor(rooms.map(validateMediaFlow), 'validate media flow');
    rooms.forEach(room => room.disconnect());
  });

  [1, 2].forEach((nPeople) => {
    describe(`${nPeople} participant(s)`, () => {
      let rooms = [];
      let currentNetworks = null;

      beforeEach('setting up the room and participants', async function() {
        // eslint-disable-next-line no-invalid-this
        console.log('Starting: ' + this.test.fullTitle());

        if (!isRunningInsideDocker) {
          // eslint-disable-next-line no-invalid-this
          this.skip();
        } else {
          await waitFor(dockerAPI.resetNetwork(), 'resetNetwork');
          await waitToGoOnline();
          currentNetworks = await readCurrentNetworks(dockerAPI);

          rooms = await waitFor(setup(nPeople), 'setup rooms');
        }
      });

      afterEach(async () => {
        if (isRunningInsideDocker) {
          rooms.forEach(room => room.disconnect());
          rooms = [];
          await waitFor(dockerAPI.resetNetwork(), 'reset network after each');
        }
      });

      describe('Network interruption', () => {
        let reconnectingPromises = null;
        beforeEach('disconnect the network', async () => {
          if (isRunningInsideDocker) {
            reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));

            // disconnect from network.
            await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from all networks');
          }
        });

        it('should emit "reconnecting" on the Rooms', async () => {
          await waitFor(reconnectingPromises, 'reconnectingPromises');
        });

        context('that is longer than the session timeout', () => {
          it('should emit "disconnected" on the Rooms', async () => {
            const disconnectPromises = rooms.map(room => new Promise(resolve => room.once('disconnected', resolve)));
            await waitFor(reconnectingPromises, 'reconnectingPromises');
            await waitFor(disconnectPromises, 'disconnectPromises');
          });
        });

        context('that recovers before the session timeout', () => {
          it('should emit "reconnected on the Rooms', async () => {
            const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));

            await waitFor(reconnectingPromises, 'reconnectingPromises');
            await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.connectToNetwork(networkId)), 'reconnect to original networks');
            await readCurrentNetworks(dockerAPI);
            await waitToGoOnline();

            try {
              await waitFor(reconnectedPromises, 'reconnectedPromises');
            } catch (err) {
              console.log('rooms - Failed to Reconnect:');
              rooms.forEach(room => console.log(`ConnectionStates: ${room.localParticipant.identity}: signalingConnectionState:${room._signaling.signalingConnectionState}  mediaConnectionState:${room._signaling.mediaConnectionState}`));
              console.log('rooms - Failed to Reconnect Hope that helps');
              throw err;
            }

            if (nPeople > 1) {
              // if mroe than one person have joined room
              // validate the media flow.
              try {
                await waitFor(rooms.map(validateMediaFlow), 'validate media flow');
              } catch (_err) {
                console.log('TODO(mpatwardhan) : no media detected in the room. But ignoring that for now.');
              }
            }
          });
        });
      });

      // NOTE: network handoff does not work Firefox because of following known issues
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1546562))
      // ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1548318))
      (isFirefox ? describe.skip : describe)('Network handoff reconnects to new network', () => {
        it('Known Unstable JSDK-2503: Scenario 1 (jump): connected interface switches off and then a new interface switches on',  async () => {
          const reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
          const newNetwork = await waitFor(dockerAPI.createNetwork(), 'create network');

          await waitFor(currentNetworks.map(({ Id: networkId }) => dockerAPI.disconnectFromNetwork(networkId)), 'disconnect from networks');
          await waitFor(dockerAPI.connectToNetwork(newNetwork.Id), 'connect to network');
          await readCurrentNetworks(dockerAPI);

          try {
            await waitFor(reconnectingPromises, 'reconnectingPromises');
            await waitFor(reconnectedPromises, 'reconnectedPromises');
          } catch (err) {
            console.log('rooms - Failed to Reconnect. Checking status:');
            rooms.forEach(room => console.log(`ConnectionStates: ${room.localParticipant.identity}: signalingConnectionState:${room._signaling.signalingConnectionState}  mediaConnectionState:${room._signaling.mediaConnectionState}`));
            console.log('rooms - Failed to Reconnect Hope that helps');
            throw err;
          }

          if (nPeople > 1) {
            await waitFor(rooms.map(validateMediaFlow), 'validate media flow');
          }
        });

        it('Known Unstable JSDK-2503: Scenatio 2 (step) : new interface switches on and then the connected interface switches off.', async () => {
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

          try {
            await waitFor(reconnectingPromises, 'reconnectingPromises');
            await waitFor(reconnectedPromises, 'reconnectedPromises');
          } catch (err) {
            console.log('rooms - Failed to Reconnect. Checking status:');
            rooms.forEach(room => console.log(`ConnectionStates: ${room.localParticipant.identity}: signalingConnectionState:${room._signaling.signalingConnectionState}  mediaConnectionState:${room._signaling.mediaConnectionState}`));
            console.log('rooms - Failed to Reconnect Hope that helps');
            throw err;
          }

          if (nPeople > 1) {
            await waitFor(rooms.map(validateMediaFlow), 'validate media flow');
          }
        });
      });
    });
  });
});
