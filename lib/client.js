'use strict';

var inherits = require('util').inherits;

var createCancelableRoomPromise = require('./cancelableroompromise');
var constants = require('./util/constants');
var DefaultECS = require('./ecs');
var Room = require('./room');
var E = require('./util/constants').typeErrors;
var TwE = require('./util/constants').twilioErrors;
var EventEmitter = require('events').EventEmitter;
var LocalMedia = require('./media/localmedia');
var LocalParticipant = require('./localparticipant');
var Log = require('./util/log');
var SignalingV2 = require('./signaling/v2');
var TimeoutPromise = require('./util/timeoutpromise');
var util = require('./util');
var version = require('../package').version;
var nInstances = 0;

/**
 * Constructs a new {@link Client} with an Access Token string.
 * @class
 * @classdesc Construct a {@link Client} to start creating and connecting
 *   to {@link Room}s with other {@link Participant}s.
 * @param {string} initialToken - The {@link Client}'s Access Token string
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {string} token - The current Access Token
 * @property {Map<Room.SID, Room>} rooms - The {@link Room}s this
 *   {@link Client} is participating in
 * @fires Client#error
 */
function Client(initialToken, options) {
  if (!(this instanceof Client)) {
    return new Client(initialToken, options);
  }

  if (typeof initialToken !== 'string') {
    throw new E.INVALID_TYPE('initialToken', 'string');
  }

  EventEmitter.call(this);

  try {
    var accountSid = util.token.getAccountSid(initialToken);
    var identity = util.token.getIdentity(initialToken);
  } catch (e) {
    throw new TwE.INVALID_ACCESSTOKEN(e.message);
  }

  options = Object.assign({
    ECS: DefaultECS,
    environment: constants.DEFAULT_ENVIRONMENT,
    getLocalMedia: LocalMedia.getLocalMedia,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    realm: constants.DEFAULT_REALM,
    signaling: SignalingV2
  }, options);

  /* eslint new-cap:0 */
  options = Object.assign({
    ecsServer: constants.ECS_SERVER(options.environment, options.realm),
    wsServer: constants.WS_SERVER(options.environment, options.realm, accountSid)
  }, options);

  var defaultIceServers = constants.DEFAULT_ICE_SERVERS(options.environment);
  var ECS = options.ECS;
  var logLevels = util.buildLogLevels(options.logLevel);
  var log = new Log('default', this, logLevels);
  var rooms = new Map();
  var self = this;
  var Signaling = options.signaling;

  options.log = log;
  var signaling = new Signaling(options.wsServer, accountSid, identity, options);

  function getConfiguration() {
    var ecsOptions = {
      configUrl: options.ecsServer + '/v1/Configuration',
      body: {
        'service': 'video',
        'sdk_version': version
      }
    };

    log.info('Getting ECS configuration');
    log.debug('Token:', self.token);
    log.debug('ECS options:', ecsOptions);

    return ECS.getConfiguration(self.token, ecsOptions).then(function(res) {
      log.info('Got ECS configuration');
      log.debug('ECS configuration:', res);

      var ttl = util.getOrNull(res, 'video.network_traversal_service.ttl');
      ttl = ttl || constants.ICE_SERVERS_DEFAULT_TTL;
      log.debug('NTS Token TTL:', ttl);

      setTimeout(function renewIceServers() {
        self._ecsPromise = getConfiguration();
      }, (ttl - constants.ECS_TIMEOUT) * 1000);

      return res;
    }, function(reason) {
      log.warn('Failed to get ECS configuration:', reason);
      return null;
    });
  }

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _defaultIceServers: {
      value: defaultIceServers
    },
    _getLocalMedia: {
      value: options.getLocalMedia
    },
    _instanceId: {
      value: ++nInstances
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
    _token: {
      value: initialToken,
      writable: true
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
        return this._token;
      }
    }
  });

  Object.defineProperty(this, '_ecsPromise', {
    value: getConfiguration(),
    writable: true
  });

  log.info('Created a new Client');
  log.debug('Initial Access Token:', initialToken);
  log.debug('Options:', options);
}

inherits(Client, EventEmitter);

Client.prototype.toString = function toString() {
  return '[Client #' + this._instanceId + ']';
};

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
 * @param {Client.ConnectOptions} [options={audio:true,video:true}] - Options to override the default behavior
 * @returns {CancelablePromise<Room>}
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * client.connect({ to: 'my-cool-room' }).then(function(room) {
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
    to: null
  }, this._options, options);

  var log = this._log;
  log.info('Connecting to a Room');
  log.debug('Options:', options);

  var cancelableRoomPromise = createCancelableRoomPromise(
    getLocalMedia.bind(null, this, options),
    createLocalParticipant.bind(null, this),
    createRoomSignaling.bind(null, this, options),
    createRoom.bind(null, this, options));

  cancelableRoomPromise.then(function(room) {
    log.info('Connected to Room:', room.toString());
    log.info('Room name:', room.name);
    log.debug('Room:', room);
    return room;
  }, function(error) {
    if (cancelableRoomPromise._isCanceled) {
      log.info('Attempt to connect to a Room was canceled');
    } else {
      log.info('Error while connecting to a Room:', error);
    }
  });
  return cancelableRoomPromise;
};

/**
 * Set log levels for {@link Client}
 * @param {LogLevels|LogLevel} logLevel - New log level(s)
 * @returns {Client} this
 */
Client.prototype.setLogLevel = function setLogLevel(logLevel) {
  this._log.setLevels(util.buildLogLevels(logLevel));
  return this;
};

