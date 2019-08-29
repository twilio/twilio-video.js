/* eslint-disable no-console */
'use strict';
const assert = require('assert');
const DockerProxyClient = require('../../../docker/dockerProxyClient');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const {
  connect,
  // createLocalAudioTrack,
  // LocalDataTrack,
} = require('../../../lib');

const {
  // participantsConnected,
  randomName,
  waitToGoOnline,
  // waitToGoOffline
} = require('../../lib/util');

const minute = 1 * 60 * 1000;

async function setup(nPeople) {
  console.log(`setting up for ${nPeople} participants`);
  const roomName = randomName();
  // eslint-disable-next-line no-warning-comments
  // TODO: add more people to room to ensure all gets network events.
  const people = ['Alice', 'Bob', 'Charlie', 'Mak'];
  people.splice(nPeople);

  const roomPromises = people.map((userName) => {
    const options = Object.assign({ name: roomName }, defaults);
    return connect(getToken(userName), options);
  });
  const rooms = await Promise.all(roomPromises);
  console.log('makarand: rooms connected:' + roomPromises.length);
  rooms.forEach((room) => {
    room.on('disconnected', () => console.log(room.localParticipant.identity + ': room received disconnected'));
    room.on('reconnecting', () => console.log(room.localParticipant.identity + ': room received reconnecting'));
    room.on('reconnected', () => console.log(room.localParticipant.identity + ': room received reconnected'));
  });

  return { roomName, rooms };
}

// waits for given promise (or array of promises) for given time.
// rejects if promise does not resolve in given time
function waitForSometime(promiseOrArray, timeoutMS = 2 * minute) {
  const promise = Array.isArray(promiseOrArray) ? Promise.all(promiseOrArray) : promiseOrArray;
  const timeoutPromise = new Promise((_resolve, reject) => setTimeout(reject, timeoutMS));
  return Promise.race([promise, timeoutPromise]);
}
describe('Reconnection states and events', function() {
  // eslint-disable-next-line no-invalid-this
  // eslint-disable-next-line no-invalid-this
  this.timeout(5 * minute);

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


  [1, 2].forEach((nPeople) => {
    describe(`docker dependent tests involving ${nPeople} participants`, () => {
      let rooms = null;
      let roomName = null;

      beforeEach('setting up the room and participants', async function() {
        if (!isRunningInsideDocker) {
          // eslint-disable-next-line no-invalid-this
          this.skip();
        } else {
          console.log('resetting networks before each');
          await dockerAPI.resetNetwork();
          await waitToGoOnline();

          const result =  await setup(nPeople);
          roomName = result.roomName;
          console.log('roomName: ', roomName);
          rooms = result.rooms;
        }
      });

      afterEach(async () => {
        if (isRunningInsideDocker) {
          // reset to original network settings.
          rooms.forEach(room => room.disconnect());
          console.log('resetting networks after each');
          await dockerAPI.resetNetwork();
        }
      });

      describe('Network interruption', () => {
        let reconnectingPromises = null;

        beforeEach('disconnect the network', async () => {
          reconnectingPromises = rooms.map(room => new Promise(resolve => room.once('reconnecting', resolve)));
          console.log('disconnecting networks');
          await dockerAPI.disconnectFromAllNetworks();
        });

        it('should emit "reconnecting" on the Rooms', async () => {
          console.log('watining for reconneting events:' + reconnectingPromises.length);
          await Promise.all(reconnectingPromises);
        });

        context('that is longer than the session timeout', () => {
          it('should emit "disconnected" on the Rooms', async () => {
            const disconnectPromises = rooms.map(room => new Promise(resolve => room.once('disconnected', resolve)));
            await Promise.all(reconnectingPromises);
            await Promise.all(disconnectPromises);
          });
        });

        context('that recovers before the session timeout', () => {
          // it('should emit "reconnected on the Rooms', async () => {
          //   const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));

          //   console.log('makarand: waiting for reconnectingPromises');
          //   await Promise.all(reconnectingPromises);

          //   // create and connect to new network
          //   const newNetwork = await dockerAPI.createNetwork();
          //   console.log('makarand: waiting to connect to network');
          //   await dockerAPI.connectToNetwork(newNetwork.Id);

          //   await waitToGoOnline();

          //   console.log('makarand: waiting for reconnectedPromises');
          //   await Promise.all(reconnectedPromises);
          // });

          it('should resume media between the Participants', async () => {
            let failTest = null;
            const reconnectedPromises = rooms.map(room => new Promise(resolve => room.once('reconnected', resolve)));
            await Promise.all(reconnectingPromises);

            // create and connect to new network
            const newNetwork = await dockerAPI.createNetwork();
            console.log('makarand: waiting to connect to network');
            await dockerAPI.connectToNetwork(newNetwork.Id);

            await waitToGoOnline();

            console.log('waiting to get reconnected');

            try {
              await waitForSometime(reconnectedPromises);
              console.log('got reconnected!');
            } catch (err) {
              console.log('rooms - Failed to Reconnect:');
              rooms.forEach(room => console.log(`ConnectionStates: ${room.localParticipant.identity}: signalingConnectionState:${room._signaling.signalingConnectionState}  mediaConnectionState:${room._signaling.mediaConnectionState}`));
              console.log('rooms - Failed to Reconnect Hope that helps');
              failTest = 'test failed';
            }

            // 8. Get StatsReports.
            const reports1 = await Promise.all(rooms.map(room => room.getStats()));

            // wait for a second.
            await new Promise(resolve => setTimeout(resolve, 1000));

            const reports2 = await Promise.all(rooms.map(room => room.getStats()));

            console.log('statsReport 1: ', JSON.stringify(reports1, null, 2));
            console.log('statsReport 2: ', JSON.stringify(reports2, null, 2));
            if (failTest) {
              throw failTest;
            }
          });
        });
      });

      describe('Network handoff', () => {
        it('reconnects to new network : Scenario 1 (jump): connected interface switches off and then a new interface switches on',  () => {
          // Scenario 1 (jump): connected interface switches off and then a new interface switches on.
          // NOTE: Disable this for Firefox 67 or below ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1546562))
          throw new Error('not implemented');
        });
        it('reconnects to new network : Scenatio 2 (step) : new interface switches on and then the connected interface switches off.', () => {
          // Scenatio 2 (step) : new interface switches on and then the connected interface switches off.
          // NOTE: Disable this for Firefox ([bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1548318))
          // Expected behavior in both cases: reconnecting, reconnected and media resumption.
          throw new Error('not implemented');
        });
      });
    });
  });
});
