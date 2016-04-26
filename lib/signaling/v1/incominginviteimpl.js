'use strict';

var C = require('../../util/constants');
var ConversationImpl = require('./conversationimpl');
var IncomingInviteImpl_ = require('../incominginviteimpl');
var inherits = require('util').inherits;
var util = require('../../util');

function IncomingInviteImpl(inviteServerTransaction, options) {
  if (!(this instanceof IncomingInviteImpl)) {
    return new IncomingInviteImpl(inviteServerTransaction, options);
  }

  options = util.withDefaults({ }, options, {
    logLevel: C.DEFAULT_LOG_LEVEL
  });

  var self = this;

  var conversation = null;
  var conversationSid = inviteServerTransaction.conversationSid;
  var from = util.getUser(inviteServerTransaction.from);
  var localMedia = null;
  var participants = [from];
  var participantSid = inviteServerTransaction.participantSid;
  var pending = 0;

  var deferred = util.defer();
  var inviteServerTransactions = new Set();
  inviteServerTransactions.add(inviteServerTransaction);

  IncomingInviteImpl_.call(this, conversationSid, from, participantSid, options);

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
    participants: {
      enumerable: true,
      value: participants
    }
  });

  inviteServerTransaction.once('canceled', function() {
    self.preempt('canceled');
  });

  this.on('stateChanged', this.emit.bind(this));
}

inherits(IncomingInviteImpl, IncomingInviteImpl_);

IncomingInviteImpl.prototype._onAcceptFailure = function _onAcceptFailure(reason) {
  this._pending--;

  if (this.state === 'accepting' && !this._pending) {
    this._deferred.reject(reason);
  }

  return this;
};

IncomingInviteImpl.prototype._onDialog = function _onDialog(dialog) {
  this._pending--;

  var conversation
    = this._conversation
    = this._conversation || new ConversationImpl(this._localMedia, this.participantSid, this.conversationSid, this._options);

  conversation._onDialog(dialog);

  if (this.state === 'accepting') {
    this._deferred.resolve(conversation);
  }

  return conversation;
};

IncomingInviteImpl.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  switch (this.state) {
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
      inviteServerTransaction.accept(this._options).then(
        this._onDialog.bind(this), this._onAcceptFailure.bind(this));
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

IncomingInviteImpl.prototype._accept = function accept(localMedia, options) {
  Object.assign(this._options, options);
  this._localMedia = this._options.localMedia = localMedia;
  this._inviteServerTransactions.forEach(this._onInviteServerTransaction, this);
  return this._promise;
};

IncomingInviteImpl.prototype._reject = function reject() {
  this._inviteServerTransactions.forEach(function(inviteServerTransaction) {
    inviteServerTransaction.reject();
  });
  return this;
};

module.exports = IncomingInviteImpl;
