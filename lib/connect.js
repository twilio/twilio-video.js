'use strict';

const { MediaStreamTrack } = require('./webrtc');
const { guessBrowser, guessBrowserVersion } = require('./webrtc/util');
const createCancelableRoomPromise = require('./cancelableroompromise');
const EncodingParametersImpl = require('./encodingparameters');
const LocalParticipant = require('./localparticipant');
const InsightsPublisher = require('./util/insightspublisher');
const NullInsightsPublisher = require('./util/insightspublisher/null');

const LocalAudioTrack = require('./media/track/localaudiotrack');
const LocalDataTrack = require('./media/track/localdatatrack');
const LocalVideoTrack = require('./media/track/localvideotrack');

const NetworkQualityConfigurationImpl = require('./networkqualityconfiguration');
const Room = require('./room');
const SignalingV2 = require('./signaling/v2');

const {
  asLocalTrack,
  filterObject,
  isNonArrayObject
} = require('./util');

const {
  DEFAULT_ENVIRONMENT,
  DEFAULT_LOGGER_NAME,
  DEFAULT_REALM,
  DEFAULT_REGION,
  WS_SERVER,
  SDK_NAME,
  SDK_VERSION,
  typeErrors: E
} = require('./util/constants');

const CancelablePromise = require('./util/cancelablepromise');
const EventObserver = require('./util/eventobserver');
const DefaultLog = require('./util/log');
const { validateBandwidthProfile } = require('./util/validate');

const safariVersion = guessBrowser() === 'safari' && guessBrowserVersion();

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
let connectCalls = 0;

