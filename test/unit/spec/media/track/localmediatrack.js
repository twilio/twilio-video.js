'use strict';

const assert = require('assert');
const sinon = require('sinon');

const LocalAudioTrack = require('../../../../../lib/media/track/localaudiotrack');
const LocalVideoTrack = require('../../../../../lib/media/track/localvideotrack');
const documentVisibilityMonitor = require('../../../../../lib/util/documentvisibilitymonitor');

const Document = require('../../../../lib/document');
const log = require('../../../../lib/fakelog');
const { fakeGetUserMedia, FakeMediaStreamTrack: MediaStreamTrack } = require('../../../../lib/fakemediastream');
const { combinationContext, waitForEvent, waitForSometime } = require('../../../../lib/util');
const { defer } = require('../../../../../lib/util');

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
        mediaStreamTrack = new MediaStreamTrack(kind[description]);
      });

      context('when called without the "options" argument', () => {
        it(`should return an instance of ${description}`, () => {
          assert(new LocalMediaTrack(mediaStreamTrack) instanceof LocalMediaTrack);
        });
      });
    });

    describe('.isEnabled', () => {
      it('should set the .isEnabled to the MediaStreamTrack\'s .enabled property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
        track.mediaStreamTrack.enabled = !track.mediaStreamTrack.enabled;
        assert.equal(track.isEnabled, track.mediaStreamTrack.enabled);
      });
    });

    describe('.isStopped', () => {
      it('should set .isStopped based on the state of the MediaStreamTrack\'s .readyState property', () => {
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
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
          track = createLocalMediaTrack(LocalMediaTrack, kind[description], { name: notAString });
          assert.equal(track.name, String(notAString));
        });
      });

      [true, false].forEach(isNamePresentInOptions => {
        context(`when .name is ${isNamePresentInOptions ? '' : 'not '}present in LocalTrackOptions`, () => {
          it(`should set .name to ${isNamePresentInOptions ? 'LocalTrackOptions\' .name' : 'MediaStreamTrack\'s ID'}`, () => {
            track = isNamePresentInOptions
              ? createLocalMediaTrack(LocalMediaTrack, kind[description], { name: 'foo' })
              : createLocalMediaTrack(LocalMediaTrack, kind[description]);
            assert.equal(track.name, isNamePresentInOptions ? 'foo' : track._trackSender.id);
          });
        });
      });
    });

    describe('"trackStopped" event', () => {
      context('when the MediaStreamTrack emits onended event', () => {
        it(`should emit ${description}#stopped, passing the instance of ${description}`, async () => {
          track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
          const stoppedEvent = waitForEvent(track, 'stopped');
          assert(track.mediaStreamTrack.readyState !== 'ended');
          track.mediaStreamTrack.stop();
          const _track = await stoppedEvent;
          assert.equal(track, _track);
        });
      });
    });

    describe('#disable', () => {
      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
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
        dummyElement = { oncanplay: 'bar', remove: sinon.spy() };
        document.createElement = sinon.spy(() => {
          return dummyElement;
        });
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
        track._attach = sinon.spy(el => el);
        track._detachElement = sinon.spy();
        track._attachments.delete = sinon.spy();
      });

      it('should not replace track name', async () => {
        const newTrack = new MediaStreamTrack(kind[description]);
        const trackName = track.name;
        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.name, trackName);
      });

      it('should update underlying mediaStreamTrack if unprocessedTrack does not exists', async () => {
        const stub = sinon.stub();
        const originalFn = track._trackSender.setMediaStreamTrack;
        track._trackSender.setMediaStreamTrack = mediaStreamTrack => {
          stub(mediaStreamTrack);
          return originalFn.call(track._trackSender, mediaStreamTrack);
        };
        const newTrack = new MediaStreamTrack(kind[description]);
        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.mediaStreamTrack, newTrack);
        sinon.assert.calledWith(stub, newTrack);
      });

      it('should not update underlying mediaStreamTrack if unprocessedTrack exists', async () => {
        const stub = sinon.stub();
        const originalFn = track._trackSender.setMediaStreamTrack;
        track._trackSender.setMediaStreamTrack = mediaStreamTrack => {
          stub(mediaStreamTrack);
          return originalFn.call(track._trackSender, mediaStreamTrack);
        };
        const newTrack = new MediaStreamTrack(kind[description]);
        track._unprocessedTrack = new MediaStreamTrack(kind[description]);
        await track._setMediaStreamTrack(newTrack);
        assert.equal(newTrack, track._unprocessedTrack);
        sinon.assert.notCalled(stub);
      });

      it('should fire stopped and started events before and after replacing track respectively', async () => {
        const started1Promise = waitForEvent(track, 'started');
        dummyElement.oncanplay();
        await started1Promise;

        const newTrack = new MediaStreamTrack(kind[description]);
        const stopped1Promise = waitForEvent(track, 'stopped');
        const started2Promise = waitForEvent(track, 'started');

        await track._setMediaStreamTrack(newTrack);
        await stopped1Promise;
        dummyElement.oncanplay();
        await started2Promise;
      });

      it('should maintain enabled/disabled state of the track', async () => {
        const newTrack = new MediaStreamTrack(kind[description]);
        assert.equal(track.isEnabled, true);
        track.disable();
        assert.equal(track.isEnabled, false);
        await track._setMediaStreamTrack(newTrack);
        assert.equal(track.isEnabled, false);
      });

    });

    describe('#enable', () => {
      context('when called with the same boolean value as the underlying MediaStreamTrack\'s .enabled', () => {
        let trackDisabledEmitted;
        let trackEnabledEmitted;

        before(() => {
          track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
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
              track =  createLocalMediaTrack(LocalMediaTrack, kind[description]);
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

    describe('#restart', () => {
      combinationContext([
        [
          [true, false],
          x => `when called on a ${description} that was ${x ? '' : 'not '}created using either createLocalTracks or create${description}`
        ],
        [
          [undefined, { foo: 'bar' }],
          x => `when called with${x ? '' : 'out'} constraints`
        ],
        [
          [true, false],
          x => `when getUserMedia ${x ? 'resolves with a MediaStream' : 'rejects with an Error'}`
        ]
      ], ([isCreatedByCreateLocalTracks, constraints, gUMSucceeds]) => {
        const restartArgs = constraints ? [constraints] : [];
        let error;
        let getUserMedia;
        let mediaStream;
        let track;
        let stoppedEmitted = false;
        before(async () => {
          getUserMedia = sinon.spy(gUMSucceeds ? (...args) => fakeGetUserMedia(...args).then(stream => {
            mediaStream = stream;
            return stream;
          }) : () => Promise.reject(new Error('foo')));

          track = createLocalMediaTrack(LocalMediaTrack, kind[description], {
            getUserMedia,
            isCreatedByCreateLocalTracks
          }, {
            baz: 'zee'
          });

          track._setMediaStreamTrack = sinon.spy();

          track.once('stopped', () => {
            stoppedEmitted = true;
          });

          try {
            await track.restart(...restartArgs);
          } catch (err) {
            error = err;
          }


        });

        if (!(isCreatedByCreateLocalTracks && gUMSucceeds)) {
          if (!isCreatedByCreateLocalTracks) {
            it('should not call getUserMedia', () => {
              sinon.assert.notCalled(getUserMedia);
            });
          } else {
            it('should stop the track', () => {
              assert(stoppedEmitted, 'stop was emitted');
            });

            it(`should call getUserMedia with the ${restartArgs.length > 0 ? 'new' : 'existing'} constraints`, () => {
              sinon.assert.calledWith(getUserMedia, Object.assign({
                audio: false,
                video: false
              }, {
                [kind[description]]: restartArgs.length > 0
                  ? { foo: 'bar' }
                  : { baz: 'zee' }
              }));
            });
          }

          it(`should reject with ${!isCreatedByCreateLocalTracks ? 'a TypeError' : 'the Error raised by getUserMedia'}`, () => {
            if (!isCreatedByCreateLocalTracks) {
              assert(error instanceof TypeError);
            } else {
              assert(error.message, 'foo');
            }
          });

          it('should not call _setMediaStreamTrack', () => {
            sinon.assert.notCalled(track._setMediaStreamTrack);
          });
        } else {
          it('should not reject', () => {
            assert.equal(typeof error, 'undefined');
          });

          it(`should call getUserMedia with the ${restartArgs.length > 0 ? 'new' : 'existing'} constraints`, () => {
            sinon.assert.calledWith(getUserMedia, Object.assign({
              audio: false,
              video: false
            }, {
              [kind[description]]: restartArgs.length > 0
                ? { foo: 'bar' }
                : { baz: 'zee' }
            }));
          });

          it('should call _setMediaStreamTrack with the MediaStreamTrack returned by getUserMedia', () => {
            sinon.assert.calledWith(track._setMediaStreamTrack, mediaStream.getTracks()[0]);
          });
        }
      });
    });

    describe('#stop', () => {
      const dummyElement = {
        oncanplay: null,
        videoWidth: 320,
        videoHeight: 240,
        remove: sinon.spy()
      };

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
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
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
      });

      it('only returns public properties', () => {
        if (kind[description] === 'audio') {
          assert.deepEqual(Object.keys(track), [
            'kind',
            'name',
            'isStarted',
            'mediaStreamTrack',
            'processedTrack',
            'isEnabled',
            'isStopped',
            'noiseCancellation'
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
            'isStopped'
          ]);
        }
      });
    });

    describe('#toJSON', () => {
      let track;

      before(() => {
        track = createLocalMediaTrack(LocalMediaTrack, kind[description]);
      });

      it('only returns public properties', () => {
        if (kind[description] === 'audio') {
          assert.deepEqual(track.toJSON(), {
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isStopped: track.isStopped,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name,
            processedTrack: null,
            noiseCancellation: null,
          });
        } else {
          assert.deepEqual(track.toJSON(), {
            isEnabled: track.isEnabled,
            isStarted: track.isStarted,
            isStopped: track.isStopped,
            dimensions: track.dimensions,
            kind: track.kind,
            mediaStreamTrack: track.mediaStreamTrack,
            name: track.name,
            processor: null,
            processedTrack: null
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
        let track;

        before(() => {
          document.visibilityState = 'visible';
          track = createLocalMediaTrack(LocalMediaTrack, kind[description], {}, {}, [
            'addEventListener',
            'removeEventListener'
          ]);
        });

        it('does not register for document visibility change', () => {
          sinon.assert.notCalled(document.addEventListener);
        });

        it('should not listen to "ended" and "unmute" events on the underlying MediaStreamTrack', () => {
          sinon.assert.callCount(track.mediaStreamTrack.addEventListener, 1);
          sinon.assert.neverCalledWith(track.mediaStreamTrack.addEventListener, 'unmute');
          assert.equal(track.mediaStreamTrack.addEventListener.args[0][0], 'ended');
          assert.equal(track.mediaStreamTrack.addEventListener.args[0][1].name, 'onended');
        });
      });

      context('when called with workaroundWebKitBug1208516', () => {
        let localMediaTrack = null;
        let gumRejections = 0;
        before(() => {
          document.visibilityState = 'visible';
          localMediaTrack = createLocalMediaTrack(LocalMediaTrack, kind[description], {
            workaroundWebKitBug1208516: true,
          }, {}, [
            'addEventListener',
            'removeEventListener'
          ],
          () => gumRejections-- > 0);
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

        it('should listen to "ended" and "unmute" events on the underlying MediaStreamTrack', () => {
          ['ended', 'unmute'].forEach(event => {
            sinon.assert.calledWith(localMediaTrack.mediaStreamTrack.addEventListener, event);
          });
        });

        it('should not cause unhandled rejections from failure in GUM', async () => {
          let unhandledRejections = 0;
          const unhandledRejectionHandler = () => unhandledRejections++;
          process.on('unhandledRejection', unhandledRejectionHandler);

          document.visibilityState = 'visible';
          localMediaTrack.mediaStreamTrack.readyState = 'ended';
          gumRejections = 1; // let gum reject for next call.
          document.emit('visibilitychange', document.visibilityState);

          await waitForSometime(100);
          process.off('unhandledRejection', unhandledRejectionHandler);
          assert.equal(unhandledRejections, 0, `unhandled rejections: ${unhandledRejections}`);
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
          const phase2Promise = new Promise(resolve => documentVisibilityMonitor.onVisibilityChange(2, function onVisible() {
            documentVisibilityMonitor.offVisibilityChange(2, onVisible);
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

        it('un-registers for document visibility change and "ended" and "unmute" events when track is stopped', () => {
          sinon.assert.callCount(document.addEventListener, 1);
          sinon.assert.calledWith(document.addEventListener, 'visibilitychange');
          sinon.assert.callCount(document.removeEventListener, 0);

          localMediaTrack.stop();
          sinon.assert.callCount(document.removeEventListener, 1);
          sinon.assert.calledWith(document.removeEventListener, 'visibilitychange');

          ['ended', 'unmute'].forEach(event => {
            sinon.assert.calledWith(localMediaTrack.mediaStreamTrack.removeEventListener, event);
          });
        });
      });
    });
  });
});

function createLocalMediaTrack(LocalMediaTrack, kind, options = {}, constraints = {}, stubMediaStreamTrackMethods = [], shouldGUMReject) {
  const mediaStreamTrack = new MediaStreamTrack(kind);
  stubMethods(mediaStreamTrack, stubMediaStreamTrackMethods);

  options = Object.assign({
    [kind]: constraints,
    log,
    getUserMedia: constraints => fakeGetUserMedia(constraints).then(stream => {
      stream.getTracks().forEach(track => stubMethods(track, stubMediaStreamTrackMethods));
      return stream;
    }),
    gUMSilentTrackWorkaround: (_log, gum, constraints) => gum(constraints).then(stream => {
      if (shouldGUMReject && shouldGUMReject()) {
        throw new Error('GUM Rejected');
      }
      stream.getTracks().forEach(track => stubMethods(track, stubMediaStreamTrackMethods));
      return stream;
    })
  }, options);

  return new LocalMediaTrack(mediaStreamTrack, options);
}

function stubMethods(instance, methods) {
  methods.forEach(method => {
    const fn = instance[method];
    instance[method] = sinon.spy((...args) => fn.apply(instance, args));
  });
}
