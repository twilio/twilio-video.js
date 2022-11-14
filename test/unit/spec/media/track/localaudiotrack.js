'use strict';

const assert = require('assert');
const sinon = require('sinon');

const LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
const Document = require('../../../../lib/document');
const log = require('../../../../lib/fakelog');
const { fakeGetUserMedia, FakeMediaStreamTrack: MediaStreamTrack } = require('../../../../lib/fakemediastream');
const { defer } = require('../../../../../lib/util');

describe('LocalAudioTrack workaroundWebKitBug1208516', () => {
  let addEventListenerStub;
  let removeEventListenerStub;

  before(() => {
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
    context('when called without workaroundWebKitBug1208516', () => {
      it('does not register for document visibility change', () => {
        document.visibilityState = 'visible';
        const track = createLocalAudioTrack();
        assert(track instanceof LocalAudioTrack);
        sinon.assert.callCount(document.addEventListener, 0);
      });
    });

    context('when called with workaroundWebKitBug1208516', () => {
      let localAudioTrack = null;
      before(() => {
        document.visibilityState = 'visible';
        localAudioTrack = createLocalAudioTrack({ workaroundWebKitBug1208516: true });
        assert(localAudioTrack instanceof LocalAudioTrack);
      });

      after(() => {
        addEventListenerStub.resetHistory();
        removeEventListenerStub.resetHistory();
      });

      it('registers for document visibility change', () => {
        sinon.assert.callCount(document.addEventListener, 1);
        sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
        sinon.assert.callCount(document.removeEventListener, 0);
      });

      it('when document becomes visible and track is ended, calls setMediaStreamTrack on all senders', async () => {
        document.visibilityState = 'visible';
        localAudioTrack.mediaStreamTrack.readyState = 'ended';

        const replaceTrackPromises = [];

        // create two fake RTCRtpSender
        const senders = [1, 2].map(() => {
          const deferred = defer();
          replaceTrackPromises.push(deferred.promise);
          return {
            track: 'foo', // track is replaced only when sender.track is not falsy.
            replaceTrack: sinon.spy(() => {
              deferred.resolve();
              return Promise.resolve();
            })
          };
        });

        // setup senders
        senders.forEach(sender => localAudioTrack._trackSender.addSender(sender));
        assert(replaceTrackPromises.length === senders.length);

        document.emit('visibilitychange', document.visibilityState);
        await Promise.all(replaceTrackPromises);
      });

      it('un-registers for document visibility change when track is stopped', () => {
        sinon.assert.callCount(document.addEventListener, 1);
        sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
        sinon.assert.callCount(document.removeEventListener, 0);

        localAudioTrack.stop();
        sinon.assert.callCount(document.removeEventListener, 1);
      });
    });
  });
});


function createLocalAudioTrack(options) {
  const mediaStreamTrack = new MediaStreamTrack('audio');

  options = Object.assign({
    log,
    getUserMedia: fakeGetUserMedia,
    gUMSilentTrackWorkaround: (_log, gum, constraints) => gum(constraints)
  }, options);

  return new LocalAudioTrack(mediaStreamTrack, options);
}
