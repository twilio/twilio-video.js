'use strict';

/**
 * Construct a {@link Participant}.
 * @class
 * @classdesc A {@link Participant} represents a remote {@link Endpoint} in a
 * {@link Conversation}.
 * @param {Dialog} dialog - the {@link Dialog} that this {@link Participant} represents
 * @property {string} address - the address of the {@link Participant}
 * @property {Conversation} conversation - the {@link Conversation} this {@link Participant} is in
 * @property {PeerConnection} peerConnection - the PeerConnection between your {@link Endpoint} and this {@link Participant} within the context of a {@link Conversation}
 * @property {string} sid - the {@link Participant}'s SID
 * @property {Stream} stream - the {@link Participant}'s {@link Stream}
 */
function Participant(conversation, dialog) {
  if (!(this instanceof Participant)) {
    return new Participant(dialog);
  }
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
    'peerConnection': {
      enumerable: true,
      value: peerConnection
    },
    'sid': {
      enumerable: true,
      value: sid
    },
    'stream': {
      enumerable: true,
      value: dialog.remoteStream
    }
  });
  return Object.freeze(this);
}

Object.freeze(Participant.prototype);

module.exports = Participant;
