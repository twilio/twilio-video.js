'use strict';

var constants = require('../../util/constants');
var Conversation = require('../../conversation');
var E = constants.twilioErrors;
var inherits = require('util').inherits;
var IncomingInvite = require('../incominginvite');
var Log = require('../../util/log');
var OutgoingInvite = require('./outgoinginvite');
var Signaling = require('../');
var SIPJSUserAgent = require('./sipjsuseragent');
var StatsReporter = require('../../statsreporter');
var util = require('../../util');

/**
 * Construct {@link SignalingV1}.
 * @class
 * @classdesc {@link SignalingV1} implements version 1 of our signaling
 * protocol.
 * @extends {Signaling}
 * @param {AccessManager} accessManager
 * @param {?object} [options={}]
 * @property {Map<Conversation.SID, IncomingInvite>} incomingInvites -
 * pending {@link IncomingInvite}s
 * @property {Set<OutgoingInvite>} outgoingInvite - pending
 * {@link OutgoingInvite}s
 */
function SignalingV1(accessManager, options) {
  if (!(this instanceof SignalingV1)) {
    return new SignalingV1(accessManager, options);
  }

  options = util.withDefaults(options, {
    eventGateway: constants.EVENT_GATEWAY,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    userAgent: SIPJSUserAgent
  });

  var eventGateway = options.eventGateway;
  var log = new Log('[Signaling/v1]', options.logLevel);

  Signaling.call(this, accessManager, { log: log });

  var outgoingInvites = new Map();
  var canceledOutgoingInvites = new Map();
  var inviteServerTransactions = new Set();
  var rejectedIncomingInvites = new Set();

  var UserAgent = options.userAgent;
  var userAgent = new UserAgent(accessManager, options);

  Object.defineProperties(this, {
    _accessManager: {
      value: accessManager
    },
    _canceledOutgoingInvites: {
      value: canceledOutgoingInvites
    },
    _dialogs: {
      value: userAgent.dialogs
    },
    _eventGateway: {
      value: eventGateway
    },
    _inviteServerTransactions: {
      value: inviteServerTransactions
    },
    _outgoingInvites: {
      value: outgoingInvites
    },
    _rejectedIncomingInvites: {
      value: rejectedIncomingInvites
    },
    _userAgent: {
      value: userAgent
    },
    outgoingInvites: {
      enumerable: true,
      get: function() {
        return new Set(outgoingInvites.values());
      }
    }
  });

  handleAccessManagerEvents(this, accessManager);
  handleSignalingEvents(this);
  handleUserAgentEvents(this);
}

inherits(SignalingV1, Signaling);

SignalingV1.prototype._close = function _close(key) {
  var preemptionError = new Error('Signaling/v1 StateMachine was preempted');
  if (!this._stateMachine.hasLock(key)) {
    throw preemptionError;
  }
  var self = this;
  this._stateMachine.transition('closing', key);
  return this._userAgent.disconnect().then(function disconnectSucceeded() {
    if (!self._stateMachine.hasLock(key)) {
      throw preemptionError;
    }
    self._stateMachine.transition('closed', key);
  }, function disconnectFailed(error) {
    if (self._stateMachine.hasLock(key)) {
      self.transition('open', key);
    }
    throw error;
  });
};

SignalingV1.prototype._createConversation = function _createConversation(sid,
  participantSid, localMedia, options) {
  var conversation = new Conversation(sid, participantSid, localMedia, this,
    options);
  var deferred = util.defer();

  options = util.withDefaults({
    localMedia: localMedia
  }, this._options, options);

  var inviteServerTransactions = [];
  this._inviteServerTransactions.forEach(function(inviteServerTransaction) {
    if (inviteServerTransaction.participantSid === participantSid) {
      this._inviteServerTransactions.delete(inviteServerTransaction);
      inviteServerTransactions.push(inviteServerTransaction);
    }
  }, this);

  var n = inviteServerTransactions.length;

  var self = this;
  inviteServerTransactions.forEach(function(inviteServerTransaction) {
    inviteServerTransaction.accept(options).then(function() {
      n--;
      deferred.resolve(conversation);
      self._handleConversation(conversation);
    }, function(error) {
      n--;
      if (!n) {
        deferred.reject(error);
      }
    });
  });

  return deferred.promise;
};

