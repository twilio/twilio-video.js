'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var constants = require('./util/constants');
var Conversation = require('./conversation');
var EventEmitter = require('events').EventEmitter;
var IncomingInvite = require('./incominginvite');
var Log = require('./util/log');
var SignalingV1 = require('./signaling/v1');
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

  EventEmitter.call(this);

  options = util.withDefaults(options, {
    logLevel: constants.DEFAULT_LOG_LEVEL,
    signaling: 'v1'
  });

  var Signaling;
  switch (options.signaling) {
    case 'v1':
      Signaling = SignalingV1;
      break;
    default:
      if (typeof options.signaling === 'function') {
        Signaling = options.signaling;
      }
      throw new Error(
        'Unknown Signaling version "' + options.signaling + '"');
  }

  var conversations = new Map();
  var logLevel = options.logLevel;
  var log = new Log('Client', logLevel);
  var signaling = new Signaling(accessManager, options);


  /* istanbul ignore next */
  Object.defineProperties(this, {
    _conversations: {
      value: conversations
    },
    _log: {
      value: log
    },
    _signaling: {
      value: signaling
    },
    accessManager: {
      enumerable: true,
      value: accessManager
    },
    conversations: {
      enumerable: true,
      get: function() {
        return new Map(conversations);
      }
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
        return signaling.state === 'listening';
      }
    }
  });

  handleSignalingEvents(this, signaling);
}

inherits(Client, EventEmitter);

/**
 * Causes this {@link Client} to stop listening for {@link IncomingInvite}s to
 *   {@link Conversation}s until {@link Client#listen} is called again.
 * @returns {this}
 */
Client.prototype.unlisten = function unlisten() {
  this._signaling.unlisten();
  return this;
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
  return this._signaling.listen().then(function listenSucceeded() {
    return self;
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
  options = util.withDefaults({ with: participants }, this._options, options);
  var self = this;
  return this._signaling.connect(null, options).then(function connectSucceeded(conversationImpl) {
    return createConversation(self, conversationImpl, options);
  });
};

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
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 */

/**
 * You may pass these options to {@link Client#inviteToConversation} to
 * override the default behavior.
 * @typedef {object} Client.InviteToConversationOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Conversation}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Conversation}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Conversation}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

function createConversation(client, conversationImpl, options) {
  var conversation = new Conversation(conversationImpl, options);
  client._conversations.set(conversation.sid, conversation);

  conversationImpl.on('stateChanged', function stateChanged() {
    client._conversations.delete(conversation.sid);
    conversationImpl.removeListener('stateChanged', stateChanged);
  });

  return conversation;
}

function handleSignalingEvents(client, signaling) {
  signaling.on('invite', function invite(incomingInviteImpl) {
    var incomingInvite = new IncomingInvite(incomingInviteImpl,
      createConversation.bind(null, client));

    client.emit('invite', incomingInvite);
  });
}

module.exports = Client;
