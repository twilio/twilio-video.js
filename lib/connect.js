'use strict';

const { MediaStreamTrack } = require('@twilio/webrtc');
const { guessBrowser, guessBrowserVersion } = require('@twilio/webrtc/lib/util');
const createCancelableRoomPromise = require('./cancelableroompromise');
const createLocalTracks = require('./createlocaltracks');
const EncodingParametersImpl = require('./encodingparameters');
const ConstantIceServerSource = require('./iceserversource/constant');
const NTSIceServerSource = require('./iceserversource/nts');
const LocalParticipant = require('./localparticipant');

const {
  LocalAudioTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('./media/track/es5');

const NetworkQualityConfigurationImpl = require('./networkqualityconfiguration');
const Room = require('./room');
const SignalingV2 = require('./signaling/v2');

const {
  asLocalTrack,
  buildLogLevels,
  filterObject,
  isNonArrayObject
} = require('./util');

const {
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOG_LEVEL,
  DEFAULT_REALM,
  DEFAULT_REGION,
  ICE_SERVERS_TIMEOUT_MS,
  WS_SERVER,
  typeErrors: E
} = require('./util/constants');

const CancelablePromise = require('./util/cancelablepromise');
const Log = require('./util/log');
const { validateBandwidthProfile } = require('./util/validate');

const safariVersion = guessBrowser() === 'safari' && guessBrowserVersion();

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
let connectCalls = 0;

let didPrintSafariWarning = false;
let didPrintDscpTaggingWarning = false;
let isSafariWithoutVP8Support = false;

if (safariVersion) {
  const { major: safariMajorVersion, minor: safariMinorVersion } = safariVersion;
  isSafariWithoutVP8Support = safariMajorVersion < 12 || (safariMajorVersion === 12 && safariMinorVersion < 1);
}

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
 * @alias module:twilio-video.connect
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
 * }).catch(error => {
 *   console.log('Could not connect to the Room:', error.message);
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
 * }).catch(error => {
 *   console.log('Could not connect to the Room:', error.message);
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
 * }).catch(error => {
 *   console.log('Could not connect to the Room:', error.message);
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
 * }).catch(error => {
 *   console.log('Could not connect to the Room:', error.message);
 * });
 */
