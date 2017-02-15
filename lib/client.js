'use strict';

var createCancelableRoomPromise = require('./cancelableroompromise');
var ConstantIceServerSource = require('./iceserversource/constant');
var constants = require('./util/constants');
var Room = require('./room');
var E = require('./util/constants').typeErrors;
var AccessTokenInvalidError = require('./util/twilio-video-errors').AccessTokenInvalidError;
var LocalMedia = require('./media/localmedia');
var LocalParticipant = require('./localparticipant');
var Log = require('./util/log');
var NTSIceServerSource = require('./iceserversource/nts');
var SignalingV2 = require('./signaling/v2');
var util = require('./util');
var nInstances = 0;

/**
 * Constructs a new {@link Client} with an Access Token string.
 * @class
 * @classdesc Construct a {@link Client} to start creating and connecting
 *   to {@link Room}s with other {@link Participant}s.
 * @param {Client.ConstructorOptions} [options] - Options to override the
 *   constructor's default behavior
 * @property {string} token - The current Access Token
 * @property {Map<Room.SID, Room>} rooms - The {@link Room}s this
 *   {@link Client} is participating in
 */
function Client(options) {
  if (!(this instanceof Client)) {
    return new Client(options);
  }

  options = Object.assign({
    environment: constants.DEFAULT_ENVIRONMENT,
    getLocalMedia: LocalMedia.getLocalMedia,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    realm: constants.DEFAULT_REALM,
    signaling: SignalingV2
  }, options);

  var rooms = new Map();
  var logLevels = util.buildLogLevels(options.logLevel);
  var log = new Log('default', this, logLevels);
  options.log = log;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _getLocalMedia: {
      value: options.getLocalMedia
    },
    _iceServerSource: {
      value: null,
      writable: true
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
      value: null,
      writable: true
    },
    _token: {
      value: null,
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

  log.info('Created a new Client');
  log.debug('Options:', options);
}

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
 * @throws {TwilioError}
 * @throws {AccessTokenInvalidError}
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client();
 *
 * client.connect({
 *   token: initialToken,
 *   to: 'my-cool-room'
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 * @example
 * var initialToken = getAccessToken();
 * var client = new Twilio.Video.Client();
 *
 * var localMedia = new Twilio.Video.LocalMedia();
 *
 * // Connect with audio-only
 * localMedia.addMicrophone().then(function() {
 *   return client.connect({
 *     token: initialToken,
 *     localMedia: localMedia,
 *     to: 'my-cool-room'
 *   });
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
  var initialToken = options.token;
  if (typeof initialToken !== 'string') {
    throw new E.INVALID_TYPE('options.accessToken', 'string');
  }

  this._token = initialToken;
  try {
    var accountSid = util.token.getAccountSid(initialToken);
    var identity = util.token.getIdentity(initialToken);
  } catch (e) {
    throw new AccessTokenInvalidError();
  }

  /* eslint new-cap:0 */
  options = Object.assign({
    wsServer: constants.WS_SERVER(this._options.environment,
      this._options.realm,
      accountSid),
    to: null
  }, this._options, options);

  var Signaling = options.signaling;
  this._signaling = new Signaling(options.wsServer, accountSid, identity, options);

  this._iceServerSource = options.iceServers
    ? new ConstantIceServerSource(options.iceServers)
    : new NTSIceServerSource(initialToken, options);

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
    throw new AccessTokenInvalidError();
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
 * @property {string} token - The Access Token string
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

  var iceServerSource = options.iceServers
    ? new ConstantIceServerSource(options.iceServerSource)
    : client._iceServerSource;

  return iceServerSource.start().then(function(iceServers) {
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

module.exports = Client;
