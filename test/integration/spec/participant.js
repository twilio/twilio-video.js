'use strict';

var assert = require('assert');
var credentials = require('../../env');
var randomName = require('../../lib/util').randomName;
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;
var logLevel = credentials.logLevel;

var Client = require('../../../lib/client');
var LocalMedia = require('../../../lib/media/localmedia');
var FakeMediaStream = require('../../lib/fakemediastream').FakeMediaStream;
var FakeMediaStreamTrack = require('../../lib/fakemediastream').FakeMediaStreamTrack;
var PeerConnectionManager = require('../../../lib/signaling/v2/peerconnectionmanager');

describe('Participant', () => {
  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  if (logLevel) {
    options.logLevel = logLevel;
  }

  describe('events', () => {
    var roomName = null;
    var aliceRoom = null;
    var alice = null;
    var bobRoom = null;
    var bob = null;

    beforeEach(() => {
      roomName = randomName();
      alice = createClient(options);
      bob = createClient(options);
    });

    context('when alice (with audio and video tracks) and bob connect to the Room,', () => {
      it('should populate alice\'s Participant in bob\'s Room with her Media', () => {
        return alice.client.connect({
          name: roomName,
          localMedia: createFakeLocalMedia(alice.name),
          token: getToken({ address: alice.name })
        })
        .then((room) => {
          aliceRoom = room;
          PeerConnectionManager.prototype.getRemoteMediaStreams = () => [fakeStreams.get(alice.name)];
          return bob.client.connect({
            name: roomName,
            token: getToken({ address: bob.name })
          });
        })
        .then((room) => {
          bobRoom = room;
          var aliceParticipantSid = aliceRoom.localParticipant.sid;
          assert(bobRoom.participants.has(aliceParticipantSid));

          var aliceMedia = bobRoom.participants.get(aliceParticipantSid).media;
          assert.equal(aliceMedia.tracks.size, 2);

          fakeStreams.get(alice.name).getTracks().forEach((track) => {
            var aliceTrack = aliceMedia.tracks.get(track.id);
            assert.equal(aliceTrack.id, track.id);
            assert.equal(aliceTrack.kind, track.kind);
          });
        });
      });

      context('when bob later disconnects from the Room,', () => {
        it('should not trigger "trackRemoved" event on alice\'s Participant in bob\'s Room', () => {
          return alice.client.connect({
            name: roomName,
            localMedia: createFakeLocalMedia(alice.name),
            token: getToken({ address: alice.name })
          })
          .then((room) => {
            aliceRoom = room;
            PeerConnectionManager.prototype.getRemoteMediaStreams = () => [fakeStreams.get(alice.name)];
            return bob.client.connect({
              name: roomName,
              token: getToken({ address: bob.name })
            });
          })
          .then((room) => {
            bobRoom = room;
            return new Promise((resolve, reject) => {
              var aliceParticipantSid = aliceRoom.localParticipant.sid;
              var aliceParticipant = bobRoom.participants.get(aliceParticipantSid);

              aliceParticipant.on('trackRemoved', reject.bind(new Error(
                '"trackRemoved" triggered on alice\'s Participant'
              )));
              bobRoom.disconnect();
              setTimeout(resolve);
            });
          });
        });
      });
    });

    afterEach(() => {
      if (aliceRoom) {
        aliceRoom.disconnect();
        aliceRoom = null;
      }
      fakeStreams.delete(alice.name);
      alice = null;

      if (bobRoom) {
        bobRoom.disconnect();
        bobRoom = null;
      }
      bob = null;
      PeerConnectionManager.prototype.getRemoteMediaStreams = getRemoteMediaStreams;
    });
  });
});

function createClient(options) {
  var client = new Client(options);
  return {
    name: randomName(),
    client: client
  };
}

var fakeStreams = new Map();
var getRemoteMediaStreams =
  PeerConnectionManager.prototype.getRemoteMediaStreams;

function createFakeLocalMedia(name) {
  var fakeLocalMedia = new LocalMedia({ logLevel: logLevel });
  var fakeLocalMediaStream = new FakeMediaStream();
  var fakeLocalVideoTrack = new FakeMediaStreamTrack('video');
  var fakeLocalAudioTrack = new FakeMediaStreamTrack('audio');

  fakeLocalMediaStream.addTrack(fakeLocalVideoTrack);
  fakeLocalMediaStream.addTrack(fakeLocalAudioTrack);
  fakeLocalMedia.addStream(fakeLocalMediaStream);
  fakeStreams.set(name, fakeLocalMediaStream);

  return fakeLocalMedia;
}