/**
 * Replace the {@link Client}'s currently active token with a new token.
 * @param {string} newToken - The new token to use to authenticate this {@link Client}.
 * @returns {Promise<this>}
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client(initialToken);
 *
 * getAccessToken().then(function(newToken) {
 *   return client.updateToken(newToken);
 * }).then(function() {
 *   console.info('Successfully updated with new token');
 * }, function(reason) {
 *   console.error('Error while updating token: ' + reason);
 * });
 */
Client.prototype.updateToken = function updateToken(newToken) {
  var log = this._log;
  log.info('Updating the Client with a new Access Token');
  log.debug('New Access Token:', newToken);

  try {
    util.token.getAccountSid(newToken);
    util.token.getIdentity(newToken);
    this._token = newToken;
    return Promise.resolve(this);
  } catch (e) {
    throw new TwE.INVALID_ACCESSTOKEN(e.message);
  }
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
 * You may pass these options to {@link Client}'s constructor to override
 * its default behavior.
 * @typedef {object} Client.ConstructorOptions
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the ICE
 *   transport policy to be one of "relay" or "all"
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same level for
 *   all components. Pass a {@link LogLevels} to set specific log levels.
 */

/**
 * You may pass these options to {@link Client#connect} to
 * override the default behavior.
 * @typedef {object} Client.ConnectOptions
 * @property {?boolean} [audio=true] - Whether or not to get local audio
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
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

/**
 * You may pass these levels to {@link Client.ConstructorOptions} to override
 *   log levels for individual components.
 * @typedef {object} LogLevels
 * @property {LogLevel} [default='warn'] - Override the log level for 'default' modules.
 * @property {LogLevel} [media='warn'] - Override the log level for 'media' modules.
 * @property {LogLevel} [signaling='warn'] - Override the log level for 'signaling' module.
 * @property {LogLevel} [webrtc='warn'] - Override the log level for 'webrtc' module.
 */

/**
 * Levels for logging verbosity.
 * @typedef {String} LogLevel - One of ['debug', 'info', 'warn', 'error', 'off']
 */

function createLocalParticipant(client, localMedia) {
  var signaling = client._signaling.createLocalParticipantSignaling();
  var log = client._log;

  log.debug('Creating a new LocalParticipant:', signaling);
  return new LocalParticipant(signaling, localMedia, { log: log });
}

function createRoom(client, options, localParticipant, roomSignaling) {
  var room = new Room(localParticipant, roomSignaling, options);
  var log = client._log;

  log.debug('Creating a new Room:', room);
  client._rooms.set(room.sid, room);

  roomSignaling.on('stateChanged', function stateChanged() {
    log.info('Disconnected from Room:', room.toString());
    client._rooms.delete(room.sid);
    roomSignaling.removeListener('stateChanged', stateChanged);
  });

  return room;
}

function createRoomSignaling(client, options, localParticipant) {
  var log = client._log;
  log.info('Getting ICE servers');
  log.debug('Options:', options);

  return getIceServers(client, options).then(function(iceServers) {
    var roomSignalingParams = {
      token: client.token,
      accountSid: util.token.getAccountSid(client.token),
      identity: util.token.getIdentity(client.token)
    };

    log.info('Got ICE servers');
    log.debug('ICE servers:', iceServers);

    options.iceServers = iceServers;
    log.debug('Creating a new RoomSignaling');
    log.debug('RoomSignaling params:', roomSignalingParams);

    return client._signaling.connect(
      localParticipant._signaling,
      roomSignalingParams.token,
      roomSignalingParams.accountSid,
      roomSignalingParams.identity,
      options);
  });
}

function getLocalMedia(client, options, handleLocalMedia) {
  var log = client._log;

  options.shouldStopLocalMedia = !options.localMedia && !options.localStream;
  options.log = log;

  if (options.shouldStopLocalMedia) {
    log.info('LocalMedia was not provided, so it will be acquired '
      + 'automatically before connecting to the Room. LocalMedia will '
      + 'be released if connecting to the Room fails or if the Room '
      + 'is disconnected');
  } else {
    log.info('Getting LocalMedia');
    log.debug('Options:', options);
  }

  return client._getLocalMedia(options).then(function getLocalMediaSucceeded(localMedia) {
    if (options.shouldStopLocalMedia) {
      log.info('Got LocalMedia:', localMedia);
    }

    var promise = handleLocalMedia(localMedia);
    promise.catch(function handleLocalMediaFailed() {
      if (options.shouldStopLocalMedia) {
        log.info('The automatically acquired LocalMedia will now be stopped');
        localMedia.stop();
      }
    });
    return promise;
  });
}

function getIceServers(client, options) {
  var log = client._log;

  if (options.iceServers) {
    log.debug('ICE servers:', options.iceServers);
    return Promise.resolve(options.iceServers);
  }

  log.debug('No ICE servers provided, so getting them from ECS');
  return new TimeoutPromise(client._ecsPromise, constants.ICE_SERVERS_TIMEOUT_MS).then(function(config) {
    var nts = util.getOrNull(config, 'video.network_traversal_service');

    if (!nts) {
      throw new Error('network_traversal_service not available');
    }

    if (nts.warning) {
      log.warn(nts.warning);
    }

    if (!nts.ice_servers) {
      throw new Error('ice_servers not available');
    }

    log.info('Got ICE servers');
    log.debug('ICE servers:', nts.ice_servers);
    return nts.ice_servers;
  }).catch(function(reason) {
    log.error('Failed to get ICE servers from ECS:', reason.message);
    log.warn('Returning default ICE servers:', client._defaultIceServers);
    return client._defaultIceServers;
  });
}

module.exports = Client;
