/* globals MediaStreamTrackGenerator, MediaStreamTrackProcessor, TransformStream */
'use strict';

const { DEFAULT_FRAME_RATE } = require('../../util/constants');

function captureVideoFramesSetInterval(videoEl, processVideoFrame) {
  const [track] = videoEl.srcObject.getVideoTracks();
  const { frameRate = DEFAULT_FRAME_RATE } = track.getSettings();
  let sampleInterval;

  const readable = new ReadableStream({
    start(controller) {
      sampleInterval = setInterval(
        () => controller.enqueue(),
        1000 / frameRate
      );
    }
  });

  const transformer = new TransformStream({
    transform() {
      return processVideoFrame();
    }
  });

  readable
    .pipeThrough(transformer)
    .pipeTo(new WritableStream())
    .then(() => { /* noop */ });

  return () => {
    clearInterval(sampleInterval);
  };
}

function captureVideoFramesInsertableStreams(videoEl, processVideoFrame, videoFrameType) {
  const [track] = videoEl.srcObject.getVideoTracks();
  const { readable } = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  let shouldStop = false;

  const transformer = new TransformStream({
    transform(videoFrame, controller) {
      const promise = videoFrameType === 'videoframe'
        ? processVideoFrame(videoFrame)
        : Promise.resolve(videoFrame.close())
          .then(processVideoFrame);
      return promise.finally(() => {
        if (shouldStop) {
          controller.terminate();
        }
      });
    }
  });

  readable
    .pipeThrough(transformer)
    .pipeTo(generator.writable)
    .then(() => { /* noop */ });

  return () => {
    shouldStop = true;
  };
}

module.exports = typeof MediaStreamTrackGenerator === 'function' && typeof MediaStreamTrackProcessor === 'function'
  ? captureVideoFramesInsertableStreams
  : captureVideoFramesSetInterval;