SignalingV1.prototype._disconnect = function _disconnect(conversation) {
  this._dialogs.forEach(function(dialog) {
    if (dialog.conversationSid === conversation.sid) {
      dialog.end();
    }
  });
  this._unregisterIfNoLongerRequired();
};

SignalingV1.prototype._handleConversation = function _handleConversation(
  conversation) {
  this._conversations.set(conversation.sid, conversation);
  this._dialogs.forEach(function(dialog) {
    if (dialog.conversationSid === conversation.sid) {
      handleDialogEvents(this, dialog);
    }
  }, this);
};

SignalingV1.prototype._listen = function _listen(key) {
  var preemptionError = new Error('Signaling/v1 StateMachine was preempted');
  if (!this._stateMachine.hasLock(key)) {
    throw preemptionError;
  }
  var self = this;
  this._stateMachine.transition('attemptingToListen', key);
  return this._userAgent.register().then(function registerSucceeded() {
    if (!self._stateMachine.hasLock(key)) {
      throw preemptionError;
    }
    self._stateMachine.transition('listening', key);
  }, function registerFailed(error) {
    if (self._stateMachine.hasLock(key)) {
      self._stateMachine._transition('open', key);
    }
    throw error;
  });
};

SignalingV1.prototype._onInviteServerTransaction =
  function _onInviteServerTransaction(inviteServerTransaction) {
  // If not listening, do nothing; don't even reject.
  if (this.state !== 'listening') {
    this._log.info('Ignoring InviteServerTransaction');
    return;
  }

  this._inviteServerTransactions.add(inviteServerTransaction);

  this._log.info('Creating new IncomingInvite');

  var conversationSid = inviteServerTransaction.conversationSid;
  var from = util.getUser(inviteServerTransaction.from);
  var participantSid = inviteServerTransaction.participantSid;
  var incomingInvite =
    new IncomingInvite(conversationSid, from, participantSid, this);
  this._handleIncomingInvite(incomingInvite);

  var self = this;

  incomingInvite.once('canceled', function incomingInviteCanceled() {
    self._unregisterIfNoLongerRequired();
  });

  // If rejected, SignalingV1 remembers the IncomingInvite until all the
  // InviteServerTransactions with matching Conversation SID and Participant
  // SID would have been received, and it rejects any such
  // InviteServerTransactions.
  incomingInvite.once('rejected', function incomingInviteRejected() {
    self._rejectedIncomingInvites.add(participantSid);

    setTimeout(function deleteRejectedIncomingInvite() {
      self._rejectedIncomingInvites.delete(participantSid);
    }, constants.DEFAULT_CALL_TIMEOUT * 3);

    self._unregisterIfNoLongerRequired();
  });

  this.emit('invite', incomingInvite);
};

SignalingV1.prototype._open = function _open(key) {
  var preemptionError = new Error('Signaling/v1 StateMachine was preempted');
  if (!this._stateMachine.hasLock(key)) {
    throw preemptionError;
  }
  var self = this;
  this._stateMachine.transition('opening', key);
  return this._userAgent.connect().then(function connectSucceeded() {
    if (!self._stateMachine.hasLock(key)) {
      throw preemptionError;
    }
    self._stateMachine.transition('open', key);
  }, function connectFailed(error) {
    if (self._stateMachine.hasLock(key)) {
      self._stateMachine.transition('closed', key);
    }
    throw error;
  });
};

SignalingV1.prototype._unlisten = function _unlisten(key) {
  var preemptionError = new Error('Signaling/v1 StateMachine was preempted');
  if (!this._stateMachine.hasLock(key)) {
    throw preemptionError;
  }
  var self = this;
  this._stateMachine.transition('attemptingToUnlisten', key);
  return this._unregisterIfNoLongerRequired().then(
    function unregisterIfNoLongerRequiredSucceeded() {
    if (!self._stateMachine.hasLock(key)) {
      throw preemptionError;
    }
    self._stateMachine.transition('open', key);
  }, function unregisterIfNoLongerRequiredFailed(error) {
    if (self._stateMachine.hasLock(key)) {
      self._stateMachine.transition('listening', key);
    }
    throw error;
  });
};

