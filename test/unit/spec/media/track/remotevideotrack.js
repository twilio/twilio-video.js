'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { combinationContext } = require('../../../../lib/util');
const Document = require('../../../../lib/document');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');
const { NullIntersectionObserver: IntersectionObserver, NullResizeObserver: ResizeObserver } = require('../../../../../lib/util/nullobserver');
const { waitForSometime } = require('../../../../../lib/util');

describe('RemoteVideoTrack', () => {
  combinationContext([
    [
      ['auto', 'manual', 'disabled', undefined],
      x => `when clientTrackSwitchOffControl is ${typeof x === 'string' ? `set to ${x}` : 'not set'}`
    ],
    [
      ['auto', 'manual', 'disabled', undefined],
      x => `when contentPreferencesMode is ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
    ],
    [
      [true, false, undefined],
      x => `when enableDocumentVisibilityTurnOff is ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
    ],
  ], ([clientTrackSwitchOffControl, contentPreferencesMode, enableDocumentVisibilityTurnOff]) => {
    let track;
    let el;
    let IntersectionObserverSpy;
    let ResizeObserverSpy;
    let intersectionObserveSpy;
    let intersectionUnobserveSpy;
    let resizeObserveSpy;
    let resizeUnobserveSpy;
    let setRenderHintsSpy;
    let addEventListenerStub;
    let removeEventListenerStub;
    before(() => {
      IntersectionObserverSpy = sinon.spy(IntersectionObserver);
      ResizeObserverSpy = sinon.spy(ResizeObserver);
      let options = { };
      if (typeof enableDocumentVisibilityTurnOff === 'boolean') {
        options.enableDocumentVisibilityTurnOff = enableDocumentVisibilityTurnOff;
      }
      if (typeof clientTrackSwitchOffControl === 'string') {
        options.clientTrackSwitchOffControl = clientTrackSwitchOffControl;
      }
      if (typeof contentPreferencesMode === 'string') {
        options.contentPreferencesMode = contentPreferencesMode;
      }

      global.document = global.document || new Document();
      global.IntersectionObserver = IntersectionObserverSpy;
      global.ResizeObserver = ResizeObserverSpy;
      documentVisibilityMonitor.clear();
      addEventListenerStub = sinon.spy(document, 'addEventListener');
      removeEventListenerStub = sinon.spy(document, 'removeEventListener');

      const dummyElement = { oncanplay: sinon.spy() };
      document.createElement = sinon.spy(() => {
        return dummyElement;
      });

      el = document.createElement('video');
      setRenderHintsSpy = sinon.spy();

      track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintsSpy, options });
      intersectionObserveSpy = sinon.spy(track._intersectionObserver, 'observe');
      intersectionUnobserveSpy = sinon.spy(track._intersectionObserver, 'unobserve');
      resizeObserveSpy = sinon.spy(track._resizeObserver, 'observe');
      resizeUnobserveSpy = sinon.spy(track._resizeObserver, 'unobserve');
    });

    after(() => {
      addEventListenerStub.restore();
      removeEventListenerStub.restore();
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    const effectiveClientTrackSwitchOffControl = clientTrackSwitchOffControl || 'auto';
    const effectiveContentPreferencesMode = contentPreferencesMode || 'auto';
    const effectiveDocVisibility = effectiveClientTrackSwitchOffControl === 'auto' && enableDocumentVisibilityTurnOff !== false;
    const autoTrackSwitchOff = effectiveClientTrackSwitchOffControl === 'auto';
    const autoContentPreferencesMode = effectiveContentPreferencesMode === 'auto';

    describe('constructor', () => {
      it('sets correct default for _clientTrackSwitchOffControl', () => {
        assert(track._clientTrackSwitchOffControl === effectiveClientTrackSwitchOffControl);
      });

      it('sets correct default for _contentPreferencesMode', () => {
        assert(track._contentPreferencesMode === effectiveContentPreferencesMode);
      });

      it('sets correct default for _enableDocumentVisibilityTurnOff', () => {
        assert(track._enableDocumentVisibilityTurnOff === effectiveDocVisibility);
      });

      if (autoTrackSwitchOff) {
        it('constructs IntersectionObserver', () => {
          sinon.assert.callCount(IntersectionObserverSpy, 1);
        });
      } else {
        it('does not construct IntersectionObserver', () => {
          sinon.assert.callCount(IntersectionObserverSpy, 0);
        });
      }

      if (autoContentPreferencesMode) {
        it('constructs ResizeObserver', () => {
          sinon.assert.callCount(ResizeObserverSpy, 1);
        });
      } else {
        it('does not construct ResizeObserver', () => {
          sinon.assert.callCount(ResizeObserverSpy, 0);
        });
      }
    });

    describe('when an element is attached', () => {
      before(() => {
        track.attach(el);
      });

      it('IntersectionObserver observe is called', () => {
        sinon.assert.callCount(intersectionObserveSpy, 1);
        sinon.assert.calledWith(intersectionObserveSpy, el);
      });

      it('ResizeObserver observe is called', () => {
        sinon.assert.callCount(resizeObserveSpy, 1);
        sinon.assert.calledWith(resizeObserveSpy, el);
      });

      if (effectiveDocVisibility) {
        it('listens for document visibility change', () => {
          sinon.assert.callCount(document.addEventListener, 1);
          sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
          sinon.assert.callCount(document.removeEventListener, 0);
        });
      } else {
        it('does not register for document visibility change', () => {
          assert(track._enableDocumentVisibilityTurnOff === false);
          sinon.assert.notCalled(document.addEventListener);
        });
      }
    });

    describe('after element receives started event', () => {
      before(() => {
        sinon.assert.callCount(setRenderHintsSpy, 0);
        el.oncanplay(); // simulate started event.
      });

      if (effectiveClientTrackSwitchOffControl === 'auto') {
        it('_setRenderHint gets called with a delay', async () => {
          await waitForSometime(1000);
          sinon.assert.callCount(setRenderHintsSpy, 1);
        });
      } else {
        it('_setRenderHint does not gets called', () => {
          sinon.assert.callCount(setRenderHintsSpy, 0);
        });
      }
    });

    describe('when an element is detached', () => {
      before(() => {
        track.detach(el);
      });

      it('IntersectionObserver unobserve is called', () => {
        sinon.assert.callCount(intersectionUnobserveSpy, 1);
        sinon.assert.calledWith(intersectionUnobserveSpy, el);
      });

      if (autoTrackSwitchOff) {
        it(' _setRenderHint gets called with { enable: false } after a delay', async () => {
          await waitForSometime(200);
          sinon.assert.calledWith(setRenderHintsSpy, { enabled: false });
        });
      }

      it('ResizeObserver unobserve is called', () => {
        sinon.assert.callCount(resizeUnobserveSpy, 1);
        sinon.assert.calledWith(resizeUnobserveSpy, el);
      });

      if (effectiveDocVisibility) {
        it('stops listening when element is detached', () => {
          sinon.assert.callCount(document.addEventListener, 1);
          sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
          sinon.assert.callCount(document.removeEventListener, 1);
          sinon.assert.calledWith(document.removeEventListener, 'visibilitychange');
        });
      } else {
        it('does not start or stop listening for visibility', () => {
          sinon.assert.notCalled(document.addEventListener);
          sinon.assert.notCalled(document.removeEventListener);
        });
      }
    });

    describe('#switchOn', () => {
      beforeEach(() => {
        setRenderHintsSpy.resetHistory();
      });
      const allowManualSwitchOff = effectiveClientTrackSwitchOffControl === 'manual';
      if (allowManualSwitchOff) {
        it('calls _setRenderHint with enable = true', () => {
          track.switchOn();
          sinon.assert.calledWith(setRenderHintsSpy, sinon.match.has('enabled', true));
        });
      } else {
        it('throws an error', () => {
          let errorThrown = null;
          try {
            track.switchOn();
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOn only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
          sinon.assert.notCalled(setRenderHintsSpy);
        });
      }
    });

    describe('#switchOff', () => {
      beforeEach(() => {
        setRenderHintsSpy.resetHistory();
      });
      const allowManualSwitchOff = effectiveClientTrackSwitchOffControl === 'manual';
      if (allowManualSwitchOff) {
        it('calls _setRenderHint with enable = false', () => {
          track.switchOff();
          sinon.assert.calledWith(setRenderHintsSpy, sinon.match.has('enabled', false));
        });
      } else {
        it('throws an error', () => {
          let errorThrown = null;
          try {
            track.switchOff();
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOff only when bandwidthProfile.video.clientTrackSwitchOffControl is set to "manual"');
          sinon.assert.notCalled(setRenderHintsSpy);
        });
      }
    });

    describe('#setContentPreferences', () => {
      beforeEach(() => {
        setRenderHintsSpy.resetHistory();
      });
      const allowManualContentHints = effectiveContentPreferencesMode === 'manual';
      if (allowManualContentHints !== false) {
        it('calls _setRenderHint with given dimensions', () => {
          track.setContentPreferences({ renderDimensions: { width: 100, height: 101 } });
          sinon.assert.calledWith(setRenderHintsSpy, sinon.match.has('renderDimensions', { width: 100, height: 101 }));
        });
      } else {
        it('throws an error', () => {
          let errorThrown = null;
          try {
            track.setContentPreferences({ renderDimensions: { width: 100, height: 101 } });
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOn only when bandwidthProfile.video.contentPreferencesMode is set to "manual"');
          sinon.assert.notCalled(setRenderHintsSpy);
        });
      }
    });
  });

  describe('IntersectionObserver', () => {
    let track;
    let el;
    let observeSpy;
    let unobserveSpy;
    let setRenderHintsSpy;

    before(() => {
      global.document = global.document || new Document();
      el = document.createElement('video');
      setRenderHintsSpy = sinon.spy();
      track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintsSpy, options: { IntersectionObserver } });
      observeSpy = sinon.spy(IntersectionObserver.prototype, 'observe');
      unobserveSpy = sinon.spy(IntersectionObserver.prototype, 'unobserve');
    });

    after(() => {
      observeSpy.restore();
      unobserveSpy.restore();
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    context('when an element is', () => {
      before(() => {
        track.attach(el);
        setRenderHintsSpy.resetHistory();
      });

      it('visible, _setRenderHint gets called with { enable: true }', () => {
        el.clientWidth = 103;
        el.clientHeight = 104;
        track._intersectionObserver.makeVisible(el);
        sinon.assert.calledWith(setRenderHintsSpy, sinon.match.has('enabled', true));

        // also dimensions get updated.
        sinon.assert.calledWith(setRenderHintsSpy, { renderDimensions: { width: 103, height: 104 } });
      });

      it('invisible, _setRenderHint gets called with { enable: false } after some delay', async () => {
        track._intersectionObserver.makeInvisible(el);
        await waitForSometime(1000);
        sinon.assert.calledWith(setRenderHintsSpy, { enabled: false });
      });
    });
  });

  describe('ResizeObserver', () => {
    let track;
    let el;
    let observeSpy;
    let unobserveSpy;
    let setRenderHintsSpy;

    before(() => {
      global.document = global.document || new Document();
      el = document.createElement('video');
      setRenderHintsSpy = sinon.spy();
      track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintsSpy, options: { ResizeObserver } });
      observeSpy = sinon.spy(track._resizeObserver, 'observe');
      unobserveSpy = sinon.spy(track._resizeObserver, 'unobserve');
    });

    after(() => {
      observeSpy.restore();
      unobserveSpy.restore();
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    context('detects size change of visible element', () => {
      before(() => {
        track.attach(el);
        track._intersectionObserver.makeVisible(el);
        el.clientWidth = 100;
        el.clientHeight = 100;
        setRenderHintsSpy.resetHistory();
      });

      it('_setRenderHint gets called with { enable: true }', () => {
        track._resizeObserver.resize(el);
        sinon.assert.calledWith(setRenderHintsSpy, { renderDimensions: { height: 100, width: 100 } });
      });
    });

    context('ignores size change of invisible element', () => {
      before(() => {
        track.attach(el);
        track._intersectionObserver.makeInvisible(el);
        el.clientWidth = 100;
        el.clientHeight = 100;
        setRenderHintsSpy.resetHistory();
      });

      it('_setRenderHint does not get called', () => {
        track._resizeObserver.resize(el);
        sinon.assert.notCalled(setRenderHintsSpy);
      });
    });

    context('reports SDmax size among attached visible elements', () => {
      before(() => {
        track.attach(el);
        track._intersectionObserver.makeVisible(el);
        el.clientWidth = 100;
        el.clientHeight = 100;

        const el2 = document.createElement('video');
        track.attach(el2);
        track._intersectionObserver.makeVisible(el2);
        el2.clientWidth = 200;
        el2.clientHeight = 200;
        setRenderHintsSpy.resetHistory();
      });

      it('_setRenderHint does not get called', () => {
        // even though 100x100 element was resized.
        track._resizeObserver.resize(el);

        // expect reported size to be 200x200
        sinon.assert.calledWith(setRenderHintsSpy, { renderDimensions: { height: 200, width: 200 } });
      });
    });
  });
});


function makeTrack({ id, sid, isEnabled, options, setPriority, setRenderHint, isSwitchedOff }) {
  const emptyFn = () => undefined;
  setPriority = setPriority || emptyFn;
  setRenderHint = setRenderHint || emptyFn;
  isSwitchedOff = !!isSwitchedOff;
  isEnabled = typeof isEnabled === 'boolean' ? true : isEnabled;
  const mediaStreamTrack = new FakeMediaStreamTrack('video');
  const mediaTrackReceiver = new MediaTrackReceiver(id, mediaStreamTrack);
  return new RemoteVideoTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);
}
