'use strict';

var createCancelableRoomPromise = require('./cancelableroompromise');
var createLocalTracks = require('./createlocaltracks');
var ConstantIceServerSource = require('./iceserversource/constant');
var constants = require('./util/constants');
var Room = require('./room');
var E = require('./util/constants').typeErrors;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalParticipant = require('./localparticipant');
var LocalVideoTrack = require('./media/track/localvideotrack');
var Log = require('./util/log');
var MediaStreamTrack = require('./webrtc/mediastreamtrack');
var NTSIceServerSource = require('./iceserversource/nts');
var SignalingV2 = require('./signaling/v2');
var util = require('./util');

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
var connectCalls = 0;

/**
 * Connect to a {@link Room}.
 *   <br><br>
 *   By default, this will automatically acquire an array containing a
 *   {@link LocalAudioTrack} and {@link LocalVideoTrack} before connecting to
 *   the {@link Room}. The {@link LocalTrack}s will be stopped when you
 *   disconnect from the {@link Room}.
 *   <br><br>
 *   You can override the default behavior by specifying
 *   <code>options</code>. For example, rather than acquiring {@link LocalTrack}s
 *   automatically, you can pass your own array which you can stop yourself.
 *   See {@link ConnectOptions} for more information.
 * @param {string} token - The Access Token string
 * @param {ConnectOptions} [options] - Options to override the default behavior
 * @returns {CancelablePromise<Room>}
 * @throws {RangeError}
 * @throws {TwilioError}
 * @throws {TypeError}
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 * Video.connect(token, {
 *   name: 'my-cool-room'
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });

 *   room.once('disconnected', function() {
 *     console.log('You left the Room:', room.name);
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 *
 * // Connect with audio-only
 * Video.connect(token, {
 *   name: 'my-cool-room',
 *   audio: true
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 *
 *   room.once('disconnected', function() {
 *     console.log('You left the Room:', room.name);
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 *
 * // Connect with media acquired using getUserMedia()
 * navigator.mediaDevices.getUserMedia({
 *   audio: true,
 *   video: true
 * }).then(function(mediaStream) {
 *   return Video.connect(token, {
 *     name: 'my-cool-room',
 *     tracks: mediaStream.getTracks()
 *   });
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
 *   });
 *
 *   room.once('disconnected', function() {
 *     console.log('You left the Room:', room.name);
 *   });
 * });
 */
function connect(token, options) {
  options = Object.assign({
    createLocalTracks: createLocalTracks,
    environment: constants.DEFAULT_ENVIRONMENT,
    LocalAudioTrack: LocalAudioTrack,
    LocalParticipant: LocalParticipant,
    LocalVideoTrack: LocalVideoTrack,
    MediaStreamTrack: MediaStreamTrack,
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
  var logComponentName = '[connect #' + ++connectCalls + ']';
  try {
    var log = new Log('default', logComponentName, logLevels);
  } catch (error) {
    return Promise.reject(error);
  }
  options.log = log;

  if (typeof token !== 'string') {
    return Promise.reject(new E.INVALID_TYPE('token', 'string'));
  }

  if ('tracks' in options) {
    if (!Array.isArray(options.tracks)) {
      return Promise.reject(new E.INVALID_TYPE('options.tracks',
        'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack'));
    }
    try {
      options.tracks = options.tracks.map(function(track) {
        return util.asLocalTrack(track, options);
      });
    } catch (error) {
      return Promise.reject(error);
    }
  }

  var Signaling = options.signaling;
  var signaling = new Signaling(options.wsServer, options);

  log.info('Connecting to a Room');
  log.debug('Options:', options);

  // Create a CancelableRoomPromise<Room> that resolves after these steps:
  // 1 - Get the LocalTracks.
  // 2 - Create the LocalParticipant using options.tracks.
  // 3 - Connect to rtc-room-service and create the RoomSignaling.
  // 4 - Create the Room and then resolve the CancelablePromise.
  var cancelableRoomPromise = createCancelableRoomPromise(
    getLocalTracks.bind(null, options),
    createLocalParticipant.bind(null, signaling, log, options),
    createRoomSignaling.bind(null, token, options, signaling),
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
 * @property {boolean} [audio=true] - Whether or not to get local audio
 *    with <code>getUserMedia</code> when <code>tracks</code> are not
 *    provided.
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used by the {@link Client} when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 *   ICE transport policy to be one of "relay" or "all"
 * @property {?string} [name=null] - Set to connect to a {@link Room} by name
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {Array<LocalTrack|MediaStreamTrack>} [tracks] - The
 *   {@link LocalTrack}s or MediaStreamTracks with which to join the
 *   {@link Room}. These tracks can be obtained either by calling
 *   {@link createLocalTracks}, or by constructing them from the MediaStream
 *   obtained by calling <code>getUserMedia()</code>.
 * @property {boolean} [video=true] - Whether or not to get local video
 *    with <code>getUserMedia</code> when <code>tracks</code> are not
 *    provided.
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

function createLocalParticipant(signaling, log, options, localTracks) {
  var localParticipantSignaling = signaling.createLocalParticipantSignaling();
  log.debug('Creating a new LocalParticipant:', localParticipantSignaling);
  return new options.LocalParticipant(localParticipantSignaling, localTracks, options);
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

function createRoomSignaling(token, options, signaling, localParticipant) {
  var log = options.log;
  log.info('Getting ICE servers');
  log.debug('Options:', options);

  var iceServerSource = options.iceServers
    ? new ConstantIceServerSource(options.iceServers)
    : new NTSIceServerSource(token, options);

  return iceServerSource.start().then(function(iceServers) {
    var roomSignalingParams = {
      token: token
    };

    log.info('Got ICE servers');
    log.debug('ICE servers:', iceServers);

    options.iceServers = iceServers;
    log.debug('Creating a new RoomSignaling');
    log.debug('RoomSignaling params:', roomSignalingParams);

    return signaling.connect(
      localParticipant._signaling,
      token,
      options);
  });
}

function getLocalTracks(options, handleLocalTracks) {
  var log = options.log;

  options.shouldStopLocalTracks = !options.tracks;
  if (options.shouldStopLocalTracks) {
    log.info('LocalTracks were not provided, so they will be acquired '
      + 'automatically before connecting to the Room. LocalTracks will '
      + 'be released if connecting to the Room fails or if the Room '
      + 'is disconnected');
  } else {
    log.info('Getting LocalTracks');
    log.debug('Options:', options);
  }

  return options.createLocalTracks(options).then(function getLocalTracksSucceeded(localTracks) {
    var promise = handleLocalTracks(localTracks);

    promise.catch(function handleLocalTracksFailed() {
      if (options.shouldStopLocalTracks) {
        log.info('The automatically acquired LocalTracks will now be stopped');
        localTracks.forEach(function(track) {
          track.stop();
        });
      }
    });

    return promise;
  });
}

module.exports = connect;
