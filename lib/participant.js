'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('./media');
var util = require('./util');

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Client} in a
 * {@link Conversation}.
 * @param {string} sid - The {@link Participant}'s SID
 * @param {string} address - The address of the {@link Participant}
 * @param {PeerConnection} peerConnection - The PeerConnection between your {@link Client} and this {@link Participant} within the context of a {@link Conversation}
 * @param {?Media} [media] - The {@link Media} this {@link Participant} is sharing, if any
 * @property {string} address - The address of the {@link Participant}
 * @property {Conversation} conversation - The {@link Conversation} this {@link Participant} is in
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {PeerConnection} peerConnection - The PeerConnection between your {@link Client} and this {@link Participant} within the context of a {@link Conversation}
 * @property {string} sid - The {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackEnded
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(sid, address, peerConnection, media) {
  if (!(this instanceof Participant)) {
    return new Participant(sid, address, peerConnection, media);
  }

  EventEmitter.call(this);

  media = media || new Media();
  media.on('trackAdded', this.emit.bind(this, 'trackAdded'));
  media.on('trackDisabled', this.emit.bind(this, 'trackDisabled'));
  media.on('trackEnabled', this.emit.bind(this, 'trackEnabled'));
  media.on('trackEnded', this.emit.bind(this, 'trackEnded'));
  media.on('trackRemoved', this.emit.bind(this, 'trackRemoved'));
  media.on('trackStarted', this.emit.bind(this, 'trackStarted'));

  /* istanbul ignore next */
  Object.defineProperties(this, {
    address: {
      enumerable: true,
      value: address
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
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

module.exports = Participant;
