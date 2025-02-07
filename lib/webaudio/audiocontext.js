/* globals webkitAudioContext, AudioContext */
'use strict';

const NativeAudioContext = typeof AudioContext !== 'undefined'
  ? AudioContext
  : typeof webkitAudioContext !== 'undefined'
    ? webkitAudioContext
    : null;

/**
 * @interface AudioContextFactoryOptions
 * @property {AudioContext} [AudioContext] - The AudioContext constructor
 */

/**
 * {@link AudioContextFactory} ensures we construct at most one AudioContext
 * at a time, and that it is eventually closed when we no longer need it.
 * @property {AudioContextFactory} AudioContextFactory - The
 *   {@link AudioContextFactory} constructor
 */
class AudioContextFactory {
  /**
   * @param {AudioContextFactoryOptions} [options]
   */
  constructor(options) {
    options = Object.assign({
      AudioContext: NativeAudioContext
    }, options);
    Object.defineProperties(this, {
      _AudioContext: {
        value: options.AudioContext
      },
      _audioContext: {
        value: null,
        writable: true
      },
      _holders: {
        value: new Set()
      },
      AudioContextFactory: {
        enumerable: true,
        value: AudioContextFactory
      },
      _enabled: {
        value: true,
        writable: true
      }
    });
  }

  /**
   * Disables audio context functionality
   * @returns {void}
   */
  disable() {
    if (this._holders.size > 0) {
      throw new Error('Cannot disable while AudioContext has active holders');
    }
    this._enabled = false;
    if (this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }

  /**
   * @returns {boolean} Whether audio context functionality is enabled
   */
  isEnabled() {
    return this._enabled;
  }

  /**
   * Sets a custom AudioContext instance
   * @param {AudioContext} customContext - The AudioContext instance to use
   * @returns {void}
   */
  setAudioContext(customContext) {
    if (!this._enabled) {
      throw new Error('Cannot set AudioContext while it is disabled');
    }
    if (this._holders.size > 0) {
      throw new Error('Cannot change AudioContext while it has active holders');
    }
    this._audioContext = customContext;
  }

  /**
   * Each call to {@link AudioContextFactory#getOrCreate} should be paired with a
   * call to {@link AudioContextFactory#release}. Calling this increments an
   * internal reference count.
   * @param {*} holder - The object to hold a reference to the AudioContext
   * @returns {?AudioContext}
   */
  getOrCreate(holder) {
    if (!this._enabled) {
      throw new Error('Cannot use AudioContext while it is disabled');
    }
    if (!this._holders.has(holder)) {
      this._holders.add(holder);
      if (this._AudioContext && !this._audioContext) {
        try {
          this._audioContext = new this._AudioContext();
        } catch (error) {
          // Do nothing;
        }
      }
    }
    return this._audioContext;
  }

  /**
   * Decrement the internal reference count. If it reaches zero, close and destroy
   * the AudioContext.
   * @param {*} holder - The object that held a reference to the AudioContext
   * @returns {void}
   */
  release(holder) {
    if (this._holders.has(holder)) {
      this._holders.delete(holder);
      if (!this._holders.size && this._audioContext) {
        this._audioContext.close();
        this._audioContext = null;
      }
    }
  }
}

module.exports = new AudioContextFactory();
