'use strict';

var inherits = require('util').inherits;
var LocalTrackPublicationSignaling = require('../localtrackpublication');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

/**
 * Construct a {@link LocalTrackPublicationV2}.
 * @class
 * @extends LocalTrackPublicationSignaling
 * @param {MediaStreamTrack|DataTrackSender} mediaStreamTrackOrDataTrackSender
 * @param {string} name
 */
function LocalTrackPublicationV2(mediaStreamTrackOrDataTrackSender, name) {
  if (!(this instanceof LocalTrackPublicationV2)) {
    return new LocalTrackPublicationV2(mediaStreamTrackOrDataTrackSender, name);
  }
  LocalTrackPublicationSignaling.call(this,
    mediaStreamTrackOrDataTrackSender,
    name);
}

inherits(LocalTrackPublicationV2, LocalTrackPublicationSignaling);

/**
 * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
 * @returns {LocalTrackPublicationV2#Representation} - without the SID
 */
LocalTrackPublicationV2.prototype.getState = function getState() {
  return {
    enabled: this.isEnabled,
    id: this.id,
    kind: this.kind,
    name: this.name
  };
};

/**
 * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
 * and perform any updates necessary.
 * @param {PublishedTrack} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
LocalTrackPublicationV2.prototype.update = function update(track) {
  switch (track.state) {
    case 'ready':
      this.setSid(track.sid);
      break;
    case 'failed':
      var error = track.error;
      this.publishFailed(createTwilioError(error.code, error.message));
      break;
    default: // 'created'
      break;
  }
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link LocalTrackPublicationV2}
 * @typedef {object} LocalTrackPublicationV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {Track.Kind} kind
 * @property {string} name
 * @property {Track.SID} sid
 */

module.exports = LocalTrackPublicationV2;
