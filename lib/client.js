'use strict';

var inherits = require('util').inherits;

var AccessManager = require('twilio-common').AccessManager;
var createCancelableRoomPromise = require('./cancelableroompromise');
var constants = require('./util/constants');
var Room = require('./room');
var E = require('./util/constants').twilioErrors;
var ECS = require('twilio-common/lib/ecs');
var EventEmitter = require('events').EventEmitter;
var LocalMedia = require('./media/localmedia');
var LocalParticipant = require('./localparticipant');
var Log = require('./util/log');
var SignalingV2 = require('./signaling/v2');
var TimeoutPromise = require('./util/timeoutpromise');
var util = require('./util');
var version = require('../package').version;

/**
 * Constructs a new {@link Client} with an Access Token string.
 * @class
 * @classdesc Construct a {@link Client} to start creating and connecting
 *   to {@link Room}s with other {@link Participant}s.
 * @param {string} token - The {@link Client}'s Access Token string
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {?Date} tokenExpiration - The time at which the currently active Access
 *   Token will expire; this will not be populated until this information
 *   has been parsed and returned by the server.
 * @property {boolean} tokenIsExpired - Whether or not the currently active
 *   Access Token has expired; if tokenExpiration time is unknown, this is false.
 * @property {string} token - The {@link Client}'s active Access Token
 * @property {Map<Room.SID, Room>} rooms - The {@link Room}s this
 *   {@link Client} is participating in
 * @fires Client#error
 * @fires Client#tokenExpired
 * @fires Client#tokenWillExpire
 */
function Client(token, options) {
  if (!(this instanceof Client)) {
    return new Client(token, options);
  }

  if (typeof token !== 'string') {
    throw E.INVALID_ARGUMENT.clone('<string> token is a required parameter');
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

  var accessManager = new AccessManager(token);
  var logLevel = options.logLevel;
  var log = new Log('Client', logLevel);
  var rooms = new Map();
  var self = this;
  var signaling = new Signaling(accessManager._tokenPayload.sub, accessManager.identity, options);

  accessManager.on('tokenExpired', function() {
    self.emit('tokenExpired');
  });

  accessManager.on('tokenWillExpire', function() {
    self.emit('tokenWillExpire');
  });

  function getConfiguration() {
    return ECS.getConfiguration(accessManager.token, {
      configUrl: 'https://ecs.dev-us1.twilio.com/v1/Configuration',
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
    _accessManager: {
      value: accessManager
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
    _rooms: {
      value: rooms
    },
    _signaling: {
      value: signaling
    },
    rooms: {
      enumerable: true,
      get: function() {
        return new Map(rooms);
      }
    },
    token: {
      enumerable: true,
      get: function() {
        return accessManager.token;
      }
    },
    tokenExpiration: {
      enumerable: true,
      get: function() {
        return accessManager.expires;
      }
    },
    tokenIsExpired: {
      enumerable: true,
      get: function() {
        return accessManager.isExpired;
      }
    }
  });
}

inherits(Client, EventEmitter);

/**
 * Connect to a {@link Room}.
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
 * @param {Client.ConnectOptions}
 *   [options={audio:true,video:true}] - Options to override
 *   the default behavior
 * @returns {CancelablePromise<Room>}
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.connect({ to: my-cool-room' }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * var localMedia = new Twilio.Video.LocalMedia();
 *
 * // Connect with audio-only
 * localMedia.addMicrophone().then(function() {
 *   return client.connect({ to: 'my-cool-room', localMedia: localMedia });
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
 */
Client.prototype.connect = function connect(options) {
  options = Object.assign({
    create: true,
    to: null
  }, this._options, options);
  return createCancelableRoomPromise(
    getLocalMedia.bind(null, this, options),
    createLocalParticipant.bind(null, this),
    createRoomSignaling.bind(null, this, options),
    createRoom.bind(null, this, options));
};

/**
 * Replace the {@link Client}'s currently active token with a new token.
 * @param {string} newToken - The new token to use to authenticate this {@link Client}.
 * @returns {Promise<this>}
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.on('tokenWillExpire', function() {
 *   var newToken = getAccessToken();
 *
 *   client.updateToken(newToken).then(function() {
 *     console.info('Successfully updated with new token');
 *   }, function(reason) {
 *     console.error('Error while updating token: ' + reason);
 *   });
 * });
 */
Client.prototype.updateToken = function updateToken(newToken) {
  var self = this;
  return this._accessManager.updateToken(newToken).then(function() {
    return self;
  });
};

/**
 * Your {@link Client} has run into an error.
 * @param {Error} error - The Error
 * @event Client#error
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.on('error', function(error) {
 *  console.error(error);
 * });
 */

/**
 * The active Access Token has expired.
 * @event Client#tokenExpired
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.on('tokenExpired', function() {
 *   console.error('Uh oh! Token has expired.');
 * });
 */

/**
 * The active Access Token will expire soon.
 * @event Client#tokenWillExpire
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.on('tokenWillExpire', function() {
 *   var newToken = getAccessToken();
 *
 *   client.updateToken(newToken).then(function() {
 *     console.info('Successfully updated with new token');
 *   }, function(reason) {
 *     console.error('Error while updating token: ' + reason);
 *   });
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
 * @property {?boolean} [audio=true] - Whether or not to get local audio
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 * @property {?boolean} [create=true] - Set to false in order to only connect
 *   to a {@link Room} if it already exists (use in conjunction with
 *   <code>to</code>)
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Room}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Room}
 * @property {?string} [to=null] - Set to connect to a {@link Room} by name
 * @property {?boolean} [video=true] - Whether or not to get local video
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 */

function createLocalParticipant(client, localMedia) {
  var signaling = client._signaling.createLocalParticipantSignaling();
  return new LocalParticipant(signaling, localMedia);
}

function createRoom(client, options, localParticipant, roomSignaling) {
  var room = new Room(localParticipant, roomSignaling, options);
  client._rooms.set(room.sid, room);

  roomSignaling.on('stateChanged', function stateChanged() {
    client._rooms.delete(room.sid);
    roomSignaling.removeListener('stateChanged', stateChanged);
  });

  return room;
}

function createRoomSignaling(client, options, localParticipant) {
  return getIceServers(client, options).then(function(iceServers) {
    options.iceServers = iceServers;
    return client._signaling.connect(localParticipant._signaling, options);
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
