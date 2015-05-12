'use strict';

var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');
var Sound = require('./media/sound');
var Stream = require('./media/stream');
var util = require('./util');

/**
 * Construct an {@link Invite}.
 * @class
 * @classdesc An {@link Invite} to a {@link Conversation} can be accepted or
 * rejected.
 * <br><br>
 * {@link Invite}s are raised by {@link Endpoint#event:invite}.
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('invite', function(invite) {
 *   console.log('Received invite from ' + invite.from + ' to join a Conversation with ' +
 *     invite.participantAddresses.join(','));
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
 * @param {Endpoint} endpoint - the {@link Endpoint} that owns this {@link Invite} object
 * @param {InviteServerTransaction} inviteServerTransaction - the
 *   {@link InviteServerTransaction} that this {@link Invite} wraps
 * @property {string} conversationSid - the SID of the {@link Conversation} this {@link Invite} is
 *   for
 * @property {string} from - the remote {@link Endpoint} that sent this
 *   {@link Invite}
 * @property {Array<string>} participantAddresses - the remote participants currently in the {@link Conversation}
 * @property {string} status - the status of this {@link Invite}, either
 *   "accepted", "rejected", "canceled", or "pending"
 * @property {Endpoint} to - the recipient {@link Endpoint} of this
 *   {@link Invite}
 * @fires Invite#accepted
 * @fires Invite#canceled
 * @fires Invite#failed
 * @fires Invite#rejected
 */
function Invite(endpoint, inviteServerTransaction) {
  if (!(this instanceof Invite)) {
    return new Invite(endpoint, inviteServerTransaction);
  }
  var self = this;
  EventEmitter.call(this);

  var conversation = null;
  var from = inviteServerTransaction.from;
  var sound = Sound.getDefault();
  var to = inviteServerTransaction.to;

  var deferred = Q.defer();
  var inviteServerTransactions = [inviteServerTransaction];

  Object.defineProperties(this, {
    '_conversation': {
      set: function(_conversation) {
        conversation = _conversation;
      },
      get: function() {
        return conversation;
      }
    },
    '_deferred': {
      value: deferred
    },
    '_endpoint': {
      value: endpoint
    },
    '_inviteServerTransaction': {
      value: inviteServerTransaction
    },
    '_inviteServerTransactions': {
      value: inviteServerTransactions
    },
    '_promise': {
      value: deferred.promise
    },
    '_sound': {
      value: sound
    },
    'accepted': {
      enumerable: true,
      get: function() {
        return inviteServerTransactions.reduce(function(accepted, ist) {
          return accepted || ist.accepted;
        }, false);
      }
    },
    'canceled': {
      enumerable: true,
      get: function() {
        return inviteServerTransactions.reduce(function(canceled, ist) {
          return canceled && ist.canceled;
        }, true);
      }
    },
    'from': {
      enumerable: true,
      value: from
    },
    'participantAddresses': {
      enumerable: true,
      get: function() {
        return inviteServerTransactions.map(function(ist) {
          return ist.from;
        });
      }
    },
    'rejected': {
      enumerable: true,
      get: function() {
        var accepted = inviteServerTransactions.reduce(function(accepted, ist) {
          return accepted || ist.accepted;
        }, false);
        if (accepted) {
          return false;
        }
        return inviteServerTransactions.reduce(function(rejected, ist) {
          return rejected || ist.rejected;
        }, false);
      }
    },
    'conversationSid': {
      enumerable: true,
      value: inviteServerTransaction.conversationSid
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
  return Object.freeze(this);
}

inherits(Invite, EventEmitter);

/**
 * Accept the {@link Invite} and join the {@link Conversation}.
 * @param {Invite#AcceptOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - options to override
 *   {@link Invite#accept}'s default behavior
 * @fires Invite#accepted
 * @fires Invite#failed
 * @returns {Promise<Conversation>}
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('invite', function(invite) {
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
    return new Q(this._conversation);
  }
  options = options || {};
  var stream = options['localStream']
             ? new Q(options['localStream'] instanceof Stream ? options['localStream'] : new Stream(options['localStream']))
             : Stream.getUserMedia(options['localStreamConstraints']);
  return stream.then(function(stream) {
    options['localStream'] = stream;
    var promises = self._inviteServerTransactions.map(function(inviteServerTransaction) {
      return inviteServerTransaction.accept(options).then(function(dialog) {
        if (!self._conversation) {
          self._conversation = new Conversation(self._endpoint);
          self._deferred.resolve(self._conversation);
        }
        self._conversation._addDialog(dialog);
        return dialog;
      });
    });
    return util.race(promises).then(function() {
      setTimeout(function() {
        self.emit('accepted', self);
      });
      return self._conversation;
    }, function(error) {
      setTimeout(function() {
        self.emit('failed', self);
      });
      self._deferred.reject(error);
      throw error;
    });
  });
};

/**
 * Reject the {@link Invite} to a {@link Conversation}.
 * @instance
 * @fires Invite#rejected
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('invite', function(invite) {
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
 * @property {?Stream} [localStream=null] - Set to reuse an existing {@link Stream} when
 *   creating the {@link Conversation}.
 * @property {object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when an
 *   initial {@link Stream} is not supplied.
 */

module.exports = Invite;
