'use strict';

const assert = require('assert');
const log = require('../../../../lib/fakelog');
const { capitalize } = require('../../../../lib/util');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteAudioTrack = require('../../../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');

[
  ['audio', RemoteAudioTrack],
  ['video', RemoteVideoTrack]
].forEach(([kind, RemoteTrack]) => {
  let name = `Remote${capitalize(kind)}Track`;
  describe(`${name}`, () => {
    describe('constructor', () => {
      [() => null, () => ({ log, name: 'bar' })].forEach(getOptions => {
        context(`when called with${getOptions() ? '' : 'out'} the options object`, () => {
          let error;
          let track;

          before(() => {
            try {
              track = makeTrack('foo', kind, true, getOptions(), RemoteTrack);
            } catch (e) {
              error = e;
            }
          });

          it('shouldn\'t throw', () => {
            assert(!error);
          });

          it(`should return an instance of ${name}`, () => {
            assert(track instanceof RemoteTrack);
          });

          it('should set the .id property', () => {
            assert.equal(track.id, 'foo');
          });

          it('should set the .isEnabled property', () => {
            assert(track.isEnabled);
          });

          it('should set the .kind property', () => {
            assert.equal(track.kind, kind);
          });

          it('should set the .name property', () => {
            assert.equal(track.name, getOptions() ? 'bar' : 'foo');
          });
        });
      });
    });

    describe('#_setEnabled', () => {
      [
        [true, true],
        [true, false],
        [false, true],
        [false, false]
      ].forEach(([isEnabled, newIsEnabled]) => {
        context(`when .isEnabled is ${isEnabled} and the new value is ${newIsEnabled}`, () => {
          let arg;
          let track;
          let trackDisabled;
          let trackEnabled;

          before(() => {
            arg = null;
            track = makeTrack('foo', kind, isEnabled, null, RemoteTrack);
            track.once('disabled', _arg => {
              trackDisabled = true;
              arg = _arg;
            });
            track.once('enabled', _arg => {
              trackEnabled = true;
              arg = _arg;
            });
            track._setEnabled(newIsEnabled);
          });

          if (isEnabled === newIsEnabled) {
            it('should not change the .isEnabled property', () => {
              assert.equal(track.isEnabled, isEnabled);
            });

            it('should not emit any events', () => {
              assert(!trackDisabled);
              assert(!trackEnabled);
            });

            return;
          }

          it(`should set .isEnabled to ${newIsEnabled}`, () => {
            assert.equal(track.isEnabled, newIsEnabled);
          });

          it(`should emit "${newIsEnabled ? 'enabled' : 'disabled'}" on the ${name} with the ${name} itself`, () => {
            assert(newIsEnabled ? trackEnabled : trackDisabled);
            assert(!(newIsEnabled ? trackDisabled : trackEnabled));
            assert.equal(arg, track);
          });
        });
      });
    });

    describe('Object.keys', () => {
      let track;

      before(() => {
        track = makeTrack('foo', kind, true, null, RemoteTrack);
      });

      it('only returns public properties', () => {
        if (kind === 'audio') {
          assert.deepEqual(Object.keys(track), [
            'id',
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'isEnabled',
            'isSubscribed',
            'sid'
          ]);
        } else {
          assert.deepEqual(Object.keys(track), [
            'id',
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'dimensions',
            'isEnabled',
            'isSubscribed',
            'sid'
          ]);
        }
      });
    });

    describe('#toJSON', () => {
      let track;

      before(() => {
        track = makeTrack('foo', kind, true, null, RemoteTrack);
      });

      it('only returns public properties', () => {
        if (kind === 'audio') {
          assert.deepEqual(track.toJSON(), {
            id: track.id,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isSubscribed: track.isSubscribed,
            kind: track.kind,
            name: track.name,
            sid: track.sid
          });
        } else {
          assert.deepEqual(track.toJSON(), {
            dimensions: track.dimensions,
            id: track.id,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isSubscribed: track.isSubscribed,
            kind: track.kind,
            name: track.name,
            sid: track.sid
          });
        }
      });
    });
  });
});

function makeTrack(id, kind, isEnabled, options, RemoteTrack) {
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const mediaTrackReceiver = new MediaTrackReceiver(id, mediaStreamTrack);
  return new RemoteTrack(mediaTrackReceiver, isEnabled, options);
}
