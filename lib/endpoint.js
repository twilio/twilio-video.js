'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Conversation = require('./conversation');
var CancelablePromise = require('./util/cancelablepromise');
var EventEmitter = require('events').EventEmitter;
var Invite = require('./invite');
var Q = require('q');
var Set = require('es6-set');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var Sound = require('./media/sound');
var StatsReporter = require('./statsreporter');
var Stream = require('./media/stream');
var Token = require('./token');
var util = require('./util');

var Log = require('./util/log');
var E = constants.twilioErrors;

/**
 * Constructs a new {@link Endpoint} with a token and calls
 *   {@link Endpoint#listen}.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and
 *   can create or join {@link Conversation}s.
 * <br><br>
 * {@link Endpoint}s are created with {@link Endpoint.createWithToken}.
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
    'iceServers': [],
    'register': true,
    'sound': Sound.getDefault(),
    'userAgent': SIPJSUserAgent,
    'logLevel': 'warn'
  });

  var address = token.incomingClientName;
  var accountSid = token.accountSid;
  var conversations = new Set();
  var eventGateway = options['eventGateway'];
  var invites = new Set();
  var sound = options['sound'];

  var logLevel;

  try {
    logLevel = Log.getLevelByName(options.logLevel);
  } catch(e) {
    throw E.INVALID_ARGUMENT.clone(e.message);
  }

  var log = new Log('Endpoint', logLevel);

  try {
    token = typeof token === 'string' ? new Token(token) : token;
  } catch(e) {
    log.throw(E.INVALID_TOKEN, e.message);
  }

  var userAgent = new options['userAgent'](token, options);

  userAgent.on('invite', function(inviteServerTransaction) {
    var conversationSid = inviteServerTransaction.conversationSid;

    // If we are already in the Conversation, accept immediately.
    var activeConversation = null;
    conversations.forEach(function(conversation) {
      if (conversation.sid === conversationSid) {
        activeConversation = conversation;
      }
    });
    if (activeConversation) {
      // FIXME(mroberts): ...
      return inviteServerTransaction.accept({ localStream: activeConversation.localStream })
        .then(function(dialog) {
          activeConversation._addDialog(dialog);
        });
    }

    // If we have already received an Invite for the Conversation, add to existing Invite.
    var activeInvite = null;
    invites.forEach(function(invite) {
      if (invite.conversationSid === conversationSid) {
        activeInvite = invite;
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
    }, function() {
      invites.delete(invite);
    });
    self.emit('invite', invite);
  });

  userAgent.on('dialogCreated', function(dialog) {
    var statsReporter = new StatsReporter(eventGateway, dialog);
  });

  Object.defineProperties(this, {
    '_log': {
      value: log
    },
    '_options': {
      value: options
    },
    '_sound': {
      value: sound
    },
    '_userAgent': {
      value: userAgent
    },
    'address': {
      enumerable: true,
      get: function() {
        return this._userAgent.token.incomingClientName;
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
    'listening': {
      enumerable: true,
      get: function() {
        return this._userAgent.registered;
      }
    },
    'token': {
      enumerable: true,
      get: function() {
        return this._userAgent.token;
      }
    }
  });

  if (options['register']) {
    this.listen();
  }

  return Object.freeze(this);
}

/**
 * Constructs a new {@link Endpoint} with a token and calls
 *   {@link Endpoint#listen}.
 * @param {string} token - the {@link Endpoint}'s token
 * @param {Endpoint#EndpointOptions} [options] - options to override the
 *   constructor's default behavior
 * @returns {Promise<Endpoint>}
 */
Endpoint.createWithToken = function createWithToken(token, options) {
  options = util.withDefaults(options, {});
  options['register'] = false;
  var endpoint = new Endpoint(token, options);
  return endpoint.listen();
};

inherits(Endpoint, EventEmitter);

