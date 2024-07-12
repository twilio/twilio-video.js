/* globals MediaStreamTrackGenerator, MediaStreamTrackProcessor, TransformStream */

'use strict';

/**
 * @private
 * @param {ReadableStream} readable
 * @param {WritableStream} writable
 * @param {function(VideoFrame): Promise<VideoFrame>} processVideoFrame
 * @returns {void}
 */
function processVideoMediaStreamTrack(readable, writable, processVideoFrame) {
  const transformer = new TransformStream({
    transform(frame, controller) {
      return processVideoFrame(frame).then(frame_ => {
        frame = frame_;
      }).finally(() => {
        controller.enqueue(frame);
      });
    }
  });
  readable
    .pipeThrough(transformer)
    .pipeTo(writable)
    .catch(() => { /* Do nothing. */ });
}

module.exports = processVideoMediaStreamTrack;
