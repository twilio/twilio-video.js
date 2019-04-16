'use strict';

const { guessBrowser } = require('@twilio/webrtc/lib/util');
const CancelablePromise = require('./util/cancelablepromise');
const createCancelableRoomPromise = require('./cancelableroompromise');
const createLocalTracks = require('./createlocaltracks');
const ConstantIceServerSource = require('./iceserversource/constant');
const constants = require('./util/constants');
const Room = require('./room');
const E = require('./util/constants').typeErrors;
const EncodingParametersImpl = require('./encodingparameters');
const LocalAudioTrack = require('./media/track/es5/localaudiotrack');
const LocalDataTrack = require('./media/track/es5/localdatatrack');
const LocalParticipant = require('./localparticipant');
const LocalVideoTrack = require('./media/track/es5/localvideotrack');
const Log = require('./util/log');
const MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
const NTSIceServerSource = require('./iceserversource/nts');
const SignalingV2 = require('./signaling/v2');
const util = require('./util');
const NetworkQualityConfigurationImpl = require('./networkqualityconfiguration');

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
let connectCalls = 0;

let didPrintSafariWarning = false;

/**
 * Connect to a {@link Room}.
 *   <br><br>
 *   By default, this will automatically acquire an array containing a
 *   {@link LocalAudioTrack} and {@link LocalVideoTrack} before connecting to
 *   the {@link Room}. These will be stopped when you disconnect from the
 *   {@link Room}.
 *   <br><br>
 *   You can override the default behavior by specifying
 *   <code>options</code>. For example, rather than acquiring a
 *   {@link LocalAudioTrack} and {@link LocalVideoTrack} automatically, you can
 *   pass your own array which you can stop yourself. See {@link ConnectOptions}
 *   for more information.
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
 * @example
 * var Video = require('twilio-video');
 * var token = getAccessToken();
 *
 * // Connect with custom names for LocalAudioTrack and LocalVideoTrack
 * Video.connect(token, {
 *   name: 'my-cool-room'
 *   audio: { name: 'microphone' },
 *   video: { name: 'camera' }
 * }).then(function(room) {
 *   room.localParticipants.trackPublications.forEach(function(publication) {
 *     console.log('The LocalTrack "' + publication.trackName + '" was successfully published');
 *   });
 * });
 */