let didPrintSafariWarning = false;
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
 *   <br><br>
 *   A "trackPublished" event is fired on the {@link LocalParticipant} for each
 *   LocalTrack that was successfully published. A "trackPublicationFailed" event
 *   is fired for each LocalTrack that was failed to be published.
 * @alias module:twilio-video.connect
 * @param {string} token - The Access Token string
 * @param {ConnectOptions} [options] - Options to override the default behavior, invalid options are ignored.
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
 *   room.localParticipant.on('trackPublished', function(publication) {
 *     console.log('The LocalTrack "' + publication.trackName + '" was successfully published');
 *   });
 * }).catch(error => {
 *   console.log('Could not connect to the Room:', error.message);
 * });
 * @example
 * // Accessing the SDK logger
 * var { Logger, connect } = require('twilio-video');
 * var token = getAccessToken();
 *
 * var logger = Logger.getLogger('twilio-video');
 *
 * // Listen for logs
 * var originalFactory = logger.methodFactory;
 * logger.methodFactory = function (methodName, logLevel, loggerName) {
 *   var method = originalFactory(methodName, logLevel, loggerName);
 *
 *   return function (datetime, logLevel, component, message, data) {
 *     method(datetime, logLevel, component, message, data);
 *     // Send to your own server
 *     postDataToServer(arguments);
 *   };
 * };
 * logger.setLevel('debug');
 *
 * connect(token, {
 *   name: 'my-cool-room'
 * }).then(function(room) {
 *   room.on('participantConnected', function(participant) {
 *     console.log(participant.identity + ' has connected');
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

  const Log = options.Log || DefaultLog;
  const loggerName = options.loggerName || DEFAULT_LOGGER_NAME;
  const logComponentName = `[connect #${++connectCalls}]`;

  let log;
  try {
    log = new Log(logComponentName, loggerName);
  } catch (error) {
    return CancelablePromise.reject(error);
  }

  const adaptiveSimulcast = options.preferredVideoCodecs === 'auto';
  if (adaptiveSimulcast) {
    // NOTE(mpatwardhan): enable adaptiveSimulcast.
    options.preferredVideoCodecs = [{ codec: 'VP8', simulcast: true, adaptiveSimulcast: true }];
  }

  if (options.maxVideoBitrate && adaptiveSimulcast) {
    log.error('ConnectOptions "maxVideoBitrate" is not compatible with "preferredVideoCodecs=auto"');
    return CancelablePromise.reject(E.ILLEGAL_INVOKE('connect',
      'ConnectOptions "maxVideoBitrate" is not compatible with "preferredVideoCodecs=auto"'));
  }

  options = Object.assign({
    automaticSubscription: true,
    dominantSpeaker: false,
    enableDscp: false,
    environment: DEFAULT_ENVIRONMENT,
    insights: true,
    LocalAudioTrack,
    LocalDataTrack,
    LocalParticipant,
    LocalVideoTrack,
    Log,
    MediaStreamTrack,
    loggerName,
    maxAudioBitrate: null,
    maxVideoBitrate: null,
    name: null,
    networkMonitor: true,
    networkQuality: false,
    preferredAudioCodecs: [],
    preferredVideoCodecs: [],
    realm: DEFAULT_REALM,
    region: DEFAULT_REGION,
    signaling: SignalingV2
  }, filterObject(options));

  /* eslint new-cap:0 */
  const eventPublisherOptions = {};
  if (typeof options.wsServerInsights === 'string') {
    eventPublisherOptions.gateway = options.wsServerInsights;
  }
  const EventPublisher = options.insights ? InsightsPublisher : NullInsightsPublisher;
  const eventPublisher = new EventPublisher(
    token,
    SDK_NAME,
    SDK_VERSION,
    options.environment,
    options.realm,
    eventPublisherOptions);

  const wsServer = WS_SERVER(options.environment, options.region);
  const eventObserver = new EventObserver(eventPublisher, Date.now(), log);
  options = Object.assign({ eventObserver, wsServer }, options);
  options.log = log;

  // NOTE(mmalavalli): Print the Safari warning only for versions 12.0 and below.
  if (isSafariWithoutVP8Support && !didPrintSafariWarning) {
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

  // Note(mpatwardhan): "clientTrackSwitchOffControl" can have one of the three values internally:
  // 1) "auto" = sdk will decide and send the hints.
  // 2) "manual" - app can use api to send the hints.
  // 3) "disabled" = do not enable this feature. (this is internal only value)
  // 'disabled' is needed because clientTrackSwitchOffControl is incompatible with internal property maxTracks.
  options.clientTrackSwitchOffControl = 'disabled'; // should sdk turn off idle tracks automatically?
  if (options.bandwidthProfile) {
    options.clientTrackSwitchOffControl = 'auto';
    options.contentPreferencesMode = 'auto';
    if (options.bandwidthProfile.video) {
      if ('maxTracks' in options.bandwidthProfile.video) {
        // when maxTracks is specified. disable clientTrackSwitchOffControl
        options.clientTrackSwitchOffControl = 'disabled';
        options.bandwidthProfile.video.maxSwitchedOnTracks = options.bandwidthProfile.video.maxTracks;
        delete options.bandwidthProfile.video.maxTracks;
      } else if (options.bandwidthProfile.video.clientTrackSwitchOffControl === 'manual') {
        options.clientTrackSwitchOffControl = 'manual';
      }
      if (options.bandwidthProfile.video.contentPreferencesMode === 'manual') {
        options.contentPreferencesMode = 'manual';
      }
    }
  }

  const Signaling = options.signaling;
  const signaling = new Signaling(options.wsServer, options);

  log.info('Connecting to a Room');
  log.debug('Options:', options);

  const encodingParameters = new EncodingParametersImpl({
    maxAudioBitrate: options.maxAudioBitrate,
    maxVideoBitrate: options.maxVideoBitrate
  }, adaptiveSimulcast);

  const preferredCodecs = {
    audio: options.preferredAudioCodecs.map(normalizeCodecSettings),
    video: options.preferredVideoCodecs.map(normalizeCodecSettings)
  };

  const networkQualityConfiguration = new NetworkQualityConfigurationImpl(
    isNonArrayObject(options.networkQuality) ? options.networkQuality : {}
  );

  // Create a CancelableRoomPromise<Room> that resolves after these steps:
  // 1 - Get the LocalTracks.
  // 2 - Create the LocalParticipant using options.tracks.
  // 3 - Connect to rtc-room-service and create the RoomSignaling.
  // 4 - Create the Room and then resolve the CancelablePromise.
  const cancelableRoomPromise = createCancelableRoomPromise(
    getLocalTracks.bind(null, options),
    createLocalParticipant.bind(null, signaling, log, encodingParameters, networkQualityConfiguration, options),
    createRoomSignaling.bind(null, token, options, signaling, encodingParameters, preferredCodecs),
    createRoom.bind(null, options));

  cancelableRoomPromise.then(room => {
    eventPublisher.connect(room.sid, room.localParticipant.sid);
    log.info('Connected to Room:', room.toString());
    log.info('Room name:', room.name);
    log.debug('Room:', room);
    room.once('disconnected', () => eventPublisher.disconnect());
    return room;
  }, error => {
    eventPublisher.disconnect();
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
 * @property {boolean|CreateLocalTrackOptions} [audio=true] - Whether or not to
 *   get local audio with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 * @property {boolean} [automaticSubscription=true] - By default, you will subscribe
 *   to all RemoteTracks shared by other Participants in a Room. You can now override this
 *   behavior by setting this flag to <code>false</code>. It will make sure that you will
 *   not subscribe to any RemoteTrack in a Group or Small Group Room. Setting it to
 *   <code>true</code>, or not setting it at all preserves the default behavior. This
 *   flag does not have any effect in a Peer-to-Peer Room.
 * @property {BandwidthProfile} [bandwidthProfile] - You can optionally configure
 *   how your available downlink bandwidth is shared among the RemoteTracks you have subscribed
 *   to in a Group Room. By default, bandwidth is shared equally among the RemoteTracks.
 *   This has no effect in Peer-to-Peer Rooms.
 * @property {boolean} [dominantSpeaker=false] - Whether to enable the Dominant
 *   Speaker API or not. This only takes effect in Group Rooms.
 * @property {boolean} [enableDscp=false] - DSCP tagging allows you to request enhanced
 *   QoS treatment for RTP media packets from any firewall that the client may be behind.
 *   Setting this option to <code>true</code> will request DSCP tagging for media packets
 *   on supported browsers (only Chrome supports this as of now). Audio packets will be
 *   sent with DSCP header value set to 0xb8 which corresponds to Expedited Forwarding (EF).
 *   Video packets will be sent with DSCP header value set to 0x88 which corresponds to
 *   Assured Forwarding (AF41).
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used when connecting to {@link Room}s
 * @property {RTCIceTransportPolicy} [iceTransportPolicy="all"] - Override the
 *   ICE transport policy to be one of "relay" or "all"
 * @property {boolean} [insights=true] - Whether publishing events
 *   to the Insights gateway is enabled or not
 * @property {?number} [maxAudioBitrate=null] - Max outgoing audio bitrate (Kbps);
 *   A <code>null</code> or a <code>0</code> value does not set any bitrate limit;
 *   This value is set as a hint for variable bitrate codecs, but will not take
 *   effect for fixed bitrate codecs; Based on our tests, Chrome, Firefox and Safari
 *   support a bitrate range of 12 kbps to 256 kbps for Opus codec; This parameter
 *   has no effect on iSAC, PCMU and PCMA codecs
 * @property {?number} [maxVideoBitrate=null] - Max outgoing video bitrate (Kbps);
 *   A <code>null</code> or <code>0</code> value does not set any bitrate limit;
 *   This value is set as a hint for variable bitrate codecs, but will not take
 *   effect for fixed bitrate codecs; Based on our tests, Chrome, Firefox and Safari
 *   all seem to support an average bitrate range of 20 kbps to 8000 kbps for a 720p
 *   VideoTrack. This parameter must not be set when preferredVideoCodecs is set to `auto`.
 *   Note: this limit is not applied for screen share tracks published on Chrome.
 * @property {?string} [name=null] - Set to connect to a {@link Room} by name
 * @property {boolean|NetworkQualityConfiguration} [networkQuality=false] - Whether to enable the Network
 *   Quality API or not. This only takes effect in Group Rooms. Pass a {@link NetworkQualityConfiguration}
 *   to configure verbosity levels for network quality information for {@link LocalParticipant}
 *   and {@link RemoteParticipant}s. A <code>true</code> value will set the {@link NetworkQualityVerbosity}
 *   for the {@link LocalParticipant} to {@link NetworkQualityVerbosity}<code style="padding:0 0">#minimal</code>
 *   and the {@link NetworkQualityVerbosity} for {@link RemoteParticipant}s to
 *   {@link NetworkQualityVerbosity}<code style="padding:0 0">#none</code>.
 * @property {Array<string>} [notifyWarnings=[]] - The SDK raises warning events when it
 *   detects certain conditions. You can implement callbacks on these events to act on them, or to alert
 *   the user of an issue. Subsequently, "warningsCleared" event is raised when conditions have returned
 *   to normal. You can listen to these events by specifying an array of warning. By default,
 *   this array is empty and no warning events will be raised.
 *   Possible values include <code>recording-media-lost</code>, which is raised when the media server
 *   has not detected any media on the published track that is being recorded in the past 30 seconds.
 *   This usually happens when there are network interruptions or when the track has stopped.
 *   This warning is raised by {@link LocalTrackPublication}, {@link LocalParticipant}, and {@link Room} object.
 * @property {string} [region='gll'] - Preferred signaling region; By default, you will be connected to the
 *   nearest signaling server determined by latency based routing. Setting a value other
 *   than <code style="padding:0 0">gll</code> bypasses routing and guarantees that signaling traffic will be
 *   terminated in the region that you prefer. Please refer to this <a href="https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication" target="_blank">table</a>
 *   for the list of supported signaling regions.
 * @property {Array<AudioCodec|AudioCodecSettings>} [preferredAudioCodecs=[]] - Preferred audio codecs;
 *  An empty array preserves the current audio codec preference order.
 * @property {Array<VideoCodec|VideoCodecSettings>|VideoEncodingMode} [preferredVideoCodecs=[]] -
 *  Preferred video codecs; when set to 'VideoEncodingMode.Auto', SDK manages the video codec,
 *  by preferring VP8 simulcast in group rooms. It also enables adaptive simulcast, which allows SDK
 *  to turn off simulcast layers that are not needed for efficient bandwidth and CPU usage.
 *  An empty array preserves the current video codec.
 *  preference order. If you want to set a preferred video codec on a Group Room,
 *  you will need to create the Room using the REST API and set the
 *  <code>VideoCodecs</code> property.
 *  See <a href="https://www.twilio.com/docs/api/video/rooms-resource#create-room">
 *  here</a> for more information.
 * @property {string} [loggerName='twilio-video'] - The name of the logger. Use this name when accessing the logger used by the SDK.
 *   See [examples](module-twilio-video.html#.connect) for details.
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
 * {@link BandwidthProfile} allows you to configure how your available downlink
 * bandwidth is shared among the RemoteTracks you have subscribed to in a Group Room.
 * @typedef {object} BandwidthProfile
 * @property {VideoBandwidthProfile} [video] - Optional parameter to configure
 *   how your available downlink bandwidth is shared among the {@link RemoteVideoTrack}s you
 *   have subscribed to in a Group Room.
 * @property {AudioBandwidthProfile} [audio] - Optional parameter to configure
 *   how your available downlink bandwidth is shared among the {@link RemoteAudioTrack}s you
 *   have subscribed to in a Group Room.
 */

/**
 * {@link AudioBandwidthProfile} allows you to configure how your available downlink
 * bandwidth is shared among the {@link RemoteAudioTrack}s you have subscribed to in a Group Room.
 * @typedef {object} AudioBandwidthProfile
 * @property {number} [maxSwitchedOnTracks] - Optional
 *   parameter to specify the maximum number of {@link RemoteAudioTrack}s, which will be selected based on
 *   N-Loudest policy. If not specified server defaults will be used.
 */

/**
 * {@link VideoBandwidthProfile} allows you to configure how your available downlink
 * bandwidth is shared among the {@link RemoteVideoTrack}s you have subscribed to in a Group Room.
 * @typedef {object} VideoBandwidthProfile
 * @property {Track.Priority} [dominantSpeakerPriority="standard"] - Optional parameter to
 *   specify the minimum subscribe {@link Track.Priority} of the Dominant Speaker's {@link RemoteVideoTrack}s.
 *   This means that the Dominant Speaker's {@link RemoteVideoTrack}s that are published with
 *   lower {@link Track.Priority} will be subscribed to with the {@link Track.Priority} specified here.
 *   This has no effect on {@link RemoteVideoTrack}s published with higher {@link Track.Priority}, which will
 *   still be subscribed to with with the same {@link Track.Priority}. If not specified, this defaults to "standard".
 *   This parameter only applies to a Group Room Participant when {@link ConnectOptions}.dominantSpeaker is set to true.
 * @property {number} [maxSubscriptionBitrate] - Optional parameter to specify the maximum downlink video bandwidth in
 *   kilobits per second (kbps). By default, there are no limits on the downlink video bandwidth.
 * @property {ClientTrackSwitchOffControl} [clientTrackSwitchOffControl="auto"] - Optional parameter that determines
 *    when to turn the {@link RemoteVideoTrack} on or off. When set to "auto", SDK will use the visibility of the
 *    attached elements to determine if the {@link RemoteVideoTrack} should be turned off or on. When the attached video elements become invisible the {@link RemoteVideoTrack} will
 *    be turned off, and when elements become visible they will be turned on. When set to "manual" you can turn the {@link RemoteVideoTrack}
 *    on and off using the api {@link RemoteVideoTrack#switchOn} and {@link RemoteVideoTrack#switchOff} respectively.
 * @property {VideoContentPreferencesMode} [contentPreferencesMode="auto"] - This Optional parameter configures
 *    the mode for specifying content preferences for the {@link RemoteVideoTrack}. When set to "auto" the
 *    SDK determines the render dimensions by inspecting the attached video elements. {@link RemoteVideoTrack}s rendered in smaller video elements
 *    will receive a lower resolution stream compared to the video rendered in larger video elements. When set to "manual" you can set
 *    the dimensions programmatically by calling {@link RemoteVideoTrack#setContentPreferences}.
 * @property {BandwidthProfileMode} [mode="grid"] - Optional parameter to specify how the {@link RemoteVideoTrack}s'
 *   TrackPriority values are mapped to bandwidth allocation in Group Rooms. This defaults to "grid",
 *   which results in equal bandwidth share allocation to all {@link RemoteVideoTrack}s.
 * @property {TrackSwitchOffMode} [trackSwitchOffMode="predicted"] - Optional parameter to configure
 *   how {@link RemoteVideoTrack}s are switched off in response to bandwidth pressure. Defaults to "predicted".
 */

/**
 * Configure verbosity levels for network quality information for
 * {@link LocalParticipant} and {@link RemoteParticipant}s.
 * @typedef {object} NetworkQualityConfiguration
 * @property {NetworkQualityVerbosity} [local=1] - Verbosity level for {@link LocalParticipant}
 * @property {NetworkQualityVerbosity} [remote=0] - Verbosity level for {@link RemoteParticipant}s
 */

/**
 * Audio codec settings.
 * @typedef {object} AudioCodecSettings
 * @property {AudioCodec} codec - Audio codec name
 */

/**
 * Opus codec settings.
 * @typedef {AudioCodecSettings} OpusCodecSettings
 * @property {AudioCodec} name - "opus"
 * @property {boolean} [dtx=true] - Enable/disable discontinuous transmission (DTX);
 *   If enabled all published {@link LocalAudioTrack}s will reduce the outgoing bitrate
 *   to near-zero whenever speech is not detected, resulting in bandwidth and CPU savings;
 *   It defaults to true.
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
 * @property {boolean} [simulcast=false] - Enable/disable VP8 simulcast; If
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
 * Names of the supported VideoEncodingMode.
 * @enum {string}
 */
// eslint-disable-next-line
const VideoEncodingMode = {
  Auto: 'auto',
};


/**
 * Names of the supported video codecs.
 * @enum {string}
 */
// eslint-disable-next-line
const VideoCodec = {
  H264: 'H264',
  VP8: 'VP8'
};
// VP9 is supported by most browsers, but backend doesn't at the moment.
// Hide it from public documentation until then.
VideoCodec.VP9 = 'VP9';

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
 * {@link TrackSwitchOffReason} describes why a {@link RemoteTrack} is switched off. This reason
 * accompanies the {@link RemoteTrack} event <code>switchedOff</code> and is used for
 * the {@link RemoteTrack} property <code>switchOffReason</code>.
 * @enum {string}
 */
const TrackSwitchOffReason = {
  /**
   * The {@link RemoteTrack} was disabled by the publishing {@link Participant}.
   * The media server does not send media to the subscribing {@link Participant}s
   * for a disabled {@link Track}.
   */
  'disabled-by-publisher': 'disabled-by-publisher',

  /**
   * The {@link RemoteVideoTrack} was disabled by the subscribing {@link Participant}
   * and the media server stopped sending its media.
   */
  'disabled-by-subscriber': 'disabled-by-subscriber',

  /**
   * The {@link RemoteVideoTrack} was switched off because the remaining
   * downlink bandwidth is not sufficient to receive its media. The bandwidth
   * limit is configured by specifying <code>maxSubscriptionBitrate</code>
   * in {@link VideoBandwidthProfile} or a default value is selected
   * by the media server.
   */
  'max-bandwidth-reached': 'max-bandwidth-reached',

  /**
   * The {@link RemoteTrack} was switched off because the number of switched on
   * {@link Track}s reached the limit set by the media server.
   */
  'max-tracks-switched-on': 'max-tracks-switched-on',

  /**
   * The {@link RemoteVideoTrack} was switched off because network congestion
   * was detected or predicted. The <code>trackSwitchOffMode</code> property
   * on {@link VideoBandwidthProfile} allows you to specify how the
   * switch off is managed.
   */
  'network-congestion': 'network-congestion'
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
   * to the requested render dimensions corresponding to their {@link Track.Priority}. In case of
   * insufficient downlink bandwidth, the quality of higher priority {@link RemoteVideoTrack}s
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

/**
 * {@link VideoContentPreferencesMode} specifies how {@link RemoteVideoTrack}s' render dimensions are
 * decided by the SDK.
 * @enum {string}
 */
// eslint-disable-next-line
const VideoContentPreferencesMode = {
  /**
   * when set to auto, SDK uses the sizes of the video elements attached to the to the  {@link RemoteVideoTrack} dynamically to
   * decide the render dimensions. {@link RemoteVideoTrack}s rendered in smaller video elements will be given smaller bandwidth allocation
   * compared to the tracks rendered in large video elements.
   */
  auto: 'auto',
  /**
   * When set to manual, application can use {@link RemoteVideoTrack#setContentPreference} to set the
   * desired render dimensions for the {@link RemoteVideoTrack}.
   */
  manual: 'manual'
};


/**
 * {@link ClientTrackSwitchOffControl} specifies how {@link RemoteVideoTrack}s' turned on and off
 * @enum {string}
 */
// eslint-disable-next-line
const ClientTrackSwitchOffControl = {
  /**
   * when set to auto, SDK uses the visibility of the video elements attached to the to the  {@link RemoteVideoTrack} to decide.
   * on turning tracks on or off. The track that are not attached to any video elements or not visible on the screen will be turned
   * off automatically.
   */
  auto: 'auto',

  /**
   * When set to manual, application can use {@link RemoteVideoTrack}s switchOff and switchOn apis to control turn the track on or off.
   */
  manual: 'manual'
};


/**
 * Names of the supported levels for {@link LoggerEvent}s.
 * @enum {string}
 */
// eslint-disable-next-line
const LoggerEventLevel = {
  debug: 'debug',
  error: 'error',
  info: 'info',
  warning: 'warning'
};

/**
 * Names of the supported groups for {@link LoggerEvent}s.
 * @enum {string}
 */
// eslint-disable-next-line
const LoggerEventGroup = {
  /**
   * Events associated with the connection to Twilio's signaling server
   */
  signaling: 'signaling'
};

/**
 * A {@link LoggerEvent} provides context about an event raised by the SDK on the Logger.
 * Apart from the properties listed here, it may also include some event-specific data within
 * an optional "payload" property. The different types of {@link LoggerEvent}s are listed below:
 *  * {@link LoggerClosedEvent}
 *  * {@link LoggerConnectingEvent}
 *  * {@link LoggerEarlyEvent}
 *  * {@link LoggerOpenEvent}
 *  * {@link LoggerWaitingEvent}
 * @typedef {object} LoggerEvent
 * @property {number} elapsedTime - The time elapsed in milliseconds since connect() was called
 * @property {LoggerEventGroup} group - The group under which the event is classified
 * @property {LoggerEventLevel} level - The verbosity level of the event, which can be one of "debug", "error", "info", "warning"
 * @property {string} name - The name of the event
 * @property {*} [payload] - Optional event-specific data
 * @property {number} timestamp - The time in milliseconds relative to the Unix Epoch when the event was raised
 * @example
 * const { Logger } = require('twilio-video');
 *
 * const logger = Logger.getLogger('twilio-video');
 *
 * // Listen for LoggerEvents.
 * const originalFactory = logger.methodFactory;
 * logger.methodFactory = function(methodName, level, loggerName) {
 *   const method = originalFactory(methodName, level, loggerName);
 *   return function(datetime, logLevel, component, message, data) {
 *     method(datetime, logLevel, component, message, data);
 *     if (message === 'event') {
 *       // The argument 'data' will be of type LoggerEvent.
 *       // Handle the data here (for ex: log to your own server).
 *     }
 *   };
 * };
 *
 * // Set the log level to info (or debug) in order to intercept LoggerEvents.
 * logger.setLevel('info');
 */

/**
 * The connection to Twilio's signaling server was closed.
 * @typedef {LoggerEvent} LoggerClosedEvent
 * @property {LoggerEventGroup} group='signaling'
 * @property {LoggerEventLevel} level - 'info' if the connection was closed by the client, 'error' otherwise
 * @property {string} name='closed'
 * @property {{reason: string}} payload - Reason for the connection being closed. It can be one of
 *   'busy', 'failed', 'local', 'remote' or 'timeout'
 */

/**
 * The SDK is connecting to Twilio's signaling server.
 * @typedef {LoggerEvent} LoggerConnectingEvent
 * @property {LoggerEventGroup} group='signaling'
 * @property {LoggerEventLevel} level='info'
 * @property {string} name='connecting'
 */

/**
 * The SDK is about to connect to Twilio's signaling server.
 * @typedef {LoggerEvent} LoggerEarlyEvent
 * @property {LoggerEventGroup} group='signaling'
 * @property {LoggerEventLevel} level='info'
 * @property {string} name='early'
 */

/**
 * The SDK has established a signaling connection to Twilio's signaling server.
 * @typedef {LoggerEvent} LoggerOpenEvent
 * @property {LoggerEventGroup} group='signaling'
 * @property {LoggerEventLevel} level='info'
 * @property {string} name='open'
 */

/**
 * The SDK is waiting to retry connecting th Twilio's signaling server. This can
 * happen if the server is busy with too many connection requests.
 * @typedef {LoggerEvent} LoggerWaitingEvent
 * @property {LoggerEventGroup} group='signaling'
 * @property {LoggerEventLevel} level='warning'
 * @property {string} name='waiting'
 */

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

function createRoomSignaling(token, options, signaling, encodingParameters, preferredCodecs, localParticipant) {
  options.log.debug('Creating a new RoomSignaling');
  return signaling.connect(
    localParticipant._signaling,
    token,
    encodingParameters,
    preferredCodecs,
    options);
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

function normalizeCodecSettings(nameOrSettings) {
  const settings = typeof nameOrSettings === 'string'
    ? { codec: nameOrSettings }
    : nameOrSettings;
  switch (settings.codec.toLowerCase()) {
    case 'opus': {
      return Object.assign({ dtx: true }, settings);
    }
    case 'vp8': {
      return Object.assign({ simulcast: false }, settings);
    }
    default: {
      return settings;
    }
  }
}

module.exports = connect;