/**
 * Causes this {@link Endpoint} to stop listening for {@link Invite}s to
 *   {@link Conversation}s until {@link Endpoint#listen} is called again.
 * @instance
 * @fires Endpoint#unlisten
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.unlisten = function unlisten() {
  if (!this.listening) {
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
 * var alice;
 * Twilio.Endpoint.createWithToken(originalToken).then(function(endpoint) {
 *   alice = endpoint;
 * });
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
  if (this.listening) {
    return new Q(this);
  }
  var self = this;
  return this._userAgent.register(token).then(function() {
    return self;
  }, function(response) {
    var errorMessage = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw');
    self._log.throw(E.REGISTER_FAILED, 'Gateway responded with: ' + errorMessage);
  });
};

/**
 * Invite remote {@link Endpoint}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup audio and video
 *   {@link Stream}s between local and remote {@link Endpoint}s. You can
 *   override this by specifying <code>options</code>.
 *   <br><br>
 *   You can call <code>.cancel()</code> on the returned Promise until the
 *   remote {@link Endpoint} has joined.
 * @param {string} address - an address to invite to the {@link Conversation}
 * @param {Endpoint#CreateConversationOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - options to override
 *   {@link Endpoint#createConversation}'s default behavior
 * @returns {CancelablePromise<Conversation>}
 * @example
 * Twilio.Endpoint.createWithToken('$TOKEN').then(function(endpoint) {
 *
 *   // By default, createConversation will request a new audio/video Stream for you.
 *   endpoint.createConversation('alice');
 *
 *   // If you want to use an audio- or video-only Stream, you can set the localStreamConstraints.
 *   var options = {
 *     localStreamConstraints: {
 *       audio: true,
 *       video: false
 *     }
 *   };
 *   endpoint.createConversation('bob', options);
 *
 *   // Or, you can use a Stream you already have.
 *   var localStream;
 *   options = {
 *     localStream: localStream
 *   };
 *   endpoint.createConversation('charlie', options);
 *
 * });
 */
Endpoint.prototype.createConversation =
  function createConversation(address, options)
{
  var self = this;
  var anyPromise;

  var addresses = address.forEach ? address : [address];
  options = util.withDefaults(options, this._options);

  var stream = options['localStream']
             ? new Q(options['localStream'] instanceof Stream ? options['localStream'] : new Stream(options['localStream']))
             : Stream.getUserMedia(options['localStreamConstraints']);
  stream = new CancelablePromise(stream);
  var thenPromise = stream.then(function(stream) {
    self._sound.outgoing.play();
    options['localStream'] = stream;

    var conversation = new Conversation(self);
    var icts = addresses.map(function(address) {
      return self._userAgent.invite(address, options);
    });
    var ictPromises = icts.map(function(ict) {
      return ict.then(function(dialog) {
        conversation._addDialog(dialog);
      }, function(reason) {
        if (reason.failed) {
          self._log.throw(E.SESSION_CONNECT_FAILED, 'Remote endpoint unreachable');
        } else if (reason.canceled) {
          self._log.throw(E.SESSION_CONNECT_FAILED, 'Invite to remote endpoint was canceled');
        } else if (reason.rejected) {
          self._log.throw(E.SESSION_CONNECT_FAILED, 'Remote endpoint rejected invite');
        } else if(reason === 'ignored') {
          self._log.throw(E.SESSION_CONNECT_FAILED, 'Invite to remote endpoint timed out');
        } else {
          self._log.throw(E.SESSION_CONNECT_FAILED, 'An unknown error occurred');
        }
      });
    });

    anyPromise = util.any(ictPromises);

    return anyPromise.then(function() {
      self._sound.outgoing.stop();
      self.conversations.add(conversation);
      return conversation;
    }, function(error) {
      icts.forEach(function(ict) { ict.cancel(); });
      self._sound.outgoing.stop();
      throw error;
    });
  });

  function cancel() {
    if (anyPromise) {
      anyPromise.cancel();
    } else {
      stream.cancel();
    }
  }

  Object.defineProperties(thenPromise, {
    cancel: { value: cancel }
  });

  return thenPromise;
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
 * Twilio.Endpoint.createWithToken('$TOKEN').then(function(endpoint) {
 *   endpoint.on('invite', function(invite) {
 *     console.log('Received an Invite to join a Conversation from ' + invite.from);
 *   });
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
 * @property {?Stream} [localStream=null] - Set to reuse an existing {@link Stream} when
 *   creating the {@link Conversation}.
 * @property {object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when an
 *   initial {@link Stream} is not supplied.
 */

module.exports = Endpoint;