function connect(token, options) {
  if (typeof options === 'undefined') {
    options = {};
  }
  if (typeof options !== 'object' || Array.isArray(options)) {
    return CancelablePromise.reject(E.INVALID_TYPE('options', 'object'));
  }

  options = Object.assign({
    abortOnIceServersTimeout: false,
    createLocalTracks,
    environment: constants.DEFAULT_ENVIRONMENT,
    iceServersTimeout: constants.ICE_SERVERS_TIMEOUT_MS,
    insights: true,
    LocalAudioTrack,
    LocalDataTrack,
    LocalParticipant,
    LocalVideoTrack,
    MediaStreamTrack,
    logLevel: constants.DEFAULT_LOG_LEVEL,
    maxAudioBitrate: null,
    maxVideoBitrate: null,
    name: null,
    preferredAudioCodecs: [],
    preferredVideoCodecs: [],
    realm: constants.DEFAULT_REALM,
    signaling: SignalingV2
  }, util.filterObject(options));

  /* eslint new-cap:0 */
  options = Object.assign({
    wsServer: constants.WS_SERVER(options.environment, options.realm)
  }, options);

  const logLevels = util.buildLogLevels(options.logLevel);
  const logComponentName = `[connect #${++connectCalls}]`;

  let log;
  try {
    log = new Log('default', logComponentName, logLevels);
  } catch (error) {
    return CancelablePromise.reject(error);
  }
  options.log = log;

  // NOTE(mroberts): Print the Safari warning once if the log-level is at least
  // "warn", i.e. neither "error" nor "off".
  if (guessBrowser() === 'safari'
    && !didPrintSafariWarning
    && (log.logLevel !== 'error' && log.logLevel !== 'off')) {
    didPrintSafariWarning = true;
    log.warn([
      'This release of twilio-video.js includes experimental support for',
      'Safari 11 and newer. Support for Safari is "experimental" because,',
      'at the time of writing, Safari does not support VP8. This means you',
      'may experience codec issues in Group Rooms. You may also experience',
      'codec issues in Peer-to-Peer (P2P) Rooms containing Android- or',
      'iOS-based Participants who do not support H.264. However, P2P Rooms',
      'with browser-based Participants should work. Please test this release',
      'and report any issues to https://github.com/twilio/twilio-video.js'
    ].join(' '));
  }

  if (typeof token !== 'string') {
    return CancelablePromise.reject(E.INVALID_TYPE('token', 'string'));
  }

  // NOTE(mmalavalli): The Room "name" in "options" was being used
  // as the LocalTrack name in asLocalTrack(). So we pass a copy of
  // "options" without the "name".
  const localTrackOptions = Object.assign({}, options);
  delete localTrackOptions.name;

  if ('tracks' in options) {
    if (!Array.isArray(options.tracks)) {
      return CancelablePromise.reject(E.INVALID_TYPE('options.tracks',
        'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack'));
    }
    try {
      options.tracks = options.tracks.map(track => util.asLocalTrack(track, localTrackOptions));
    } catch (error) {
      return CancelablePromise.reject(error);
    }
  }

  const Signaling = options.signaling;
  const signaling = new Signaling(options.wsServer, options);

  log.info('Connecting to a Room');
  log.debug('Options:', options);

  const encodingParameters = new EncodingParametersImpl({
    maxAudioBitrate: options.maxAudioBitrate,
    maxVideoBitrate: options.maxVideoBitrate
  });

  const ntsIceServerSourceOptions = Object.assign({}, options, {
    abortOnTimeout: options.abortOnIceServersTimeout,
    timeout: options.iceServersTimeout
  });

  const iceServerSource = Array.isArray(options.iceServers)
    ? new ConstantIceServerSource(options.iceServers)
    : typeof options.iceServers === 'object'
      ? options.iceServers
      : new NTSIceServerSource(token, ntsIceServerSourceOptions);

  const preferredCodecs = {
    audio: options.preferredAudioCodecs,
    video: options.preferredVideoCodecs.map(normalizeVideoCodecSettings)
  };

  const networkQualityConfiguration = new NetworkQualityConfigurationImpl(
    typeof options.networkQuality === 'object' ? options.networkQuality : {}
  );

  // Create a CancelableRoomPromise<Room> that resolves after these steps:
  // 1 - Get the LocalTracks.
  // 2 - Create the LocalParticipant using options.tracks.
  // 3 - Connect to rtc-room-service and create the RoomSignaling.
  // 4 - Create the Room and then resolve the CancelablePromise.
  const cancelableRoomPromise = createCancelableRoomPromise(
    getLocalTracks.bind(null, options),
    createLocalParticipant.bind(null, signaling, log, encodingParameters, networkQualityConfiguration, options),
    createRoomSignaling.bind(null, token, options, signaling, iceServerSource, encodingParameters, preferredCodecs),
    createRoom.bind(null, options));

  cancelableRoomPromise.then(room => {
    log.info('Connected to Room:', room.toString());
    log.info('Room name:', room.name);
    log.debug('Room:', room);
    return room;
  }, error => {
    if (iceServerSource.isStarted) {
      iceServerSource.stop();
    }
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
 * @property {boolean} [abortOnIceServersTimeout=false] - If fetching ICE
 *   servers times out (for example, due to a restrictive network or slow HTTP
 *   proxy), then, by default, twilio-video.js will fallback to using hard-coded
 *   STUN servers and continue connecting to the Room. Setting this property to
 *   <code>true</code> will cause twilio-video.js to abort instead, and
 *   {@link connect} will reject with a {@link ConfigurationAcquireFailedError}.
 * @property {boolean|CreateLocalTrackOptions} [audio=true] - Whether or not to
 *   get local audio with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 * @property {boolean} [dominantSpeaker=false] - Whether to enable the Dominant
 *   Speaker API or not. This only takes effect in Group Rooms.
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used when connecting to {@link Room}s
 * @property {number} [iceServersTimeout=3000] - Override the amount of time, in
 *   milliseconds, that the SDK will wait when acquiring STUN and TURN servers
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 *   ICE transport policy to be one of "relay" or "all"
 * @property {boolean} [insights=true] - Whether publishing events
 *   to the Insights gateway is enabled or not
 * @property {?number} [maxAudioBitrate=null] - Max outgoing audio bitrate (bps);
 *   A <code>null</code> value does not set any bitrate limit; This value is set
 *   as a hint for variable bitrate codecs, but will not take effect for fixed
 *   bitrate codecs
 * @property {?number} [maxVideoBitrate=null] - Max outgoing video bitrate (bps);
 *   A <code>null</code> value does not set any bitrate limit; This value is set
 *   as a hint for variable bitrate codecs, but will not take effect for fixed
 *   bitrate codecs
 * @property {?string} [name=null] - Set to connect to a {@link Room} by name
 * @property {boolean|NetworkQualityConfiguration} [networkQuality=false] - Whether to enable the Network
 *   Quality API or not. This only takes effect in Group Rooms. Pass a {@link NetworkQualityConfiguration}
 *   to configure verbosity levels for network quality information for {@link LocalParticipant}
 *   and {@link RemoteParticipant}s.
 * @property {Array<AudioCodec>} [preferredAudioCodecs=[]] - Preferred audio codecs;
 *  An empty array preserves the current audio codec preference order.
 * @property {Array<VideoCodec|VideoCodecSettings>} [preferredVideoCodecs=[]] -
 *  Preferred video codecs; An empty array preserves the current video codec
 *  preference order. If you want to set a preferred video codec on a Group Room,
 *  you will need to create the Room using the REST API and set the
 *  <code>VideoCodecs</code> property.
 *  See <a href="https://www.twilio.com/docs/api/video/rooms-resource#create-room">
 *  here</a> for more information.
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {Array<LocalTrack|MediaStreamTrack>} [tracks] - The
 *   {@link LocalTrack}s or MediaStreamTracks with which to join the
 *   {@link Room}. These tracks can be obtained either by calling
 *   {@link createLocalTracks}, or by constructing them from the MediaStream
 *   obtained by calling <code>getUserMedia()</code>.
 * @property {boolean|CreateLocalTrackOptions} [video=true] - Whether or not to
 *   get local video with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 */

/**
 * Configure verbosity levels for network quality information for
 * {@link LocalParticipant} and {@link RemoteParticipant}s.
 * @typedef {object} NetworkQualityConfiguration
 * @property {NetworkQualityVerbosity} [local=1] - Verbosity level for {@link LocalParticipant}
 * @property {NetworkQualityVerbosity} [remote=0] - Verbosity level for {@link RemoteParticipant}s
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
 * Video codec settings.
 * @typedef {object} VideoCodecSettings
 * @property {VideoCodec} codec - Video codec name
 */

/**
 * VP8 codec settings.
 * @typedef {VideoCodecSettings} VP8CodecSettings
 * @property {VideoCodec} name - "VP8"
 * @property {boolean} [simulcast=false] - Enable/disable VP8 simulcast; if
 *   enabled, Twilio's Video SDK will send three video streams of different
 *   qualities
 */

/**
 * Names of the supported audio codecs.
 * @enum {string}
 */
// eslint-disable-next-line
const AudioCodec = {
  isac: 'isac',
  opus: 'opus',
  PCMA: 'PCMA',
  PCMU: 'PCMU'
};

/**
 * Names of the supported video codecs.
 * @enum {string}
 */
// eslint-disable-next-line
const VideoCodec = {
  H264: 'H264',
  VP8: 'VP8',
  VP9: 'VP9'
};

/**
 * Levels for logging verbosity.
 * @enum {string}
 */
// eslint-disable-next-line
const LogLevel = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  off: 'off'
};

/**
 * Specifies verbosity of network quality information.
 * @enum {number}
 */

// eslint-disable-next-line
const NetworkQualityVerbosity = {
  /**
   * No network quality scores are reported for the participant.
   * This has no effect and defaults to 1 for {@link LocalParticipant}.
   */
  none: 0,
  /**
   * Reports {@link NetworkQualityLevel} for the participant.
   */
  minimal: 1,
  /**
   * Reports {@link NetworkQualityLevel} and {@link NetworkQualityStats} for the participant.
   * {@link NetworkQualityStats} object is populated with Audio and Video level based on which
   * the participant's {@link NetworkQualityLevel} is calculated.
   */
  moderate: 2,
  /**
   * Reports {@link NetworkQualityLevel} and {@link NetworkQualityStats} for the participant.
   * {@link NetworkQualityStats} object is populated with Audio and Video level and corresponding stats
   * based on which the participant's {@link NetworkQualityLevel} is calculated.
   */
  detailed: 3
};

function createLocalParticipant(signaling, log, encodingParameters, networkQualityConfiguration, options, localTracks) {
  const localParticipantSignaling = signaling.createLocalParticipantSignaling(encodingParameters, networkQualityConfiguration);
  log.debug('Creating a new LocalParticipant:', localParticipantSignaling);
  return new options.LocalParticipant(localParticipantSignaling, localTracks, options);
}

function createRoom(options, localParticipant, roomSignaling) {
  const room = new Room(localParticipant, roomSignaling, options);
  const log = options.log;

  log.debug('Creating a new Room:', room);
  roomSignaling.on('stateChanged', function stateChanged() {
    log.info('Disconnected from Room:', room.toString());
    roomSignaling.removeListener('stateChanged', stateChanged);
  });

  return room;
}

function createRoomSignaling(token, options, signaling, iceServerSource, encodingParameters, preferredCodecs, localParticipant) {
  const log = options.log;
  log.info('Getting ICE servers');
  log.debug('Options:', options);

  return iceServerSource.start().then(iceServers => {
    const roomSignalingParams = {
      token
    };

    log.info('Got ICE servers');
    log.debug('ICE servers:', iceServers);

    options.iceServers = iceServers;
    log.debug('Creating a new RoomSignaling');
    log.debug('RoomSignaling params:', roomSignalingParams);

    return signaling.connect(
      localParticipant._signaling,
      token,
      iceServerSource,
      encodingParameters,
      preferredCodecs,
      options);
  });
}

function getLocalTracks(options, handleLocalTracks) {
  const log = options.log;

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
    const promise = handleLocalTracks(localTracks);

    promise.catch(function handleLocalTracksFailed() {
      if (options.shouldStopLocalTracks) {
        log.info('The automatically acquired LocalTracks will now be stopped');
        localTracks.forEach(track => {
          track.stop();
        });
      }
    });

    return promise;
  });
}

function normalizeVideoCodecSettings(nameOrSettings) {
  const settings = typeof nameOrSettings === 'string'
    ? { codec: nameOrSettings }
    : nameOrSettings;
  switch (settings.codec.toLowerCase()) {
    case 'vp8': {
      return Object.assign({ simulcast: false }, settings);
    }
    default: {
      return settings;
    }
  }
}

module.exports = connect;
