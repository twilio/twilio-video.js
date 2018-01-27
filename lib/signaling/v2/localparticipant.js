'use strict';

const ParticipantSignaling = require('../participant');
const LocalTrackPublicationV2 = require('./localtrackpublication');

/**
 * Construct a {@link LocalParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 * @param {EncodingParametersImpl} encodingParameters
 * @param {object} [options]
 * @property {number} revision
 */
class LocalParticipantV2 extends ParticipantSignaling {
  constructor(encodingParameters, options) {
    options = Object.assign({
      LocalTrackPublicationV2
    }, options);

    super();
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
        get() {
          return this._revision;
        }
      }
    });
  }

  /**
   * Set the {@link EncodingParameters}.
   * @param {?EncodingParameters} encodingParameters
   * @returns {this}
   */
  setParameters(encodingParameters) {
    this._encodingParameters.update(encodingParameters);
    return this;
  }

  /**
   * Update the {@link LocalParticipantV2} with the new state.
   * @param {Published} published
   * @returns {this}
   */
  update(published) {
    if (this._publishedRevision >= published.revision) {
      return this;
    }

    this._publishedRevision = published.revision;

    published.tracks.forEach(function(publicationState) {
      const localTrackPublicationV2 = this.tracks.get(publicationState.id);
      if (localTrackPublicationV2) {
        localTrackPublicationV2.update(publicationState);
      }
    }, this);

    return this;
  }

  /**
   * Add a {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
   * or {@link MediaTrackSender} to the {@link LocalParticipantV2}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   * @returns {this}
   */
  addTrack(trackSender, name) {
    const localTrackPublicationV2 = new this._LocalTrackPublicationV2(trackSender, name);
    return ParticipantSignaling.prototype.addTrack.call(this, localTrackPublicationV2);
  }

  /**
   * Get the current state of the {@link LocalParticipantV2}.
   * @returns {object}
   */
  getState() {
    return {
      revision: this.revision,
      tracks: Array.from(this.tracks.values()).map(track => track.getState())
    };
  }

  /**
   * Increment the revision for the {@link LocalParticipantV2}.
   * @returns {this}
   */
  incrementRevision() {
    this._revision++;
    return this;
  }

  /**
   * Remove the {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
   * or {@link MediaTrackSender} from the {@link LocalParticipantV2}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @returns {boolean}
   */
  removeTrack(trackSender) {
    const localTrackPublicationV2 = this.tracks.get(trackSender.id);
    if (!localTrackPublicationV2) {
      return false;
    }
    return ParticipantSignaling.prototype.removeTrack.call(this, localTrackPublicationV2);
  }
}

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
