'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

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
function EncodingParametersImpl(encodingParameters) {
  if (!(this instanceof EncodingParametersImpl)) {
    return new EncodingParametersImpl(encodingParameters);
  }
  EventEmitter.call(this);

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

inherits(EncodingParametersImpl, EventEmitter);

/**
 * Returns the bitrate values in an {@link EncodingParameters}.
 * @returns {EncodingParameters}
 */
EncodingParametersImpl.prototype.toJSON = function toJSON() {
  return {
    maxAudioBitrate: this.maxAudioBitrate,
    maxVideoBitrate: this.maxVideoBitrate
  };
};

/**
 * Update the bitrate values with those in the given {@link EncodingParameters}.
 * @param {EncodingParameters} encodingParameters - The new {@link EncodingParameters}
 * @fires EncodingParametersImpl#changed
 */
EncodingParametersImpl.prototype.update = function update(encodingParameters) {
  encodingParameters = Object.assign({
    maxAudioBitrate: this.maxAudioBitrate,
    maxVideoBitrate: this.maxVideoBitrate
  }, encodingParameters);

  var self = this;
  var shouldEmitChanged = [
    'maxAudioBitrate',
    'maxVideoBitrate'
  ].reduce(function(shouldEmitChanged, maxKindBitrate) {
    if (self[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
      self[maxKindBitrate] = encodingParameters[maxKindBitrate];
      shouldEmitChanged = true;
    }
    return shouldEmitChanged;
  }, false);

  if (shouldEmitChanged) {
    this.emit('changed');
  }
};

/**
 * At least one of the {@link EncodingParametersImpl}'s bitrate values changed.
 * @event EncodingParametersImpl#changed
 */

module.exports = EncodingParametersImpl;
