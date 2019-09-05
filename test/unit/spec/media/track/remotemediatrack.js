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
              track = makeTrack('foo', 'bar', kind, true, getOptions(), RemoteTrack);
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

          it('should set the .isEnabled property', () => {
            assert.equal(track.isEnabled, true);
          });

          it('should set the .isSwitchedOff property', () => {
            assert.equal(track.isSwitchedOff, false);
          });

          it('should set the .kind property', () => {
            assert.equal(track.kind, kind);
          });

          it('should set the .name property', () => {
            assert.equal(track.name, getOptions() ? 'bar' : 'foo');
          });

          it('should set the .sid property', () => {
            assert.equal(track.sid, 'bar');
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
            track = makeTrack('foo', 'bar', kind, isEnabled, null, RemoteTrack);
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

    describe('#_setSwitchedOff', () => {
      [
        [true, true],
        [true, false],
        [false, true],
        [false, false]
      ].forEach(([isSwitchedOff, newIsSwitchedOff]) => {
        context(`when .isSwitchedOff is ${isSwitchedOff} and the new value is ${newIsSwitchedOff}`, () => {
          let arg;
          let track;
          let trackSwitchedOff;
          let trackSwitchedOn;

          before(() => {
            arg = null;
            track = makeTrack('foo', 'bar', kind, true, null, RemoteTrack);
            if (isSwitchedOff) {
              track._setSwitchedOff(isSwitchedOff);
            }
            track.once('switchedOff', _arg => {
              trackSwitchedOff = true;
              arg = _arg;
            });
            track.once('switchedOn', _arg => {
              trackSwitchedOn = true;
              arg = _arg;
            });
            track._setSwitchedOff(newIsSwitchedOff);
          });

          if (isSwitchedOff === newIsSwitchedOff) {
            it('should not change the .isSwitchedOff property', () => {
              assert.equal(track.isSwitchedOff, isSwitchedOff);
            });

            it('should not emit any events', () => {
              assert(!trackSwitchedOff);
              assert(!trackSwitchedOn);
            });

            return;
          }

          it(`should set .isSwitchedOff to ${newIsSwitchedOff}`, () => {
            assert.equal(track.isSwitchedOff, newIsSwitchedOff);
          });

          it(`should emit "${newIsSwitchedOff ? 'switchedOff' : 'switchedOn'}" on the ${name} with the ${name} itself`, () => {
            assert(newIsSwitchedOff ? trackSwitchedOff : trackSwitchedOn);
            assert(!(newIsSwitchedOff ? trackSwitchedOn : trackSwitchedOff));
            assert.equal(arg, track);
          });
        });
      });
    });

    describe('Object.keys', () => {
      let track;

      before(() => {
        track = makeTrack('foo', 'MT1', kind, true, null, RemoteTrack);
      });

      it('only returns public properties', () => {
        if (kind === 'audio') {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'isEnabled',
            'isSwitchedOff',
            'sid'
          ]);
        } else {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'dimensions',
            'isEnabled',
            'isSwitchedOff',
            'sid'
          ]);
        }
      });
    });

    describe('#toJSON', () => {
      let track;

      before(() => {
        track = makeTrack('foo', 'MT1', kind, true, null, RemoteTrack);
      });

      it('only returns public properties', () => {
        if (kind === 'audio') {
          assert.deepEqual(track.toJSON(), {
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isSwitchedOff: track.isSwitchedOff,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name,
            sid: track.sid
          });
        } else {
          assert.deepEqual(track.toJSON(), {
            dimensions: track.dimensions,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isSwitchedOff: track.isSwitchedOff,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name,
            sid: track.sid
          });
        }
      });
    });
  });
});

function makeTrack(id, sid, kind, isEnabled, options, RemoteTrack) {
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const mediaTrackReceiver = new MediaTrackReceiver(id, mediaStreamTrack);
  return new RemoteTrack(sid, mediaTrackReceiver, isEnabled, options);
}
