'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Endpoint} in a
 * {@link Conversation}.
 * @param {Dialog} dialog - the {@link Dialog} that this {@link Participant} represents
 * @property {string} address - the address of the {@link Participant}
 * @property {Conversation} conversation - the {@link Conversation} this {@link Participant} is in
 * @property {Media} media - the {@link Media} this {@link Participant} is sharing, if any
 * @property {PeerConnection} peerConnection - the PeerConnection between your {@link Endpoint} and this {@link Participant} within the context of a {@link Conversation}
 * @property {string} sid - the {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackRemoved
 */
function Participant(conversation, dialog) {
  if (!(this instanceof Participant)) {
    return new Participant(conversation, dialog);
  }
  EventEmitter.call(this);
  var media = dialog.remoteMedia;
  var peerConnection =
    (dialog && dialog.session && dialog.session.mediaHandler && dialog.session.mediaHandler.peerConnection) || null;
  var sid = null;
  Object.defineProperties(this, {
    '_dialog': {
      value: dialog
    },
    'address': {
      enumerable: true,
      value: dialog.remote
    },
    'conversation': {
      enumerable: true,
      value: conversation
    },
    'media': {
      enumerable: true,
      value: media
    },
    'peerConnection': {
      enumerable: true,
      value: peerConnection
    },
    'sid': {
      enumerable: true,
      value: sid
    }
  });
  media.on('trackAdded', this.emit.bind(this, 'trackAdded'));
  media.on('trackRemoved', this.emit.bind(this, 'trackRemoved'));
  return Object.freeze(this);
}

inherits(Participant, EventEmitter);

Object.freeze(Participant.prototype);

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - the {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - the {@link Track} that was removed
 * @event Participant#trackRemoved
 */

module.exports = Participant;
