'use strict';

const assert = require('assert');
const log = require('../../../../lib/fakelog');
const { capitalize, randomBoolean, randomName } = require('../../../../lib/util');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteAudioTrack = require('../../../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { EventEmitter } = require('events');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

[
  ['audio', RemoteAudioTrack],
  ['video', RemoteVideoTrack]
].forEach(([kind, RemoteTrack]) => {
  let name = `Remote${capitalize(kind)}Track`;
  describe(`${name}`, () => {
    describe('constructor', () => {
      [() => null, () => ({ log })].forEach(getOptions => {
        context(`when called with${getOptions() ? '' : 'out'} the options object`, () => {
          let track;

          function makeTrack() {
            const mediaStreamTrack = new FakeMediaStreamTrack(kind);
            const mediaTrackReceiver = new MediaTrackReceiver('foo', mediaStreamTrack);
            const signaling = makeSignaling(randomBoolean(), randomBoolean(), randomName());
            return new RemoteTrack(mediaTrackReceiver, signaling, getOptions());
          }

          before(() => {
            track = makeTrack();
          });

          it('shouldn\'t throw', () => {
            assert.doesNotThrow(makeTrack);
          });

          it(`should return an instance of ${name}`, () => {
            assert(track instanceof RemoteTrack);
          });

          ['isEnabled', 'isSubscribed', 'name', 'sid'].forEach(prop => {
            it(`should set the .${prop} property to the RemoteTrackSignaling's .${prop}`, () => {
              assert.equal(track[prop], track._signaling[prop]);
            });
          });
        });
      });
    });

    describe('#_unsubscribe', () => {
      [true, false].forEach(isSubscribed => {
        context(`when .isSubscribed is ${isSubscribed}`, () => {
          let track;
          let unsubscribed;

          before(() => {
            const mediaStreamTrack = new FakeMediaStreamTrack(kind);
            const mediaTrackReceiver = new MediaTrackReceiver('foo', mediaStreamTrack);
            const signaling = makeSignaling(randomBoolean(), isSubscribed, randomName());
            track = new RemoteTrack(mediaTrackReceiver, signaling);
            track.once('unsubscribed', track => { unsubscribed = track; });
            track._unsubscribe();
          });

          it(isSubscribed ? 'should set .isSubscribed to false' : 'should leave .isSubscribed unchanged', () => {
            assert.equal(track.isSubscribed, false);
          });

          it(`should ${isSubscribed ? '' : 'not'} emit the "unsubscribed" event`, () => {
            assert(isSubscribed ? unsubscribed === track : !unsubscribed);
          });
        });
      });
    });
  });
});

function makeSignaling(isEnabled, isSubscribed, sid) {
  const signaling = new EventEmitter();
  signaling.isEnabled = isEnabled;
  signaling.isSubscribed = isSubscribed;
  signaling.name = randomName();
  signaling.sid = sid;
  return signaling;
}
