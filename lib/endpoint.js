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
var ScopedAuthenticationToken = require('./scopedauthenticationtoken');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var StatsReporter = require('./statsreporter');
var util = require('./util');

var Media = require('./media');
var LocalMedia = Media.LocalMedia;

/**
 * Constructs a new {@link Endpoint} with a token and calls
 *   {@link Endpoint#listen}.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and
 *   can create or join {@link Conversation}s.
 * @param {string} token - the {@link Endpoint}'s token
 * @param {Endpoint#EndpointOptions} [options] - options to override the
 *   constructor's default behavior
 * @property {string} address - the {@link Endpoint}'s address (defined by its
 *   token)
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this
 *   {@link Endpoint} is active in
 * @property {Set<Invite>} invites - the active {@link Invite}s this
 *   {@link Endpoint} has received
 * @property {bool} listening - whether the {@link Endpoint} is listening for
 *   {@link Invite}s to {@link Conversation}s
 * @fires Endpoint#invite
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(token, options);
  }

  var self = this;
  EventEmitter.call(this);

  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'eventGateway': constants.EVENT_GATEWAY,
    'userAgent': SIPJSUserAgent,
    'logLevel': 'warn'
  });

  var logLevel = options.logLevel;
  var log = new Log('Endpoint', logLevel);
  try {
    token = new ScopedAuthenticationToken(token);
  } catch (error) {
    log.throw(E.INVALID_TOKEN, error.message);
  }

  var fetchIceServers = null;
  if (options.iceServers) {
    if (!util.isValidIceServerArray(options.iceServers)) {
      log.throw(E.INVALID_ARGUMENT, 'Invalid ICE Servers');
    }
    fetchIceServers = new Q(options.iceServers);
  }
  fetchIceServers = (fetchIceServers || util.fetchIceServers(token, log))
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
  var pendingConversations = { };
  var rejectedInvites = new Set();

  var userAgent = new options['userAgent'](token, options);
  userAgent.on('invite', function(inviteServerTransaction) {
    var conversationSid = inviteServerTransaction.conversationSid;
    var participantSid = inviteServerTransaction.participantSid;
    var cookie = inviteServerTransaction.cookie;

    // If this is a multi-invite reply, accept immediately.
    var pendingConversation = self._pendingConversations[cookie];
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

    // Otherwise, raise the Invite.
    var invite = new Invite(self, inviteServerTransaction);
    invites.add(invite);
    invite._promise.then(function(conversation) {
      invites.delete(invite);
      conversations.add(conversation);
      conversation.once('ended', function() {
        conversations.delete(conversation);
      });
    }, function() {
      invites.delete(invite);
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

  Object.defineProperties(this, {
    '_canceledConversations': {
      value: canceledConversations
    },
    '_fetchIceServers': {
      value: fetchIceServers
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
    'isListening': {
      enumerable: true,
      get: function() {
        return this._userAgent.isRegistered;
      }
    },
    'invites': {
      enumerable: true,
      value: invites
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
 * Causes this {@link Endpoint} to stop listening for {@link Invite}s to
 *   {@link Conversation}s until {@link Endpoint#listen} is called again.
 * @instance
 * @fires Endpoint#unlisten
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.unlisten = function unlisten() {
  if (!this.isListening) {
    return new Q(this);
  }
  var self = this;
  return this._userAgent.unregister().then(function() {
    return self;
  });
};

/**
 * Causes this {@link Endpoint} to start listening for {@link Invite}s to
 *   {@link Conversation}s.
 * @instance
 * @param {string} [token] - a new token to listen with
 * @fires Endpoint#listen
 * @fires Endpoint#listenFailed
 * @returns {Promise<Endpoint>}
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
  // NOTE(mroberts): We want to ensure that we've fetched ICE servers before we
  // register because, once registered, we may start receiving INVITEs, and, on
  // INVITE, SIP.js construct a PeerConnection with whatever STUN and TURN
  // servers were already set.
  var self = this;
  return this._fetchIceServers.then(function() {
    try {
      token = token ? new ScopedAuthenticationToken(token) : self.token;
    } catch (error) {
      self._log.throw(E.INVALID_TOKEN, error.message);
    }

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
 * Invite remote {@link Endpoint}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup an {@link AudioTrack} and
 *   {@link VideoTrack} between local and remote {@link Endpoints}s. You can
 *   override this by specifying <code>options</code>.
 *   <br><br>
 *   You can call <code>.cancel()</code> on the returned Promise until the
 *   remote {@link Endpoint} has joined.
 * @param {Array<string>|string} addresses - Address(es) to invite to the {@link Conversation}
 * @param {Endpoint#CreateConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - options to override
 *   {@link Endpoint#createConversation}'s default behavior
 * @returns {CancelablePromise<Conversation>}
 */
