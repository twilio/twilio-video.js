'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');

function ParticipantV2(sid, identity, initialState, media) {
  if (!(this instanceof ParticipantV2)) {
    return new ParticipantV2(sid, identity, initialState, media);
  }

  ParticipantSignaling.call(this, sid, identity, initialState, media);

  return this;
}

inherits(ParticipantV2, ParticipantSignaling);

/**
 * Update the {@link Participant} upon receipt of a {@link RoomEvent}.
 * @private
 * @param {RoomEvent} event
 * @returns {Participant}
 */
ParticipantV2.prototype._onRoomEvent = function _onRoomEvent(event) {
  if (event.participant_sid !== this.sid) {
    return this;
  }

  event.tracks.forEach(function(_track) {
    var trackId = _track.id;
    var track = this.media.tracks.get(trackId);
    if (!track) {
      return;
    }

    switch (event.event.toLowerCase()) {
      case 'track_disabled':
        track._signaling.disable();
        break;
      case 'track_enabled':
        track._signaling.enable();
        break;
      case 'track_removed':
        this.media._removeTrack(track);
    }
  }, this);

  return this;
};

module.exports = ParticipantV2;
