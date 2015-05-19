'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Twilio.Endpoint} in a
 * {@link Conversation}.
 * @param {Dialog} dialog - The {@link Dialog} that this {@link Participant} represents
 * @property {string} address - The address of the {@link Participant}
 * @property {Conversation} conversation - The {@link Conversation} this {@link Participant} is in
 * @property {Media} media - The {@link Media} this {@link Participant} is sharing, if any
 * @property {PeerConnection} peerConnection - The PeerConnection between your {@link Twilio.Endpoint} and this {@link Participant} within the context of a {@link Conversation}
 * @property {string} sid - The {@link Participant}'s SID
 * @fires Participant#trackAdded
 * @fires Participant#trackRemoved
 */
function Participant(conversation, dialog) {
  if (!(this instanceof Participant)) {
    return new Participant(conversation, dialog);
  }
  EventEmitter.call(this);
  var media = dialog.remoteMedia;
  var peerConnection = dialog && util.getOrNull(dialog, 'session.mediaHandler.peerConnection');
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
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

module.exports = Participant;
