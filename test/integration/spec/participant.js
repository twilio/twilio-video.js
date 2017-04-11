'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const createLocalTracks = require('../../../lib/createlocaltracks');
const { fakeGetUserMedia } = require('../../lib/fakemediastream');
const getToken = require('../../lib/token');
const { logLevel, wsServer } = require('../../env');
const { randomName } = require('../../lib/util');
const PeerConnectionManager = require('../../../lib/signaling/v2/peerconnectionmanager');

describe('Participant', function() {
  this.timeout(30000);

  describe('events', () => {
    let roomName;
    let alice;
    let aliceRoom;
    let aliceToken;
    let bob;
    let bobRoom;
    let bobToken;
    let options;
    let mediaStreamTracks;

    beforeEach(() => {
      roomName = randomName();
      alice = randomName();
      aliceToken = getToken(alice);
      bob = randomName();
      bobToken = getToken(bob);

      options = {};
      mediaStreamTracks = [];

      [ 'ecsServer', 'wsServer', 'wsServerInsights' ].forEach(server => {
        if (credentials[server]) {
          options[server] = credentials[server];
        }
      });

      if (logLevel) {
        options.logLevel = logLevel;
      }

      options.mediaStreamTracks = [];

      if (navigator.userAgent === 'Node') {
        options.getUserMedia = fakeGetUserMedia;

        options.PeerConnectionManager = function(options) {
          const peerConnectionManager = new PeerConnectionManager(options);
          peerConnectionManager.getRemoteMediaStreamTracks = () => mediaStreamTracks;
          return peerConnectionManager;
        };
      }
    });

    context('when alice (with audio and video tracks) and bob connect to the Room,', () => {
      it('should populate alice\'s Participant in bob\'s Room with her Tracks', async () => {
        const tracks = await createLocalTracks(options);
        mediaStreamTracks = tracks.map(track => track.mediaStreamTrack);

        const aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName,
          tracks
        }, options));

        const bobRoom = await connect(bobToken, Object.assign({
          name: roomName
        }, options));

        const aliceParticipantSid = aliceRoom.localParticipant.sid;
        const aliceParticipant = bobRoom.participants.get(aliceParticipantSid);
        assert(aliceParticipant);

        const aliceTracks = aliceParticipant.tracks;
        while (aliceTracks.size < 2) {
          await new Promise(resolve => aliceParticipant.once('trackAdded', resolve));
        }

        assert.equal(aliceTracks.size, 2);

        mediaStreamTracks.forEach(track => {
          const aliceTrack = aliceTracks.get(track.id);
          assert.equal(aliceTrack.id, track.id);
          assert.equal(aliceTrack.kind, track.kind);
        });
      });

      context('when bob later disconnects from the Room,', () => {
        it('should not trigger "trackRemoved" event on alice\'s Participant in bob\'s Room', async () => {
          const tracks = await createLocalTracks(options);
          mediaStreamTracks = tracks.map(track => track.mediaStreamTrack);

          const aliceRoom = await connect(aliceToken, Object.assign({
            name: roomName,
            tracks
          }, options));

          const bobRoom = await connect(bobToken, Object.assign({
            name: roomName
          }, options));

          const aliceParticipantSid = aliceRoom.localParticipant.sid;
          const aliceParticipant = bobRoom.participants.get(aliceParticipantSid);

          const aliceTracks = aliceParticipant.tracks;
          while (aliceTracks.size < 2) {
            await new Promise(resolve => aliceParticipant.once('trackAdded', resolve));
          }

          await new Promise((resolve, reject) => {
            aliceParticipant.on('trackRemoved', () => reject(new Error('"trackRemoved" triggered on alice\'s Participant')));
            bobRoom.disconnect();
            setTimeout(resolve);
          });
        });
      });
    });

    afterEach(() => {
      mediaStreamTracks.forEach(mediaStreamTrack => mediaStreamTrack.stop());

      if (aliceRoom) {
        aliceRoom.disconnect();
      }

      if (bobRoom) {
        bobRoom.disconnect();
      }
    });
  });
});