function connect(token, options) {
  if (typeof options === 'undefined') {
    options = {};
  }
  if (!isNonArrayObject(options)) {
    return CancelablePromise.reject(E.INVALID_TYPE('options', 'object'));
  }

  let shouldPrintDscpTaggingWarning = false;
  if ('dscpTagging' in options) {
    options = Object.assign({
      enableDscp: options.dscpTagging
    }, options);
    delete options.dscpTagging;
    shouldPrintDscpTaggingWarning = !didPrintDscpTaggingWarning;
  }

  options = Object.assign({
    abortOnIceServersTimeout: false,
    automaticSubscription: true,
    createLocalTracks,
    dominantSpeaker: false,
    enableDscp: false,
    environment: DEFAULT_ENVIRONMENT,
    iceServersTimeout: ICE_SERVERS_TIMEOUT_MS,
    insights: true,
    LocalAudioTrack,
    LocalDataTrack,
    LocalParticipant,
    LocalVideoTrack,
    Log,
    MediaStreamTrack,
    logLevel: DEFAULT_LOG_LEVEL,
    maxAudioBitrate: null,
    maxVideoBitrate: null,
    name: null,
    networkQuality: false,
    preferredAudioCodecs: [],
    preferredVideoCodecs: [],
    realm: DEFAULT_REALM,
    region: DEFAULT_REGION,
    signaling: SignalingV2
  }, filterObject(options));

  /* eslint new-cap:0 */
  const wsServer = WS_SERVER(options.environment, options.region);

  options = Object.assign({ wsServer }, options);

  const logLevels = buildLogLevels(options.logLevel);
  const logComponentName = `[connect #${++connectCalls}]`;

  let log;
  try {
    log = new options.Log('default', logComponentName, logLevels);
  } catch (error) {
    return CancelablePromise.reject(error);
  }
  options.log = log;

  // NOTE(mmalavalli): Print the "dscpTagging" deprecation warning once if the log-level
  // is at least "warn", i.e. neither "error" nor "off".
  if (shouldPrintDscpTaggingWarning && log.level !== 'error' && log.level !== 'off') {
    didPrintDscpTaggingWarning = true;
    log.warn([
      'The ConnectOptions flag "dscpTagging" is deprecated and scheduled for removal.',
      'Please use "enableDscp" instead.'
    ].join(' '));
  }

  // NOTE(mroberts): Print the Safari warning once if the log-level is at least
  // "warn", i.e. neither "error" nor "off".
  // NOTE(mmalavalli): Print the Safari warning only for versions 12.0 and below.
  if (isSafariWithoutVP8Support
    && !didPrintSafariWarning
    && (log.logLevel !== 'error' && log.logLevel !== 'off')) {
    didPrintSafariWarning = true;
    log.warn([
      'Support for Safari 12.0 and below is limited because it does not support VP8.',
      'This means you may experience codec issues in Group Rooms. You may also',
      'experience codec issues in Peer-to-Peer (P2P) Rooms containing Android- or',
      'iOS-based Participants who do not support H.264. However, P2P Rooms',
      'with browser-based Participants should work. For more information, please',
      'refer to this guide: https://www.twilio.com/docs/video/javascript-v2-developing-safari-11'
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
      options.tracks = options.tracks.map(track => asLocalTrack(track, localTrackOptions));
    } catch (error) {
      return CancelablePromise.reject(error);
    }
  }

  const error = validateBandwidthProfile(options.bandwidthProfile);
  if (error) {
    return CancelablePromise.reject(error);
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
    isNonArrayObject(options.networkQuality) ? options.networkQuality : {}
  );

  // Convert options.networkQuality to boolean to configure Media Signaling
  options.networkQuality = isNonArrayObject(options.networkQuality) || options.networkQuality;

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
 * @property {boolean} [automaticSubscription=true] - By default, you will subscribe
 *   to all RemoteTracks shared by other Participants in a Room. You can now override this
 *   behavior by setting this flag to <code>false</code>. It will make sure that you will
 *   not subscribe to any RemoteTrack in a Group or Small Group Room. Setting it to
 *   <code>true</code>, or not setting it at all preserves the default behavior. This
 *   flag does not have any effect in a Peer-to-Peer Room.
 * @property {BandwidthProfileOptions} [bandwidthProfile] - You can optionally configure
 *   how your available downlink bandwidth is shared among the RemoteTracks you have subscribed
 *   to in a Group Room. By default, bandwidth is shared equally among the RemoteTracks.
 *   This has no effect in Peer-to-Peer Rooms.
 * @property {boolean} [dominantSpeaker=false] - Whether to enable the Dominant
 *   Speaker API or not. This only takes effect in Group Rooms.
 * @property {boolean} [dscpTagging=false] - <code>(deprecated: use "enableDscp" instead)</code>
 *   DSCP tagging allows you to request enhanced QoS treatment for RTP media packets from any
 *   firewall that the client may be behind. Setting this option to <code>true</code> will
 *   request DSCP tagging for media packets on supported browsers (only Chrome supports this
 *   as of now). Audio packets will be sent with DSCP header value set to 0xb8 which corresponds
 *   to Expedited Forwarding (EF). Video packets will be sent with DSCP header value set to 0x88
 *   which corresponds to Assured Forwarding (AF41).
 * @property {boolean} [enableDscp=false] - DSCP tagging allows you to request enhanced
 *   QoS treatment for RTP media packets from any firewall that the client may be behind.
 *   Setting this option to <code>true</code> will request DSCP tagging for media packets
 *   on supported browsers (only Chrome supports this as of now). Audio packets will be
 *   sent with DSCP header value set to 0xb8 which corresponds to Expedited Forwarding (EF).
 *   Video packets will be sent with DSCP header value set to 0x88 which corresponds to
 *   Assured Forwarding (AF41).
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used when connecting to {@link Room}s
 * @property {number} [iceServersTimeout=3000] - Override the amount of time, in
 *   milliseconds, that the SDK will wait when acquiring STUN and TURN servers
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 *   ICE transport policy to be one of "relay" or "all"
 * @property {boolean} [insights=true] - Whether publishing events
 *   to the Insights gateway is enabled or not
 * @property {?number} [maxAudioBitrate=null] - Max outgoing audio bitrate (bps);
 *   A <code>null</code> or a <code>0</code> value does not set any bitrate limit;
 *   This value is set as a hint for variable bitrate codecs, but will not take
 *   effect for fixed bitrate codecs; Based on our tests, Chrome, Firefox and Safari
 *   support a bitrate range of 12000 bps to 256000 bps for Opus codec; This parameter
 *   has no effect on iSAC, PCMU and PCMA codecs
 * @property {?number} [maxVideoBitrate=null] - Max outgoing video bitrate (bps);
 *   A <code>null</code> or <code>0</code> value does not set any bitrate limit;
 *   This value is set as a hint for variable bitrate codecs, but will not take
 *   effect for fixed bitrate codecs; Based on our tests, Chrome, Firefox and Safari
 *   all seem to support an average bitrate range of 20000 bps (20 kbps) to
 *   8000000 bps (8 mbps) for a 720p VideoTrack
 * @property {?string} [name=null] - Set to connect to a {@link Room} by name
 * @property {boolean|NetworkQualityConfiguration} [networkQuality=false] - Whether to enable the Network
 *   Quality API or not. This only takes effect in Group Rooms. Pass a {@link NetworkQualityConfiguration}
 *   to configure verbosity levels for network quality information for {@link LocalParticipant}
 *   and {@link RemoteParticipant}s. A <code>true</code> value will set the {@link NetworkQualityVerbosity}
 *   for the {@link LocalParticipant} to {@link NetworkQualityVerbosity}<code style="padding:0 0">#minimal</code>
 *   and the {@link NetworkQualityVerbosity} for {@link RemoteParticipant}s to
 *   {@link NetworkQualityVerbosity}<code style="padding:0 0">#none</code>.
 * @property {string} [region='gll'] - Preferred signaling region; By default, you will be connected to the
 *   nearest signaling server determined by latency based routing. Setting a value other
 *   than <code style="padding:0 0">gll</code> bypasses routing and guarantees that signaling traffic will be
 *   terminated in the region that you prefer. Please refer to this <a href="https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication" target="_blank">table</a>
 *   for the list of supported signaling regions.
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
 * {@link BandwidthProfileOptions} allows you to configure how your available downlink
 * bandwidth is shared among the RemoteTracks you have subscribed to in a Group Room.
 * @typedef {object} BandwidthProfileOptions
 * @property {VideoBandwidthProfileOptions} [video] - Optional parameter to configure
 *   how your available downlink bandwidth is shared among the {@link RemoteVideoTrack}s you
 *   have subscribed to in a Group Room.
 */

/**
 * {@link VideoBandwidthProfileOptions} allows you to configure how your available downlink
 * bandwidth is shared among the {@link RemoteVideoTrack}s you have subscribed to in a Group Room.
 * @typedef {object} VideoBandwidthProfileOptions
 * @property {Track.Priority} [dominantSpeakerPriority="standard"] - Optional parameter to
 *   specify the minimum subscribe {@link Track.Priority} of the Dominant Speaker's {@link RemoteVideoTrack}s.
 *   This means that the Dominant Speaker's {@link RemoteVideoTrack}s that are published with
 *   lower {@link Track.Priority} will be subscribed to with the {@link Track.Priority} specified here.
 *   This has no effect on {@link RemoteVideoTrack}s published with higher {@link Track.Priority}, which will
 *   still be subscribed to with with the same {@link Track.Priority}. If not specified, this defaults to "standard".
 * @property {number} [maxSubscriptionBitrate] - Optional parameter to specify the maximum
 *   downlink video bandwidth in bits per second (bps). By default, there are no limits on
 *   the downlink video bandwidth.
 * @property {number} [maxTracks] - Optional parameter to specify the maximum number of visible
 *   {@link RemoteVideoTrack}s, which will be selected based on {@link Track.Priority} and an N-Loudest
 *   policy. By default there are no limits on the number of visible {@link RemoteVideoTrack}s.
 *   0 or a negative value will remove any limit on the maximum number of visible {@link RemoteVideoTrack}s.
 * @property {BandwidthProfileMode} [mode="grid"] - Optional parameter to specify how the {@link RemoteVideoTrack}s'
 *   TrackPriority values are mapped to bandwidth allocation in Group Rooms. This defaults to "grid",
 *   which results in equal bandwidth share allocation to all {@link RemoteVideoTrack}s.
 * @property {VideoRenderDimensions} [renderDimensions] - Optional parameter to specify the desired
 *   render dimensions of {@link RemoteVideoTrack}s based on {@link Track.Priority} and the
 *   {@link RemoteVideoTrack}s of the Dominant Speaker.
 * @property {TrackSwitchOffMode} [trackSwitchOffMode="predicted"] - Optional parameter to configure
 *   how {@link RemoteVideoTrack}s are switched off in response to bandwidth pressure. Defaults to "predicted".
 */

/**
 * {@link VideoRenderDimensions} allows you to specify the desired render dimensions of {@link RemoteVideoTrack}s
 * based on {@link Track.Priority}. The bandwidth allocation algorithm will distribute the available downlink bandwidth
 * proportional to the requested render dimensions. This is just an input for calculating the bandwidth to be allocated
 * and does not affect the actual resolution of the {@link RemoteVideoTrack}s.
 * @typedef {object} VideoRenderDimensions
 * @property {VideoTrack.Dimensions} [high] - Optional parameter to specify the desired rendering dimensions of
 *   {@link RemoteVideoTrack} whose {@link Track.Priority} is "high". 0 or a negative value will result in the lowest
 *   possible resolution. This defaults to 1280 x 720 (HD).
 * @property {VideoTrack.Dimensions} [low] - Optional parameter to specify the desired rendering dimensions of
 *   {@link RemoteVideoTrack} whose {@link Track.Priority} is "low". 0 or a negative value will result in the lowest
 *   possible resolution. This defaults to 176 x 144 (QCIF).
 * @property {VideoTrack.Dimensions} [standard] - Optional parameter to specify the desired rendering dimensions of
 *   {@link RemoteVideoTrack} whose {@link Track.Priority} is "standard". 0 or a negative value will result in the lowest
 *   possible resolution. This defaults to 640 x 480 (VGA).
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
 * log levels for individual components.
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
 * The verbosity level of network quality information of a {@link Participant}.
 * @enum {number}
 */
// eslint-disable-next-line
const NetworkQualityVerbosity = {
  /**
   * Nothing is reported for the {@link Participant}. This has no effect and
   * defaults to {@link NetworkQualityVerbosity}<code style="padding:0 0">#minimal</code>
   * for the {@link LocalParticipant}.
   */
  none: 0,
  /**
   * Reports {@link NetworkQualityLevel} for the {@link Participant}.
   */
  minimal: 1,
  /**
   * Reports {@link NetworkQualityLevel} and {@link NetworkQualityStats} for the {@link Participant}.
   * {@link NetworkQualityStats} is populated with audio and video {@link NetworkQualityLevel}s
   * based on which the {@link Participant}'s {@link NetworkQualityLevel} is calculated.
   */
  moderate: 2,
  /**
   * Reports {@link NetworkQualityLevel} and {@link NetworkQualityStats} for the {@link Participant}.
   * {@link NetworkQualityStats} is populated with audio and Video {@link NetworkQualityLevel}s
   * and their corresponding {@link NetworkQualityMediaStats} based on which the
   * {@link Participant}'s {@link NetworkQualityLevel} is calculated.
   */
  detailed: 3
};

/**
 * {@link TrackSwitchOffMode} specifies when {@link RemoteVideoTrack}s' are switched off.
 * @enum {string}
 */
// eslint-disable-next-line
const TrackSwitchOffMode = {
  /**
   * In this mode, {@link RemoteVideoTrack}s are switched off only when network congestion
   * is detected.
   */
  detected: 'detected',

  /**
   * In this mode, {@link RemoteVideoTrack}s are pro-actively switched off when network
   * congestion is predicted by the bandwidth estimation mechanism.
   */
  predicted: 'predicted',

  /**
   * In this mode, {@link RemoteVideoTrack}s are not switched off. Instead in response to network
   * congestion, tracks will be adjusted to lower quality.
   */
  disabled: 'disabled'
};

/**
 * {@link BandwidthProfileMode} specifies how {@link RemoteVideoTrack}s' {@link Track.Priority} values
 * are mapped to bandwidth allocation in Group Rooms.
 * @enum {string}
 */
// eslint-disable-next-line
const BandwidthProfileMode = {
  /**
   * This mode is for use cases where all the subscribed {@link RemoteVideoTrack}s are
   * equally important. The bandwidth allocation algorithm will share the available
   * downlink bandwidth equally among the subscribed {@link RemoteVideoTrack}s, irrespective
   * of their {@link Track.Priority}. In case of insufficient downlink bandwidth, the lower
   * priority {@link RemoteVideoTrack}s are switched off.
   */
  grid: 'grid',
  /**
   * This mode is for use cases where some {@link RemoteVideoTrack}s are prioritized more than
   * others. However, the lower priority {@link RemoteVideoTrack}s still need to be visible.
   * The bandwidth allocation algorithm will share the available downlink bandwidth proportional
   * to the requested {@link VideoRenderDimensions} corresponding to their {@link Track.Priority}.
   * In case of insufficient downlink bandwidth, the quality of higher priority {@link RemoteVideoTrack}s
   * may be degraded to avoid switching off lower priority {@link RemoteVideoTrack}s.
   */
  collaboration: 'collaboration',
  /**
   * This mode is for use cases where some {@link RemoteVideoTrack}s are deemed critical and must
   * be preserved at any cost over the other {@link RemoteVideoTrack}s. The bandwidth allocation
   * algorithm will allocate as big a share of the available downlink bandwidth as it possibly
   * can to the higher priority {@link RemoteVideoTrack}s, and only then consider the lower priority
   * {@link RemoteVideoTrack}s. In case of insufficient downlink bandwidth, the lower priority
   * {@link RemoteVideoTrack}s are switched off in order to preserve the quality of the higher
   * priority {@link RemoteVideoTrack}s.
   */
  presentation: 'presentation'
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
  roomSignaling.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      log.info('Disconnected from Room:', room.toString());
      roomSignaling.removeListener('stateChanged', stateChanged);
    }
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
