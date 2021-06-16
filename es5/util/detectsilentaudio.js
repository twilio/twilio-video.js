'use strict';

var detectSilence = require('../webaudio/detectsilence');

var N_ATTEMPTS = 3;
var ATTEMPT_DURATION_MS = 250;

/**
 * Detect whether the audio stream rendered by the given HTMLVideoElement is silent.
 * @param {HTMLAudioElement} el
 * @returns {Promise<boolean>} true if silent, false if not.
 */
function detectSilentAudio(el) {
  // NOTE(mmalavalli): We have to delay require-ing AudioContextFactory, because
  // it exports a default instance whose constructor calls Object.assign.
  var AudioContextFactory = require('../webaudio/audiocontext');
  var holder = {};
  var audioContext = AudioContextFactory.getOrCreate(holder);

  var attemptsLeft = N_ATTEMPTS;

  function doCheckSilence() {
    attemptsLeft--;
    return detectSilence(audioContext, el.srcObject, ATTEMPT_DURATION_MS).then(function (isSilent) {
      if (!isSilent) {
        return false;
      }
      if (attemptsLeft > 0) {
        return doCheckSilence();
      }
      return true;
    }).catch(function () {
      // NOTE(mmalavalli): If an error is thrown while detect silence, the audio
      // stream is assumed to be silent.
      return true;
    });
  }

  // Resolve the returned Promise with true if 3 consecutive attempts
  // to detect silent audio are successful.
  return doCheckSilence().finally(function () {
    AudioContextFactory.release(holder);
  });
}

module.exports = detectSilentAudio;