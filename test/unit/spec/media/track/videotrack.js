'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const { inherits } = require('util');
const log = require('../../../../lib/fakelog');
const Document = require('../../../../lib/document');
const VideoTrack = require('../../../../../lib/media/track/videotrack');
const MediaTrackTransceiver = require('../../../../../lib/media/track/transceiver');

const mediaStreamTrackSettings = {
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
    processedTrack = {};
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
          sinon.assert.calledWith(captureStream, mediaStreamTrackSettings.frameRate);
          assert.equal(videoTrack.processedTrack.enabled, mediaStreamTrackSettings.enabled);
        });

        it('should update the mediaStreamTrack of attached elements', () => {
          sinon.assert.calledOnce(videoTrack._updateElementsMediaStreamTrack);
        });

        it('should start capturing frames', () => {
          sinon.assert.calledOnce(videoTrack._captureFrames);
        });
      });

      context('raise an error', () => {
        [{
          name: 'processor is null',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: null,
        }, {
          name: 'processor is undefined',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: undefined,
        }, {
          name: 'processFrame is null',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: { processFrame: null },
        }, {
          name: 'processFrame is undefined',
          errorMsg: 'Received an invalid VideoProcessor.',
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

  describe('#_captureFrames', () => {
    // As of node12, the Promise.then and Promise.finally requires separate
    // promises to resolve internally.
    const internalPromise = () => Promise.resolve().then(Promise.resolve());
    const timeoutMs = 1000 / mediaStreamTrackSettings.frameRate;
    let processFrame;

    beforeEach(() => {
      processFrame = sinon.spy();
      videoTrack._attachments.add('foo');
      videoTrack.processor = { processFrame };

      videoTrack._dummyEl.play = () => ({ then: cb => {
        cb();
        return { catch: sinon.stub() };
      } });

      videoTrack._inputFrame = new OffscreenCanvas(mediaStreamTrackSettings.width, mediaStreamTrackSettings.height);
      videoTrack._outputFrame = new OffscreenCanvas(mediaStreamTrackSettings.width, mediaStreamTrackSettings.height);
    });

    describe('processFrame', () => {
      it('should pass the inputFrames to the processFrame method', () => {
        videoTrack._captureFrames();
        clock.tick(timeoutMs);
        sinon.assert.calledWith(processFrame, videoTrack._inputFrame);
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
        name: 'should drop the frame if processFrame returns null',
        getReturnValue: () => null,
        expectedDrawing: {}
      }, {
        name: 'should drop the frame if processFrame returns a promise which resolves to null',
        getReturnValue: () => Promise.resolve(null),
        expectedDrawing: {}
      }].forEach(({ name, getReturnValue, expectedDrawing }) => {
        it(name, async () => {
          videoTrack.processor.processFrame = () => getReturnValue();
          videoTrack._captureFrames();
          clock.tick(timeoutMs);
          await internalPromise();
          assert.deepEqual(videoTrack._outputFrame.drawing, expectedDrawing);
        });
      });
    });

    describe('requestVideoFrameCallback', () => {
      let onVideoFrame;

      beforeEach(() => {
        onVideoFrame = sinon.stub();
      });

      it('should use requestVideoFrameCallback when available', async () => {
        videoTrack._dummyEl.requestVideoFrameCallback = cb => {
          setTimeout(() => {
            onVideoFrame();
            cb();
          }, timeoutMs);
        };
        videoTrack._captureFrames();

        clock.tick(timeoutMs - 1);
        sinon.assert.notCalled(processFrame);
        sinon.assert.notCalled(onVideoFrame);
        clock.tick(1);
        sinon.assert.calledOnce(processFrame);
        sinon.assert.calledOnce(onVideoFrame);

        await internalPromise();
        clock.tick(timeoutMs);
        sinon.assert.calledTwice(processFrame);
        sinon.assert.calledTwice(onVideoFrame);

        await internalPromise();
        clock.tick(timeoutMs);
        sinon.assert.calledThrice(processFrame);
        sinon.assert.calledThrice(onVideoFrame);
      });

      it('should use setTimeout if requestVideoFrameCallback is not available', async () => {
        videoTrack._captureFrames();

        clock.tick(timeoutMs - 1);
        sinon.assert.notCalled(processFrame);
        sinon.assert.notCalled(onVideoFrame);
        clock.tick(1);
        sinon.assert.calledOnce(processFrame);
        sinon.assert.notCalled(onVideoFrame);

        await internalPromise();
        clock.tick(timeoutMs);
        sinon.assert.calledTwice(processFrame);
        sinon.assert.notCalled(onVideoFrame);

        await internalPromise();
        clock.tick(timeoutMs);
        sinon.assert.calledThrice(processFrame);
        sinon.assert.notCalled(onVideoFrame);
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
    }
  });
}

function MediaStreamTrack(id, kind) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    id: { value: id },
    kind: { value: kind },
    enabled: { value: mediaStreamTrackSettings.enabled },
    getSettings: { value: () => mediaStreamTrackSettings }
  });
}
inherits(MediaStreamTrack, EventEmitter);
MediaStreamTrack.prototype.addEventListener = MediaStreamTrack.prototype.addListener;
MediaStreamTrack.prototype.removeEventListener = MediaStreamTrack.prototype.removeListener;
