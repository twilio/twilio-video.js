'use strict';

const assert = require('assert');
const sinon = require('sinon');
// const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');
const { NullIntersectionObserver } = require('../../../../../lib/util/nullobserver');

const kind = 'video';
const RemoteTrack = RemoteVideoTrack;
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
      if (global.document instanceof Document && kind === 'video') {
        delete global.document;
      }
    });

    describe('constructor', () => {
      context('when called without enableDocumentVisibilityTurnOff', () => {
        let track;
        before(() => {
          document.visibilityState = 'visible';
          track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { enableDocumentVisibilityTurnOff: false }, RemoteTrack });
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
          track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff: false, isEnabled: true, options: { enableDocumentVisibilityTurnOff: true }, RemoteTrack });
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
      track = makeTrack({ id: 'foo', sid: 'bar', kind, isSwitchedOff: false, setRenderHint: setRenderHintSpy, isEnabled: true, options: { IntersectionObserver: NullIntersectionObserver }, RemoteTrack });
      observeSpy = sinon.spy(NullIntersectionObserver.prototype, 'observe');
      unobserveSpy = sinon.spy(NullIntersectionObserver.prototype, 'unobserve');
    });

    after(() => {
      observeSpy.restore();
      unobserveSpy.restore();
      if (global.document instanceof Document && kind === 'video') {
        delete global.document;
      }
    });

    context('when an element is attached', () => {
      beforeEach(() => {
        track.attach(el);
      });

      it('IntersectionObserver observe is called', () => {
        sinon.assert.callCount(observeSpy, 1);
      });

      it('_setRenderHint gets called with { enable: true }', () => {
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', true));
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('renderDimension', { height: sinon.match.any, width: sinon.match.any }));
      });
    });

    context('when an element is detached', () => {
      beforeEach(() => {
        track.detach(el);
      });

      it('IntersectionObserver unobserve is called', () => {
        sinon.assert.callCount(unobserveSpy, 1);
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

      it('invisible, _setRenderHint gets called with { enable: false }', () => {
        track._intersectionObserver.makeInvisible(el);
        sinon.assert.calledWith(setRenderHintSpy, { enabled: false });
      });

      it('visible, _setRenderHint gets called with { enable: true }', () => {
        track._intersectionObserver.makeVisible(el);
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('enabled', true));
        sinon.assert.calledWith(setRenderHintSpy, sinon.match.has('renderDimension', { height: sinon.match.any, width: sinon.match.any }));
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
  options.IntersectionObserver = NullIntersectionObserver;
  return new RemoteTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);
}
