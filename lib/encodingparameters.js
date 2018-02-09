'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * {@link EncodingParametersImpl} represents an object which notifies its
 * listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements EncodingParameters
 * @emits EncodingParametersImpl#changed
 * @property {?number} maxAudioBitrate
 * @property {?number} maxVideoBitrate
 */
class EncodingParametersImpl extends EventEmitter {
  /**
   * Construct an {@link EncodingParametersImpl}.
   * @param {EncodingParamters} encodingParameters - Initial {@link EncodingParameters}
   */
  constructor(encodingParameters) {
    super();

    encodingParameters = Object.assign({
      maxAudioBitrate: null,
      maxVideoBitrate: null
    }, encodingParameters);

    Object.defineProperties(this, {
      maxAudioBitrate: {
        value: encodingParameters.maxAudioBitrate,
        writable: true
      },
      maxVideoBitrate: {
        value: encodingParameters.maxVideoBitrate,
        writable: true
      }
    });
  }

  /**
   * Returns the bitrate values in an {@link EncodingParameters}.
   * @returns {EncodingParameters}
   */
  toJSON() {
    return {
      maxAudioBitrate: this.maxAudioBitrate,
      maxVideoBitrate: this.maxVideoBitrate
    };
  }

  /**
   * Update the bitrate values with those in the given {@link EncodingParameters}.
   * @param {EncodingParameters} encodingParameters - The new {@link EncodingParameters}
   * @fires EncodingParametersImpl#changed
   */
  update(encodingParameters) {
    encodingParameters = Object.assign({
      maxAudioBitrate: this.maxAudioBitrate,
      maxVideoBitrate: this.maxVideoBitrate
    }, encodingParameters);

    const shouldEmitChanged = [
      'maxAudioBitrate',
      'maxVideoBitrate'
    ].reduce((shouldEmitChanged, maxKindBitrate) => {
      if (this[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
        this[maxKindBitrate] = encodingParameters[maxKindBitrate];
        shouldEmitChanged = true;
      }
      return shouldEmitChanged;
    }, false);

    if (shouldEmitChanged) {
      this.emit('changed');
    }
  }
}

/**
 * At least one of the {@link EncodingParametersImpl}'s bitrate values changed.
 * @event EncodingParametersImpl#changed
 */

module.exports = EncodingParametersImpl;