Endpoint.prototype.createConversation = function createConversation(addresses, options) {
  options = util.withDefaults({ }, options, this._options);

  var localMedia = options && options.localMedia;
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

  var conversation = new Conversation(this);
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

    this._pendingConversations[cookie] = {
      conversation: conversation,
      onReceiveInvite: setupConversation
    };

    setTimeout(function() {
      delete this._pendingConversations[cookie];
      this._canceledConversations.delete(cookie);
    }, constants.DEFAULT_CALL_TIMEOUT * 3);
  }

  // Kick off the invite flow
  getLocalMedia().catch(getLocalMediaFailed)
    .then(setLocalMedia)
    .then(this._fetchIceServers)
    .then(inviteAddresses, inviteAddressesFailed)
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
    var message;
    switch (reason.message) {
      case 'canceled':
        message = 'Conversation invite was canceled';
        break;
      case 'rejected':
        message = 'Conversation invite was rejected';
        break;
      case 'ignored':
        message = 'Conversation invite timed out';
        break;
      case 'failed':
        message = 'Unable to reach Participant';
        break;
      default:
        message = 'An unknown error occurred';
        break;
    }

    deferred.reject(E.CONVERSATION_CREATE_FAILED.clone(message));
  }

  function setupConversation(dialog) {
    conversation._addDialog(dialog);
    conversation.once('ended', function() {
      self.conversations.delete(conversation);
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
      delete self._pendingConversations[cookie];

      if (ict) { ict.cancel(); }
      else { isCanceled = true; }
    }

    self._log.throw(error);
  });

  return cancelablePromise;
};

/*
 * Leave one or more {@link Conversation}s. If no {@link Conversation} is
 *   provided this leaves <em>all</em> {@link Conversation}s the
 *   {@link Endpoint} is active in.
 * @instance
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to leave
 * @returns {Promise<Endpoint>}
 */
/* Endpoint.prototype.leave = function leave(conversation) {
  var self = this;

  var conversations = conversation ? [conversation] : this.conversations;
  var dialogs = [];
  conversations.forEach(function(conversation) {
    var found = false;
    conversation._dialogs.forEach(function(dialog) {
      if (dialog.userAgent === self._userAgent) {
        found = true;
        dialogs.push(dialog.end().then(function() {
          self.conversations.delete(conversation);
        }, function(error) {
          self.conversations.delete(conversation);
          throw error;
        }));
      }
    });
    if (!found) {
      self.conversations.delete(conversation);
    }
  });

  return Q.all(dialogs).then(function() {
    return self;
  }, function() {
    return self;
  });
}; */

Object.freeze(Endpoint.prototype);

/**
 * Your {@link Endpoint} has received an {@link Invite} to participant in a
 * {@link Conversation}.
 * @param {Invite} invite - the {@link Invite}
 * @event Endpoint#invite
 * @example
 * var endpoint = new Twilio.Endpoint('$TOKEN');
 *
 * endpoint.on('invite', function(invite) {
 *   console.log('Received an Invite to join a Conversation from ' + invite.from);
 * });
 */

/**
 * You may pass these options to {@link Endpoint}'s constructor to override
 * its default behavior.
 * @typedef {object} Endpoint#EndpointOptions
 * @property {boolean} [debug=false] - Set to <code>true</code> to enable debug
 *   debug logging
 * @property {?Array<object>} [iceServers=[]] - Set this to override the STUN/TURN
 *   servers used in ICE negotiation. You can pass the <code>ice_servers</code>
 *   property from a <a href="https://www.twilio.com/docs/api/rest/token">
 *   Network Traversal Service Token</a>.
 */

/**
 * You may pass these options to {@link Endpoint#createConversation} to
 * override the default behavior.
 * @typedef {object} Endpoint#CreateConversationOptions
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
