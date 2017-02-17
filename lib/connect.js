'use strict';

var createCancelableRoomPromise = require('./cancelableroompromise');
var ConstantIceServerSource = require('./iceserversource/constant');
var constants = require('./util/constants');
var Room = require('./room');
var E = require('./util/constants').typeErrors;
var LocalMedia = require('./media/localmedia');
var LocalParticipant = require('./localparticipant');
var Log = require('./util/log');
var NTSIceServerSource = require('./iceserversource/nts');
var SignalingV2 = require('./signaling/v2');
var util = require('./util');

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
var connectCalls = 0;

/**
 * Connect to a {@link Room}.
 *   <br><br>
 *   By default, this will automatically acquire {@link LocalMedia} containing a
 *   {@link LocalAudioTrack} and {@link LocalVideoTrack} before connecting to
 *   the {@link Room}. The {@link LocalMedia} will be stopped when you
 *   disconnect from the {@link Room}.
 *   <br><br>
 *   You can override the default behavior by specifying
 *   <code>options</code>. For example, rather than acquiring {@link LocalMedia}
 *   automatically, you can pass your own instance which you can stop yourself.
 *   See {@link ConnectOptions} for more information.
 * @param {ConnectOptions} [options={audio:true,video:true}] - Options to override the default behavior
 * @returns {CancelablePromise<Room>}
 * @throws {TwilioError}
 * @throws {RangeError}
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 *
 * Video.connect({
 *   token: token,
 *   name: 'my-cool-room'
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 * var localMedia = new Twilio.Video.LocalMedia();
 *
 * // Connect with audio-only
 * localMedia.addMicrophone().then(function() {
 *   return Video.connect({
 *     token: token,
 *     localMedia: localMedia,
 *     name: 'my-cool-room'
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
function connect(options) {
  options = Object.assign({
    environment: constants.DEFAULT_ENVIRONMENT,
    getLocalMedia: LocalMedia.getLocalMedia,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    name: null,
    realm: constants.DEFAULT_REALM,
    signaling: SignalingV2
  }, options);

  /* eslint new-cap:0 */
  options = Object.assign({
    wsServer: constants.WS_SERVER(options.environment, options.realm)
  }, options);

  var logLevels = util.buildLogLevels(options.logLevel);
  var logComponentName = '[connect #' + connectCalls++ + ']';
  try {
    var log = new Log('default', logComponentName, logLevels);
  } catch (error) {
    return Promise.reject(error);
  }
  options.log = log;

  var token = options.token;
  if (typeof token !== 'string') {
    return Promise.reject(new E.INVALID_TYPE('options.token', 'string'));
  }

  var Signaling = options.signaling;
  var signaling = new Signaling(options.wsServer, options);

  log.info('Connecting to a Room');
  log.debug('Options:', options);

  // Create a CancelableRoomPromise<Room> that resolves after these steps:
  // 1 - Get the local media to join the Room with.
  // 2 - Create the LocalParticipant.
  // 3 - Connect to rtc-room-service and create the RoomSignaling.
  // 4 - Create the Room and then resolve the CancelablePromise.
  var cancelableRoomPromise = createCancelableRoomPromise(
    getLocalMedia.bind(null, options),
    createLocalParticipant.bind(null, signaling, log),
    createRoomSignaling.bind(null, options, signaling),
    createRoom.bind(null, options));

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
}

/**
 * You may pass these options to {@link connect} in order to override the
 * default behavior.
 * @typedef {object} ConnectOptions
 * @property {string} token - The Access Token string
 * @property {?boolean} [audio=true] - Whether or not to get local audio
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 *   ICE transport policy to be one of "relay" or "all"
 * @property {?LocalMedia} [localMedia=null] - Set to reuse an existing
 *   {@link LocalMedia} object when creating the {@link Room}
 * @property {?MediaStream} [localStream=null] - Set to reuse an existing
 *   <code>MediaStream</code> when creating the {@link Room}
 * @property {?string} [name=null] - Set to connect to a {@link Room} by name
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {?boolean} [video=true] - Whether or not to get local video
 *   with <code>getUserMedia</code> when neither <code>localMedia</code>
 *   nor <code>localStream</code> are provided
 */

/**
 * You may pass these levels to {@link ConnectOptions} to override
 *   log levels for individual components.
 * @typedef {object} LogLevels
 * @property {LogLevel} [default='warn'] - Log level for 'default' modules.
 * @property {LogLevel} [media='warn'] - Log level for 'media' modules.
 * @property {LogLevel} [signaling='warn'] - Log level for 'signaling' modules.
 * @property {LogLevel} [webrtc='warn'] - Log level for 'webrtc' modules.
 */

/**
 * Levels for logging verbosity.
 * @typedef {String} LogLevel - One of ['debug', 'info', 'warn', 'error', 'off']
 */

function createLocalParticipant(signaling, log, localMedia) {
  var localParticipantSignaling = signaling.createLocalParticipantSignaling();
  log.debug('Creating a new LocalParticipant:', localParticipantSignaling);
  return new LocalParticipant(localParticipantSignaling, localMedia, { log: log });
}

function createRoom(options, localParticipant, roomSignaling) {
  var room = new Room(localParticipant, roomSignaling, options);
  var log = options.log;

  log.debug('Creating a new Room:', room);
  roomSignaling.on('stateChanged', function stateChanged() {
    log.info('Disconnected from Room:', room.toString());
    roomSignaling.removeListener('stateChanged', stateChanged);
  });

  return room;
}

function createRoomSignaling(options, signaling, localParticipant) {
  var log = options.log;
  log.info('Getting ICE servers');
  log.debug('Options:', options);

  var iceServerSource = options.iceServers
    ? new ConstantIceServerSource(options.iceServers)
    : new NTSIceServerSource(options.token, options);

  return iceServerSource.start().then(function(iceServers) {
    var roomSignalingParams = {
      token: options.token
    };

    log.info('Got ICE servers');
    log.debug('ICE servers:', iceServers);

    options.iceServers = iceServers;
    log.debug('Creating a new RoomSignaling');
    log.debug('RoomSignaling params:', roomSignalingParams);

    return signaling.connect(
      localParticipant._signaling,
      roomSignalingParams.token,
      options);
  });
}

function getLocalMedia(options, handleLocalMedia) {
  var log = options.log;

  options.shouldStopLocalMedia = !options.localMedia && !options.localStream;
  if (options.shouldStopLocalMedia) {
    log.info('LocalMedia was not provided, so it will be acquired '
      + 'automatically before connecting to the Room. LocalMedia will '
      + 'be released if connecting to the Room fails or if the Room '
      + 'is disconnected');
  } else {
    log.info('Getting LocalMedia');
    log.debug('Options:', options);
  }

  return options.getLocalMedia(options).then(function getLocalMediaSucceeded(localMedia) {
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

module.exports = connect;
