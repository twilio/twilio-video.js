'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
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
 * Constructs a new {@link Client} with an AccessManager. Alternatively, you
 * can pass an Access Token string and the {@link Client} will construct an
 * AccessManager for you. AccessManager is provided by twilio-common.js, which
 * must be included alongside twilio-conversations.js.
 * @class
 * @classdesc Construct a {@link Client} to start creating and participating
 *   in {@link Conversation}s with other {@link Participant}s.
 * @param {AccessManager|string} managerOrToken - The {@link Client}'s AccessManager or an Access Token string to use when constructing an AccessManager
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {string} identity - The {@link Client}'s identity
 * @property {Map<Conversation.SID, Conversation>} conversations - The {@link Conversation}s this
 *   {@link Client} is participating in
 * @property {bool} isListening - Whether the {@link Client} is listening for
 *   {@link IncomingInvite}s to {@link Conversation}s
 * @fires Client#invite
 * @fires Client#error
 */
function Client(accessManager, options) {
  if (!(this instanceof Client)) {
    return new Client(accessManager, options);
  }

  if (typeof accessManager === 'string') {
    accessManager = new AccessManager(accessManager);
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
  var log = new Log('Client', logLevel);

  var conversations = new Map();
  var eventGateway = options.eventGateway;
  var incomingInvites = new Map();
  var rejectedIncomingInvites = new Map();
  var isListening = false;
  var outgoingInvites = new Map();
  var canceledOutgoingInvites = new Map();

  var UserAgent = options.userAgent;
  var userAgent = new UserAgent(accessManager, options);

  userAgent.on('invite', function onInviteServerTransaction(inviteServerTransaction) {
    var cookie = inviteServerTransaction.cookie;
    var outgoingInvite = outgoingInvites.get(cookie) || canceledOutgoingInvites.get(cookie);
    if (outgoingInvite) {
      return outgoingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var key = inviteServerTransaction.key;
    var incomingInvite = incomingInvites.get(key) || rejectedIncomingInvites.get(key);
    if (incomingInvite) {
      return incomingInvite._onInviteServerTransaction(inviteServerTransaction);
    }

    var conversation = conversations.get(inviteServerTransaction.conversationSid);
    if (conversation) {
      return conversation._onInviteServerTransaction(inviteServerTransaction);
    }

    self._onInviteServerTransaction(inviteServerTransaction);
  });

  userAgent.on('dialogCreated', function(dialog) {
    new StatsReporter(eventGateway, dialog, logLevel);
  });

  userAgent.on('keepAliveTimeout', function() {
    self.emit('error', E.GATEWAY_DISCONNECTED);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _canceledOutgoingInvites: {
      value: canceledOutgoingInvites
    },
    _incomingInvites: {
      value: incomingInvites
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
    _needsRegistration: {
      get: function() {
        return isListening
          || outgoingInvites.size
          || incomingInvites.size
          || conversations.size;
      }
    },
    _options: {
      value: options
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
    isListening: {
      enumerable: true,
      get: function() {
        return isListening;
      }
    }
  });

  accessManager.on('tokenUpdated', this._register.bind(this, true));

  return this;
}

inherits(Client, EventEmitter);

Client.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  // If not listening, do nothing. Do not even reject, as that would cause
  // other listening Clients to be unable to accept the
  // InviteServerTransaction.
  if (!this.isListening) {
    return;
  }

  var incomingInvite = new IncomingInvite(inviteServerTransaction, this._options);
  var key = inviteServerTransaction.key;
  this._incomingInvites.set(key, incomingInvite);

  var self = this;

  // If accepted, the Client has joined the Conversation and will pass any
  // InviteServerTransactions with matching Conversation SID to the
  // Conversation in order to be accepted or rejected.
  incomingInvite.once('accepted', function incomingInviteAccepted() {
    self._incomingInvites.delete(key);

    var conversation = incomingInvite._conversation;
    self.conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self.conversations.delete(conversation.sid);
      self._unregisterIfNotNeeded();
    });
  });

  incomingInvite.once('canceled', function incomingInviteCanceled() {
    self._incomingInvites.delete(key);
    self._unregisterIfNotNeeded();
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

    self._unregisterIfNotNeeded();
  });

  this.emit('invite', incomingInvite);
};

/**
 * Causes this {@link Client} to stop listening for {@link IncomingInvite}s to
 *   {@link Conversation}s until {@link Client#listen} is called again.
 * @returns {this}
 */
Client.prototype.unlisten = function unlisten() {
  this._isListening = false;
  this._unregisterIfNotNeeded();
  return this;
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
 * @returns {Promise<this>}
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
 * @param {Array<string>|string} participants - {@link Participant} identities to invite to the {@link Conversation}
 * @param {Client.InviteToConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Client#inviteToConversation}'s default behavior
 * @returns {OutgoingInvite}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.inviteToConversation(['bob', 'charlie']).then(function(conversation) {
 *   conversation.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 */
Client.prototype.inviteToConversation = function inviteToConversation(participants, options) {
  options = util.withDefaults({ }, options, this._options);

  if (!participants) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  participants = participants.forEach ? participants : [participants];
  util.validateAddresses(this.accessManager._tokenPayload.sub, participants);

  // Save a reference to the OutgoingInvite; the Client will pass any
  // InviteServerTransactions with matching cookie to the OutgoingInvite
  // in order to be accepted or rejected.
  var outgoingInvite = new OutgoingInvite(this._userAgent, participants, options);
  var cookie = outgoingInvite._cookie;
  this._outgoingInvites.set(cookie, outgoingInvite);

  var self = this;

  // If accepted, the Client has joined the Conversation and will pass any
  // InviteServerTransactions with matching Conversation SID to the
  // Conversation in order to be accepted or rejected.
  outgoingInvite.once('accepted', function() {
    self._outgoingInvites.delete(cookie);

    var conversation = outgoingInvite._conversation;
    self.conversations.set(conversation.sid, conversation);

    conversation.once('disconnected', function() {
      self.conversations.delete(conversation.sid);
      self._unregisterIfNotNeeded();
    });
  });

  // If canceled, the Client remembers the OutgoingInvite until all the
  // InviteServerTransactions with matching cookies would have been received
  // and passes them to the OutgoingInvite in order to be rejected.
  outgoingInvite.once('canceled', function outgoingInviteCanceled() {
    self._outgoingInvites.delete(cookie);
    self._canceledOutgoingInvites.set(cookie, outgoingInvite);

    setTimeout(function deleteCanceledOutgoingInvite() {
      self._canceledOutgoingInvites.delete(cookie);
    }, constants.DEFAULT_CALL_TIMEOUT * 3);

    self._unregisterIfNotNeeded();
  });

  outgoingInvite.once('rejected', function() {
    self._outgoingInvites.delete(outgoingInvite._cookie);
    self._unregisterIfNotNeeded();
  });

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
 * You may pass these options to {@link Client}'s constructor to override
 * its default behavior.
 * @typedef {object} Client.ConstructorOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Conversation}s
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 */

/**
 * You may pass these options to {@link Client#inviteToConversation} to
 * override the default behavior.
 * @typedef {object} Client.InviteToConversationOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Conversation}s
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = Client;
