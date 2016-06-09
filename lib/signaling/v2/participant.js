'use strict';

var inherits = require('util').inherits;
var Media = require('../../media');
var ParticipantSignaling = require('../participant');

function ParticipantV2(sid, identity, initialState) {
  if (!(this instanceof ParticipantV2)) {
    return new ParticipantV2(sid, identity, initialState);
  }
  ParticipantSignaling.call(this, sid, identity, initialState);

  var media = this.media;

  /* eslint no-use-before-define:0 */
  media.on(Media.TRACK_ADDED, this.emit.bind(this, TRACK_ADDED));
  media.on(Media.TRACK_DIMENSIONS_CHANGED, this.emit.bind(this, TRACK_DIMENSIONS_CHANGED));
  media.on(Media.TRACK_DISABLED, this.emit.bind(this, TRACK_DISABLED));
  media.on(Media.TRACK_ENABLED, this.emit.bind(this, TRACK_ENABLED));
  media.on(Media.TRACK_ENDED, this.emit.bind(this, TRACK_ENDED));
  media.on(Media.TRACK_REMOVED, this.emit.bind(this, TRACK_REMOVED));
  media.on(Media.TRACK_STARTED, this.emit.bind(this, TRACK_STARTED));

  /* istanbul ignore next */
  Object.defineProperties(this, {
    identity: {
      enumerable: true,
      value: identity
    },
    media: {
      enumerable: true,
      value: media
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });

  return this;
}

var TRACK_ADDED = ParticipantV2.TRACK_ADDED = Media.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = ParticipantV2.TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = ParticipantV2.TRACK_DISABLED = Media.TRACK_DISABLED;
var TRACK_ENABLED = ParticipantV2.TRACK_ENABLED = Media.TRACK_ENABLED;
var TRACK_ENDED = ParticipantV2.TRACK_ENDED = Media.TRACK_ENDED;
var TRACK_REMOVED = ParticipantV2.TRACK_REMOVED = Media.TRACK_REMOVED;
var TRACK_STARTED = ParticipantV2.TRACK_STARTED = Media.TRACK_STARTED;

inherits(ParticipantV2, ParticipantSignaling);

/**
 * Update the {@link Participant} upon receipt of a {@link ConversationEvent}.
 * @private
 * @param {ConversationEvent} event
 * @returns {Participant}
 */
ParticipantV2.prototype._onConversationEvent = function _onConversationEvent(event) {
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
        track._enable(false);
        break;
      case 'track_enabled':
        track._enable(true);
        break;
      case 'track_removed':
        this.media._removeTrack(track);
    }
  }, this);

  return this;
};

module.exports = ParticipantV2;
