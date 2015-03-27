'use strict';

var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');
var Sound = require('./media/sound');

/**
 * Construct an {@link Invite}.
 * @class
 * @classdesc An {@link Invite} to a {@link Conversation} can be accepted or
 * rejected.
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('invite', function(invite) {
 *   console.log('Received invite to join a Conversation with ' + invite.from);
 *   invite.accept().then(displayConversation);
 * });
 *
 * // Display the remote Stream(s) in your app.
 * function displayConversation(conversation) {
 *   var participantVideos = document.getElementById('participant-videos');
 *   conversation.getRemoteStreams().forEach(function(remoteStream) {
 *     var participantVideo = remoteStream.attach();
 *     participantVideos.appendChild(participantVideo);
 *   });
 * }
 * @param {InviteServerTransaction} inviteServerTransaction - the
 *   {@link InviteServerTransaction} that this {@link Invite} wraps
 * @property {Conversation} conversation - the {@link Conversation} this {@link Invite} is
 *   for
 * @property {string} from - the remote {@link Endpoint} that sent this
 *   {@link Invite}
 * @property {string} status - the status of this {@link Invite}, either
 *   "accepted", "rejected", "canceled", or "pending"
 * @property {Endpoint} to - the recipient {@link Endpoint} of this
 *   {@link Invite}
 * @fires Invite#accepted
 * @fires Invite#canceled
 * @fires Invite#failed
 * @fires Invite#rejected
 */
function Invite(inviteServerTransaction) {
  var self = this;
  EventEmitter.call(this);

  var conversation = null;
  var from = inviteServerTransaction.from;
  var sound = Sound.getDefault();
  var to = inviteServerTransaction.to;

  var promise = inviteServerTransaction.then(function(dialog) {
    var dialogs = [dialog];
    var conversation = new Conversation(dialogs);
    self._conversation = conversation;
    return self.conversation;
  });

  Object.defineProperties(this, {
    '_conversation': {
      set: function(_conversation) {
        conversation = _conversation;
      }
    },
    '_inviteServerTransaction': {
      value: inviteServerTransaction
    },
    '_promise': {
      value: promise
    },
    '_sound': {
      value: sound
    },
    'accepted': {
      enumerable: true,
      get: function() {
        return inviteServerTransaction.accepted;
      }
    },
    'canceled': {
      enumerable: true,
      get: function() {
        return inviteServerTransaction.canceled;
      }
    },
    'from': {
      enumerable: true,
      value: from
    },
    'rejected': {
      enumerable: true,
      get: function() {
        return inviteServerTransaction.rejected;
      }
    },
    'conversation': {
      enumerable: true,
      get: function() {
        return conversation;
      }
    },
    'status': {
      enumerable: true,
      get: function() {
        switch (true) {
          case this.accepted:
            return 'accepted';
          case this.rejected:
            return 'rejected';
          case this.canceled:
            return 'canceled';
          default:
            return 'pending';
        }
      }
    },
    'to': {
      enumerable: true,
      value: to
    }
  });
  sound.incoming.play();
  inviteServerTransaction.once('canceled', function() {
    sound.incoming.stop();
    self.emit('canceled', self);
  });
  inviteServerTransaction.once('failed', function() {
    sound.incoming.stop();
  });
  return this;
}

inherits(Invite, EventEmitter);

/**
 * Accept the {@link Invite} and join the {@link Conversation}.
 * @param {Invite#AcceptOptions}
 *   [options={streamConstraints:{audio:true,video:true}}] - options to override
 *   {@link Invite#accept}'s default behavior
 * @fires Invite#accepted
 * @fires Invite#failed
 * @returns {Promise<Conversation>}
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('invite', function(invite) {
 *   console.log('Received Invite to join a Conversation with ' + invite.from);
 *
 *   // By default, accept will request a new audio/video Stream for you.
 *   invite.accept();
 * });
 */
Invite.prototype.accept = function accept(options) {
  var self = this;
  this._sound.incoming.stop();
  if (this.accepted) {
    return new Q(this.conversation);
  }
  return this._inviteServerTransaction.accept(options).then(function() {
    setTimeout(function() {
      self.emit('accepted', self);
    });
    return self.conversation;
  }, function(error) {
    setTimeout(function() {
      self.emit('failed', self);
    });
    throw error;
  });
};

/**
 * Reject the {@link Invite} to a {@link Conversation}.
 * @instance
 * @fires Invite#rejected
 * @example
 *
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('invite', function(invite) {
 *   console.log('Rejecting Invite to join a Conversation with ' + invite.from);
 *   invite.reject();
 * });
 */
Invite.prototype.reject = function reject() {
  var self = this;
  this._sound.incoming.stop();
  if (this.rejected) {
    return new Q(this);
  }
  return this._inviteServerTransaction.reject().then(function() {
    setTimeout(function() {
      self.emit('rejected', self);
    });
    return self;
  }, function(error) {
    // We don't really care if we succeed or not.
    setTimeout(function() {
      self.emit('rejected', self);
    });
    return self;
  });
};

Object.freeze(Invite.prototype);

/**
 * The {@link Invite} was accepted, and the {@link Endpoint} is now
 * participating in the {@link Conversation}.
 * @param {Invite} invite - the {@link Invite}
 * @event Invite#accepted
 */

/**
 * The {@link Invite} was rejected.
 * @param {Invite} invite - the {@link Invite}
 * @event Invite#rejected
 */

/**
 * The {@link Invite} was canceled.
 * @param {Invite} invite - the {@link Invite}
 * @event Invite#canceled
 */

/**
 * The {@link Invite} failed.
 * @param {Invite} invite - the {@link Invite}
 * @event Invite#failed
 */

/**
 * You may pass these options to {@link Invite#accept} to
 * override the default behavior.
 * @typedef {object} Invite#AcceptOptions
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 * @property {?Stream} [stream=null] - Set to reuse an existing {@link Stream} when
 *   creating the {@link Conversation}.
 * @property {object} [streamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when an
 *   initial {@link Stream} is not supplied.
 */

module.exports = Invite;