SignalingV1.prototype._unregisterIfNoLongerRequired =
  function _unregisterIfNoLongerRequired() {
  if (this.state === 'listening' ||
      this._outgoingInvites.size ||
      this.incomingInvites.size ||
      this.conversations.size) {
    return Promise.resolve();
  }
  return this._userAgent.unregister();
};

/**
 * Connect to a {@link Conversation} by inviting other {@link Participant}s.
 * {@link SignalingV1} has no notion of connecting to a {@link Conversation}
 * without {@link Participant}s, so one or more {@link Participant} identities
 * must be provided. The <code>conversationSidOrLabel</code> parameter is
 * ignored.
 * @param {Conversation.SID|string} conversationSidOrLabel - ignored
 * @param {object} options
 * @returns {OutgoingInvite}
 */
SignalingV1.prototype.connect = function connect(conversationSidOrLabel,
  options) {
  if (this.state === 'closed' ||
      this.state === 'opening' ||
      this.state === 'closing') {
    throw new Error('Signaling must be open');
  }

  void conversationSidOrLabel;
  var self = this;

  if (!options.with || options.with instanceof Array && !options.with.length) {
    return Promise.reject(
      new Error('Must specify one or more Participant identities'));
  }

  var identities = options.with instanceof Array
    ? options.with : [options.with];

  this._log.info('Connecting to a Conversation and inviting Participants: ' +
    identities.join(', '));

  // Save a reference to the OutgoingInvite; SignalingV1 will pass any
  // InviteServerTransactions with matching cookie to the OutgoingInvite in
  // order to be accepted or rejected.
  var outgoingInvite = new OutgoingInvite(this._userAgent, identities, this,
    options);
  this._outgoingInvites.set(outgoingInvite._cookie, outgoingInvite);
  self._log.info('Created OutgoingInvite with cookie ' +
    outgoingInvite._cookie);

  outgoingInvite.once('accepted', function outgoingInviteAccepted() {
    self._log.info('OutgoingInvite with cookie ' + outgoingInvite._cookie +
      ' was accepted');
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._handleConversation(outgoingInvite._conversation);
  });

  // If canceled, SignalingV1 remembers the OutgoingInvite until all the
  // InviteServerTransactions with matching cookies would have been received
  // and passes them to the OutgoingInvite in order to be rejected.
  outgoingInvite.once('canceled', function outgoingInviteCanceled() {
    self._log.info('OutgoingInvite with cookie ' + outgoingInvite._cookie +
      ' was canceled');
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._canceledOutgoingInvites.set(outgoingInvite._cookie, outgoingInvite);

    setTimeout(function deleteCanceledOutgoingInvite() {
      self._canceledOutgoingInvites.delete(outgoingInvite._cookie);
    }, constants.DEFAULT_CALL_TIMEOUT * 3);

    self._unregisterIfNoLongerRequired();
  });

  outgoingInvite.once('rejected', function outgoingInviteRejected() {
    self._log.info('OutgoingInvite with cookie ' + outgoingInvite._cookie +
      ' was rejected');
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._unregisterIfNoLongerRequired();
  });

  return outgoingInvite;
};

SignalingV1.prototype.invite = function invite(conversation, identity) {
  var dialog;
  var dialogs = Array.from(this._dialogs);
  for (var i = 0; i < dialogs.length; i++) {
    if (dialogs[i].conversationSid === conversation.sid) {
      dialog = dialogs[i];
      break;
    }
  }

  if (!dialog) {
    return Promise.reject(
      new Error('Conversation disconnected'));
  }

  try {
    util.validateAddresses(this._accessManager._tokenPayload.sub, [identity]);
  } catch (error) {
    return Promise.reject(error);
  }

  return dialog.refer(identity);
};

function handleAccessManagerEvents(signaling, accessManager) {
  accessManager.on('tokenUpdated', function onTokenUpdated() {
    // TODO(mroberts): Need to re-register.
    void signaling;
  });
}

