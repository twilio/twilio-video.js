'use strict';

var C = require('../../util/constants');
var Conversation = require('../../conversation');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../../util');

var LocalMedia = require('../../media/localmedia');

/**
 * Construct an {@link IncomingInvite}.
 * @class
 * @classdesc An {@link IncomingInvite} to a {@link Conversation} can be accepted or
 * rejected.
 * <br><br>
 * {@link IncomingInvite}s are returned by {@link Client#event:invite}.
 * @param {InviteServerTransaction} inviteServerTransaction - The
 *   {@link InviteServerTransaction} that this {@link IncomingInvite} wraps
 * @param {Object} [options] - Options to override the constructor's
 *   default behavior.
 * @property {Conversation.SID} conversationSid - The SID of the {@link Conversation}
 *   this {@link IncomingInvite} invites to
 * @property {string} from - The identity of the {@link Participant} that sent this
 *   {@link IncomingInvite}
 * @property {Array<string>} participants - The identities of the {@link Participant}s currently in the {@link Conversation}
 * @property {string} status - The status of this {@link IncomingInvite}, either
 *   "accepting", "accepted", "rejected", "canceled", "failed", or "pending"
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
  var getLocalMedia = null;
  var localMedia = null;
  var participants = [from];
  var participantSid = inviteServerTransaction.participantSid;
  var pending = 0;
  var shouldStopLocalMediaOnFailure = false;
  var status = 'pending';

  var deferred = util.defer();
  var inviteServerTransactions = new Set();
  inviteServerTransactions.add(inviteServerTransaction);

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
    _getLocalMedia: {
      get: function() {
        return getLocalMedia;
      },
      set: function(_getLocalMedia) {
        getLocalMedia = _getLocalMedia;
      }
    },
    _inviteServerTransaction: {
      value: inviteServerTransaction
    },
    _inviteServerTransactions: {
      value: inviteServerTransactions
    },
    _localMedia: {
      get: function() {
        return localMedia;
      },
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _logLevel: {
      value: options.logLevel
    },
    _options: {
      get: function() {
        return options;
      },
      set: function(_options) {
        options = _options;
      }
    },
    _pending: {
      get: function() {
        return pending;
      },
      set: function(_pending) {
        pending = _pending;
      }
    },
    _promise: {
      value: deferred.promise
    },
    _shouldStopLocalMediaOnFailure: {
      get: function() {
        return shouldStopLocalMediaOnFailure;
      },
      set: function(_shouldStopLocalMediaOnFailure) {
        shouldStopLocalMediaOnFailure = _shouldStopLocalMediaOnFailure;
      }
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
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
      value: participants
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    status: {
      enumerable: true,
      get: function() {
        return status;
      }
    }
  });

  inviteServerTransaction.once('canceled', function() {
    self.emit('canceled', self);
  });

  return this;
}

inherits(IncomingInvite, EventEmitter);

IncomingInvite.prototype._onAcceptFailure = function _onAcceptFailure(reason) {
  this._pending--;

  if (this.status === 'accepting' && !this._pending) {
    this._status = 'failed';
    if (this._shouldStopLocalMediaOnFailure && this._localMedia) {
      this._localMedia.stop();
    }
    this._deferred.reject(reason);
    this.emit('failed', this);
  }

  return this;
};

IncomingInvite.prototype._onDialog = function _onDialog(dialog) {
  this._pending--;

  var conversation
    = this._conversation
    = this._conversation || new Conversation(this._options);

  conversation._onDialog(dialog);

  if (this.status === 'accepting') {
    this._status = 'accepted';
    this._deferred.resolve(conversation);
    this.emit('accepted', this);
  }

  return conversation;
};

IncomingInvite.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  var self = this;
  switch (this.status) {
    case 'canceled':
    case 'rejected':
      inviteServerTransaction.reject();
      return;
    case 'accepting':
      if (!this._inviteServerTransactions.has(inviteServerTransaction)) {
        this.participants.push(util.getUser(inviteServerTransaction.from));
        this._inviteServerTransactions.add(inviteServerTransaction);
      }
      this._pending++;
      this._getLocalMedia.then(function gotLocalMedia() {
        return inviteServerTransaction.accept(self._options);
      }).then(this._onDialog.bind(this), this._onAcceptFailure.bind(this));
      return;
    case 'accepted':
      this._conversation._onInviteServerTransaction(inviteServerTransaction);
      return;
    default:
      if (!this._inviteServerTransactions.has(inviteServerTransaction)) {
        this.participants.push(util.getUser(inviteServerTransaction.from));
        this._inviteServerTransactions.add(inviteServerTransaction);
      }
  }
};

/**
 * Accept the {@link IncomingInvite} and join the {@link Conversation}.
 * @param {IncomingInvite.AcceptOptions}
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
  if (this.status === 'accepted') {
    return this._promise;
  }

  options = this._options = util.withDefaults({ }, options, this._options);
  this._status = 'accepting';

  var self = this;

  function getLocalMedia() {
    if (!options.localMedia && !options.localStream) {
      self._shouldStopLocalMediaOnFailure = true;
      self._options.shouldStopLocalMediaOnDisconnect = true;
    }
    return LocalMedia.getLocalMedia(options);
  }

  this._getLocalMedia = getLocalMedia();

  return this._getLocalMedia.then(function gotLocalMedia(localMedia) {
    self._localMedia = localMedia;
    options.localMedia = localMedia;
    self._inviteServerTransactions.forEach(self._onInviteServerTransaction, self);
    return self._promise;
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
 *
 * @returns {this}
 */
IncomingInvite.prototype.reject = function reject() {
  this._inviteServerTransactions.forEach(function(inviteServerTransaction) {
    inviteServerTransaction.reject();
  });
  this.emit('rejected');
  return this;
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
 * @typedef {object} IncomingInvite.AcceptOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Conversation}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when accepting an {@link IncomingInvite}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   MediaStream when accepting an {@link IncomingInvite}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = IncomingInvite;
