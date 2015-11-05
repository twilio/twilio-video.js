'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var constants = require('./util/constants');
var Conversation = require('./conversation');
var CancelablePromise = require('./util/cancelablepromise');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var Invite = require('./invite');
var Log = require('./util/log');
var Q = require('q');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var StatsReporter = require('./statsreporter');
var util = require('./util');

var LocalMedia = require('./media/localmedia');

/**
 * Constructs a new {@link Client} with an AccessManager.
 * @class
 * @classdesc A {@link Client} is identified by an identity and
 *   can create or join {@link Conversation}s.
 * @param {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @param {Client#ClientOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {string} identity - The {@link Client}'s identity
 * @property {Set<Conversation>} conversations - The {@link Conversation}s this
 *   {@link Client} is active in
 * @property {bool} isListening - Whether the {@link Client} is listening for
 *   {@link Invite}s to {@link Conversation}s
 * @property {Set<Invite>} invites - The active {@link Invite}s this
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
    'eventGateway': constants.EVENT_GATEWAY,
    'logLevel': constants.DEFAULT_LOG_LEVEL,
    'useConversationEvents': true,
    'userAgent': SIPJSUserAgent
  });

  var logLevel = options.logLevel;

  if(options.debug === true) {
    logLevel = 'debug';
    console.warn('Warning: ClientOptions.debug is deprecated and will be removed in a future release. Please see ClientOptions.logLevel.');
  }

  var log = new Log('Client', logLevel);

  var fetchIceServers = null;
  if (options.iceServers) {
    if (!util.isValidIceServerArray(options.iceServers)) {
      log.throw(E.INVALID_ARGUMENT, 'Invalid ICE Servers');
    }
    fetchIceServers = new Q(options.iceServers);
  }
  fetchIceServers = (fetchIceServers || util.fetchIceServers(accessManager._tokenPayload.sub, accessManager.token, { log: log }))
    .then(function(iceServers) {
      var servers = util.separateIceServers(iceServers);
      self._userAgent._stunServers = servers.stunServers;
      self._userAgent._turnServers = servers.turnServers;
    });

  var canceledConversations = new Set();
  var conversations = new Set();
  var eventGateway = options['eventGateway'];
  var invites = new Set();
  var isListening = false;
  var pendingConversations = new Map();
  var rejectedInvites = new Set();

  var userAgent = new options['userAgent'](accessManager, options);
  userAgent.on('invite', function(inviteServerTransaction) {
    var conversationSid = inviteServerTransaction.conversationSid;
    var participantSid = inviteServerTransaction.participantSid;
    var cookie = inviteServerTransaction.cookie;

    // If this is a multi-invite reply, accept immediately.
    var pendingConversation = self._pendingConversations.get(cookie);
    if (pendingConversation) {
      return inviteServerTransaction
        .accept({ localMedia: pendingConversation.conversation.localMedia })
        .then(pendingConversation.onReceiveInvite)
        .catch(function(reason) {
          var error = E.CONVERSATION_INVITE_FAILED.clone(reason.message || reason);
          pendingConversation.conversation.emit('participantFailed', error);
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

    // If we have already received and rejected an Invite for the conversation, reject.
    if (rejectedInvites.has(conversationSid + participantSid)) {
      return inviteServerTransaction.reject();
    }

    // If we have already received an Invite for the Conversation, add to existing Invite.
    var activeInvite = null;
    invites.forEach(function(invite) {
      if(invite.conversationSid === conversationSid && invite.participantSid === participantSid) {
        activeInvite = activeInvite || invite;
      }
    });

    if (activeInvite) {
      return activeInvite._inviteServerTransactions.push(inviteServerTransaction);
    }

    // NOTE(mroberts): Only raise an Invite if we are listening for Invites.
    if (!self.isListening) {
      return inviteServerTransaction.reject();
    }

    // Otherwise, raise the Invite.
    var invite = new Invite(inviteServerTransaction, self._options);
    invites.add(invite);
    invite._promise.then(function(conversation) {
      invites.delete(invite);
      conversations.add(conversation);
      conversation.once('ended', function() {
        conversations.delete(conversation);
        self._unregisterIfNotNeeded();
      });
    }, function() {
      invites.delete(invite);
      self._unregisterIfNotNeeded();
      rejectedInvites.add(conversationSid + participantSid);
      setTimeout(function() {
        rejectedInvites.delete(conversationSid + participantSid);
      }, constants.DEFAULT_CALL_TIMEOUT * 3);
    });
    self.emit('invite', invite);
  });

  userAgent.on('dialogCreated', function(dialog) {
    var statsReporter = new StatsReporter(eventGateway, dialog, logLevel);
  });

  userAgent.on('keepAliveTimeout', function() {
    self.emit('error', E.GATEWAY_DISCONNECTED);
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    '_canceledConversations': {
      value: canceledConversations
    },
    '_fetchIceServers': {
      value: fetchIceServers
    },
    '_isListening': {
      set: function(_isListening) {
        isListening = _isListening;
      }
    },
    '_isRegistered': {
      enumerable: true,
      get: function() {
        return this._userAgent.isRegistered;
      }
    },
    '_log': {
      value: log
    },
    '_logLevel': {
      value: logLevel
    },
    '_pendingConversations': {
      value: pendingConversations
    },
    '_needsRegistration': {
      get: function() {
        return isListening
          || pendingConversations.size
          || conversations.size
          || invites.size
          || userAgent.inviteClientTransactions.size;
      }
    },
    '_options': {
      value: options
    },
    '_userAgent': {
      value: userAgent
    },
    'accessManager': {
      enumerable: true,
      value: accessManager
    },
    'conversations': {
      enumerable: true,
      value: conversations
    },
    'identity': {
      enumerable: true,
      get: function() {
        return accessManager.identity;
      }
    },
    'invites': {
      enumerable: true,
      value: invites
    },
    'isListening': {
      enumerable: true,
      get: function() {
        return isListening;
      }
    }
  });

  accessManager.on('tokenExpired', this.emit.bind(this, 'tokenExpired', accessManager));

  return this;
}

inherits(Client, EventEmitter);

/**
 * Causes this {@link Client} to stop listening for {@link Invite}s to
 *   {@link Conversation}s until {@link Client#listen} is called again.
 * @returns {Promise<Client>}
 */
