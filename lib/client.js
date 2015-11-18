'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var IncomingInvite = require('./incominginvite');
var Log = require('./util/log');
var OutgoingInvite = require('./outgoinginvite');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var StatsReporter = require('./statsreporter');
var util = require('./util');

/**
 * Constructs a new {@link Client} with an AccessManager.
 * @class
 * @classdesc Construct a {@link Client} using an AccessManager to create and
 *   participate in {@link Conversation}s.
 *   <br><br>
 *   AccessManager is provided by twilio-common.js, which must be included
 *   alongside twilio-conversations.js.
 * @param {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @param {Client#ClientOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {string} identity - The {@link Client}'s identity
 * @property {Set<Conversation>} conversations - The {@link Conversation}s this
 *   {@link Client} is active in
 * @property {bool} isListening - Whether the {@link Client} is listening for
 *   {@link IncomingInvite}s to {@link Conversation}s
 * @property {Set<IncomingInvite>} incomingInvites - The active {@link IncomingInvite}s this
 *   {@link Client} has received
 * @fires Client#invite
 * @fires Client#error
 * @fires Client#tokenExpired
 */
function Client(accessManager, options) {
  if (!(this instanceof Client)) {
    return new Client(accessManager, options);
  }

  var self = this;
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    eventGateway: constants.EVENT_GATEWAY,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    useConversationEvents: true,
    userAgent: SIPJSUserAgent
  });

  var logLevel = options.logLevel;

  if (options.debug === true) {
    logLevel = 'debug';
    console.warn('Warning: ClientOptions.debug is deprecated and will be removed in a future release. Please see ClientOptions.logLevel.');
  }

  var log = new Log('Client', logLevel);

  var canceledConversations = new Set();
  var conversations = new Set();
  var eventGateway = options.eventGateway;
  var incomingInvites = new Set();
  var isListening = false;
  var outgoingInvites = new Map();
  var rejectedInvites = new Set();

  var UserAgent = options.userAgent;
  var userAgent = new UserAgent(accessManager, options);
  userAgent.on('invite', function(inviteServerTransaction) {
    var conversationSid = inviteServerTransaction.conversationSid;
    var participantSid = inviteServerTransaction.participantSid;
    var cookie = inviteServerTransaction.cookie;

    // If this is a multi-invite reply, accept immediately.
    var outgoingInvite = self._outgoingInvites.get(cookie);
    if (outgoingInvite) {
      return inviteServerTransaction
        .accept({ localMedia: outgoingInvite._conversation.localMedia })
        .then(outgoingInvite._onReceiveInvite)
        .catch(function(reason) {
          var error = E.CONVERSATION_INVITE_FAILED.clone(reason.message || reason);
          outgoingInvite._conversation.emit('participantFailed', error);
        });
    }

    // If this is canceled a multi-invite reply, reject immediately.
    if (canceledConversations.has(cookie)) {
      return inviteServerTransaction.reject();
    }

    // If we are already in the Conversation, accept immediately.
    var activeConversation = null;
    conversations.forEach(function(conversation) {
      if (conversation.sid === conversationSid) {
        activeConversation = activeConversation || conversation;
      }
    });

    if (activeConversation) {
      return inviteServerTransaction
        .accept({ localMedia: activeConversation.localMedia })
        .then(activeConversation._addDialog.bind(activeConversation));
    }

    // If we have already received and rejected an IncomingInvite for the conversation, reject.
    if (rejectedInvites.has(conversationSid + participantSid)) {
      return inviteServerTransaction.reject();
    }

    // If we have already received an IncomingInvite for the Conversation, add to existing IncomingInvite.
    var activeInvite = null;
    incomingInvites.forEach(function(invite) {
      if (invite.conversationSid === conversationSid && invite.participantSid === participantSid) {
        activeInvite = activeInvite || invite;
      }
    });

    if (activeInvite) {
      return activeInvite._inviteServerTransactions.push(inviteServerTransaction);
    }

    // NOTE(mroberts): Only raise an IncomingInvite if we are listening for IncomingInvite.
    if (!self.isListening) {
      return inviteServerTransaction.reject();
    }

    // Otherwise, raise the IncomingInvite.
    var invite = new IncomingInvite(inviteServerTransaction, self._options);
    incomingInvites.add(invite);
    invite._promise.then(function(conversation) {
      incomingInvites.delete(invite);
      conversations.add(conversation);
      conversation.once('ended', function() {
        conversations.delete(conversation);
        self._unregisterIfNotNeeded();
      });
    }, function() {
      incomingInvites.delete(invite);
      self._unregisterIfNotNeeded();
      rejectedInvites.add(conversationSid + participantSid);
      setTimeout(function() {
        rejectedInvites.delete(conversationSid + participantSid);
      }, constants.DEFAULT_CALL_TIMEOUT * 3);
    });
    self.emit('invite', invite);
  });

  userAgent.on('dialogCreated', function(dialog) {
    new StatsReporter(eventGateway, dialog, logLevel);
  });

  userAgent.on('keepAliveTimeout', function() {
    self.emit('error', E.GATEWAY_DISCONNECTED);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _canceledConversations: {
      value: canceledConversations
    },
    _isListening: {
      set: function(_isListening) {
        isListening = _isListening;
      }
    },
    _isRegistered: {
      enumerable: true,
      get: function() {
        return this._userAgent.isRegistered;
      }
    },
    _log: {
      value: log
    },
    _logLevel: {
      value: logLevel
    },
    _outgoingInvites: {
      value: outgoingInvites
    },
    _needsRegistration: {
      get: function() {
        return isListening
          || outgoingInvites.size
          || conversations.size
          || incomingInvites.size
          || userAgent.inviteClientTransactions.size;
      }
    },
    _options: {
      value: options
    },
    _userAgent: {
      value: userAgent
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    conversations: {
      enumerable: true,
      value: conversations
    },
    identity: {
      enumerable: true,
      get: function() {
        return accessManager.identity;
      }
    },
    incomingInvites: {
      enumerable: true,
      value: incomingInvites
    },
    isListening: {
      enumerable: true,
      get: function() {
        return isListening;
      }
    }
  });

  accessManager.on('tokenExpired', this.emit.bind(this, 'tokenExpired', accessManager));
  accessManager.on('tokenUpdated', this._register.bind(this, true));

  return this;
}

