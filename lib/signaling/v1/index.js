'use strict';

var constants = require('../../util/constants');
var E = constants.twilioErrors;
var IncomingInviteV1 = require('./incominginvite');
var inherits = require('util').inherits;
var Log = require('../../util/log');
var OutgoingInviteV1 = require('./outgoinginvite');
var Signaling = require('../');
var SIPJSUserAgent = require('./sipjsuseragent');
var StatsReporter = require('../../statsreporter');

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

  options = Object.assign({
    eventGateway: constants.EVENT_GATEWAY,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    userAgent: SIPJSUserAgent
  }, options);

  var eventGateway = options.eventGateway;
  var log = new Log('[Signaling/v1]', options.logLevel);

  Signaling.call(this);

  var outgoingInvites = new Map();
  var canceledOutgoingInvites = new Map();
  var conversations = new Map();
  var incomingInvites = new Map();
  var rejectedIncomingInvites = new Map();

  var UserAgent = options.userAgent;
  var userAgent = new UserAgent(accessManager, options);

  Object.defineProperties(this, {
    _accessManager: {
      value: accessManager
    },
    _canceledOutgoingInvites: {
      value: canceledOutgoingInvites
    },
    _conversations: {
      value: conversations
    },
    _dialogs: {
      value: userAgent.dialogs
    },
    _eventGateway: {
      value: eventGateway
    },
    _incomingInvites: {
      value: incomingInvites
    },
    _log: {
      value: log
    },
    _outgoingInvites: {
      value: outgoingInvites
    },
    _rejectedIncomingInvites: {
      value: rejectedIncomingInvites
    },
    _userAgent: {
      value: userAgent
    }
  });

  handleAccessManagerEvents(this, accessManager);
  handleSignalingEvents(this);
  handleUserAgentEvents(this);
}

inherits(SignalingV1, Signaling);

SignalingV1.prototype._close = function _close(key) {
  var self = this;
  this.transition('closing', key);
  return this._userAgent.disconnect().then(function disconnectSucceeded() {
    self.transition('closed', key);
  }, function disconnectFailed(error) {
    self.tryTransition('open', key);
    throw error;
  });
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
  var self = this;
  this.transition('attemptingToListen', key);
  return this._userAgent.register().then(function registerSucceeded() {
    self.transition('listening', key);
  }, function registerFailed(error) {
    self.tryTransition('open', key);
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

  this._log.info('Creating new IncomingInvite');

  var incomingInvite = new IncomingInviteV1(inviteServerTransaction, this._options);
  var key = inviteServerTransaction.key;
  this._incomingInvites.set(key, incomingInvite);

  var self = this;

  // If accepted, the Client has joined the Conversation and will pass any
  // InviteServerTransactions with matching Conversation SID to the
  // Conversation in order to be accepted or rejected.
  incomingInvite.once('accepted', function incomingInviteAccepted() {
    self._incomingInvites.delete(key);

    var conversation = incomingInvite._conversation;
    self._conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self._conversations.delete(conversation.sid);
      self._unregisterIfNoLongerRequired();
    });
  });

  incomingInvite.once('canceled', function incomingInviteCanceled() {
    self._incomingInvites.delete(key);
    self._unregisterIfNoLongerRequired();
  });

  // If rejected, the Client remembers the IncomingInvite until all the
  // InviteServerTransactions with matching Conversation SID and Participant
  // SID would have been received and passes them to the IncomingInvite in
  // order to be rejected.
  incomingInvite.once('rejected', function incomingInviteRejected() {
    self._incomingInvites.delete(key);
    self._rejectedIncomingInvites.set(key, incomingInvite);

    setTimeout(function deleteRejectedIncomingInvite() {
      self._rejectedIncomingInvites.delete(key);
    }, 3 * constants.DEFAULT_CALL_TIMEOUT);

    self._unregisterIfNoLongerRequired();
  });

  this.emit('invite', incomingInvite);
};

SignalingV1.prototype._open = function _open(key) {
  var self = this;
  this.transition('opening', key);
  return this._userAgent.connect().then(function connectSucceeded() {
    self.transition('open', key);
  }, function connectFailed(error) {
    self.tryTransition('closed', key);
    throw error;
  });
};

SignalingV1.prototype._unlisten = function _unlisten(key) {
  var self = this;
  this.transition('attemptingToUnlisten', key);
  return this._unregisterIfNoLongerRequired().then(
    function unregisterIfNoLongerRequiredSucceeded() {
    self.transition('open', key);
  }, function unregisterIfNoLongerRequiredFailed(error) {
    self.tryTransition('listening', key);
    throw error;
  });
};

SignalingV1.prototype._unregisterIfNoLongerRequired =
  function _unregisterIfNoLongerRequired() {
  if (this.state === 'listening' ||
      this._outgoingInvites.size ||
      this._incomingInvites.size ||
      this._conversations.size) {
    return Promise.resolve();
  }
  return this._userAgent.unregister();
};

SignalingV1.prototype._connect = function _connect(identities, labelOrSid, localMedia, options) {
  void labelOrSid;
  var self = this;

  if (!identities || identities instanceof Array && !identities.length) {
    return Promise.reject(
      new Error('Must specify one or more Participant identities'));
  }

  identities = identities instanceof Array ? identities : [identities];

  this._log.info('Connecting to a Conversation and inviting Participants: ' +
    identities.join(', '));

  // Save a reference to the OutgoingInvite; SignalingV1 will pass any
  // InviteServerTransactions with matching cookie to the OutgoingInvite in
  // order to be accepted or rejected.
  var outgoingInvite = new OutgoingInviteV1(this._userAgent, identities, localMedia, options);
  this._outgoingInvites.set(outgoingInvite._cookie, outgoingInvite);
  self._log.info('Created OutgoingInvite with cookie ' +
    outgoingInvite._cookie);

  outgoingInvite.once('accepted', function outgoingInviteAccepted() {
    self._log.info('OutgoingInvite with cookie ' + outgoingInvite._cookie +
      ' was accepted');
    self._outgoingInvites.delete(outgoingInvite._cookie);

    var conversation = outgoingInvite._conversation;
    self._conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self._conversations.delete(conversation.sid);
      self._unregisterIfNoLongerRequired();
    });
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

  return Promise.resolve(outgoingInvite);
};

function handleAccessManagerEvents(signaling, accessManager) {
  accessManager.on('tokenUpdated', function onTokenUpdated() {
    if (signaling._userAgent.isRegistered) {
      signaling._userAgent.register();
    }
  });
}

function handleDialogEvents(signaling, dialog) {
  var conversationSid = dialog.conversationSid;
  var conversation = signaling._conversations.get(conversationSid);
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

    var conversation = signaling._conversations.get(conversationSid);
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
      return outgoingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var key = inviteServerTransaction.key;
    var incomingInvite = signaling._incomingInvites.get(key) ||
      signaling._rejectedIncomingInvites.get(key);
    if (incomingInvite) {
      return incomingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var conversation = signaling._conversations.get(
      inviteServerTransaction.conversationSid);
    if (conversation) {
      return conversation._onInviteServerTransaction(inviteServerTransaction);
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
