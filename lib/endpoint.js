'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Conversation = require('./conversation');
var CancelablePromise = require('./util/cancelablepromise');
var E = constants.twilioErrors;
var EventEmitter = require('events').EventEmitter;
var getUserMedia = require('./webrtc/getusermedia');
var Invite = require('./invite');
var Log = require('./util/log');
var Q = require('q');
var AccessToken = require('./accesstoken');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var StatsReporter = require('./statsreporter');
var util = require('./util');

var Media = require('./media');
var LocalMedia = Media.LocalMedia;

/**
 * Constructs a new {@link Twilio.Endpoint} with a {@link Twilio.AccessToken}.
 * @memberof Twilio
 * @class
 * @classdesc A {@link Twilio.Endpoint} is identified by an address and
 *   can create or join {@link Conversation}s.
 * @param {string} token - The {@link Twilio.Endpoint}'s token
 * @param {Twilio.Endpoint#EndpointOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {string} address - The {@link Twilio.Endpoint}'s address (defined by its
 *   token)
 * @property {Set<Conversation>} conversations - The {@link Conversation}s this
 *   {@link Twilio.Endpoint} is active in
 * @property {bool} isListening - Whether the {@link Twilio.Endpoint} is listening for
 *   {@link Invite}s to {@link Conversation}s
 * @property {Set<Invite>} invites - The active {@link Invite}s this
 *   {@link Twilio.Endpoint} has received
 * @property {Twilio.AccessToken} token - The {@link Twilio.Endpoint}'s active {@link Twilio.AccessToken}
 * @fires Twilio.Endpoint#invite
 * @fires Twilio.Endpoint#error
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(token, options);
  }

  var self = this;
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    'eventGateway': constants.EVENT_GATEWAY,
    'logLevel': constants.DEFAULT_LOG_LEVEL,
    'userAgent': SIPJSUserAgent,
  });

  var logLevel = options.logLevel;

  if(options.debug === true) {
    logLevel = 'debug';
    console.warn('Warning: EndpointOptions.debug is deprecated and will be removed in a future release. Please see EndpointOptions.logLevel.');
  }

  var log = new Log('Endpoint', logLevel);
  token = this._createToken(token, log);

  var fetchIceServers = null;
  if (options.iceServers) {
    if (!util.isValidIceServerArray(options.iceServers)) {
      log.throw(E.INVALID_ARGUMENT, 'Invalid ICE Servers');
    }
    fetchIceServers = new Q(options.iceServers);
  }
  fetchIceServers = (fetchIceServers || util.fetchIceServers(token, { log: log }))
    .then(function(iceServers) {
      var servers = util.separateIceServers(iceServers);
      self._userAgent._stunServers = servers.stunServers;
      self._userAgent._turnServers = servers.turnServers;
    });

  var address = token.address;
  var accountSid = token.accountSid;
  var canceledConversations = new Set();
  var conversations = new Set();
  var eventGateway = options['eventGateway'];
  var invites = new Set();
  var isListening = false;
  var pendingConversations = new Map();
  var rejectedInvites = new Set();

  var userAgent = new options['userAgent'](token, options);
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
    var invite = new Invite(self, inviteServerTransaction);
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
    'address': {
      enumerable: true,
      get: function() {
        return this._userAgent.token.address;
      }
    },
    'conversations': {
      enumerable: true,
      value: conversations
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
    },
    'token': {
      enumerable: true,
      get: function() {
        return this._userAgent.token;
      }
    }
  });

  return Object.freeze(this);
}

inherits(Endpoint, EventEmitter);

/**
 * Causes this {@link Twilio.Endpoint} to stop listening for {@link Invite}s to
 *   {@link Conversation}s until {@link Twilio.Endpoint#listen} is called again.
 * @instance
 * @returns {Promise<Twilio.Endpoint>}
 */
Endpoint.prototype.unlisten = function unlisten() {
  this._isListening = false;
  return this._unregisterIfNotNeeded();
};

