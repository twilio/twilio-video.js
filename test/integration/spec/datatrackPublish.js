'use strict';

const {
  connect,
  createLocalAudioTrack,
  LocalDataTrack,
} = require('../../../lib');

const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');

const {
  participantsConnected,
  randomName,
  waitFor
} = require('../../lib/util');

describe('JSDK-2501: data track not getting published in firefox', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(60000);
  [true, false].forEach((dominantSpeaker) => {
    [0, 5000].forEach((delay) => {
      it('delay: ' + delay + ', dominantSpeaker: ' + dominantSpeaker, async () => {
        const roomName = randomName();
        const audioTrack = await createLocalAudioTrack();
        const options = Object.assign({
          dominantSpeaker,
          name: roomName,
          networkQuality: false,
          tracks: [audioTrack],
        }, defaults);

        const aliceRoom = await waitFor(connect(getToken('Alice'), options), 'Alice to connect to room');
        await waitFor(new Promise(resolve => setTimeout(resolve, delay)), `wait for ${delay} ms`);

        const bobRoom = await waitFor(connect(getToken('Bob'), options), 'Bob to connect to room');

        await waitFor([aliceRoom, bobRoom].map(room => participantsConnected(room, 1)), `Alice and Bob to see each other connected::${aliceRoom.sid}`);

        await waitFor(aliceRoom.localParticipant.publishTrack(new LocalDataTrack()), `Alice to publish data track:${aliceRoom.sid}`);

        [aliceRoom, bobRoom].forEach(room => room.disconnect());
      });
    });
  });
});
