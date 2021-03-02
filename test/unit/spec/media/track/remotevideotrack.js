'use strict';

const assert = require('assert');
const sinon = require('sinon');
// const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');
const MediaTrackReceiver = require('../../../../../lib/media/track/receiver');
const RemoteVideoTrack = require('../../../../../lib/media/track/remotevideotrack');
const { FakeMediaStreamTrack } = require('../../../../lib/fakemediastream');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');

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
});


function makeTrack({ id, sid, kind, isEnabled, options, RemoteTrack, setPriority, setRenderHint, isSwitchedOff }) {
  const emptyFn = () => undefined;
  setPriority = setPriority || emptyFn;
  setRenderHint = setRenderHint || emptyFn;
  isSwitchedOff = !!isSwitchedOff;
  const mediaStreamTrack = new FakeMediaStreamTrack(kind);
  const mediaTrackReceiver = new MediaTrackReceiver(id, mediaStreamTrack);
  class FakeIntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
  }
  options.IntersectionObserver = FakeIntersectionObserver;
  return new RemoteTrack(sid, mediaTrackReceiver, isEnabled, isSwitchedOff, setPriority, setRenderHint, options);
}
