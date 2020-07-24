'use strict';

const detectSilence = require('../webaudio/detectsilence');

const N_ATTEMPTS = 3;
const ATTEMPT_DURATION_MS = 250;

/**
 * Detect whether the audio stream rendered by the given HTMLVideoElement is silent.
 * @param {HTMLAudioElement} el
 * @returns {Promise<boolean>} true if silent, false if not.
 */
function detectSilentAudio(el) {
  // NOTE(mmalavalli): We have to delay require-ing AudioContextFactory, because
  // it exports a default instance whose constructor calls Object.assign.
  const AudioContextFactory = require('../webaudio/audiocontext');
  const holder = {};
  const audioContext = AudioContextFactory.getOrCreate(holder);

  let attemptsLeft = N_ATTEMPTS;

  function doCheckSilence() {
    attemptsLeft--;
    return detectSilence(audioContext, el.srcObject, ATTEMPT_DURATION_MS).then(isSilent => {
      if (!isSilent) {
        return false;
      }
      if (attemptsLeft > 0) {
        return doCheckSilence();
      }
      return true;
    }).catch(() => {
      // NOTE(mmalavalli): If an error is thrown while detect silence, the audio
      // stream is assumed to be silent.
      return true;
    });
  }

  // Resolve the returned Promise with true if 3 consecutive attempts
  // to detect silent audio are successful.
  return doCheckSilence().finally(() => {
    AudioContextFactory.release(holder);
  });
}

module.exports = detectSilentAudio;
