'use strict';

var C = require('./util/constants');
var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');

var LocalMedia = require('./media/localmedia');

/**
 * Construct an {@link IncomingInvite}.
 * @class
 * @classdesc An {@link IncomingInvite} to a {@link Conversation} can be accepted or
 * rejected.
 * <br><br>
 * {@link IncomingInvite}s are raised by {@link Client#event:invite}.
 * @param {InviteServerTransaction} inviteServerTransaction - The
 *   {@link InviteServerTransaction} that this {@link IncomingInvite} wraps
 * @param {Object} [options] - Options to override the constructor's
 *   default behavior.
 * @property {string} conversationSid - The SID of the {@link Conversation} this {@link IncomingInvite} is
 *   for
 * @property {string} from - The remote {@link Client} that sent this
 *   {@link IncomingInvite}
 * @property {Array<string>} participants - The identities of the {@link Participants} currently in the {@link Conversation}
 * @property {string} status - The status of this {@link IncomingInvite}, either
 *   "accepted", "rejected", "canceled", or "pending"
 * @property {Client} to - The recipient {@link Client} of this
 *   {@link IncomingInvite}
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#canceled
 * @fires IncomingInvite#failed
 * @fires IncomingInvite#rejected
 */
function IncomingInvite(inviteServerTransaction, options) {
  if (!(this instanceof IncomingInvite)) {
    return new IncomingInvite(inviteServerTransaction, options);
  }

  options = util.withDefaults({ }, options, {
    logLevel: C.DEFAULT_LOG_LEVEL
  });

  var self = this;
  EventEmitter.call(this);

  var conversation = null;
  var from = util.getUser(inviteServerTransaction.from);
  var participantSid = inviteServerTransaction.participantSid;
  var to = inviteServerTransaction.to;

  var deferred = util.defer();
  var inviteServerTransactions = [inviteServerTransaction];

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _conversation: {
      set: function(_conversation) {
        conversation = _conversation;
      },
      get: function() {
        return conversation;
      }
    },
    _deferred: {
      value: deferred
    },
    _inviteServerTransaction: {
      value: inviteServerTransaction
    },
    _inviteServerTransactions: {
      value: inviteServerTransactions
    },
    _logLevel: {
      value: options.logLevel
    },
    _options: {
      value: options
    },
    _promise: {
      value: deferred.promise
    },
    accepted: {
      enumerable: true,
      get: function() {
        return inviteServerTransactions.reduce(function(accepted, ist) {
          return accepted || ist.isAccepted;
        }, false);
      }
    },
    canceled: {
      enumerable: true,
      get: function() {
        return inviteServerTransactions.reduce(function(canceled, ist) {
          return canceled && ist.isCanceled;
        }, true);
      }
    },
    conversationSid: {
      enumerable: true,
      value: inviteServerTransaction.conversationSid
    },
    from: {
      enumerable: true,
      value: from
    },
    participants: {
      enumerable: true,
      get: function() {
        // TODO(mroberts): Let's not create an array on the fly every time...
        return inviteServerTransactions.map(function(ist) {
          return util.getUser(ist.from);
        });
      }
    },
    participantSid: {
      value: participantSid
    },
    rejected: {
      enumerable: true,
      get: function() {
        var accepted = inviteServerTransactions.reduce(function(accepted, ist) {
          return accepted || ist.isAccepted;
        }, false);
        if (accepted) {
          return false;
        }
        return inviteServerTransactions.reduce(function(rejected, ist) {
          return rejected || ist.isRejected;
        }, false);
      }
    },
    status: {
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
    to: {
      enumerable: true,
      value: to
    }
  });

  inviteServerTransaction.once('canceled', function() {
    self.emit('canceled', self);
  });

  return this;
}

inherits(IncomingInvite, EventEmitter);

/**
 * Accept the {@link IncomingInvite} and join the {@link Conversation}.
 * @param {IncomingInvite#AcceptOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link IncomingInvite#accept}'s default behavior
 * @fires IncomingInvite#accepted
 * @fires IncomingInvite#failed
 * @returns {Promise<Conversation>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received IncomingInvite to join a Conversation with ' + invite.from);
 *
 *   // By default, accept will request the microphone and camera for you.
 *   invite.accept();
 * });
 */
IncomingInvite.prototype.accept = function accept(options) {
  if (this.accepted) { return Promise.resolve(this._conversation); }

  options = util.withDefaults({ }, options, this._options);

  /* istanbul ignore next: getLocalMedia is browser-specific */
  var localMedia = options.localMedia ?
    Promise.resolve(options.localMedia) :
    LocalMedia.getLocalMedia(options);

  var self = this;
  return localMedia.then(function(localMedia) {
    options.localMedia = localMedia;
    var promises = self._inviteServerTransactions.map(function(inviteServerTransaction) {
      return inviteServerTransaction.accept(options).then(function(dialog) {
        if (!self._conversation) {
          self._conversation = new Conversation(options);
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
 * Reject the {@link IncomingInvite} to a {@link Conversation}.
 * @fires IncomingInvite#rejected
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Rejecting IncomingInvite to join a Conversation with ' + invite.from);
 *   invite.reject();
 * });
 */
IncomingInvite.prototype.reject = function reject() {
  var self = this;

  return this._inviteServerTransaction.reject().then(function() {
    self.emit('rejected');
    return self;
  });
};

Object.freeze(IncomingInvite.prototype);

/**
 * The {@link IncomingInvite} was accepted, and the {@link Client} is now
 * participating in the {@link Conversation}.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#accepted
 */

/**
 * The {@link IncomingInvite} was rejected.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#rejected
 */

/**
 * The {@link IncomingInvite} was canceled.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#canceled
 */

/**
 * The {@link IncomingInvite} failed.
 * @param {IncomingInvite} invite - The {@link IncomingInvite}
 * @event IncomingInvite#failed
 */

/**
 * You may pass these options to {@link IncomingInvite#accept} to
 * override the default behavior.
 * @typedef {object} IncomingInvite#AcceptOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when accepting an {@link IncomingInvite}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   MediaStream when accepting an {@link IncomingInvite}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = IncomingInvite;
