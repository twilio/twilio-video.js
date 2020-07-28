'use strict';

const { defer } = require('./');

/**
 * This is a pair of Deferreds that are set whenever local media is muted and
 * resolved whenever local media is unmuted/ended and restarted if necessary.
 */
class LocalMediaRestartDeferreds {
  /**
   * Constructor.
   */
  constructor() {
    Object.defineProperties(this, {
      _audio: {
        value: defer(),
        writable: true
      },
      _video: {
        value: defer(),
        writable: true
      }
    });

    // Initially, resolve both the Deferreds.
    this._audio.resolve();
    this._video.resolve();
  }

  /**
   * Resolve the Deferred for audio or video.
   * @param {'audio'|'video'} kind
   */
  resolveDeferred(kind) {
    if (kind === 'audio') {
      this._audio.resolve();
    } else {
      this._video.resolve();
    }
  }

  /**
   * Start the Deferred for audio or video.
   * @param {'audio' | 'video'} kind
   */
  startDeferred(kind) {
    if (kind === 'audio') {
      this._audio = defer();
    } else {
      this._video = defer();
    }
  }

  /**
   * Wait until the Deferred for audio or video is resolved.
   * @param {'audio'|'video'} kind
   * @returns {Promise<void>}
   */
  whenResolved(kind) {
    return kind === 'audio' ? this._audio.promise : this._video.promise;
  }
}

module.exports = new LocalMediaRestartDeferreds();
