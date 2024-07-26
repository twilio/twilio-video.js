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
        () => controller.enqueue(Date.now()),
        1000 / frameRate
      );
    }
  });

  const transformer = new TransformStream({
    transform(now, controller) {
      controller.enqueue(now);
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

function captureVideoFramesInsertableStreams(videoEl, processVideoFrame) {
  const [track] = videoEl.srcObject.getVideoTracks();
  const { readable } = new MediaStreamTrackProcessor({ track });
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });

  const transformer = new TransformStream({
    transform(videoFrame, controller) {
      controller.enqueue(videoFrame);
      return processVideoFrame();
    }
  });

  readable
    .pipeThrough(transformer)
    .pipeTo(generator.writable)
    .then(() => { /* noop */ });

  return () => {
    generator.stop();
  };
}

module.exports = typeof MediaStreamTrackGenerator === 'function' && typeof MediaStreamTrackProcessor === 'function'
  ? captureVideoFramesInsertableStreams
  : captureVideoFramesSetInterval;
