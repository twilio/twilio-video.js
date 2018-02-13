'use strict';

const LocalTrackPublicationSignaling = require('../localtrackpublication');
const createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

/**
 * @extends LocalTrackPublicationSignaling
 */
class LocalTrackPublicationV2 extends LocalTrackPublicationSignaling {
  /**
   * Construct a {@link LocalTrackPublicationV2}.
   * @param {DataTrackSender|MediaTrackSender} trackSender
   * @param {string} name
   */
  constructor(trackSender, name) {
    super(trackSender, name);
  }

  /**
   * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
   * @returns {LocalTrackPublicationV2#Representation} - without the SID
   */
  getState() {
    return {
      enabled: this.isEnabled,
      id: this.id,
      kind: this.kind,
      name: this.name
    };
  }

  /**
   * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
   * and perform any updates necessary.
   * @param {PublishedTrack} track
   * @returns {this}
   * @fires TrackSignaling#updated
   */
  update(track) {
    switch (track.state) {
      case 'ready':
        this.setSid(track.sid);
        break;
      case 'failed': {
        const error = track.error;
        this.publishFailed(createTwilioError(error.code, error.message));
        break;
      }
      default: // 'created'
        break;
    }
    return this;
  }
}

/**
 * The Room Signaling Protocol (RSP) representation of a {@link LocalTrackPublicationV2}.
 * @typedef {object} LocalTrackPublicationV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {Track.Kind} kind
 * @property {string} name
 * @property {Track.SID} sid
 */

module.exports = LocalTrackPublicationV2;
