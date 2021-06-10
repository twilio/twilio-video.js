'use strict';

/**
 * Return a Promise that resolves after `timeout` milliseconds.
 * @param {?number} [timeout=0]
 * @returns {Promise<void>}
 */

function delay(timeout) {
  timeout = typeof timeout === 'number' ? timeout : 0;
  return new Promise(function (resolve) {
    return setTimeout(resolve, timeout);
  });
}

/**
 * Attempt to detect silence. The Promise returned by this function returns
 * false as soon as audio is detected or true after `timeout` milliseconds.
 * @param {AudioContext} audioContext
 * @param {MediaStream} stream
 * @param {?number} [timeout=250]
 * @returns {Promise<boolean>}
 */
function detectSilence(audioContext, stream, timeout) {
  timeout = typeof timeout === 'number' ? timeout : 250;

  var source = audioContext.createMediaStreamSource(stream);
  var analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  var samples = new Uint8Array(analyser.fftSize);

  var timeoutDidFire = false;
  setTimeout(function () {
    timeoutDidFire = true;
  }, timeout);

  /**
   * We can't use async/await yet, so I need to factor this out.
   * @returns {Promise<boolean>}
   */
  function doDetectSilence() {
    if (timeoutDidFire) {
      return Promise.resolve(true);
    }
    analyser.getByteTimeDomainData(samples);
    // NOTE(mpatwardhan): An audio MediaStreamTrack can be silent either due to all samples
    // being equal to 128 or all samples being equal to 0.
    return samples.some(function (sample) {
      return sample !== 128 && sample !== 0;
    }) ? Promise.resolve(false) : delay().then(doDetectSilence);
  }

  return doDetectSilence().then(function (isSilent) {
    source.disconnect();
    return isSilent;
  }, function (error) {
    source.disconnect();
    throw error;
  });
}

module.exports = detectSilence;