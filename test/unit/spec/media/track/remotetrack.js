'use strict';

const assert = require('assert');
const log = require('../../../../lib/fakelog');
const { capitalize, randomBoolean, randomName } = require('../../../../lib/util');
const RemoteAudioTrack = require('../../../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { EventEmitter } = require('events');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

[
  [ 'audio', RemoteAudioTrack ],
  [ 'video', RemoteVideoTrack ]
].forEach(([ kind, RemoteTrack ]) => {
  let name = `Remote${capitalize(kind)}Track`;
  describe(`${name}`, () => {
    describe('constructor', () => {
      [ () => null, () => ({ log }) ].forEach(getOptions => {
        context(`when called with${getOptions() ? '' : 'out'} the options object`, () => {
          [ true, false ].forEach(shouldUseNew => {
            context(`when called with${shouldUseNew ? '' : 'out'} the new keyword`, () => {
              let track;

              const makeTrack = () => {
                const mediaStreamTrack = new FakeMediaStreamTrack(kind);
                const signaling = makeSignaling(randomBoolean(), randomBoolean(), randomName());
                return shouldUseNew ? new RemoteTrack(mediaStreamTrack, signaling, getOptions())
                  : RemoteTrack(mediaStreamTrack, signaling, getOptions());
              };

              before(() => {
                track = makeTrack();
              });

              it('shouldn\'t throw', () => {
                assert.doesNotThrow(makeTrack);
              });

              it(`should return an instance of ${name}`, () => {
                assert(track instanceof RemoteTrack);
              });

              [ 'isEnabled', 'isSubscribed', 'sid' ].forEach(prop => {
                it(`should set the .${prop} property to the RemoteTrackSignaling's .${prop}`, () => {
                  assert.equal(track[prop], track._signaling[prop]);
                });
              });
            });
          });
        });
      });
    });

    describe('#_unsubscribe', () => {
      [ true, false ].forEach(isSubscribed => {
        context(`when .isSubscribed is ${isSubscribed}`, () => {
          let track;
          let unsubscribed;

          before(() => {
            const mediaStreamTrack = new FakeMediaStreamTrack(kind);
            const signaling = makeSignaling(randomBoolean(), isSubscribed, randomName());
            track = new RemoteTrack(mediaStreamTrack, signaling);
            track.once('unsubscribed', track => unsubscribed = track);
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
  signaling.sid = sid;
  return signaling;
}
