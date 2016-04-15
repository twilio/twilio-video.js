'use strict';

var inherits = require('util').inherits;
var Media = require('../../media');
var ParticipantImpl_ = require('../participantimpl');

function ParticipantImpl(sid, identity, initialState, signaling) {
  if (!(this instanceof ParticipantImpl)) {
    return new ParticipantImpl(sid, identity, initialState, signaling);
  }
  ParticipantImpl_.call(this, sid, identity);

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

var TRACK_ADDED = ParticipantImpl.TRACK_ADDED = Media.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = ParticipantImpl.TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = ParticipantImpl.TRACK_DISABLED = Media.TRACK_DISABLED;
var TRACK_ENABLED = ParticipantImpl.TRACK_ENABLED = Media.TRACK_ENABLED;
var TRACK_ENDED = ParticipantImpl.TRACK_ENDED = Media.TRACK_ENDED;
var TRACK_REMOVED = ParticipantImpl.TRACK_REMOVED = Media.TRACK_REMOVED;
var TRACK_STARTED = ParticipantImpl.TRACK_STARTED = Media.TRACK_STARTED;

inherits(ParticipantImpl, ParticipantImpl_);

/**
 * Update the {@link Participant} upon receipt of a {@link ConversationEvent}.
 * @private
 * @param {ConversationEvent} event
 * @returns {Participant}
 */
ParticipantImpl.prototype._onConversationEvent = function _onConversationEvent(event) {
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

module.exports = ParticipantImpl;
