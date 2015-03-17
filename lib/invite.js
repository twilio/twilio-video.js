'use strict';

var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');
var Sound = require('./media/sound');

/**
 * Construct an {@link Invite}.
 * @class
 * @classdesc An {@link Invite} can be accepted to join a {@link Conversation}, or
 * it can be rejected.
 * @param {InviteServerTransaction} inviteServerTransaction - the
 *   {@link InviteServerTransaction} that this {@link Invite} wraps
 * @property {boolean} accepted - whether this {@link Invite} was accepted
 * @property {boolean} canceled - whether this {@link Invite} was canceled
 * @property {Conversation} conversation - the {@link Conversation} this {@link Invite} is
 *   for
 * @property {string} from - the remote {@link Endpoint} that sent this
 *   {@link Invite}
 * @property {boolean} rejected - whether this {@link Invite} was rejected
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
 * @param object [options=]
 * @fires Invite#accepted
 * @fires Invite#failed
 * @returns {Promise<Conversation>}
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
 */
Invite.prototype.reject = function reject() {
  var self = this;
  this._sound.incoming.stop();
  if (this.rejected) {
    return new Q(this);
  }
  this._inviteServerTransaction.reject().then(function() {
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

module.exports = Invite;
