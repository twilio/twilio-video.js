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
    _publishedRevision: {
      writable: true,
      value: 0
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
 * @param {Published} published
 * @returns {this}
 */
LocalParticipantV2.prototype.update = function update(published) {
  if (this._publishedRevision >= published.revision) {
    return this;
  }

  this._publishedRevision = published.revision;

  published.tracks.forEach(function(publicationState) {
    var localTrackPublicationV2 = this.tracks.get(publicationState.id);
    if (localTrackPublicationV2) {
      localTrackPublicationV2.update(publicationState);
    }
  }, this);

  return this;
};

/**
 * Add a {@link LocalTrackPublicationV2} for the given MediaStreamTrack or
 * {@link DataTrackSender} to the {@link LocalParticipantV2}.
 * @param {MediaStreamTrack|DataTrackSender} mediaStreamTrackOrDataTrackSender
 * @param {string} name
 * @returns {this}
 */
LocalParticipantV2.prototype.addTrack = function addTrack(mediaStreamTrackOrDataTrackSender, name) {
  var localTrackPublicationV2 = new this._LocalTrackPublicationV2(mediaStreamTrackOrDataTrackSender, name);
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
 * {@link DataTrackSender} from the {@link LocalParticipantV2}.
 * @param {MediaStreamTrack|DataTrackSender} mediaStreamTrackOrDataTrackSender
 * @returns {boolean}
 */
LocalParticipantV2.prototype.removeTrack = function removeTrack(mediaStreamTrackOrDataTrackSender) {
  var localTrackPublicationV2 = this.tracks.get(mediaStreamTrackOrDataTrackSender.id);
  if (!localTrackPublicationV2) {
    return false;
  }
  return ParticipantSignaling.prototype.removeTrack.call(this, localTrackPublicationV2);
};

/**
 * @interface Published
 * @property {number} revision
 * @property {Array<PublishedTrack>} tracks
 */

/**
 * @typedef {CreatedTrack|ReadyTrack|FailedTrack} PublishedTrack
 */

/**
 * @interface CreatedTrack
 * @property {Track.ID} id
 * @property {string} state - "created"
 */

/**
 * @interface ReadyTrack
 * @property {Track.ID} id
 * @property {Track.SID} sid
 * @property {string} state - "ready"
 */

/**
 * @interface FailedTrack
 * @property {Track.ID} id
 * @property {TrackError} error
 * @property {string} state - "failed"
 */

/**
 * @interface TrackError
 * @property {number} code
 * @property {string} message
 */

module.exports = LocalParticipantV2;