inherits(Client, EventEmitter);

/**
 * Causes this {@link Client} to stop listening for {@link IncomingInvite}s to
 *   {@link Conversation}s until {@link Client#listen} is called again.
 * @returns {Promise<Client>}
 */
Client.prototype.unlisten = function unlisten() {
  this._isListening = false;
  return this._unregisterIfNotNeeded();
};

Client.prototype._unregister = function _unregister() {
  if (!this._isRegistered) {
    return Promise.resolve(this);
  }
  var self = this;
  return this._userAgent.unregister().then(function() {
    self._isListening = false;
    return self;
  });
};

/**
 * Causes this {@link Client} to start listening for {@link IncomingInvite}s to
 *   {@link Conversation}s.
 * @returns {Promise<Client>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var alice = new Twilio.Conversations.Client(manager);
 *
 * alice.listen().then(function() {
 *   console.log('Alice is listening');
 * }, function(error) {
 *   console.error(error);
 * });
 */
Client.prototype.listen = function listen() {
  var self = this;
  return this._register().then(function() {
    self._isListening = true;
    return self;
  });
};

Client.prototype._register = function _register(reregister) {
  var self = this;
  if (!reregister && this._isRegistered) {
    return Promise.resolve(this);
  }
  return this._userAgent.register().then(function onRegistered() {
    return self;
  }, function onRegisterFailed(response) {
    var gatewayMessage = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw');
    var sipMessage = response.cause;

    if (sipMessage) {
      self._log.throw(E.LISTEN_FAILED, 'Received SIP error: ' + sipMessage);
    } else if (gatewayMessage) {
      self._log.throw(E.LISTEN_FAILED, 'Gateway responded with: ' + gatewayMessage);
    } else {
      self._log.throw(E.LISTEN_FAILED, response.message || response);
    }
  });
};

/**
 * Invite remote {@link Client}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup an {@link AudioTrack} and
 *   {@link VideoTrack} between local and remote {@link Client}s. You can
 *   override this by specifying <code>options</code>.
 * @param {Array<string>|string} participants - Participant(s) to invite to the {@link Conversation}
 * @param {Client#CreateConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Client#createConversation}'s default behavior
 * @returns {OutgoingInvite}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.createConversation(['bob', 'charlie']).then(function(conversation) {
 *   conversation.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 */
Client.prototype.createConversation = function createConversation(participants, options) {
  options = util.withDefaults({ }, options, this._options);

  if (!participants) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  participants = participants.forEach ? participants : [participants];

  util.validateAddresses(this.accessManager._tokenPayload.sub, participants);

  var outgoingInvite = new OutgoingInvite(this._userAgent, participants, options);

  this._outgoingInvites.set(outgoingInvite._cookie, outgoingInvite);

  var self = this;

  setTimeout(function() {
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._canceledConversations.delete(outgoingInvite._cookie);
    self._unregisterIfNotNeeded();
  }, constants.DEFAULT_CALL_TIMEOUT * 3);

  outgoingInvite.once('accepted', function() {
    self._outgoingInvites.delete(outgoingInvite._cookie);
    var conversation = outgoingInvite._conversation;
    self.conversations.add(conversation);
    conversation.once('ended', function() {
      self.conversations.delete(conversation);
      self._unregisterIfNotNeeded();
    });
  });

  function outgoingInviteFailed() {
    self._canceledConversations.add(outgoingInvite._cookie);
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._unregisterIfNotNeeded();
  }

  outgoingInvite.once('canceled', outgoingInviteFailed);
  outgoingInvite.catch(outgoingInviteFailed);

  return outgoingInvite;
};

Client.prototype._unregisterIfNotNeeded = function _unregisterIfNotNeeded() {
  return this._needsRegistration ? Promise.resolve(this) : this._unregister();
};

Object.freeze(Client.prototype);

/**
 * Your {@link Client} has run into an error.
 * @param {Error} error - The Error
 * @event Client#error
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('error', function(error) {
 *  console.error(error);
 * });
 */

/**
 * Your {@link Client} has received an {@link IncomingInvite} to participant in a
 * {@link Conversation}.
 * @param {IncomingInvite} invite - the {@link IncomingInvite}
 * @event Client#invite
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received an IncomingInvite to join a Conversation from ' + invite.from);
 * });
 */

/**
 * Your {@link Client}'s AccessManager's Access Token has expired. You should
 * update the Access Token on the AccessManager.
 * @param {AccessManager} accessManager
 * @event Client#tokenExpired
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('tokenExpired', function() {
 *   var newToken = getAccessToken();
 *   manager.updateToken(newToken);
 * });
 */

/**
 * You may pass these options to {@link Client}'s constructor to override
 * its default behavior.
 * @typedef {object} Client#ClientOptions
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 */

/**
 * You may pass these options to {@link Client#createConversation} to
 * override the default behavior.
 * @typedef {object} Client#CreateConversationOptions
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = Client;
