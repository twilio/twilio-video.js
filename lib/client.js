'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var constants = require('./util/constants');
var Room = require('./room');
var EventEmitter = require('events').EventEmitter;
var IncomingInvite = require('./incominginvite');
var LocalMedia = require('./media/localmedia');
var Log = require('./util/log');
var OutgoingInvite = require('./outgoinginvite');
var SignalingV2 = require('./signaling/v2');

/**
 * Constructs a new {@link Client} with an AccessManager. Alternatively, you
 * can pass an Access Token string and the {@link Client} will construct an
 * AccessManager for you.
 * @class
 * @classdesc Construct a {@link Client} to start creating and participating
 *   in {@link Room}s with other {@link Participant}s.
 * @param {AccessManager|string} managerOrToken - The {@link Client}'s AccessManager or an Access Token string to use when constructing an AccessManager
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {string} identity - The {@link Client}'s identity
 * @property {Map<Room.SID, Room>} rooms - The {@link Room}s this
 *   {@link Client} is participating in
 * @property {bool} isListening - Whether the {@link Client} is listening for
 *   {@link IncomingInvite}s to {@link Room}s
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

  options = Object.assign({
    logLevel: constants.DEFAULT_LOG_LEVEL,
    signaling: 'v2'
  }, options);

  var Signaling;
  switch (options.signaling) {
    case 'v2':
      Signaling = SignalingV2;
      break;
    default:
      if (typeof options.signaling === 'function') {
        Signaling = options.signaling;
      }
      throw new Error(
        'Unknown Signaling version "' + options.signaling + '"');
  }

  var rooms = new Map();
  var logLevel = options.logLevel;
  var log = new Log('Client', logLevel);
  var signaling = new Signaling(accessManager, options);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _rooms: {
      value: rooms
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
    rooms: {
      enumerable: true,
      get: function() {
        return new Map(rooms);
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
 *   {@link Room}s until {@link Client#listen} is called again.
 * @returns {this}
 */
Client.prototype.unlisten = function unlisten() {
  this._signaling.unlisten();
  return this;
};

/**
 * Causes this {@link Client} to start listening for {@link IncomingInvite}s to
 *   {@link Room}s.
 * @returns {Promise<this>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var alice = new Twilio.Rooms.Client(manager);
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
 * Invite remote {@link Client}s to join a {@link Room}.
 *   <br><br>
 *   By default, this will attempt to setup an {@link AudioTrack} and
 *   {@link VideoTrack} between local and remote {@link Client}s. You can
 *   override this by specifying <code>options</code>.
 * @param {Array<string>|string} participants - {@link Participant} identities to invite to the {@link Room}
 * @param {Client.InviteToRoomOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   {@link Client#inviteToRoom}'s default behavior
 * @returns {OutgoingInvite}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Rooms.Client(manager);
 *
 * client.inviteToRoom(['bob', 'charlie']).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 */
Client.prototype.inviteToRoom = function inviteToRoom(identities, options) {
  identities = identities || [];
  identities = identities instanceof Array ? identities : [identities];
  options = Object.assign({}, this._options, options);
  var labelOrSid = options.labelOrSid;
  return new OutgoingInvite(identities,
    getLocalMedia.bind(null, this, options),
    createOutgoingInviteSignaling.bind(null, this, identities, labelOrSid, options),
    createRoom.bind(null, this, options));
};

/**
 * Your {@link Client} has run into an error.
 * @param {Error} error - The Error
 * @event Client#error
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Rooms.Client(manager);
 *
 * client.on('error', function(error) {
 *  console.error(error);
 * });
 */

/**
 * Your {@link Client} has received an {@link IncomingInvite} to participant in a
 * {@link Room}.
 * @param {IncomingInvite} invite - the {@link IncomingInvite}
 * @event Client#invite
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Rooms.Client(manager);
 *
 * client.on('invite', function(invite) {
 *   console.log('Received an IncomingInvite to join a Room from ' + invite.from);
 * });
 */

/**
 * You may pass these options to {@link Client}'s constructor to override
 * its default behavior.
 * @typedef {object} Client.ConstructorOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {string} [logLevel='warn'] - Set the verbosity of logging to console.
 *   Valid values: ['off', 'error', 'warn', 'info', 'debug']
 */

/**
 * You may pass these options to {@link Client#inviteToRoom} to
 * override the default behavior.
 * @typedef {object} Client.InviteToRoomOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Room}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Room}
 * @property {?object} [localStreamConstraints={audio:true,video:true}] - Set to
 *   override the parameters passed to <code>getUserMedia</code> when neither
 *   <code>localMedia</code> nor <code>localStream</code> are provided
 */

function createRoom(client, options, roomSignaling) {
  var room = new Room(roomSignaling, options);
  client._rooms.set(room.sid, room);

  roomSignaling.on('stateChanged', function stateChanged() {
    client._rooms.delete(room.sid);
    roomSignaling.removeListener('stateChanged', stateChanged);
  });

  return room;
}

function createOutgoingInviteSignaling(client, identities, labelOrSid, options, localMedia) {
  return client._signaling.connect(identities, labelOrSid, localMedia, options);
}

function getLocalMedia(client, options, handleLocalMedia) {
  options.shouldStopLocalMedia = !options.localMedia && !options.localStream;
  return LocalMedia.getLocalMedia(options).then(function getLocalMediaSucceeded(localMedia) {
    var promise = handleLocalMedia(localMedia);
    promise.catch(function handleLocalMediaFailed() {
      if (options.shouldStopLocalMedia) {
        localMedia.stop();
      }
    });
    return promise;
  });
}

function handleSignalingEvents(client, signaling) {
  signaling.on('invite', function invite(incomingInviteSignaling) {
    var incomingInvite = new IncomingInvite(incomingInviteSignaling,
      getLocalMedia.bind(null, client),
      createRoom.bind(null, client),
      client._options);

    client.emit('invite', incomingInvite);
  });
}

module.exports = Client;