Endpoint.prototype._unregister = function _unregister() {
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
 * Causes this {@link Twilio.Endpoint} to start listening for {@link Invite}s to
 *   {@link Conversation}s.
 * @instance
 * @param {string} [token] - A new token to listen with
 * @returns {Promise<Twilio.Endpoint>}
 * @example
 * var originalToken = '$TOKEN';
 *
 * var alice = new Twilio.Endpoint(originalToken);
 *
 * getNewToken(function(newToken) {
 *   // Continue listening with new token.
 *   alice.listen(newToken);
 * });
 *
 * function getNewToken(callback) {
 *   // Get new token from application server.
 * }
 */
Endpoint.prototype.listen = function listen(token) {
  if(this.isListening && (!token || token === this.token)) {
    var deferred = Q.defer();
    setTimeout(deferred.resolve.bind(deferred, this));
    return deferred.promise;
  }

  return this._register(token).then(function(self) {
    self._isListening = true;
    return self;
  });
};

Endpoint.prototype._register = function _register(token) {
  // NOTE(mroberts): We want to ensure that we've fetched ICE servers before we
  // register because, once registered, we may start receiving INVITEs, and, on
  // INVITE, SIP.js construct a PeerConnection with whatever STUN and TURN
  // servers were already set.
  var self = this;
  return this._fetchIceServers.then(function() {
    token = self._createToken.call(self, token);
    return self._userAgent.register(token);
  }).then(function onRegistered() {
    return self;
  }, function onRegisterFailed(response) {
    var gatewayMessage = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw');
    var sipMessage = response.cause;

    if(sipMessage) {
      self._log.throw(E.LISTEN_FAILED, 'Received SIP error: ' + sipMessage);
    } else {
      self._log.throw(E.LISTEN_FAILED, 'Gateway responded with: ' + gatewayMessage);
    }
  });
};

/**
 * Invite remote {@link Twilio.Endpoint}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup an {@link AudioTrack} and
 *   {@link VideoTrack} between local and remote {@link Twilio.Endpoint}s. You can
 *   override this by specifying <code>options</code>.
 *   <br><br>
 *   You can call <code>.cancel()</code> on the returned {@link CancelablePromise}
 *   until the remote {@link Twilio.Endpoint} has joined.
 * @param {Array<string>|string} addresses - Address(es) to invite to the {@link Conversation}
 * @param {Twilio.Endpoint#CreateConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Twilio.Endpoint#createConversation}'s default behavior
 * @returns {CancelablePromise<Conversation>}
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.createConversation(['bob', 'charlie']).then(function(conversation) {
 *   conversation.on('participantConnected', function(participant) {
 *     console.log(participant.address, 'has connected');
 *   });
 * });
 */
Endpoint.prototype.createConversation = function createConversation(addresses, options) {
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

  if (!addresses) {
    this._log.throw(E.INVALID_ARGUMENT, 'No address was provided');
  }

  addresses = addresses.forEach ? addresses : [addresses];

  var conversation = new Conversation({ logLevel: this._logLevel });
  var deferred = Q.defer();
  var ict = null;
  var isCanceled = false;
  var self = this;
  var userAgent = this._userAgent;

  // If this is a multi-invite, save this new conversation by cookie
  // so we can auto-accept the invites that are sent back in response.
  if(addresses.length > 1) {
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
    .then(inviteAddresses).catch(inviteAddressesFailed)
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

  function inviteAddresses() {
    if(isCanceled) { throw new Error('canceled'); }

    ict = userAgent.invite(addresses, options);
    return ict;
  }
  function inviteAddressesFailed(reason) {
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

/**
 * Sets the active token of this {@link Twilio.Endpoint}
 * @instance
 * @private
 * @returns {Twilio.AccessToken}
 */
Endpoint.prototype._createToken = function _createToken(token, log) {
  if (!token) { return this.token; }
  log = log || this._log;

  try {
    token = new AccessToken(token);
  } catch(e) {
    log.throw(E.INVALID_TOKEN, e.message);
  }

  var self = this;

  // Fire Twilio.Endpoint#tokenExpired if this token
  // is active when it expires
  token.once('expired', function tokenExpired(token) {
    if(token === self.token) {
      self.emit('error', E.TOKEN_EXPIRED);
    }
  });

  return token;
};

Endpoint.prototype._unregisterIfNotNeeded = function _unregisterIfNotNeeded() {
  return this._needsRegistration ? new Q(this) : this._unregister();
};

Object.freeze(Endpoint.prototype);

/**
 * Your {@link Twilio.Endpoint} has run into an error.
 * @param {Error} error - The Error
 * @event Twilio.Endpoint#error
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('error', function(error) {
 *  console.error(error);
 * });
 */

/**
 * Your {@link Twilio.Endpoint} has received an {@link Invite} to participant in a
 * {@link Conversation}.
 * @param {Invite} invite - the {@link Invite}
 * @event Twilio.Endpoint#invite
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('invite', function(invite) {
 *   console.log('Received an Invite to join a Conversation from ' + invite.from);
 * });
 */

/**
 * You may pass these options to {@link Twilio.Endpoint}'s constructor to override
 * its default behavior.
 * @typedef {object} Twilio.Endpoint#EndpointOptions
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 */

/**
 * You may pass these options to {@link Twilio.Endpoint#createConversation} to
 * override the default behavior.
 * @typedef {object} Twilio.Endpoint#CreateConversationOptions
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

module.exports = Endpoint;
