'use strict';

var getTrackState = require('./track').getState;
var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');

/**
 * Construct a {@link LocalParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 */
function LocalParticipantV2() {
  if (!(this instanceof LocalParticipantV2)) {
    return new LocalParticipantV2();
  }
  ParticipantSignaling.call(this);
  Object.defineProperties(this, {
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
