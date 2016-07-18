'use strict';

var C = require('../../util/constants');
var ConversationV1 = require('./conversation');
var IncomingInviteSignaling = require('../incominginvite');
var inherits = require('util').inherits;
var util = require('../../util');

function IncomingInviteV1(inviteServerTransaction, options) {
  if (!(this instanceof IncomingInviteV1)) {
    return new IncomingInviteV1(inviteServerTransaction, options);
  }

  options = Object.assign({
    logLevel: C.DEFAULT_LOG_LEVEL
  }, options);

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

  IncomingInviteSignaling.call(this, conversationSid, from, participantSid, options);

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

  inviteServerTransaction.once('failed', function() {
    self.preempt('failed');
  });

  inviteServerTransaction.once('canceled', function() {
    self.preempt('canceled');
  });

  this.on('stateChanged', this.emit.bind(this));
}

inherits(IncomingInviteV1, IncomingInviteSignaling);

IncomingInviteV1.prototype._onAcceptFailure = function _onAcceptFailure(reason) {
  this._pending--;

  if (this.state === 'accepting' && !this._pending) {
    this._deferred.reject(reason);
  }

  return this;
};

IncomingInviteV1.prototype._onDialog = function _onDialog(dialog) {
  this._pending--;

  var conversation
    = this._conversation
    = this._conversation || new ConversationV1(this._localMedia, this.participantSid, this.conversationSid, this._options);

  conversation._onDialog(dialog);

  if (this.state === 'accepting') {
    this._deferred.resolve(conversation);
  }

  return conversation;
};

IncomingInviteV1.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
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

IncomingInviteV1.prototype._accept = function accept(localMedia, options) {
  Object.assign(this._options, options);
  this._localMedia = this._options.localMedia = localMedia;
  this._inviteServerTransactions.forEach(this._onInviteServerTransaction, this);
  return this._promise;
};

IncomingInviteV1.prototype._reject = function reject() {
  this._inviteServerTransactions.forEach(function(inviteServerTransaction) {
    inviteServerTransaction.reject();
  });
  return this;
};

module.exports = IncomingInviteV1;
