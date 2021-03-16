'use strict';

// Cached copy of the <canvas> used to check silent video frames.

var canvas = null;

var N_SAMPLES = 3;
var SAMPLE_HEIGHT = 50;
var SAMPLE_INTERVAL_MS = 250;
var SAMPLE_WIDTH = 50;

/**
 * Check whether the current video frame is silent by selecting a 50x50
 * sample and calculating the max value of the pixel data. If it is 0, then
 * the frame is considered to be silent.
 * @private
 * @param {HTMLVideoElement} el
 * @returns {boolean} true if silent, false if not
 */
function checkSilence(el) {
  var context = canvas.getContext('2d');
  context.drawImage(el, 0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  var frame = context.getImageData(0, 0, SAMPLE_WIDTH, SAMPLE_HEIGHT);
  var frameDataWithoutAlpha = frame.data.filter(function (item, i) {
    return (i + 1) % 4;
  });
  var max = Math.max.apply(Math, frameDataWithoutAlpha);
  return max === 0;
}

/**
 * Detect whether the video stream rendered by the given HTMLVideoElement is silent.
 * @param {HTMLVideoElement} el
 * @returns {Promise<boolean>} true if silent, false if not.
 */
function detectSilentVideo(el) {
  // Create the canvas when detectSilentVideo() is called for the
  // first time.
  canvas = canvas || document.createElement('canvas');

  // Resolve the returned Promise with true if 3 consecutive sample
  // frames from the video being played by the HTMLVideoElement are
  // silent.
  return new Promise(function (resolve) {
    var samplesLeft = N_SAMPLES;
    setTimeout(function doCheckSilence() {
      samplesLeft--;
      if (!checkSilence(el)) {
        return resolve(false);
      }
      if (samplesLeft > 0) {
        return setTimeout(doCheckSilence, SAMPLE_INTERVAL_MS);
      }
      return resolve(true);
    }, SAMPLE_INTERVAL_MS);
  });
}

module.exports = detectSilentVideo;