function handleDialogEvents(signaling, dialog) {
  var conversationSid = dialog.conversationSid;
  var conversation = signaling.conversations.get(conversationSid);
  if (!conversation) {
    signaling._log.warn('Could not find Conversation ' + conversationSid);
    return;
  }

  // Handle Conversation Info notifications.
  dialog.on('notification', function onNotification(notification) {
    var conversationState = notification.conversation_state;
    var conversationSid = conversationState
      ? conversationState.sid
      : dialog.conversationSid;
    signaling._log.info(
      'Received ' + (conversationState ? 'full' : 'partial') + ' ' +
      'Conversation Info for Conversation ' + conversationSid);

    var conversation = signaling.conversations.get(conversationSid);
    if (!conversation) {
      signaling._log.warn('Could not find Conversation ' + conversationSid);
      return;
    }

    var handleConversationEvent = conversationState
      ? conversation._onFullNotification
      : conversation._onPartialNotification;
    handleConversationEvent.call(conversation, notification);
  });

  dialog.dequeue('notification');

  // Handle Media events.
  function addTrack(track) {
    signaling._log.info('Adding ' + track.kind + ' Track ' + track.id + ' ' +
      'to Conversation');
    conversation._addTrack(track);
  }

  function removeTrack(track) {
    signaling._log.info('Removing ' + track.kind + ' Track ' + track.id + ' ' +
      'from Conversation');
    conversation._removeTrack(track);
  }

  var dialogMedia = dialog.remoteMedia;
  dialogMedia.tracks.forEach(addTrack);
  dialogMedia.on('trackAdded', addTrack);
  dialogMedia.on('trackRemoved', removeTrack);

  dialog.once('ended', function onEnded() {
    dialogMedia.removeListener('trackAdded', addTrack);
    dialogMedia.removeListener('trackRemoved', removeTrack);

    // NOTE(mroberts): Disconnect the Conversation if this was the last Dialog.
    var found = false;
    signaling._dialogs.forEach(function(_dialog) {
      found = found || _dialog.conversationSid === dialog.conversationSid;
    });
    if (!found && signaling.conversations.has(dialog.conversationSid)) {
      signaling.conversations.get(dialog.conversationSid).disconnect();
    }
  });
}

function handleSignalingEvents(signaling) {
  signaling.on('disconnected', function onConversationDisconnected() {
    signaling._unregisterIfNoLongerRequired();
  });
}

function handleUserAgentEvents(signaling) {
  signaling._userAgent.on('invite',
    function onInviteServerTransaction(inviteServerTransaction) {
    signaling._log.info('Received InviteServerTransaction for Conversation ' +
      inviteServerTransaction.conversationSid);

    var cookie = inviteServerTransaction.cookie;
    var outgoingInvite = signaling._outgoingInvites.get(cookie) ||
      signaling._canceledOutgoingInvites.get(cookie);
    if (outgoingInvite) {
      signaling._log.info('Passing InviteServerTransaction to OutgoingInvite');
      outgoingInvite._onInviteServerTransaction(inviteServerTransaction);
      return;
    }

    var participantSid = inviteServerTransaction.participantSid;
    if (signaling._rejectedIncomingInvites.has(participantSid)) {
      inviteServerTransaction.reject();
      return;
    }

    var incomingInvite = signaling.incomingInvites.get(participantSid);
    if (incomingInvite) {
      signaling._log.info('Found pending IncomingInvite');
      signaling._inviteServerTransactions.add(inviteServerTransaction);
      return;
    }

    var conversationSid = inviteServerTransaction.conversationSid;
    var conversation = signaling.conversations.get(conversationSid);
    if (conversation) {
      signaling._log.info('Passing InviteServerTransaction to Conversation');
      var options = util.withDefaults({
        localMedia: conversation.localMedia
      }, conversation._options);
      inviteServerTransaction.accept(options).then(
        function acceptSucceeded(dialog) {
          handleDialogEvents(signaling, dialog);
        }, function acceptFailed(error) {
          signaling._log.warn('Unable to accept InviteServerTransaction for ' +
            'Conversation ' + conversationSid, error);
        });
      return;
    }

    signaling._onInviteServerTransaction(inviteServerTransaction);
  });

  signaling._userAgent.on('dialogCreated', function onDialogCreated(dialog) {
    new StatsReporter(signaling._eventGateway, dialog, signaling._log.logLevel);
  });

  signaling._userAgent.on('keepAliveTimeout', function onKeepAliveTimeout() {
    signaling.emit('error', E.GATEWAY_DISCONNECTED);
  });
}

module.exports = SignalingV1;
