'use strict';

const assert = require('assert');
const sinon = require('sinon');
const Document = require('../../../../lib/document');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');
const { NullIntersectionObserver: IntersectionObserver, NullResizeObserver: ResizeObserver } = require('../../../../../lib/util/nullobserver');

describe('RemoteVideoTrack', () => {
  describe('enableDocumentVisibilityTurnOff', () => {
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
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    describe('constructor', () => {
      context('when called without enableDocumentVisibilityTurnOff', () => {
        let track;
        before(() => {
          document.visibilityState = 'visible';
          track = makeTrack({ id: 'foo', sid: 'bar', options: { enableDocumentVisibilityTurnOff: false } });
        });

        it('does not register for document visibility change', () => {
          assert(track._enableDocumentVisibilityTurnOff === false);
          sinon.assert.notCalled(document.addEventListener);
        });
      });

      context('when called with enableDocumentVisibilityTurnOff', () => {
        let track;
        before(() => {
          document.visibilityState = 'visible';
          track = makeTrack({ id: 'foo', sid: 'bar', options: { enableDocumentVisibilityTurnOff: true } });
        });

        it('sets enableDocumentVisibilityTurnOff to true', () => {
          assert(track._enableDocumentVisibilityTurnOff === true);
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

    context('when an element is attached', () => {
      beforeEach(() => {
        track.attach(el);
      });

      it('IntersectionObserver observe is called', () => {
        sinon.assert.callCount(observeSpy, 1);
        sinon.assert.calledWith(observeSpy, el);
      });
    });

    context('when an element is detached', () => {
      beforeEach(() => {
        track.detach(el);
      });

      it('IntersectionObserver unobserve is called', () => {
        sinon.assert.callCount(unobserveSpy, 1);
        sinon.assert.calledWith(unobserveSpy, el);
      });

      it(' _setRenderHint gets called with { enable: false }', () => {
        sinon.assert.calledWith(setRenderHintSpy, { enabled: false });
      });
    });

    context('when an element is', () => {
      before(() => {
        track.attach(el);
        setRenderHintSpy.reset();
      });

      it('visible, _setRenderHint gets called with { enable: true }', () => {
        track._intersectionObserver.makeVisible(el);
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', true));
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('renderDimension', { height: sinon.match.any, width: sinon.match.any }));
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
      observeSpy = sinon.spy(ResizeObserver.prototype, 'observe');
      unobserveSpy = sinon.spy(ResizeObserver.prototype, 'unobserve');
    });

    after(() => {
      observeSpy.restore();
      unobserveSpy.restore();
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    context('when an element is attached', () => {
      beforeEach(() => {
        track.attach(el);
      });

      it('ResizeObserver.observe is called', () => {
        sinon.assert.callCount(observeSpy, 1);
        sinon.assert.calledWith(observeSpy, el);
      });
    });

    context('when an element is detached', () => {
      beforeEach(() => {
        track.detach(el);
      });

      it('ResizeObserver.unobserve is called', () => {
        sinon.assert.callCount(unobserveSpy, 1);
        sinon.assert.calledWith(unobserveSpy, el);
      });
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
        sinon.assert.calledWith(setRenderHintSpy, { enabled: true, renderDimension: { height: 100, width: 100 } });
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
        sinon.assert.calledWith(setRenderHintSpy, { enabled: true, renderDimension: { height: 200, width: 200 } });
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
