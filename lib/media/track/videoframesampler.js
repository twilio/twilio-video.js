/* globals MediaStreamTrackGenerator, MediaStreamTrackProcessor, TransformStream */

'use strict';

const { DEFAULT_FRAME_RATE } = require('../../util/constants');

/**
 * @private
 * @param {HTMLVideoElement} videoElement
 * @param {function(): Promise<void>} onVideoFrame
 * @returns {function(): void}
 */
function sampleUsingInsertableStream(videoElement, onVideoFrame) {
  const [track] = videoElement.srcObject.getVideoTracks();
  const generator = new MediaStreamTrackGenerator({ kind: 'video' });
  const processor = new MediaStreamTrackProcessor({ track });
  const [processedTrack] = new MediaStream([generator]).getVideoTracks();

  const transformer = new TransformStream({
    transform(frame, controller) {
      onVideoFrame().finally(
        () => controller.enqueue(frame)
      );
    }
  });

  const promise = processor
    .readable
    .pipeThrough(transformer)
    .pipeTo(generator.writable);

  promise.catch(() => {
    /* Do nothing. */
  });

  return () => {
    processedTrack.stop();
  };
}

/**
 * @private
 * @param {HTMLVideoElement} videoElement
 * @param {function(): Promise<void>} onVideoFrame
 * @returns {function(): void}
 */
function sampleUsingSetTimeout(videoElement, onVideoFrame) {
  let processFramePeriodMs;
  let startTime;
  let timeoutId;

  const [track] = videoElement
    .srcObject
    .getVideoTracks();

  const sampleFrame = () => {
    clearTimeout(timeoutId);
    const { frameRate = DEFAULT_FRAME_RATE } = track.getSettings();
    const capturePeriodMs = Math.floor(1000 / frameRate);
    let delay = capturePeriodMs - processFramePeriodMs;
    if (delay < 0 || typeof processFramePeriodMs !== 'number') {
      delay = 0;
    }
    timeoutId = setTimeout(() => {
      startTime = Date.now();
      onVideoFrame().finally(() => {
        processFramePeriodMs = Date.now() - startTime;
        sampleFrame();
      });
    }, delay);
  };
  sampleFrame();

  return () => {
    clearTimeout(timeoutId);
  };
}

const isInsertableStreamsSupported = typeof MediaStreamTrackGenerator === 'function'
  && typeof MediaStreamTrackProcessor === 'function'
  && typeof TransformStream === 'function';

module.exports = isInsertableStreamsSupported
  ? sampleUsingInsertableStream
  : sampleUsingSetTimeout;
