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
 * @fires Participant#trackRemoved
 */
function Participant(sid, address, peerConnection, media) {
  if (!(this instanceof Participant)) {
    return new Participant(sid, address, peerConnection, media);
  }

  EventEmitter.call(this);

  media = media || new Media();
  media.on('trackAdded', this.emit.bind(this, 'trackAdded'));
  media.on('trackRemoved', this.emit.bind(this, 'trackRemoved'));
  media.on('trackMuted', this.emit.bind(this, 'trackMuted'));
  media.on('trackUnmuted', this.emit.bind(this, 'trackUnmuted'));
  media.on('trackPaused', this.emit.bind(this, 'trackPaused'));
  media.on('trackUnpaused', this.emit.bind(this, 'trackUnpaused'));

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
Object.freeze(Participant.prototype);

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

/**
 * A {@link Track} was muted by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was muted
 * @event Participant#trackMuted
 */

/**
 * A {@link Track} was unmuted by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was unmuted
 * @event Participant#trackUnmuted
 */

/**
 * A {@link Track} was paused by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was paused
 * @event Participant#trackPaused
 */

/**
 * A {@link Track} was unpaused by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was unpaused
 * @event Participant#trackUnpaused
 */

module.exports = Participant;
