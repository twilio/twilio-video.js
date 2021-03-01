'use strict';

const assert = require('assert');
const sinon = require('sinon');
const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');
const { capitalize } = require('../../../../lib/util');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteAudioTrack = require('../../../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');

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
              track = makeTrack({ id: 'foo', sid: 'bar', kind, isEnabled: true, isSwitchedOff: false, options: getOptions(), RemoteTrack });
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

    const { trackPriority } = require('../../../../../lib/util/constants');

    describe('#setPriority', () => {
      let options;
      let track;
      let onPriorityChange;
      beforeEach(() => {
        onPriorityChange = sinon.spy();
        track = makeTrack({ id: 'foo', sid: 'bar', kind, isEnabled: true, options, RemoteTrack, setPriority: onPriorityChange });
      });

      [null, ...Object.values(trackPriority)].forEach(priorityValue => {
        it('sets priority when called with valid priority value: ' + priorityValue, () => {
          let originalPriority = track.priority;
          track.setPriority(priorityValue);
          if (originalPriority !== priorityValue) {
            sinon.assert.calledWith(onPriorityChange, priorityValue);
          }
          assert.equal(track.priority, priorityValue);
        });
      });

      [undefined, '', 'foo', {}, 42, true].forEach(priorityValue => {
        it('throws RangeError for invalid priority value: ' + priorityValue, () => {
          let errorThrown = false;
          try {
            track.setPriority(priorityValue);
          } catch (error) {
            assert(error instanceof RangeError);
            errorThrown = true;
          }
          assert.equal(errorThrown, true);
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
            track = makeTrack({ id: 'foo', sid: 'bar', kind, isEnabled, options: null, RemoteTrack });
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
            track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff, isEnabled: true, options: null, RemoteTrack });
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
        track = makeTrack({ id: 'foo', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
      });

      it('only returns public properties', () => {
        if (kind === 'audio') {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'processedTrack',
            'isEnabled',
            'isSwitchedOff',
            'priority',
            'sid'
          ]);
        } else {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'processedTrack',
            'dimensions',
            'processor',
            'isEnabled',
            'isSwitchedOff',
            'priority',
            'sid'
          ]);
        }
      });
    });

    describe('#attach', () => {
      it('enables the track if disabled', () => {
        let track = makeTrack({ id: 'foo', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
        track._createElement = sinon.spy(() => {
          // return a unique element.
          return {
            internalId: Date()
          };
        });

        track.mediaStreamTrack.enabled = false;
        let el1 = track.attach();
        assert(el1);
        assert.equal(track.mediaStreamTrack.enabled, true);
      });
    });

    describe('#detach', () => {
      let el1;
      let el2;
      let track;
      beforeEach(() => {
        track = makeTrack({ id: 'foo', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
        track._createElement = sinon.spy(() => {
          // return a unique element.
          return {
            internalId: Date()
          };
        });

        el1 = track.attach();
        assert.equal(track.mediaStreamTrack.enabled, true);
        el2 = track.attach();
      });

      it('when no element specified, detaches all and disables the track', () => {
        assert.equal(track.mediaStreamTrack.enabled, true);
        let elements = track.detach();
        assert.equal(elements.length, 2);
        assert.equal(track.mediaStreamTrack.enabled, false);
      });

      it('after detaching elements does not disable track if more elements are attached', () => {
        assert.equal(track.mediaStreamTrack.enabled, true);
        track.detach(el1);
        assert.equal(track.mediaStreamTrack.enabled, true);
      });

      it('after detaching last element disables the track', () => {
        assert.equal(track.mediaStreamTrack.enabled, true);
        track.detach(el1);
        assert.equal(track.mediaStreamTrack.enabled, true);
        track.detach(el2);
        assert.equal(track.mediaStreamTrack.enabled, false);
      });
    });


    describe('#toJSON', () => {
      let track;

      before(() => {
        track = makeTrack({ id: 'foo', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
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
            priority: null,
            processedTrack: null,
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
            priority: null,
            processedTrack: null,
            processor: null,
            sid: track.sid
          });
        }
      });
    });

    describe('workaroundWebKitBug212780', () => {
      let addEventListenerStub;
      let removeEventListenerStub;

      before(() => {
        documentVisibilityMonitor.clear();
        global.document = global.document || new Document();
        addEventListenerStub = sinon.spy(document, 'addEventListener');
        removeEventListenerStub = sinon.spy(document, 'removeEventListener');
      });

      after(() => {
        addEventListenerStub.restore();
        removeEventListenerStub.restore();
        if (global.document instanceof Document && kind === 'video') {
          delete global.document;
        }
      });

      describe('constructor', () => {
        context('when called without workaroundWebKitBug1208516', () => {
          let track;
          before(() => {
            document.visibilityState = 'visible';
            track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { workaroundWebKitBug212780: false }, RemoteTrack });
          });

          it('does not register for document visibility change', () => {
            assert(track._workaroundWebKitBug212780 === false);
            sinon.assert.notCalled(document.addEventListener);
          });
        });

        context('when called with workaroundWebKitBug1208516', () => {
          let track;
          before(() => {
            document.visibilityState = 'visible';
            track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { workaroundWebKitBug212780: true }, RemoteTrack });
          });

          it('sets _workaroundWebKitBug212780 to true', () => {
            assert(track._workaroundWebKitBug212780 === true);
          });

          context('when an element is attached', () => {
            let el;
            before(() => {
              el = track.attach();
            });

            it('listens for document visibility change', () => {
              sinon.assert.callCount(document.addEventListener, 1);
              sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
              sinon.assert.callCount(document.removeEventListener, 0);
            });

            it('stops listening when element is detached', () => {
              track.detach(el);
              sinon.assert.callCount(document.addEventListener, 1);
              sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
              sinon.assert.callCount(document.removeEventListener, 1);
              sinon.assert.calledWith(document.removeEventListener, 'visibilitychange');
            });
          });
        });
      });
    });
  });
});

function makeTrack({ id, sid, kind, isEnabled, options, RemoteTrack, setPriority, setRenderHint, isSwitchedOff }) {
  const emptyFn = () => undefined;
  setPriority = setPriority || emptyFn;
  setRenderHint = setRenderHint || emptyFn;
  isSwitchedOff = !!isSwitchedOff;
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const mediaTrackReceiver = new MediaTrackReceiver(id, mediaStreamTrack);
  return new RemoteTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);
}