Client.prototype.unlisten = function unlisten() {
  this._isListening = false;
  return this._unregisterIfNotNeeded();
};

Client.prototype._unregister = function _unregister() {
  if (!this._isRegistered) {
    return new Q(this);
  }
  var self = this;
  return this._userAgent.unregister().then(function() {
    self._isListening = false;
    return self;
  });
};

/**
 * Causes this {@link Client} to start listening for {@link Invite}s to
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
  return this._register().then(function(self) {
    self._isListening = true;
    return self;
  });
};

Client.prototype._register = function _register() {
  // NOTE(mroberts): We want to ensure that we've fetched ICE servers before we
  // register because, once registered, we may start receiving INVITEs, and, on
  // INVITE, SIP.js construct a PeerConnection with whatever STUN and TURN
  // servers were already set.
  var self = this;
  return this._fetchIceServers.then(function() {
    return self._userAgent.register();
  }).then(function onRegistered() {
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
 *   <br><br>
 *   You can call <code>.cancel()</code> on the returned {@link CancelablePromise}
 *   until the remote {@link Client} has joined.
 * @param {Array<string>|string} participants - Participant(s) to invite to the {@link Conversation}
 * @param {Client#CreateConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Client#createConversation}'s default behavior
 * @returns {CancelablePromise<Conversation>}
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

  var localMedia = options.localMedia;
  var constraints = options.localStreamConstraints;
  var localStream = options.localStream;

  if (localMedia && !(localMedia instanceof LocalMedia)) {
    this._log.throw(E.INVALID_ARGUMENT, 'Invalid local media');
  }

  if (localStream && typeof localStream !== 'object') {
    this._log.throw(E.INVALID_ARGUMENT, 'Invalid local media stream');
  }
  
  if (constraints &&
      typeof constraints.audio === 'undefined' &&
      typeof constraints.video === 'undefined') {
    this._log.throw(E.INVALID_ARGUMENT, 'Invalid local media stream constraints');
  }

  if (!participants) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  participants = participants.forEach ? participants : [participants];

  util.validateAddresses(this.accessManager._tokenPayload.sub, participants);

  var conversation = new Conversation(this._options);
  var deferred = Q.defer();
  var ict = null;
  var isCanceled = false;
  var self = this;
  var userAgent = this._userAgent;

  // If this is a multi-invite, save this new conversation by cookie
  // so we can auto-accept the invites that are sent back in response.
  if(participants.length > 1) {
    var cookie = util.makeUUID();
    options.cookie = cookie;

    this._pendingConversations.set(cookie, {
      conversation: conversation,
      onReceiveInvite: setupConversation
    });

    setTimeout(function() {
      self._pendingConversations.delete(cookie);
      self._canceledConversations.delete(cookie);
      self._unregisterIfNotNeeded();
    }, constants.DEFAULT_CALL_TIMEOUT * 3);
  }

  // Kick off the invite flow
  getLocalMedia().catch(getLocalMediaFailed)
    .then(setLocalMedia)
    .then(this._register.bind(this))
    .then(inviteParticipants).catch(inviteParticipantsFailed)
    .then(setupConversation);

  // Define the specific steps of the invite flow
  function getLocalMedia() {
    return localMedia ? new Q(localMedia) : LocalMedia.getLocalMedia(options);
  }
  function getLocalMediaFailed(error) {
    if(['PermissionDeniedError', 'PERMISSION_DENIED'].indexOf(error.name) > -1) {
      error = E.MEDIA_ACCESS_DENIED;
    }

    deferred.reject(error);
  }

  function setLocalMedia(localMedia) {
    conversation._localMedia = localMedia;
    options.localMedia = localMedia;
  }

  function inviteParticipants() {
    if(isCanceled) { throw new Error('canceled'); }

    ict = userAgent.invite(participants, options);
    return ict;
  }
  function inviteParticipantsFailed(reason) {
    // If the main invite times out but we have Participants
    // this is a successful multi-invite.
    if (reason.message === 'ignored' && conversation.participants.size) {
      return;
    }

    var error;
    switch (reason.message) {
      case 'canceled':
        error = E.CONVERSATION_INVITE_CANCELED;
        break;
      case 'rejected':
        error = E.CONVERSATION_INVITE_REJECTED;
        break;
      case 'ignored':
        error = E.CONVERSATION_INVITE_TIMEOUT;
        break;
      case 'failed':
        /* falls through */
      default:
        error = E.CONVERSATION_CREATE_FAILED;
        break;
    }

    deferred.reject(error);
  }

  function setupConversation(dialog) {
    conversation._addDialog(dialog);
    conversation.once('ended', function() {
      self.conversations.delete(conversation);
      self._unregisterIfNotNeeded();
    });

    self.conversations.add(conversation);

    var promise = deferred.promise;
    if (!promise.isFulfilled() && !promise.isRejected()) {
      deferred.resolve(conversation);
    }
  }

  // Set up an error handler and make the returned promise cancelable
  var cancelablePromise = new CancelablePromise(deferred.promise);
  cancelablePromise.catch(function(error) {
    if(error.message === 'canceled') {
      self._canceledConversations.add(cookie);
      self._pendingConversations.delete(cookie);

      if (ict) { ict.cancel(); }
      else { isCanceled = true; }

      self._unregisterIfNotNeeded();
    }

    self._log.throw(error);
  });

  return cancelablePromise;
};

Client.prototype._unregisterIfNotNeeded = function _unregisterIfNotNeeded() {
  return this._needsRegistration ? new Q(this) : this._unregister();
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
 * Your {@link Client} has received an {@link Invite} to participant in a
 * {@link Conversation}.
 * @param {Invite} invite - the {@link Invite}
 * @event Client#invite
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received an Invite to join a Conversation from ' + invite.from);
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
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 */

/**
 * You may pass these options to {@link Client#createConversation} to
 * override the default behavior.
 * @typedef {object} Client#CreateConversationOptions
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = Client;
