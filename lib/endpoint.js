'use strict';

var inherits = require('util').inherits;

var constants = require('./util/constants');
var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var Invite = require('./invite');
var Q = require('q');
var Set = require('es6-set');
var SIPJSUserAgent = require('./signaling/sipjsuseragent');
var Sound = require('./media/sound');
var Stream = require('./media/stream');
var Token = require('./token');
var util = require('./util');

/**
 * Constructs a new {@link Endpoint} with a token and calls
 *   {@link Endpoint#listen}.
 * @class
 * @classdesc An {@link Endpoint} is identified by an address and
 *   can create or join {@link Conversation}s
 * @param {string} token - the {@link Endpoint}'s token
 * @param {Endpoint#EndpointOptions} [options] - options to override the
 *   constructor's default behavior
 * @property {string} address - the {@link Endpoint}'s address (defined by its
 *   token)
 * @property {Set<Conversation>} conversations - the {@link Conversation}s this
 *   {@link Endpoint} is active in
 * @property {bool} listening - whether the {@link Endpoint} is listening for
 *   {@link Invite}s to {@link Conversation}s
 * @fires Endpoint#invite
 * @fires Endpoint#listen
 * @fires Endpoint#listenFailed
 * @fires Endpoint#unlisten
 */ 
function Endpoint(token, options) {
  if (!(this instanceof Endpoint)) {
    return new Endpoint(token, options);
  }
  var self = this;
  EventEmitter.call(this);

  token = typeof token === 'string' ? new Token(token) : token;
  options = util.withDefaults(options, {
    'debug': constants.DEBUG,
    'iceServers': [],
    'register': true,
    'sound': Sound.getDefault(),
    'userAgent': SIPJSUserAgent
  });

  var address = token.incomingClientName;
  var accountSid = token.accountSid;
  var conversations = new Set();
  var sound = options['sound'];
  var userAgent = new options['userAgent'](token, options);

  userAgent.on('invite', function(inviteServerTransaction) {
    var invite = new Invite(inviteServerTransaction);
    invite._promise.then(function(conversation) {
      conversations.add(conversation);
    });
    self.emit('invite', invite);
  });

  Object.defineProperties(this, {
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

inherits(Endpoint, EventEmitter);

/**
 * Causes this {@link Endpoint} to stop listening for {@link Invite}s to
 *   {@link Conversation}s until {@link Endpoint#listen} is called again.
 * @instance
 * @fires Endpoint#unlisten
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.unlisten = function unlisten() {
  var self = this;
  return this._userAgent.unregister().then(function() {
    setTimeout(function() {
      self.emit('unlisten', self);
    });
    return self;
  }, function(error) {
    setTimeout(function() {
      self.emit('unlisten', self);
    });
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
 * var alice = new Twilio.Signal.Endpoint(originalToken);
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
  var self = this;
  return this._userAgent.register(token).then(function() {
    setTimeout(function() {
      self.emit('listen', self);
    });
    return self;
  }, function(error) {
    setTimeout(function() {
      self.emit('listenFailed', error);
    });
    throw error;
  });
};

/**
 * Invite remote {@link Endpoint}s to join a {@link Conversation}.
 *   <br><br>
 *   By default, this will attempt to setup audio and video
 *   {@link Stream}s between local and remote {@link Endpoint}s. You can
 *   override this by specifying <code>options</code>.
 * @param {string} address - an address to invite to the {@link Conversation}
 * @param {Endpoint#CreateConversationOptions}
 *   [options={streamConstraints:{audio:true,video:true}}] - options to override
 *   {@link Endpoint#createConversation}'s default behavior
 * @returns {Promise<Conversation>}
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * // By default, createConversation will request a new audio/video Stream for you.
 * alice.createConversation('bob');
 *
 * // If you want to use an audio- or video-only Stream, you can set the streamConstraints.
 * var options = {
 *   streamConstraints: {
 *     audio: true,
 *     video: false
 *   }
 * };
 * alice.createConversation('charlie', options);
 *
 * // Or, you can use a Stream you already have.
 * var localStream;
 * options = {
 *   stream: localStream
 * };
 * alice.createConversation('dave', options);
 */
Endpoint.prototype.createConversation =
  function createConversation(address, options)
{
  var self = this;

  var addresses = address.forEach ? address : [address];
  options = util.withDefaults(options, this._options);

  var stream = options['stream']
             ? new Q(options['stream'])
             : Stream.getUserMedia(options['streamConstraints']);
  return stream.then(function(stream) {
    self._sound.outgoing.play();
    options['stream'] = stream;

    var conversation = new Conversation();
    var inviteClientTransactions = addresses.map(function(address) {
      return self._userAgent.invite(address, options).then(function(dialog) {
        // conversation._dialogs.push(dialog);
        conversation._addDialog(dialog);
      });
    });

    return util.any(inviteClientTransactions).then(function() {
      self._sound.outgoing.stop();
      self.conversations.add(conversation);
      return conversation;
    }, function(error) {
      self._sound.outgoing.stop();
      throw error;
    });
  });
};

Endpoint.prototype.invite = Endpoint.prototype.createConversation;

/**
 * Leave one or more {@link Conversation}s. If no {@link Conversation} is
 *   provided this leaves <em>all</em> {@link Conversation}s the
 *   {@link Endpoint} is active in.
 * @instance
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to leave
 * @returns {Promise<Endpoint>}
 */
Endpoint.prototype.leave = function leave(conversation) {
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
};

/**
 * Mute or unmute any audio this {@link Endpoint} is streaming in
 *   one or more {@link Conversation}s. If no {@link Conversation} is provided,
 *   then this method mutes or unmutes audio for <em>all</em> of this
 *   {@link Endpoint}'s {@link Conversation}s.
 * @instance
 * @param {boolean} [mute=true] - whether to mute or unmute audio (defaults to
 *   mute)
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to mute or unmute audio for
 * @returns {Endpoint}
 */
Endpoint.prototype.muteAudio = function muteAudio(mute, conversation) {
  mute = (mute === null || typeof mute === 'undefined') ? true : mute;
  var self = this;
  var conversations = conversation
                    ? (conversation.forEach ? conversation : [conversation])
                    : this.conversations;
  conversations.forEach(function(conversation) {
    var localStreams = conversation.getLocalStreams(self);
    localStreams.forEach(function(localStream) {
      localStream.muted = mute;
    });
  });
  return this;
};

/**
 * Pause or unpause any video this {@link Endpoint} is streaming
 *   in one or more {@link Conversation}s. If no {@link Conversation} is
 *   provided, then this method pauses or unpauses video for <em>all</em> of
 *   this {@link Endpoint}'s {@link Conversation}s.
 * @instance
 * @param {boolean} [pause=true] - whether to pause or unpause audio
 *   (defaults to pause)
 * @param {(Conversation|Array<Conversation>)} [conversation] - one or more
 *   {@link Conversation}s to pause or unpause video for
 * @returns {Endpoint}
 */
Endpoint.prototype.pauseVideo = function pauseVideo(pause, conversation) {
  pause = (pause === null || typeof pause === 'undefined') ? true : pause;
  var self = this;
  var conversations = conversation
                    ? (conversation.forEach ? conversation : [conversation])
                    : this.conversations;
  conversations.forEach(function(conversation) {
    var localStreams = conversation.getLocalStreams(self);
    localStreams.forEach(function(localStream) {
      localStream.paused = pause;
    });
  });
  return this;
};

Object.freeze(Endpoint.prototype);

/**
 * Your {@link Endpoint} has received an {@link Invite} to participant in a
 * {@link Conversation}.
 * @param {Invite} invite - the {@link Invite}
 * @event Endpoint#invite
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('invite', function(invite) {
 *   console.log('Received an Invite to join a Conversation from ' + invite.from);
 * });
 */

/**
 * {@link Endpoint#listen} succeeded and your {@link Endpoint} will start
 *   receiving {@link Invite}s to {@link Conversation}s.
 * @event Endpoint#listen
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('listen', function() {
 *   console.log('Listening for Invites');
 * });
 */

/**
 * {@link Endpoint#listen} failed, and you should try again (possibly with a new
 *   token).
 * @param {object} error - the reason {@link Endpoint#listen} failed
 * @event Endpoint#listenFailed
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('listenFailed', function(error) {
 *   console.log('Listening failed because ' + error);
 * });
 */

/**
 * Your {@link Endpoint} will no longer receive {@link Invite}s to
 *   {@link Conversation}s, either because your token expired or
 *   {@link Endpoint#unlisten} was called.
 * @event Endpoint#unlisten
 * @example
 * var alice = new Twilio.Signal.Endpoint('$TOKEN');
 *
 * alice.on('unlisten', function() {
 *   console.log('No longer listening for Invites');
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
 * @property {?Stream} [stream=null] - Set to reuse an existing {@link Stream} when
 *   creating the {@link Conversation}.
 * @property {object} [streamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when an
 *   initial {@link Stream} is not supplied.
 */

module.exports = Endpoint;
