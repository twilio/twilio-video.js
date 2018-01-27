'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * EncodingParametersImpl
 * @class
 * @classdesc {@link EncodingParametersImpl} represents an object which notifies
 *   its listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements EncodingParameters
 * @fires EncodingParametersImpl#changed
 * @property {?number} maxAudioBitrate
 * @property {?number} maxVideoBitrate
 * @param {EncodingParamters} encodingParameters - Initial {@link EncodingParameters}
 */
class EncodingParametersImpl extends EventEmitter {
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

    const self = this;
    const shouldEmitChanged = [
      'maxAudioBitrate',
      'maxVideoBitrate'
    ].reduce((shouldEmitChanged, maxKindBitrate) => {
      if (self[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
        self[maxKindBitrate] = encodingParameters[maxKindBitrate];
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
