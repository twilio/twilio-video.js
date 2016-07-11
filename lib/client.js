'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var createCancelableRoomPromise = require('./cancelableroompromise');
var constants = require('./util/constants');
var Room = require('./room');
var ECS = require('twilio-common/lib/ecs');
var EventEmitter = require('events').EventEmitter;
var LocalMedia = require('./media/localmedia');
var Log = require('./util/log');
var SignalingV2 = require('./signaling/v2');
var TimeoutPromise = require('./util/timeoutpromise');
var util = require('./util');
var version = require('../package').version;

/**
 * Constructs a new {@link Client} with an AccessManager. Alternatively, you
 * can pass an Access Token string and the {@link Client} will construct an
 * AccessManager for you.
 * @class
 * @classdesc Construct a {@link Client} to start creating and connecting
 *   to {@link Room}s with other {@link Participant}s.
 * @param {AccessManager|string} managerOrToken - The {@link Client}'s AccessManager or an Access Token string to use when constructing an AccessManager
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {AccessManager} accessManager - The {@link Client}'s AccessManager
 * @property {Map<Room.SID, Room>} rooms - The {@link Room}s this
 *   {@link Client} is participating in
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

  var self = this;
  function getConfiguration() {
    return ECS.getConfiguration(accessManager.token, {
      body: {
        'service': 'rtc',
        'sdk_version': version
      }
    }).then(function(res) {
      var ttl = util.getOrNull(res, 'rtc.network_traversal_service.ttl');
      ttl = ttl || constants.ICE_SERVERS_DEFAULT_TTL;

      setTimeout(function renewIceServers() {
        self._ecsPromise = getConfiguration();
      }, (ttl - constants.ECS_TIMEOUT) * 1000);

      return res;
    }, function(reason) {
      log.warn('Failed to fetch Endpoint Configuration: ' + reason);
      return null;
    });
  }

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _rooms: {
      value: rooms
    },
    _ecsPromise: {
      value: getConfiguration(),
      writable: true
    },
    _log: {
      value: log
    },
    _options: {
      value: options
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
    }
  });
}

inherits(Client, EventEmitter);

/**
 * Connect to a {@link Room} by name or {@link Room.SID}.
 *   <br><br>
 *   By default, this will automatically acquire {@link LocalMedia} containing a
 *   {@link LocalAudioTrack} and {@link LocalVideoTrack} before connecting to the
 *   {@link Room}. The {@link LocalMedia} will be stopped when you disconnect
 *   from the {@link Room}.
 *   <br><br>
 *   You can override the default behavior by specifying
 *   <code>options</code>. For example, rather than acquiring {@link LocalMedia}
 *   automatically, you can pass your own instance which you can stop yourself.
 *   See {@link Client.ConnectOptions} for more information.
 * @param {?string|Room.SID} [nameOrSid=null] - the name or SID of a {@link Room}
 *   to connect to; if omitted, connect to a new, random {@link Room}
 * @param {Client.ConnectOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   the default behavior
 * @returns {CancelablePromise<Room>}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Rooms.Client(manager);
 *
 * client.connect('my-cool-room').then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Rooms.Client(manager);
 *
 * var localMedia = new Twilio.Rooms.LocalMedia();
 *
 * // Connect with audio-only
 * localMedia.addMicrophone().then(function() {
 *   return client.connect('my-cool-room', { localMedia: localMedia });
 * }).then(function(room) {
 *   // Our LocalParticipant reuses the LocalMedia we passed in.
 *   room.localParticipant.media === localMedia; // true
 *
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 *
 *   // Make sure to stop localMedia
 *   room.once('disconnected', function() {
 *     localMedia.stop();
 *   });
 * });
*//**
 * Connect to a new, random {@link Room}.
 * @param {Client.ConnectOptions}
 *   [options={localStreamConstraints:{audio:true,video:true}}] - Options to override
 *   the default behavior
 * @returns {CancelablePromise<Room>}
 */
Client.prototype.connect = function connect(nameOrSid, options) {
  if (typeof nameOrSid === 'object') {
    return this.connect(null, nameOrSid);
  }
  options = Object.assign({
    create: true,
    with: []
  }, this._options, options);
  options.with = options.with instanceof Array
    ? options.with
    : [options.with];
  return createCancelableRoomPromise(
    getLocalMedia.bind(null, this, options),
    createRoomSignaling.bind(null, this, options.with, nameOrSid, options),
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
 * You may pass these options to {@link Client#connect} to
 * override the default behavior.
 * @typedef {object} Client.ConnectOptions
 * @property {?boolean} [create=true] - Set to false in order to only connect
 *   to a {@link Room} if it already exists (use in conjunction with
 *   <code>nameOrSid</code>)
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {?string} [nameOrSid=null] - Set to connect to a {@link Room} by
 *   its name or {@link Room.SID}
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

function createRoomSignaling(client, identities, nameOrSid, options, localMedia) {
  return getIceServers(client, options).then(function(iceServers) {
    options.iceServers = iceServers;
    return client._signaling.connect(identities, nameOrSid, localMedia, options);
  });
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

function getIceServers(client, options) {
  var log = client._log;

  if (options.iceServers) {
    return Promise.resolve(options.iceServers);
  }

  return new TimeoutPromise(client._ecsPromise, constants.ICE_SERVERS_TIMEOUT_MS).then(function(config) {
    var nts = util.getOrNull(config, 'rtc.network_traversal_service');

    if (nts.warning) {
      log.warn(nts.warning);
    }

    if (!nts) {
      throw new Error('network_traversal_service not available');
    }

    if (!nts.ice_servers) {
      throw new Error('ice_servers not available');
    }

    return nts.ice_servers;
  }).catch(function(reason) {
    log.warn('Failed to fetch ice servers from ECS: ' + reason.message);
    return constants.DEFAULT_ICE_SERVERS;
  });
}

module.exports = Client;
