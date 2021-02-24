'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const { inherits } = require('util');
const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');
const VideoTrack = require('../../../../../lib/media/track/videotrack');
const MediaTrackTransceiver = require('../../../../../lib/media/track/transceiver');

let mediaStreamTrackSettings = {
  width: 1280,
  height: 720,
  frameRate: 24,
  enabled: true
};

describe('VideoTrack', () => {
  let captureStream;
  let clock;
  let videoTrack;
  let mediaStreamTrack;
  let processedTrack;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    mediaStreamTrackSettings = {
      width: 1280,
      height: 720,
      frameRate: 24,
      enabled: true
    };

    processedTrack = { requestFrame: sinon.stub() };
    captureStream = sinon.stub().returns({ getTracks: () => [processedTrack] });
    const document = new Document();
    document.createElement = () => ({ captureStream });
    global.document = document;

    mediaStreamTrack = new MediaStreamTrack('1', 'video');
    const mediaTrackTransceiver = new MediaTrackTransceiver('1', mediaStreamTrack);
    videoTrack = new VideoTrack(mediaTrackTransceiver, { log: log });

    videoTrack._attach = sinon.stub();
    videoTrack._selectElement = sinon.stub();
    videoTrack._updateElementsMediaStreamTrack = sinon.stub();
  });

  afterEach(() => {
    delete global.document;
    clock.restore();
  });

  describe('#attach', () => {
    beforeEach(() => {
      videoTrack._captureFrames = sinon.stub();
    });

    it('should start capturing frames if a VideoProcessor is attached', () => {
      videoTrack.processor = 'foo';
      videoTrack.attach('foo');
      sinon.assert.calledOnce(videoTrack._captureFrames);
    });

    it('should not start capturing frames if a VideoProcessor is not attached', () => {
      videoTrack.attach('foo');
      sinon.assert.notCalled(videoTrack._captureFrames);
    });
  });

  describe('#addProcessor', () => {
    let processor;

    beforeEach(() => {
      processor = { processFrame: sinon.spy() };
      videoTrack._dummyEl = 'foo';
      log.warn = sinon.spy();
    });

    describe('when OffscreenCanvas is not supported', () => {
      it('should not add a VideoProcessor', () => {
        videoTrack.addProcessor(processor);
        assert(!videoTrack.processor);
      });

      it('should log a warning', () => {
        videoTrack.addProcessor(processor);
        sinon.assert.calledWith(log.warn, 'Adding a VideoProcessor is not supported in this browser.');
      });
    });

    describe('when OffscreenCanvas is supported', () => {
      before(() => {
        global.OffscreenCanvas = OffscreenCanvas;
      });

      after(() => {
        delete global.OffscreenCanvas;
      });

      describe('unmute handler', () => {
        beforeEach(() => {
          videoTrack._captureFrames = sinon.stub();
        });

        it('should add unmuteHandler if it does not exists', () => {
          videoTrack.processor = null;
          videoTrack.addProcessor(processor);
          assert(!!videoTrack._unmuteHandler);
        });

        it('should not add unmuteHandler if it exists', () => {
          videoTrack._unmuteHandler = 'foo';
          videoTrack.processor = null;
          videoTrack.addProcessor(processor);
          assert.equal(videoTrack._unmuteHandler, 'foo');
        });

        it('should call restartProcessor if processedTrack is still muted after mediaStreamTrack is unmuted', () => {
          videoTrack.addProcessor(processor);
          videoTrack.processedTrack = { muted: true };
          videoTrack._restartProcessor = sinon.stub();
          videoTrack.mediaStreamTrack.emit('unmute');
          sinon.assert.calledOnce(videoTrack._restartProcessor);
        });

        it('should not call restartProcessor if processedTrack is not muted after mediaStreamTrack is unmuted', () => {
          videoTrack.addProcessor(processor);
          videoTrack._restartProcessor = sinon.stub();
          videoTrack.mediaStreamTrack.emit('unmute');
          sinon.assert.notCalled(videoTrack._restartProcessor);
        });
      });

      describe('when a valid VideoProcessor is provided', () => {
        beforeEach(() => {
          videoTrack._captureFrames = sinon.stub();
          videoTrack.addProcessor(processor);
        });

        it('should add a VideoProcessor', () => {
          assert.equal(videoTrack.processor, processor);
        });

        it('should not log a warning', () => {
          sinon.assert.notCalled(log.warn);
        });

        it('should initialize canvases', () => {
          assert(!!videoTrack._inputFrame);
          assert(!!videoTrack._outputFrame);
          assert.equal(videoTrack._inputFrame.width, mediaStreamTrackSettings.width);
          assert.equal(videoTrack._inputFrame.height, mediaStreamTrackSettings.height);
          assert.equal(videoTrack._outputFrame.width, mediaStreamTrackSettings.width);
          assert.equal(videoTrack._outputFrame.height, mediaStreamTrackSettings.height);
        });

        it('should set processedTrack with the correct settings', () => {
          sinon.assert.calledWith(captureStream, 0);
          assert.equal(videoTrack.processedTrack.enabled, mediaStreamTrackSettings.enabled);
        });

        it('should set processedTrack with correct dimensions', () => {
          videoTrack.processor = null;
          const settings = {
            width: 400,
            height: 200,
          };
          videoTrack.mediaStreamTrack.getSettings = () => settings;
          videoTrack.addProcessor(processor);
          assert.equal(videoTrack._inputFrame.width, settings.width);
          assert.equal(videoTrack._inputFrame.height, settings.height);
          assert.equal(videoTrack._outputFrame.width, settings.width);
          assert.equal(videoTrack._outputFrame.height, settings.height);
        });

        it('should set processedTrack with default dimensions', () => {
          videoTrack.processor = null;
          const settings = {};
          videoTrack.mediaStreamTrack.getSettings = () => settings;
          videoTrack.addProcessor(processor);
          assert.equal(videoTrack._inputFrame.width, 0);
          assert.equal(videoTrack._inputFrame.height, 0);
          assert.equal(videoTrack._outputFrame.width, 0);
          assert.equal(videoTrack._outputFrame.height, 0);
        });

        it('should update the mediaStreamTrack of attached elements', () => {
          sinon.assert.calledOnce(videoTrack._updateElementsMediaStreamTrack);
        });

        it('should start capturing frames after setting the processor', () => {
          sinon.assert.calledOnce(videoTrack._captureFrames);
        });
      });

      context('raise an error', () => {
        [{
          name: 'processor is null',
          errorMsg: 'Received an invalid VideoProcessor from addProcessor.',
          param: null,
        }, {
          name: 'processor is undefined',
          errorMsg: 'Received an invalid VideoProcessor from addProcessor.',
          param: undefined,
        }, {
          name: 'processFrame is null',
          errorMsg: 'Received an invalid VideoProcessor from addProcessor.',
          param: { processFrame: null },
        }, {
          name: 'processFrame is undefined',
          errorMsg: 'Received an invalid VideoProcessor from addProcessor.',
          param: { processFrame: undefined },
        }, {
          name: 'processor is already set',
          errorMsg: 'A VideoProcessor has already been added.',
          param: { processFrame: sinon.spy() },
          setup: () => { videoTrack.processor = { processFrame: sinon.spy() }; }
        }, {
          name: 'dummyEl is not set',
          errorMsg: 'VideoTrack has not been initialized.',
          param: { processFrame: sinon.spy() },
          setup: () => { videoTrack._dummyEl = null; }
        }].forEach(({ name, errorMsg, param, setup }) => {
          it(`when ${name}`, () => {
            if (setup) {
              setup();
            }
            const regex = new RegExp(errorMsg);
            assert.throws(() => { videoTrack.addProcessor(param); }, regex);
          });
        });
      });
    });
  });

  describe('#removeProcessor', () => {
    let processor;

    beforeEach(() => {
      processor = { foo: 'foo' };
      videoTrack.processor = processor;
      videoTrack.processedTrack = 'foo';
      videoTrack._isCapturing = true;
      videoTrack._inputFrame = new OffscreenCanvas(1, 2);
      videoTrack._outputFrame = new OffscreenCanvas(3, 4);
      videoTrack._updateElementsMediaStreamTrack = sinon.stub();
      videoTrack.mediaStreamTrack.removeEventListener = sinon.stub();
    });

    it('should clear existing timeout callback', () => {
      let cb = sinon.stub();
      videoTrack._captureTimeoutId = setTimeout(cb, 50);
      clock.tick(50);
      sinon.assert.calledOnce(cb);

      cb = sinon.stub();
      videoTrack._captureTimeoutId = setTimeout(cb, 50);
      videoTrack.removeProcessor(processor);
      clock.tick(50);
      sinon.assert.notCalled(cb);
    });

    it('should update attached video elements mediaStreamTrack', () => {
      videoTrack.removeProcessor(processor);
      sinon.assert.calledOnce(videoTrack._updateElementsMediaStreamTrack);
    });

    it('should clear inputFrame canvas', () => {
      const inputFrame = videoTrack._inputFrame;
      assert(inputFrame.drawing);
      videoTrack.removeProcessor(processor);
      assert(!inputFrame.drawing);
    });

    it('should clear outputFrame canvas', () => {
      const outputFrame = videoTrack._outputFrame;
      assert(outputFrame.drawing);
      videoTrack.removeProcessor(processor);
      assert(!outputFrame.drawing);
    });

    describe('should reset field', () => {
      const unmuteHandler = () => {};
      beforeEach(() => {
        videoTrack._unmuteHandler = unmuteHandler;
        videoTrack.removeProcessor(processor);
      });

      it('isCapturing flag', () => {
        assert(!videoTrack._isCapturing);
      });

      it('existing VideoProcessor', () => {
        assert(!videoTrack.processor);
      });

      it('processedTrack', () => {
        assert(!videoTrack.processedTrack);
      });

      it('_inputFrame', () => {
        assert(!videoTrack._inputFrame);
      });

      it('_outputFrame', () => {
        assert(!videoTrack._outputFrame);
      });

      it('_unmuteHandler', () => {
        sinon.assert.calledWith(videoTrack.mediaStreamTrack.removeEventListener, 'unmute', unmuteHandler);
      });
    });

    context('raise an error', () => {
      [{
        name: 'processor param is null',
        errorMsg: 'Received an invalid VideoProcessor from removeProcessor.',
        getParam: () => null
      }, {
        name: 'processor param is undefined',
        errorMsg: 'Received an invalid VideoProcessor from removeProcessor.',
        getParam: () => undefined
      }, {
        name: 'there is no existing processor',
        errorMsg: 'No existing VideoProcessor detected.',
        getParam: () => processor,
        setup: () => {
          videoTrack.processor = null;
        }
      }, {
        name: 'processor param is not the same as the existing one',
        errorMsg: 'The provided VideoProcessor is different than the existing one.',
        getParam: () => ({ bar: 'bar' })
      }].forEach(({ name, errorMsg, getParam, setup }) => {
        it(`when ${name}`, () => {
          if (setup) {
            setup();
          }
          const regex = new RegExp(errorMsg);
          assert.throws(() => { videoTrack.removeProcessor(getParam()); }, regex);
        });
      });
    });
  });

  describe('#_restartProcessor', () => {
    beforeEach(() => {
      videoTrack.addProcessor = sinon.stub();
      videoTrack.removeProcessor = sinon.stub();
    });

    it('should not restart if processor is not present', () => {
      videoTrack.processor = null;
      videoTrack._restartProcessor();
      sinon.assert.notCalled(videoTrack.addProcessor);
      sinon.assert.notCalled(videoTrack.removeProcessor);
    });

    it('should restart if processor is present', () => {
      videoTrack.processor = 'foo';
      videoTrack._restartProcessor();
      sinon.assert.calledOnce(videoTrack.addProcessor);
      sinon.assert.calledOnce(videoTrack.removeProcessor);
      sinon.assert.callOrder(videoTrack.removeProcessor, videoTrack.addProcessor);
    });
  });

  describe('#_captureFrames', () => {
    // As of node12, the Promise.then and Promise.finally requires separate
    // promises to resolve internally.
    const internalPromise = () => Promise.resolve().then(Promise.resolve());
    let timeoutMs;
    let processFrame;
    let internalOutputFrame;

    beforeEach(() => {
      timeoutMs = Math.floor(1000 / mediaStreamTrackSettings.frameRate);
      processFrame = sinon.spy();
      videoTrack._attachments.add('foo');
      videoTrack.processor = { processFrame };

      videoTrack._dummyEl.play = () => ({ then: cb => {
        cb();
        return { catch: sinon.stub() };
      } });

      videoTrack._inputFrame = new OffscreenCanvas(mediaStreamTrackSettings.width, mediaStreamTrackSettings.height);
      videoTrack._outputFrame = new OffscreenCanvas(mediaStreamTrackSettings.width, mediaStreamTrackSettings.height);
      internalOutputFrame = videoTrack._outputFrame;
    });

    describe('processFrame', () => {
      beforeEach(() => {
        videoTrack.processedTrack = processedTrack;
      });

      it('should pass the inputFrames to the processFrame method', () => {
        videoTrack._captureFrames();
        clock.tick(timeoutMs);
        sinon.assert.calledWith(processFrame, videoTrack._inputFrame);
      });

      it('should update processedTrack\'s current frame', async () => {
        videoTrack.processor.processFrame = () => 'myframe';
        videoTrack._captureFrames();
        clock.tick(timeoutMs);
        await internalPromise();
        sinon.assert.calledOnce(processedTrack.requestFrame);
      });

      [{
        name: 'should draw the processed frame to the outputFrame if the return value is valid and not a promise',
        getReturnValue: () => 'myframe',
        expectedDrawing: { image: 'myframe', x: 0, y: 0, width: 1280, height: 720 }
      }, {
        name: 'should draw the processed frame to the outputFrame if the return value is valid in a promise',
        getReturnValue: () =>  Promise.resolve('myframe'),
        expectedDrawing: { image: 'myframe', x: 0, y: 0, width: 1280, height: 720 }
      }, {
        name: 'should drop the frame if processFrame throws an exception',
        getReturnValue: () => { throw new Error('foo'); },
        expectedDrawing: {}
      }, {
        name: 'should drop the frame if the internal output frame is null',
        getReturnValue: () =>  Promise.resolve('myframe'),
        expectedDrawing: {},
        setup: () => {
          videoTrack._outputFrame = null;
        }
      }, {
        name: 'should drop the frame if processFrame returns null',
        getReturnValue: () => null,
        expectedDrawing: {}
      }, {
        name: 'should drop the frame if processFrame returns a promise which resolves to null',
        getReturnValue: () => Promise.resolve(null),
        expectedDrawing: {}
      }, {
        name: 'should update inputFrame dimension at runtime',
        getReturnValue: () => 'myframe',
        expectedDrawing: { image: 'myframe', x: 0, y: 0, width: 400, height: 200 },
        setup: () => {
          mediaStreamTrackSettings.width = 400;
          mediaStreamTrackSettings.height = 200;
        }
      }].forEach(({ name, getReturnValue, expectedDrawing, setup }) => {
        it(name, async () => {
          if (setup) {
            setup();
          }
          videoTrack.processor.processFrame = () => getReturnValue();
          videoTrack._captureFrames();
          clock.tick(timeoutMs);
          await internalPromise();
          assert.deepEqual(internalOutputFrame.drawing, expectedDrawing);
          if (expectedDrawing.image) {
            assert.equal(videoTrack._inputFrame.width, mediaStreamTrackSettings.width);
            assert.equal(videoTrack._inputFrame.height, mediaStreamTrackSettings.height);
            assert.equal(videoTrack._outputFrame.width, mediaStreamTrackSettings.width);
            assert.equal(videoTrack._outputFrame.height, mediaStreamTrackSettings.height);
          }
        });
      });
    });

    describe('capture frame loop', () => {
      it('should call processFrame with the correct frame rate at run time', async () => {
        const settings = {
          width: 640,
          height: 480,
          frameRate: 20,
        };
        const timeoutMs = Math.floor(1000 / settings.frameRate);
        videoTrack._inputFrame = new OffscreenCanvas(settings.width, settings.height);
        videoTrack._outputFrame = new OffscreenCanvas(settings.width, settings.height);
        videoTrack.mediaStreamTrack.getSettings = () => settings;

        const cb = sinon.stub();
        const artificialDelay = 12;
        videoTrack.processor.processFrame = () => {
          return new Promise(resolve => {
            setTimeout(() => {
              cb();
              return resolve();
            }, artificialDelay);
          });
        };

        videoTrack._captureFrames();
        await internalPromise();

        clock.tick(artificialDelay - 1);
        await internalPromise();
        sinon.assert.notCalled(cb);

        clock.tick(1);
        await internalPromise();
        sinon.assert.calledOnce(cb);

        clock.tick(timeoutMs - artificialDelay);
        await internalPromise();
        sinon.assert.calledOnce(cb);

        settings.frameRate -= 10;
        const newTimeoutMs = Math.floor(1000 / settings.frameRate);
        clock.tick(timeoutMs - artificialDelay);
        await internalPromise();
        sinon.assert.calledTwice(cb);

        // The callback should not trigger since we decrease the frameRate
        // so it still called twice
        clock.tick(timeoutMs - artificialDelay);
        await internalPromise();
        sinon.assert.calledTwice(cb);

        // The callback should now trigger with the new frameRate
        clock.tick(newTimeoutMs - (timeoutMs - newTimeoutMs));
        await internalPromise();
        sinon.assert.calledThrice(cb);
      });

      [{
        state: 'mediaStreamTrack is disabled',
        setState: () => {
          mediaStreamTrack.enabled = false;
        }
      }, {
        state: 'mediaStreamTrack is ended',
        setState: () => {
          mediaStreamTrack.readyState = 'ended';
        }
      }, {
        state: 'there is no VideoProcessor added',
        setState: () => {
          videoTrack.processor = null;
        }
      }, {
        state: 'there are no video elements attached',
        setState: () => {
          videoTrack._attachments.clear();
        }
      }].forEach(({ state, setState }) => {
        it(`should stop capturing frames if ${state}`, async () => {
          videoTrack._captureFrames();

          clock.tick(timeoutMs);
          sinon.assert.calledOnce(processFrame);

          setState();
          await internalPromise();
          clock.tick(timeoutMs);
          sinon.assert.calledOnce(processFrame);
        });

        it(`should not start capturing frames if ${state}`, async () => {
          setState();
          videoTrack._captureFrames();
          clock.tick(timeoutMs);
          sinon.assert.notCalled(processFrame);

          await internalPromise();
          clock.tick(timeoutMs);
          sinon.assert.notCalled(processFrame);
        });
      });
    });

    describe('no operation', () => {
      beforeEach(() => {
        videoTrack._dummyEl.play = sinon.stub().returns(Promise.resolve());
      });

      it('when called more than once', () => {
        videoTrack._captureFrames();
        videoTrack._captureFrames();
        videoTrack._captureFrames();
        videoTrack._captureFrames();
        sinon.assert.calledOnce(videoTrack._dummyEl.play);
      });

      it('when a VideoProcessor is not added', () => {
        videoTrack.processor = null;
        videoTrack._captureFrames();
        sinon.assert.notCalled(videoTrack._dummyEl.play);
      });

      it('when no video elements are attached', () => {
        videoTrack._attachments.clear();
        videoTrack._captureFrames();
        sinon.assert.notCalled(videoTrack._dummyEl.play);
      });

      it('when mediaStreamTrack is disabled', () => {
        mediaStreamTrack.enabled = false;
        videoTrack._captureFrames();
        sinon.assert.notCalled(videoTrack._dummyEl.play);
      });

      it('when mediaStreamTrack is ended', () => {
        mediaStreamTrack.readyState = 'ended';
        videoTrack._captureFrames();
        sinon.assert.notCalled(videoTrack._dummyEl.play);
      });
    });
  });
});

function OffscreenCanvas(width, height) {
  this.width = width;
  this.height = height;
  this.drawing = {};
  this.getContext = () => ({
    drawImage: (image, x, y, width, height) => {
      this.drawing = { image, x, y, width, height };
    },
    clearRect: () => { this.drawing = null; }
  });
}

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind },
    enabled: { value: mediaStreamTrackSettings.enabled, writable: true },
    readyState: { value: 'live', writable: true },
    muted: { value: false, writable: true },
    getSettings: { value: () => mediaStreamTrackSettings, writable: true }
  });
}
inherits(MediaStreamTrack, EventEmitter);
MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;
MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;
