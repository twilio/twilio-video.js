'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('./media');

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Conversation}.
 * @param {string} sid - The {@link Participant}'s SID
 * @param {string} identity - The identity of the {@link Participant}
 * @param {PeerConnection} peerConnection - The PeerConnection between your {@link Client} and this {@link Participant} within the context of a {@link Conversation}
 * @param {?Media} [media] - The {@link Media} this {@link Participant} is sharing, if any
 * @property {Conversation} conversation - The {@link Conversation} this {@link Participant} is in
 * @property {string} identity - The identity of the {@link Participant}
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {PeerConnection} peerConnection - The PeerConnection between your {@link Client} and this {@link Participant} within the context of a {@link Conversation}
 * @property {string} sid - The {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(sid, identity, peerConnection, media) {
  if (!(this instanceof Participant)) {
    return new Participant(sid, identity, peerConnection, media);
  }

  EventEmitter.call(this);

  media = media || new Media();

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
    peerConnection: {
      enumerable: true,
      value: peerConnection
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });

  return this;
}

var TRACK_ADDED = Participant.TRACK_ADDED = Media.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = Participant.TRACK_DIMENSIONS_CHANGED = Media.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = Participant.TRACK_DISABLED = Media.TRACK_DISABLED;
var TRACK_ENABLED = Participant.TRACK_ENABLED = Media.TRACK_ENABLED;
var TRACK_ENDED = Participant.TRACK_ENDED = Media.TRACK_ENDED;
var TRACK_REMOVED = Participant.TRACK_REMOVED = Media.TRACK_REMOVED;
var TRACK_STARTED = Participant.TRACK_STARTED = Media.TRACK_STARTED;

inherits(Participant, EventEmitter);

/**
 * Update the {@link Participant} upon receipt of a {@link ConversationEvent}.
 * @private
 * @param {ConversationEvent} event
 * @returns {Participant}
 */
Participant.prototype._onConversationEvent = function _onConversationEvent(event) {
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

Object.freeze(Participant.prototype);

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was disabled
 * @event Participant#trackDisabled
 */

/**
 * A {@link Track} was enabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Participant#trackEnabled
 */

/**
 * One of the {@link Participant}'s {@link Track}s ended.
 * @param {Track} track - The {@link Track} that ended
 * @event Participant#trackEnded
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

/**
 * One of the {@link Participant}'s {@link Track}s started.
 * @param {Track} track - The {@link Track} that started
 * @event Participant#trackStarted
 */

module.exports = Participant;
