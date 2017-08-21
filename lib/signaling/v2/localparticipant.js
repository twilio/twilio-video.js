'use strict';

var getTrackState = require('./track').getState;
var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');

/**
 * Construct a {@link LocalParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 * @param {EncodingParametersImpl} encodingParameters
 */
function LocalParticipantV2(encodingParameters) {
  if (!(this instanceof LocalParticipantV2)) {
    return new LocalParticipantV2(encodingParameters);
  }
  ParticipantSignaling.call(this);
  Object.defineProperties(this, {
    _encodingParameters: {
      value: encodingParameters
    },
    _revision: {
      writable: true,
      value: 1
    },
    revision: {
      enumerable: true,
      get: function() {
        return this._revision;
      }
    }
  });
}

inherits(LocalParticipantV2, ParticipantSignaling);


/**
 * Set the {@link EncodingParameters}.
 * @param {?EncodingParameters} encodingParameters
 * @returns {this}
 */
LocalParticipantV2.prototype.setParameters = function setParameters(encodingParameters) {
  this._encodingParameters.update(encodingParameters);
  return this;
};

LocalParticipantV2.prototype.update = function update() {
  this._revision++;
  return this;
};

LocalParticipantV2.prototype.getState = function getState() {
  return {
    revision: this.revision,
    tracks: Array.from(this.tracks.values()).map(getTrackState)
  };
};

module.exports = LocalParticipantV2;
