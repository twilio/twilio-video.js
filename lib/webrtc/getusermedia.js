/* globals navigator */
'use strict';

/**
 * This function is very similar to <code>navigator.mediaDevices.getUserMedia</code>
 * except that if no MediaStreamConstraints are provided, then bot audio and video
 * are requested.
 * @function getUserMedia
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}] - the
 *   MediaStreamConstraints object specifying what kind of MediaStream to
 *   request from the browser (by default both audio and video)
 * @returns Promise<MediaStream>
 */
function getUserMedia(constraints = { audio: true, video: true }) {
  if (typeof navigator === 'object'
    && typeof navigator.mediaDevices === 'object'
    && typeof navigator.mediaDevices.getUserMedia === 'function') {
    return navigator.mediaDevices.getUserMedia(constraints);
  }
  return Promise.reject(new Error('getUserMedia is not supported'));
}

module.exports = getUserMedia;
