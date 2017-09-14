'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');
var LocalTrackPublicationV2 = require('./localtrackpublication');

/**
 * Construct a {@link LocalParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 * @param {EncodingParametersImpl} encodingParameters
 * @param {object} [options]
 * @property {number} revision
 */
function LocalParticipantV2(encodingParameters, options) {
  if (!(this instanceof LocalParticipantV2)) {
    return new LocalParticipantV2(encodingParameters, options);
  }

  options = Object.assign({
    LocalTrackPublicationV2: LocalTrackPublicationV2
  });

  ParticipantSignaling.call(this);
  Object.defineProperties(this, {
    _encodingParameters: {
      value: encodingParameters
    },
    _LocalTrackPublicationV2: {
      value: options.LocalTrackPublicationV2
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

/**
 * Update the {@link LocalParticipantV2} with the new state.
 * @param {object} localParticipantState
 * @returns {this}
 */
LocalParticipantV2.prototype.update = function update(localParticipantState) {
  if (this.revision !== null && localParticipantState.revision < this.revision) {
    return this;
  }

  localParticipantState.tracks.forEach(function(localTrackState) {
    var localTrackPublicationV2 = this.tracks.get(localTrackState.id);
    if (localTrackPublicationV2) {
      localTrackPublicationV2.update(localTrackState);
    }
  }, this);

  return this;
};

/**
 * Add a {@link LocalTrackPublicationV2} for the given MediaStreamTrack or
 * {@link LocalDataStreamTrack} to the {@link LocalParticipantV2}.
 * @param {MediaStreamTrack|LocalDataStreamTrack} mediaOrDataStreamTrack
 * @returns {this}
 */
LocalParticipantV2.prototype.addTrack = function addTrack(mediaOrDataStreamTrack) {
  var localTrackPublicationV2 = new this._LocalTrackPublicationV2(mediaOrDataStreamTrack);
  return ParticipantSignaling.prototype.addTrack.call(this, localTrackPublicationV2);
};

/**
 * Get the current state of the {@link LocalParticipantV2}.
 * @returns {object}
 */
LocalParticipantV2.prototype.getState = function getState() {
  return {
    revision: this.revision,
    tracks: Array.from(this.tracks.values()).map(function(track) {
      return track.getState();
    })
  };
};

/**
 * Increment the revision for the {@link LocalParticipantV2}.
 * @returns {this}
 */
LocalParticipantV2.prototype.incrementRevision = function incrementRevision() {
  this._revision++;
  return this;
};

/**
 * Remove the {@link LocalTrackPublicationV2} for the given MediaStreamTrack or
 * {@link LocalDataStreamTrack} from the {@link LocalParticipantV2}.
 * @param {MediaStreamTrack|LocalDataStreamTrack} mediaOrDataStreamTrack
 * @returns {boolean}
 */
LocalParticipantV2.prototype.removeTrack = function removeTrack(mediaOrDataStreamTrack) {
  var localTrackPublicationV2 = this.tracks.get(mediaOrDataStreamTrack.id);
  if (!localTrackPublicationV2) {
    return false;
  }
  return ParticipantSignaling.prototype.removeTrack.call(this, localTrackPublicationV2);
};

module.exports = LocalParticipantV2;
