'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Document = require('../../../../lib/document');
const { capitalize } = require('../../../../lib/util');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteAudioTrack = require('../../../../../lib/media/track/remoteaudiotrack');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');
const { NullIntersectionObserver } = require('../../../../../lib/util/nullobserver');

[
  ['audio', RemoteAudioTrack],
  ['video', RemoteVideoTrack]
].forEach(([kind, RemoteTrack]) => {
  const className = `Remote${capitalize(kind)}Track`;
  describe(`${className}`, () => {
    describe('constructor', () => {
      const name = 'bar';
      let error;
      let log;
      let track;

      before(() => {
        try {
          track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isEnabled: true, isSwitchedOff: false, options: { name }, RemoteTrack });
          log = track._log;
          log.warn = sinon.spy();
        } catch (e) {
          error = e;
        }
      });

      it('shouldn\'t throw', () => {
        assert(!error);
      });

      it(`should return an instance of ${className}`, () => {
        assert(track instanceof RemoteTrack);
      });

      it('should set the .isEnabled property and log deprecation warning the first time it is accessed', () => {
        assert.equal(track.isEnabled, true);
        sinon.assert.callCount(log.warn, 1);
        sinon.assert.calledWith(log.warn, '.isEnabled is deprecated and scheduled for removal. '
          + 'The RemoteMediaTrack is can be considered disabled if .isSwitchedOff is '
          + 'set to true and .switchOffReason is set to "disabled-by-publisher".');
      });

      it('should not log deprecation warning when .isEnabled is accessed a second time', () => {
        assert.equal(track.isEnabled, true);
        sinon.assert.callCount(log.warn, 1);
      });

      it('should set the .isSwitchedOff property', () => {
        assert.equal(track.isSwitchedOff, false);
      });

      it('should set the .kind property', () => {
        assert.equal(track.kind, kind);
      });

      it('should set the .name property', () => {
        assert.equal(track.name, name);
      });

      it('should set the .sid property', () => {
        assert.equal(track.sid, 'bar');
      });

      [
        ['disabled', `${className}#disabled has been deprecated and scheduled for removal. Use ${className}#switchedOff (.switchOffReason === "disabled-by-publisher") instead.`],
        ['enabled', `${className}#enabled has been deprecated and scheduled for removal. Use ${className}#switchedOn instead.`]
      ].forEach(([event, warning], i) => {
        it(`should emit deprecation warning when "${event}" event is listened to for the first time`, () => {
          track.on(event, () => {});
          sinon.assert.callCount(log.warn, 2 + i);
          sinon.assert.calledWith(log.warn, warning);
        });

        it(`should not emit deprecation warning when "${event}" event is listened to for the second time`, () => {
          track.on(event, () => {});
          sinon.assert.callCount(log.warn, 2 + i);
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
        track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isEnabled: true, options, RemoteTrack, setPriority: onPriorityChange });
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
            track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isEnabled, options: null, RemoteTrack });
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

          it(`should emit "${newIsEnabled ? 'enabled' : 'disabled'}" on the ${className} with the ${className} itself`, () => {
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
            track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isSwitchedOff, isEnabled: true, options: null, RemoteTrack });
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

          it(`should emit "${newIsSwitchedOff ? 'switchedOff' : 'switchedOn'}" on the ${className} with the ${className} itself`, () => {
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
        track = makeTrack({ id: 'foo', mid: 'bar', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
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
            'sid',
            'switchOffReason'
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
            'sid',
            'switchOffReason'
          ]);
        }
      });
    });

    describe('#attach', () => {
      let track;

      beforeEach(() => {
        track = makeTrack({ id: 'foo', mid: 'bar', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
        track.mediaStreamTrack.enabled = false;
        track._captureFrames = sinon.stub();
        track._createElement = sinon.spy(() => {
          // return a unique element.
          return {
            internalId: Date(),
            addEventListener: sinon.spy(),
            removeEventListener: sinon.spy()

          };
        });
      });

      it('enables the track if disabled', () => {
        let el1 = track.attach();
        assert(el1);
        assert.equal(track.mediaStreamTrack.enabled, true);
      });

      it('starts processing frames if processor exists', () => {
        track.processor = 'foo';
        track.attach();
        sinon.assert.called(track._captureFrames);
      });

      it('do not start processing frames if processor does not exists', () => {
        track.processor = null;
        track.attach();
        sinon.assert.notCalled(track._captureFrames);
      });

      it('set processedTrack to enabled if it exists', () => {
        track.processedTrack = {};
        track.attach();
        assert(track.processedTrack.enabled);
      });

      it('do not set processedTrack to enabled if it does not exists', () => {
        track.processedTrack = null;
        track.attach();
        assert(!track.processedTrack);
      });
    });

    describe('#detach', () => {
      let el1;
      let el2;
      let track;
      beforeEach(() => {
        track = makeTrack({ id: 'foo', mid: 'bar', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
        track._createElement = sinon.spy(() => {
          // return a unique element.
          return {
            internalId: Date(),
            addEventListener: sinon.spy(),
            removeEventListener: sinon.spy()
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

      it('set processedTrack to disabled if it exists', () => {
        track.processedTrack = {};
        track.detach();
        assert.equal(track.processedTrack.enabled, false);
      });

      it('do not set processedTrack to disabled if it does not exists', () => {
        track.detach();
        assert(!track.processedTrack);
      });
    });


    describe('#toJSON', () => {
      let track;

      before(() => {
        track = makeTrack({ id: 'foo', mid: 'bar', sid: 'MT1', kind, isEnabled: true, options: null, RemoteTrack });
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
            sid: track.sid,
            switchOffReason: null
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
            sid: track.sid,
            switchOffReason: null
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
            track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { workaroundWebKitBug212780: false }, RemoteTrack });
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
            track = makeTrack({ id: 'foo', mid: 'baz', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { workaroundWebKitBug212780: true }, RemoteTrack });
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

function makeTrack({ id, mid, sid, kind, isEnabled, options, RemoteTrack, setPriority, setRenderHint, isSwitchedOff }) {
  const emptyFn = () => undefined;
  setPriority = setPriority || emptyFn;
  setRenderHint = setRenderHint || emptyFn;
  isSwitchedOff = !!isSwitchedOff;
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const mediaTrackReceiver = new MediaTrackReceiver(id, mid, mediaStreamTrack);
  options = options || {};
  options.IntersectionObserver = NullIntersectionObserver;
  return new RemoteTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, null, setPriority, setRenderHint, options);
}
