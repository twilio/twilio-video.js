'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');
var Sound = require('./media/sound');

/**
 * Construct an {@link Invite}
 * @class
 * @classdesc An {@link Invite} can be accepted to join a {@link Session}, or
 * it can be rejected.
 * @param {IncomingServerTransaction} inviteServerTransaction
 * @property {boolean} accepted - whether this {@link Invite} was accepted
 * @property {boolean} canceled - whether this {@link Invite} was canceled
 * @property {Participant} from - the {@link Participant} that sent this
 *   {@link Invite}
 * @property {boolean} rejected - whether this {@link Invite} was rejected
 * @property {Session} session - the {@link Session} this {@link Invite} is
 *   for
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
  var from = inviteServerTransaction.from;
  var session = inviteServerTransaction.session;
  var to = inviteServerTransaction.to;
  var sound = Sound.getDefault();
  Object.defineProperties(this, {
    '_inviteServerTransaction': {
      value: inviteServerTransaction
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
    'session': {
      enumerable: true,
      value: session
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
 * Accept the {@link Invite} and join the {@link Session}.
 * @params object [options=]
 * @returns Promise<Session>
 * @fires Invite#accepted
 * @fires Invite#failed
 */
Invite.prototype.accept = function accept(options) {
  var self = this;
  this._sound.incoming.stop();
  if (this.accepted) {
    return Q(this.session);
  }
  return this._inviteServerTransaction.accept().then(function() {
    self.emit('accepted', self.session);
    return self.session;
  }, function(error) {
    self.emit('failed', self);
    throw error;
  });
};

/**
 * Reject the {@link Invite} to a {@link Session}.
 * @returns Promise<Invite>
 * @fires Invite#rejected
 */
Invite.prototype.reject = function reject() {
  var self = this;
  this._sound.incoming.stop();
  if (this.rejected) {
    return Q(this);
  }
  return this._inviteServerTransaction.reject().then(function() {
    self.emit('rejected', self);
    return self;
  }, function(error) {
    // We don't really care if we succeed or not.
    self.emit('rejected', self);
    return self;
  });
};

module.exports = Invite;
