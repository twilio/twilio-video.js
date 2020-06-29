'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
const LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');

const Document = require('../../../../lib/document');
const log = require('../../../../lib/fakelog');
const { fakeGetUserMedia } = require('../../../../lib/fakemediastream');
const { defer, waitForSometime } = require('../../../../../lib/util');

[
  ['LocalAudioTrack', LocalAudioTrack],
  ['LocalVideoTrack', LocalVideoTrack]
].forEach(([description, LocalMediaTrack]) => {
  const kind = {
    LocalAudioTrack: 'audio',
    LocalVideoTrack: 'video'
  };

  describe(description, () => {
    before(() => {
      global.document = global.document || new Document();
    });

    after(() => {
      if (global.document instanceof Document) {
        delete global.document;
      }
    });

    let track;

    describe('constructor', () => {
      let mediaStreamTrack;

      before(() => {
        mediaStreamTrack = new MediaStreamTrack('foo', kind[description]);
      });

      context('when called without the "options" argument', () => {
        it(`should return an instance of ${description}`, () => {
          assert(new LocalMediaTrack(mediaStreamTrack) instanceof LocalMediaTrack);
        });
      });
    });

    describe('.isEnabled', () => {
      it('should set the .isEnabled to the MediaStreamTrack\'s .enabled property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
        track.mediaStreamTrack.enabled = !track.mediaStreamTrack.enabled;
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
      });
    });

    describe('.isStopped', () => {
      it('should set .isStopped based on the state of the MediaStreamTrack\'s .readyState property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        track.mediaStreamTrack.readyState = 'ended';
        assert(track.isStopped);
        track.mediaStreamTrack.readyState = 'live';
        assert(!track.isStopped);
      });
    });

    describe('.name', () => {
      context('when .name is not a string', () => {
        it('should set .name to the stringified version of the property', () => {
          const notAString = { foo: 'bar' };
          track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description], { name: notAString });
          assert.equal(track.name, String(notAString));
        });
      });

      [true, false].forEach(isNamePresentInOptions => {
        context(`when .name is ${isNamePresentInOptions ? '' : 'not '}present in LocalTrackOptions`, () => {
          it(`should set .name to ${isNamePresentInOptions ? 'LocalTrackOptions\' .name' : 'MediaStreamTrack\'s ID'}`, () => {
            track = isNamePresentInOptions
              ? createLocalMediaTrack(LocalMediaTrack, '1', kind[description], { name: 'foo' })
              : createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
            assert.equal(track.name, isNamePresentInOptions ? 'foo' : '1');
          });
        });
      });
    });

    describe('"trackStopped" event', () => {
      context('when the MediaStreamTrack emits onended event', () => {
        it('should emit LocalMediaTrack#stopped, passing the instance of LocalMediaTrack', async () => {
          track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);

          const stoppedEvent = new Promise(resolve => track.once('stopped', resolve));

          assert(track.mediaStreamTrack.readyState !== 'ended');

          track.mediaStreamTrack.emit('ended');

          const _track = await stoppedEvent;
          assert.equal(track, _track);
        });
      });
    });

    describe('#disable', () => {
      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
        track.enable = sinon.spy();
        track.disable();
      });

      it('should call .enable with false', () => {
        sinon.assert.calledWith(track.enable, false);
      });
    });

    describe('#_setMediaStreamTrack', () => {
      let dummyElement;
      beforeEach(() => {
        dummyElement = { oncanplay: 'bar' };
        document.createElement = sinon.spy(() => {
          return dummyElement;
        });
        track = createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
        track._attach = sinon.spy(el => el);
        track._detachElement = sinon.spy();
        track._attachments.delete = sinon.spy();
      });

      it('should not replace track id or name', async () => {
        const newTrack = new MediaStreamTrack('bar', kind[description]);
        assert.equal(track.id, 'foo');
        assert.equal(track.name, 'foo');

        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.id, 'foo');
        assert.equal(track.name, 'foo');
      });

      it('should update underlying mediaStreamTrack', async () => {
        const newTrack = new MediaStreamTrack('bar', kind[description]);
        assert.equal(track.mediaStreamTrack.id, 'foo');

        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.mediaStreamTrack.id, 'bar');
      });

      it('should fire started event after replacing track', async () => {
        const started1Promise = new Promise(resolve => track.on('started', resolve));
        dummyElement.oncanplay();
        await started1Promise;

        const newTrack = new MediaStreamTrack('bar', kind[description]);
        const started2Promise = new Promise(resolve => track.on('started', resolve));

        await track._setMediaStreamTrack(newTrack);

        dummyElement.oncanplay();
        await started2Promise;
      });

      it('should maintain enabled/disabled state of the track', async () => {
        const newTrack = new MediaStreamTrack('bar', kind[description]);
        assert.equal(track.id, 'foo');
        assert.equal(track.name, 'foo');
        assert.equal(track.isEnabled, true);
        track.disable();
        assert.equal(track.isEnabled, false);


        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.id, 'foo');
        assert.equal(track.name, 'foo');
        assert.equal(track.isEnabled, false);
      });

    });

    describe('#enable', () => {
      context('when called with the same boolean value as the underlying MediaStreamTrack\'s .enabled', () => {
        let trackDisabledEmitted;
        let trackEnabledEmitted;

        before(() => {
          track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
          track.mediaStreamTrack.enabled = Math.random() > 0.5;
          track.on('disabled', () => { trackDisabledEmitted = true; });
          track.on('enabled', () => { trackEnabledEmitted = true; });
        });

        it('should not emit the "disabled" or "enabled" events', () => {
          track.enable(track.mediaStreamTrack.enabled);
          assert(!(trackDisabledEmitted || trackEnabledEmitted));
        });
      });

      [true, false].forEach(enabled => {
        context(`when .enable is called with ${enabled}`, () => {
          context(`and the underlying MediaStreamTrack's .enabled is ${!enabled}`, () => {
            let eventEmitted;

            before(() => {
              track =  createLocalMediaTrack(LocalMediaTrack, 'foo', kind[description]);
              track.mediaStreamTrack.enabled = !enabled;
              track.on(enabled ? 'enabled' : 'disabled', () => { eventEmitted = true; });
              track.enable(enabled);
            });

            it(`should set the underlying MediaStreamTrack's .enabled to ${enabled}`, () => {
              assert.equal(track.mediaStreamTrack.enabled, enabled);
            });

            it(`should emit the ${enabled ? 'enabled' : 'disabled'} event`, () => {
              assert(eventEmitted);
            });
          });
        });
      });
    });

    describe('#stop', () => {
      const dummyElement = {
        oncanplay: null,
        videoWidth: 320,
        videoHeight: 240
      };

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
        track._createElement = sinon.spy(() => dummyElement);
      });

      it('should not change the value of isEnabled', done => {
        const startedTimeout = setTimeout(
          done.bind(null, new Error('track#started didn\'t fire')),
          1000
        );
        track.on('started', () => {
          const isEnabled = track.isEnabled;
          clearTimeout(startedTimeout);
          track.stop();
          assert.equal(isEnabled, track.isEnabled);
          done();
        });
        track.emit('started', track);
      });
    });

    describe('Object.keys', () => {
      let track;

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
      });

      it('only returns public properties', () => {
        if (kind[description] === 'audio') {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'id',
            'isEnabled',
            'isStopped'
          ]);
        } else {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'dimensions',
            'id',
            'isEnabled',
            'isStopped'
          ]);
        }
      });
    });

    describe('#toJSON', () => {
      let track;

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
      });

      it('only returns public properties', () => {
        if (kind[description] === 'audio') {
          assert.deepEqual(track.toJSON(), {
            id: track.id,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isStopped: track.isStopped,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name
          });
        } else {
          assert.deepEqual(track.toJSON(), {
            id: track.id,
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isStopped: track.isStopped,
            dimensions: track.dimensions,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name
          });
        }
      });
    });
  });

  describe(`workaroundWebKitBug1208516 for ${description}`, () => {
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
      if (global.document instanceof Document && description === 'LocalVideoTrack') {
        delete global.document;
      }
    });

    describe('constructor', () => {
      context('when called without workaroundWebKitBug1208516', () => {
        it('does not register for document visibility change', () => {
          document.visibilityState = 'visible';
          const track = createLocalMediaTrack(LocalMediaTrack, '1', kind[description]);
          assert(track instanceof LocalMediaTrack);
          sinon.assert.callCount(document.addEventListener, 0);
        });
      });

      context('when called with workaroundWebKitBug1208516', () => {
        let localMediaTrack = null;

        before(() => {
          document.visibilityState = 'visible';
          localMediaTrack = createLocalMediaTrack(LocalMediaTrack, '1', kind[description], { workaroundWebKitBug1208516: true });
          assert(localMediaTrack instanceof LocalMediaTrack);
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

        it('should call setMediaStreamTrack on all senders when document is visible and MediaStreamTrack has ended', async () => {
          document.visibilityState = 'visible';
          localMediaTrack.mediaStreamTrack.readyState = 'ended';

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
          senders.forEach(sender => localMediaTrack._trackSender.addSender(sender));
          assert.equal(replaceTrackPromises.length, senders.length);

          document.emit('visibilitychange', document.visibilityState);
          await Promise.all(replaceTrackPromises);
        });

        it('should call setMediaStreamTrack on all senders when MediaStreamTrack has ended', () => {
          document.visibilityState = 'visible';
          localMediaTrack.mediaStreamTrack.readyState = 'ended';

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
          senders.forEach(sender => localMediaTrack._trackSender.addSender(sender));
          assert.equal(replaceTrackPromises.length, senders.length);

          // Emit "ended" event on the MediaStreamTrack
          localMediaTrack.mediaStreamTrack.stop();

          return Promise.all(replaceTrackPromises);
        });

        it('should wait until MediaStreamTrack is re-acquired before calling the visible phase 2 callback even if MediaStreamTrack ends first', async () => {
          const mediaStreamTrack = localMediaTrack.mediaStreamTrack;
          document.visibilityState = 'visible';
          mediaStreamTrack.readyState = 'ended';

          // create two fake RTCRtpSender
          const senders = [1, 2].map(() => {
            const deferred = defer();
            return {
              track: 'foo', // track is replaced only when sender.track is not falsy.
              resolveReplaceTrack: () => deferred.resolve(),
              replaceTrack: () => deferred.promise
            };
          });

          // setup senders
          senders.forEach(sender => localMediaTrack._trackSender.addSender(sender));

          // Emit "ended" event on the MediaStreamTrack
          localMediaTrack.mediaStreamTrack.stop();

          // When document visible phase 2 callback is called, test whether MediaStreamTrack is re-acquired
          const phase2Promise = new Promise(resolve => documentVisibilityMonitor.onVisible(2, function onVisible() {
            documentVisibilityMonitor.offVisible(2, onVisible);
            assert.notEqual(mediaStreamTrack, localMediaTrack.mediaStreamTrack);
            resolve();
          }));

          // Wait for some time and then emit document visibility
          await waitForSometime(50);
          document.emit('visibilitychange', document.visibilityState);

          // Wait for some time and resolve the Promise returned by each RTCRtpSender.replaceTrack
          await waitForSometime(100);
          senders.forEach(sender => sender.resolveReplaceTrack());

          return phase2Promise;
        });

        it('un-registers for document visibility change when track is stopped', () => {
          sinon.assert.callCount(document.addEventListener, 1);
          sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
          sinon.assert.callCount(document.removeEventListener, 0);

          localMediaTrack.stop();
          sinon.assert.callCount(document.removeEventListener, 1);
          sinon.assert.calledWith(document.removeEventListener, 'visibilitychange');
        });
      });
    });
  });

});

function createLocalMediaTrack(LocalMediaTrack, id, kind, options = {}) {
  const mediaStreamTrack = new MediaStreamTrack(id, kind);
  options = Object.assign({
    log,
    getUserMedia: fakeGetUserMedia,
    gUMSilentTrackWorkaround: (_log, gum, constraints) => gum(constraints)
  }, options);

  return new LocalMediaTrack(mediaStreamTrack, options);
}

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);

  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind },
    enabled: { value: true, writable: true }
  });
}

inherits(MediaStreamTrack, EventEmitter);

MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;

MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;

MediaStreamTrack.prototype.stop = function stop() {
  // Simulating the browser-native MediaStreamTrack's 'ended' event
  this.emit('ended', { type: 'ended' });
};

MediaStreamTrack.prototype.getConstraints = function getConstraints() {
  return {};
};
