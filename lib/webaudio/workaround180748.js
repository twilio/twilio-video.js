'use strict';

const detectSilence = require('./detectsilence');

/**
 * This function attempts to workaround WebKit Bug 180748. It does so by
 *
 *   1. Calling `getUserMedia`, and
 *   2. Checking to see if the resulting MediaStream is silent.
 *   3. If so, repeat Step 1; otherwise, return the MediaStream.
 *
 * The function only repeats up to `n` times, and it only waits `timeout`
 * milliseconds when detecting silence. Assuming `getUserMedia` is
 * instantaneous, in the best case, this function returns a Promise that
 * resolves immediately; in the worst case, this function returns a Promise that
 * resolves in `n` * `timeout` milliseconds.
 *
 * @param {Log} log
 * @param {function(MediaStreamConstraints): Promise<MediaStream>} getUserMedia
 * @param {MediaStreamConstraints} constraints
 * @param {number} [n=3]
 * @param {number} [timeout=250]
 * @returns Promise<MediaStream>
 */
function workaround(log, getUserMedia, constraints, n, timeout) {
  n = typeof n === 'number' ? n : 3;
  let retry = 0;

  // NOTE(mroberts): We have to delay require-ing AudioContextFactory, because
  // it exports a default instance whose constructor calls Object.assign.
  const AudioContextFactory = require('./audiocontext');
  const holder = {};
  const audioContext = AudioContextFactory.getOrCreate(holder);

  /**
   * We can't use async/await yet, so I need to factor this out.
   * @returns {Promise<MediaStream>}
   */
  function doWorkaround() {
    return getUserMedia(constraints).then(stream => {
      const isSilentPromise = constraints.audio
        ? detectSilence(audioContext, stream, timeout).catch(err => {
          log.warn('Encountered an error while detecting silence', err);
          return true;
        })
        : Promise.resolve(false);
      return isSilentPromise.then(isSilent => {
        if (!isSilent) {
          log.info('Got a non-silent audio MediaStreamTrack; returning it.');
          return stream;
        } else if (n <= 0) {
          log.warn('Got a silent audio MediaStreamTrack. Normally we would try \
to get a new one, but we\'ve run out of retries; returning it anyway.');
          return stream;
        }
        log.warn(`Got a silent audio MediaStreamTrack. Stopping all \
MediaStreamTracks and calling getUserMedia again. This is retry \
#${++retry}.`);
        stream.getTracks().forEach(track => track.stop());
        n--;
        return doWorkaround();
      });
    });
  }

  return doWorkaround().then(stream => {
    AudioContextFactory.release(holder);
    return stream;
  }, error => {
    AudioContextFactory.release(holder);
    throw error;
  });
}

module.exports = workaround;
