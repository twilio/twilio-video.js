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
    captureStream = sinon.stub().returns({getTracks: () => [processedTrack]});
    const document = new Document();
    document.createElement = () => ({captureStream});
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
        },{
          name: 'processor is undefined',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: undefined,
        },{
          name: 'processFrame is null',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: { processFrame: null },
        },{
          name: 'processFrame is undefined',
          errorMsg: 'Received an invalid VideoProcessor.',
          param: { processFrame: undefined },
        },{
          name: 'processor is already set',
          errorMsg: 'A VideoProcessor has already been added.',
          param: { processFrame: sinon.spy() },
          setup: () => videoTrack.processor = { processFrame: sinon.spy() }
        },{
          name: 'dummyEl is not set',
          errorMsg: 'VideoTrack has not been initialized.',
          param: { processFrame: sinon.spy() },
          setup: () => videoTrack._dummyEl = null
        }].forEach(({name, errorMsg, param, setup}) => {
          it(`when ${name}`, () => {
            if (setup) {
              setup();
            }
            const regex = new RegExp(errorMsg);
            assert.throws(() => {videoTrack.addProcessor(param)}, regex);
          });
        });
      });
    });
  });

  describe('#_captureFrames', () => {
    beforeEach(() => {
      videoTrack._attachments.add('foo');
      videoTrack.processor = 'foo';
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

function OffscreenCanvas(width, height){
  this.width = width;
  this.height = height;
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
