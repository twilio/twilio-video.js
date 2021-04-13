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

describe('RemoteVideoTrack', () => {
  combinationContext([
    [
      [true, false, undefined],
      x => `when idleTrackSwitchOff is ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
    ],
    [
      [true, false, undefined],
      x => `when renderHints is ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
    ],
    [
      [true, false, undefined],
      x => `when enableDocumentVisibilityTurnOff is ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
    ],
  ], ([idleTrackSwitchOff, renderHints, enableDocumentVisibilityTurnOff]) => {
    let track;
    let el;
    let IntersectionObserverSpy;
    let ResizeObserverSpy;
    let intersectionObserveSpy;
    let intersectionUnobserveSpy;
    let resizeObserveSpy;
    let resizeUnobserveSpy;
    let setRenderHintSpy;
    let addEventListenerStub;
    let removeEventListenerStub;
    before(() => {
      IntersectionObserverSpy = sinon.spy(IntersectionObserver);
      ResizeObserverSpy = sinon.spy(ResizeObserver);
      let options = { };
      if (typeof enableDocumentVisibilityTurnOff === 'boolean') {
        options.enableDocumentVisibilityTurnOff = enableDocumentVisibilityTurnOff;
      }
      if (typeof idleTrackSwitchOff === 'boolean') {
        options.idleTrackSwitchOff = idleTrackSwitchOff;
      }
      if (typeof renderHints === 'boolean') {
        options.renderHints = renderHints;
      }

      global.document = global.document || new Document();
      global.IntersectionObserver = IntersectionObserverSpy;
      global.ResizeObserver = ResizeObserverSpy;
      documentVisibilityMonitor.clear();
      addEventListenerStub = sinon.spy(document, 'addEventListener');
      removeEventListenerStub = sinon.spy(document, 'removeEventListener');

      el = document.createElement('video');
      setRenderHintSpy = sinon.spy();

      track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options });
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

    const effectiveIdleTrackSwitchOff = idleTrackSwitchOff !== false;
    const effectiveRenderHints = renderHints !== false;
    const effectiveDocVisibility = effectiveIdleTrackSwitchOff && enableDocumentVisibilityTurnOff !== false;

    describe('constructor', () => {
      it('sets correct default for _idleTrackSwitchOff', () => {
        assert(track._idleTrackSwitchOff === effectiveIdleTrackSwitchOff);
      });

      it('sets correct default for _renderHints', () => {
        assert(track._renderHints === effectiveRenderHints);
      });

      it('sets correct default for _enableDocumentVisibilityTurnOff', () => {
        assert(track._enableDocumentVisibilityTurnOff === effectiveDocVisibility);
      });

      if (effectiveIdleTrackSwitchOff) {
        it('constructs IntersectionObserver', () => {
          sinon.assert.callCount(IntersectionObserverSpy, 1);
        });
      } else {
        it('does not construct IntersectionObserver', () => {
          sinon.assert.callCount(IntersectionObserverSpy, 0);
        });
      }

      if (effectiveRenderHints) {
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

    context('when an element is detached', () => {
      before(() => {
        track.detach(el);
      });

      it('IntersectionObserver unobserve is called', () => {
        sinon.assert.callCount(intersectionUnobserveSpy, 1);
        sinon.assert.calledWith(intersectionUnobserveSpy, el);
      });

      if (effectiveIdleTrackSwitchOff || effectiveRenderHints) {
        it(' _setRenderHint gets called with { enable: false }', () => {
          const enabled = effectiveIdleTrackSwitchOff === false;
          sinon.assert.calledWith(setRenderHintSpy, { enabled });
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

  });

  describe('#switchOn', () => {
    [true, false, undefined].forEach(allowManualSwitchOff => {
      let setRenderHintSpy;
      let track;
      beforeEach(() => {
        setRenderHintSpy = sinon.spy();
        track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options: { allowManualSwitchOff } });
      });
      if (allowManualSwitchOff !== false) {
        it('calls _setRenderHint with enable = true when allowManualSwitchOff = ' + allowManualSwitchOff, () => {
          track.switchOn();
          sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', true));
        });
      } else {
        it('throws an error when allowManualSwitchOff = ' + allowManualSwitchOff, () => {
          let errorThrown = null;
          try {
            track.switchOn();
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOn only when connected with bandwidthProfile.video.subscribedTrackSwitchOff set to "manual"');
          sinon.assert.notCalled(setRenderHintSpy);
        });
      }
    });
  });

  describe('#switchOff', () => {
    [true, false, undefined].forEach(allowManualSwitchOff => {
      let setRenderHintSpy;
      let track;
      beforeEach(() => {
        setRenderHintSpy = sinon.spy();
        track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options: { allowManualSwitchOff } });
      });
      if (allowManualSwitchOff !== false) {
        it('calls _setRenderHint with enable = true when allowManualSwitchOff = ' + allowManualSwitchOff, () => {
          track.switchOff();
          sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', false));
        });
      } else {
        it('throws an error when allowManualSwitchOff = ' + allowManualSwitchOff, () => {
          let errorThrown = null;
          try {
            track.switchOff();
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOff only when connected with bandwidthProfile.video.subscribedTrackSwitchOff set to "manual"');
          sinon.assert.notCalled(setRenderHintSpy);
        });
      }
    });
  });

  describe('#setContentPreferences', () => {
    [true, false, undefined].forEach(allowManualContentHints => {
      let setRenderHintSpy;
      let track;
      beforeEach(() => {
        setRenderHintSpy = sinon.spy();
        track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options: { allowManualContentHints } });
      });
      if (allowManualContentHints !== false) {
        it('calls _setRenderHint with enable = true when allowManualContentHints = ' + allowManualContentHints, () => {
          track.setContentPreferences({ renderDimensions: { width: 100, height: 101 } });
          sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('renderDimensions', { width: 100, height: 101 }));
        });
      } else {
        it('throws an error when allowManualContentHints = ' + allowManualContentHints, () => {
          let errorThrown = null;
          try {
            track.setContentPreferences({ renderDimensions: { width: 100, height: 101 } });
          } catch (error) {
            errorThrown = error;
          }
          assert.strictEqual(errorThrown.message, 'Invalid state. You can call switchOn only when connected with bandwidthProfile.video.renderDimensions set to "manual"');
          sinon.assert.notCalled(setRenderHintSpy);
        });
      }
    });
  });
});

describe('IntersectionObserver', () => {
  let track;
  let el;
  let observeSpy;
  let unobserveSpy;
  let setRenderHintSpy;

  before(() => {
    global.document = global.document || new Document();
    el = document.createElement('video');
    setRenderHintSpy = sinon.spy();
    track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options: { IntersectionObserver } });
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
      setRenderHintSpy.reset();
    });

    it('visible, _setRenderHint gets called with { enable: true }', () => {
      track._intersectionObserver.makeVisible(el);
      sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', true));
      sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('renderDimensions', { height: sinon.match.any, width: sinon.match.any }));
    });

    it('invisible, _setRenderHint gets called with { enable: false }', () => {
      track._intersectionObserver.makeInvisible(el);
      sinon.assert.calledWith(setRenderHintSpy, { enabled: false });
    });

  });
});

describe('ResizeObserver', () => {
  let track;
  let el;
  let observeSpy;
  let unobserveSpy;
  let setRenderHintSpy;

  before(() => {
    global.document = global.document || new Document();
    el = document.createElement('video');
    setRenderHintSpy = sinon.spy();
    track = makeTrack({ id: 'foo', sid: 'bar', setRenderHint: setRenderHintSpy, options: { ResizeObserver } });
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
      setRenderHintSpy.reset();
    });

    it('_setRenderHint gets called with { enable: true }', () => {
      track._resizeObserver.resize(el);
      sinon.assert.calledWith(setRenderHintSpy, { enabled: true, renderDimensions: { height: 100, width: 100 } });
    });
  });

  context('ignores size change of invisible element', () => {
    before(() => {
      track.attach(el);
      track._intersectionObserver.makeInvisible(el);
      el.clientWidth = 100;
      el.clientHeight = 100;
      setRenderHintSpy.reset();
    });

    it('_setRenderHint does not get called', () => {
      track._resizeObserver.resize(el);
      sinon.assert.notCalled(setRenderHintSpy);
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
      setRenderHintSpy.reset();
    });

    it('_setRenderHint does not get called', () => {
      // even though 100x100 element was resized.
      track._resizeObserver.resize(el);

      // expect reported size to be 200x200
      sinon.assert.calledWith(setRenderHintSpy, { enabled: true, renderDimensions: { height: 200, width: 200 } });
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
