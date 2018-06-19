'use strict';

/**
 * Return a Promise that resolves after `timeout` milliseconds.
 * @param {?number} [timeout=0]
 * @returns {Promise<void>}
 */
function delay(timeout) {
  timeout = typeof timeout === 'number' ? timeout : 0;
  return new Promise(resolve => setTimeout(resolve, timeout));
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

  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const samples = new Uint8Array(analyser.fftSize);

  let timeoutDidFire = false;
  setTimeout(() => { timeoutDidFire = true; }, timeout);

  /**
   * We can't use async/await yet, so I need to factor this out.
   * @returns {Promise<boolean>}
   */
  function doDetectSilence() {
    if (timeoutDidFire) {
      return Promise.resolve(true);
    }
    analyser.getByteTimeDomainData(samples);
    return samples.some(sample => sample)
      ? Promise.resolve(false)
      : delay().then(doDetectSilence);
  }

  return doDetectSilence().then(isSilent => {
    source.disconnect();
    return isSilent;
  }, error => {
    source.disconnect();
    throw error;
  });
}

module.exports = detectSilence;
