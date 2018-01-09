/*! twilio-video.js 1.7.0

The following license applies to all parts of this software except as
documented below.

    Copyright (c) 2015, Twilio, inc.
    All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

      1. Redistributions of source code must retain the above copyright
         notice, this list of conditions and the following disclaimer.

      2. Redistributions in binary form must reproduce the above copyright
         notice, this list of conditions and the following disclaimer in
         the documentation and/or other materials provided with the
         distribution.

      3. Neither the name of Twilio nor the names of its contributors may
         be used to endorse or promote products derived from this software
         without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This software includes SIP.js under the following license.

    Copyright (c) 2014 Junction Networks, Inc. <http://www.onsip.com>

    License: The MIT License

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

SIP.js contains substantial portions of the JsSIP software under the following
license.

    Copyright (c) 2012-2013 José Luis Millán - Versatica <http://www.versatica.com>

    License: The MIT License

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files (the
    "Software"), to deal in the Software without restriction, including
    without limitation the rights to use, copy, modify, merge, publish,
    distribute, sublicense, and/or sell copies of the Software, and to
    permit persons to whom the Software is furnished to do so, subject to
    the following conditions:

    The above copyright notice and this permission notice shall be
    included in all copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
    MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
    LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
    OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
    WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

 */
/* eslint strict:0 */
(function(root) {
  var bundle = (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var CancelablePromise = require('./util/cancelablepromise');

/**
 * Create a {@link CancelablePromise<Room>}.
 * @param {function(function(Array<LocalTrack>): CancelablePromise<RoomSignaling>):
 *   Promise<function(): CancelablePromise<RoomSignaling>>} getLocalTracks
 * @param {function(Array<LocalTrack>): LocalParticipant} createLocalParticipant
 * @param {function(Array<LocalTrack>): CancelablePromise<RoomSignaling>} createRoomSignaling
 * @param {function(LocalParticipant, RoomSignaling): Room} createRoom
 * @returns CancelablePromise<Room>
 */
function createCancelableRoomPromise(getLocalTracks, createLocalParticipant, createRoomSignaling, createRoom) {
  var cancelableRoomSignalingPromise;
  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    var localParticipant;
    getLocalTracks(function getLocalTracksSucceeded(localTracks) {
      if (isCanceled()) {
        return CancelablePromise.reject(cancelationError);
      }
      localParticipant = createLocalParticipant(localTracks);
      return createRoomSignaling(localParticipant).then(function createRoomSignalingSucceeded(getCancelableRoomSignalingPromise) {
        if (isCanceled()) {
          throw cancelationError;
        }
        cancelableRoomSignalingPromise = getCancelableRoomSignalingPromise();
        return cancelableRoomSignalingPromise;
      });
    }).then(function roomSignalingConnected(roomSignaling) {
      if (isCanceled()) {
        roomSignaling.disconnect();
        throw cancelationError;
      }
      resolve(createRoom(localParticipant, roomSignaling));
    }).catch(function onError(error) {
      reject(error);
    });
  }, function onCancel() {
    if (cancelableRoomSignalingPromise) {
      cancelableRoomSignalingPromise.cancel();
    }
  });
}

module.exports = createCancelableRoomPromise;

},{"./util/cancelablepromise":71}],2:[function(require,module,exports){
'use strict';

var CancelablePromise = require('./util/cancelablepromise');
var createCancelableRoomPromise = require('./cancelableroompromise');
var createLocalTracks = require('./createlocaltracks');
var ConstantIceServerSource = require('./iceserversource/constant');
var constants = require('./util/constants');
var Room = require('./room');
var E = require('./util/constants').typeErrors;
var EncodingParametersImpl = require('./encodingparameters');
var guessBrowser = require('./util').guessBrowser;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalDataTrack = require('./media/track/localdatatrack');
var LocalParticipant = require('./localparticipant');
var LocalVideoTrack = require('./media/track/localvideotrack');
var Log = require('./util/log');
var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var NTSIceServerSource = require('./iceserversource/nts');
var SignalingV2 = require('./signaling/v2');
var util = require('./util');

// This is used to make out which connect() call a particular Log statement
// belongs to. Each call to connect() increments this counter.
var connectCalls = 0;

var didPrintSafariWarning = false;

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
    return CancelablePromise.reject(new E.INVALID_TYPE('options', 'object'));
  }

  options = Object.assign({
    createLocalTracks: createLocalTracks,
    environment: constants.DEFAULT_ENVIRONMENT,
    insights: true,
    LocalAudioTrack: LocalAudioTrack,
    LocalDataTrack: LocalDataTrack,
    LocalParticipant: LocalParticipant,
    LocalVideoTrack: LocalVideoTrack,
    MediaStreamTrack: MediaStreamTrack,
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

  var logLevels = util.buildLogLevels(options.logLevel);
  var logComponentName = '[connect #' + ++connectCalls + ']';

  var log;
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
    return CancelablePromise.reject(new E.INVALID_TYPE('token', 'string'));
  }

  // NOTE(mmalavalli): The Room "name" in "options" was being used
  // as the LocalTrack name in asLocalTrack(). So we pass a copy of
  // "options" without the "name".
  var localTrackOptions = Object.assign({}, options);
  delete localTrackOptions.name;

  if ('tracks' in options) {
    if (!Array.isArray(options.tracks)) {
      return CancelablePromise.reject(new E.INVALID_TYPE('options.tracks',
        'Array of LocalAudioTrack, LocalVideoTrack or MediaStreamTrack'));
    }
    try {
      options.tracks = options.tracks.map(function(track) {
        return util.asLocalTrack(track, localTrackOptions);
      });
    } catch (error) {
      return CancelablePromise.reject(error);
    }
  }

  var Signaling = options.signaling;
  var signaling = new Signaling(options.wsServer, options);

  log.info('Connecting to a Room');
  log.debug('Options:', options);

  var encodingParameters = new EncodingParametersImpl({
    maxAudioBitrate: options.maxAudioBitrate,
    maxVideoBitrate: options.maxVideoBitrate
  });

  var iceServerSource = Array.isArray(options.iceServers)
    ? new ConstantIceServerSource(options.iceServers)
    : typeof options.iceServers === 'object'
      ? options.iceServers
      : new NTSIceServerSource(token, options);

  var preferredCodecs = {
    audio: options.preferredAudioCodecs,
    video: options.preferredVideoCodecs.map(normalizeVideoCodecSettings)
  };

  // Create a CancelableRoomPromise<Room> that resolves after these steps:
  // 1 - Get the LocalTracks.
  // 2 - Create the LocalParticipant using options.tracks.
  // 3 - Connect to rtc-room-service and create the RoomSignaling.
  // 4 - Create the Room and then resolve the CancelablePromise.
  var cancelableRoomPromise = createCancelableRoomPromise(
    getLocalTracks.bind(null, options),
    createLocalParticipant.bind(null, signaling, log, encodingParameters, options),
    createRoomSignaling.bind(null, token, options, signaling, iceServerSource, encodingParameters, preferredCodecs),
    createRoom.bind(null, options));

  cancelableRoomPromise.then(function(room) {
    log.info('Connected to Room:', room.toString());
    log.info('Room name:', room.name);
    log.debug('Room:', room);
    return room;
  }, function(error) {
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
 * @property {boolean|CreateLocalTrackOptions} [audio=true] - Whether or not to
 *   get local audio with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 * @property {Array<RTCIceServer>} iceServers - Override the STUN and TURN
 *   servers used when connecting to {@link Room}s
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
var AudioCodec = {
  isac: 'isac',
  opus: 'opus',
  PCMA: 'PCMA',
  PCMU: 'PCMU'
};

/**
 * Names of the supported video codecs.
 * @enum {string}
 */
var VideoCodec = {
  H264: 'H264',
  VP8: 'VP8',
  VP9: 'VP9'
};

/**
 * Levels for logging verbosity.
 * @enum {string}
 */
/* eslint no-unused-vars:0 */
var LogLevel = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
  off: 'off'
};

function createLocalParticipant(signaling, log, encodingParameters, options, localTracks) {
  var localParticipantSignaling = signaling.createLocalParticipantSignaling(encodingParameters);
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

function createRoomSignaling(token, options, signaling, iceServerSource, encodingParameters, preferredCodecs, localParticipant) {
  var log = options.log;
  log.info('Getting ICE servers');
  log.debug('Options:', options);

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
      iceServerSource,
      encodingParameters,
      preferredCodecs,
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

function normalizeVideoCodecSettings(nameOrSettings) {
  var settings = typeof nameOrSettings === 'string'
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

},{"./cancelableroompromise":1,"./createlocaltracks":4,"./encodingparameters":9,"./iceserversource/constant":10,"./iceserversource/nts":11,"./localparticipant":13,"./media/track/localaudiotrack":16,"./media/track/localdatatrack":18,"./media/track/localvideotrack":22,"./room":38,"./signaling/v2":49,"./util":74,"./util/cancelablepromise":71,"./util/constants":72,"./util/log":77,"@twilio/webrtc":125}],3:[function(require,module,exports){
'use strict';

var defaultCreateLocalTracks = require('./createlocaltracks');
var DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;

/**
 * Request a {@link LocalAudioTrack} or {@link LocalVideoTrack}.
 * @param {Track.Kind} kind - "audio" or "video"
 * @param {CreateLocalTrackOptions} [options]
 * @returns {Promise<LocalAudioTrack|LocalVideoTrack>}
 * @private
 */
function createLocalTrack(kind, options) {
  options = Object.assign({
    createLocalTracks: defaultCreateLocalTracks,
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var createOptions = {};
  createOptions.logLevel = options.logLevel;
  delete options.logLevel;

  var createLocalTracks = options.createLocalTracks;
  delete options.createLocalTracks;
  createOptions[kind] = Object.keys(options).length > 0 ? options : true;

  return createLocalTracks(createOptions).then(function(localTracks) {
    return localTracks[0];
  });
}

/**
 * Request a {@link LocalAudioTrack}.
 * @param {CreateLocalTrackOptions} [options] - Options for requesting a {@link LocalAudioTrack}
 * @returns {Promise<LocalAudioTrack>}
 * @example
 * var Video = require('twilio-video');
 *
 * // Connect to the Room with just video
 * Video.connect('my-token', {
 *   name: 'my-cool-room',
 *   video: true
 * }).then(function(room) {
 *   // Add audio after connecting to the Room
 *   Video.createLocalAudioTrack().then(function(localTrack) {
 *     room.localParticipant.addTrack(localTrack);
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 *
 * // Request the default LocalAudioTrack with a custom name
 * Video.createLocalAudioTrack({ name: 'microphone' }).then(function(localTrack) {
 *   console.log(localTrack.name); // 'microphone'
 * });
 */
function createLocalAudioTrack(options) {
  return createLocalTrack('audio', options);
}

/**
 * Request a {@link LocalVideoTrack}.
 * @param {CreateLocalTrackOptions} [options] - Options for requesting a {@link LocalVideoTrack}
 * @returns {Promise<LocalVideoTrack>}
 * @example
 * var Video = require('twilio-video');
 *
 * // Connect to the Room with just audio
 * Video.connect('my-token', {
 *   name: 'my-cool-room',
 *   audio: true
 * }).then(function(room) {
 *   // Add video after connecting to the Room
 *   Video.createLocalVideoTrack().then(function(localTrack) {
 *     room.localParticipant.addTrack(localTrack);
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 *
 * // Request the default LocalVideoTrack with a custom name
 * Video.createLocalVideoTrack({ name: 'camera' }).then(function(localTrack) {
 *   console.log(localTrack.name); // 'camera'
 * });
 */
function createLocalVideoTrack(options) {
  return createLocalTrack('video', options);
}

/**
 * Create {@link LocalTrack} options.
 * @typedef {MediaTrackConstraints} CreateLocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 */

module.exports = {
  audio: createLocalAudioTrack,
  video: createLocalVideoTrack
};

},{"./createlocaltracks":4,"./util/constants":72}],4:[function(require,module,exports){
'use strict';

var asLocalTrack = require('./util').asLocalTrack;
var buildLogLevels = require('./util').buildLogLevels;
var getUserMedia = require('@twilio/webrtc').getUserMedia;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalDataTrack = require('./media/track/localdatatrack');
var LocalVideoTrack = require('./media/track/localvideotrack');
var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var Log = require('./util/log');
var DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;

// This is used to make out which createLocalTracks() call a particular Log
// statement belongs to. Each call to createLocalTracks() increments this
// counter.
var createLocalTrackCalls = 0;

/**
 * Request {@link LocalTrack}s. By default, it requests a
 * {@link LocalAudioTrack} and a {@link LocalVideoTrack}.
 * @param {CreateLocalTracksOptions} [options]
 * @returns {Promise<Array<LocalTrack>>}
 * @example
 * var Video = require('twilio-video');
 * // Request audio and video tracks
 * Video.createLocalTracks().then(function(localTracks) {
 *   var localMediaContainer = document.getElementById('local-media-container-id');
 *   localTracks.forEach(function(track) {
 *     localMediaContainer.appendChild(track.attach());
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 * // Request just the default audio track
 * Video.createLocalTracks({ audio: true }).then(function(localTracks) {
 *   return Video.connect('my-token', {
 *     name: 'my-cool-room',
 *     tracks: localTracks
 *   });
 * });
 * @example
 * var Video = require('twilio-video');
 * // Request the audio and video tracks with custom names
 * Video.createLocalTracks({
 *   audio: { name: 'microphone' },
 *   video: { name: 'camera' }
 * }).then(function(localTracks) {
 *   localTracks.forEach(function(localTrack) {
 *     console.log(localTrack.name);
 *   });
 * });
 */
function createLocalTracks(options) {
  var isAudioVideoAbsent =
    !(options && ('audio' in options || 'video' in options));

  options = Object.assign({
    audio: isAudioVideoAbsent,
    getUserMedia: getUserMedia,
    logLevel: DEFAULT_LOG_LEVEL,
    LocalAudioTrack: LocalAudioTrack,
    LocalDataTrack: LocalDataTrack,
    LocalVideoTrack: LocalVideoTrack,
    MediaStreamTrack: MediaStreamTrack,
    Log: Log,
    video: isAudioVideoAbsent
  }, options);

  var logComponentName = '[createLocalTracks #' + ++createLocalTrackCalls + ']';
  var logLevels = buildLogLevels(options.logLevel);
  var log = new options.Log('default', logComponentName, logLevels);

  // NOTE(mmalavalli): The Room "name" in "options" was being used
  // as the LocalTrack name in asLocalTrack(). So we pass a copy of
  // "options" without the "name".
  var localTrackOptions = Object.assign({ log: log }, options);
  delete localTrackOptions.name;

  if (options.audio === false && options.video === false) {
    log.info('Neither audio nor video requested, so returning empty LocalTracks');
    return Promise.resolve([]);
  }

  if (options.tracks) {
    log.info('Adding user-provided LocalTracks');
    log.debug('LocalTracks:', options.tracks);
    return Promise.resolve(options.tracks);
  }

  var localTrackNameOptions = {
    audio: options.audio && options.audio.name
      ? { name: options.audio.name }
      : {},
    video: options.video && options.video.name
      ? { name: options.video.name }
      : {}
  };

  if (options.audio) {
    delete options.audio.name;
  }
  if (options.video) {
    delete options.video.name;
  }

  return options.getUserMedia({
    audio: options.audio,
    video: options.video
  }).then(function(mediaStream) {
    var mediaStreamTracks = mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());

    log.info('Call to getUserMedia successful; got MediaStreamTracks:',
      mediaStreamTracks);

    return mediaStreamTracks.map(function(mediaStreamTrack) {
      return asLocalTrack(mediaStreamTrack, Object.assign(
        localTrackNameOptions[mediaStreamTrack.kind], localTrackOptions));
    });
  }, function(error) {
    log.warn('Call to getUserMedia failed:', error);
    throw error;
  });
}

/**
 * {@link createLocalTracks} options
 * @typedef {object} CreateLocalTracksOptions
 * @property {boolean|CreateLocalTrackOptions} [audio=true] - Whether or not to
 *   get local audio with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {boolean|CreateLocalTrackOptions} [video=true] - Whether or not to
 *   get local video with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 */

module.exports = createLocalTracks;

},{"./media/track/localaudiotrack":16,"./media/track/localdatatrack":18,"./media/track/localvideotrack":22,"./util":74,"./util/constants":72,"./util/log":77,"@twilio/webrtc":125}],5:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var DataTrackTransceiver = require('./transceiver');

/**
 * Construct an {@link DataTrackReceiver}.
 * @class
 * @classdesc A {@link DataTrackReceiver} represents a
 *   {@link DataTrackTransceiver} over which data can be received. Internally, it
 *   users a single RTCDataChannel to receive data.
 * @extends DataTrackTransceiver
 * @param {RTCDataChannel} dataChannel
 * @fires DataTrackReceiver#message
 */
function DataTrackReceiver(dataChannel) {
  if (!(this instanceof DataTrackReceiver)) {
    return new DataTrackReceiver(dataChannel);
  }
  DataTrackTransceiver.call(this,
    dataChannel.label,
    dataChannel.maxPacketLifeTime,
    dataChannel.maxRetransmits,
    dataChannel.ordered);

  // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
  // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
  // and Safari.
  dataChannel.binaryType = 'arraybuffer';

  var self = this;
  dataChannel.addEventListener('message', function(event) {
    self.emit('message', event.data);
  });
}

inherits(DataTrackReceiver, DataTrackTransceiver);

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

module.exports = DataTrackReceiver;

},{"./transceiver":7,"util":146}],6:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var DataTrackTransceiver = require('./transceiver');
var makeUUID = require('../util').makeUUID;

/**
 * Construct a {@link DataTrackSender}.
 * @class
 * @classdesc A {@link DataTrackSender} represents a
 *   {@link DataTrackTransceiver} over which data can be sent. Internally, it uses a
 *   collection of RTCDataChannels to send data.
 * @extends DataTrackTransceiver
 * @param {?number} maxPacketLifeTime
 * @param {?number} maxRetransmits
 * @param {boolean} ordered
 */
function DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered) {
  if (!(this instanceof DataTrackSender)) {
    return new DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered);
  }
  var id = makeUUID();
  DataTrackTransceiver.call(this, id, maxPacketLifeTime, maxRetransmtis, ordered);
  Object.defineProperties(this, {
    _dataChannels: {
      value: new Set()
    }
  });
}

inherits(DataTrackSender, DataTrackTransceiver);

/**
 * Add an RTCDataChannel to the {@link DataTrackSender}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
DataTrackSender.prototype.addDataChannel = function addDataChannel(dataChannel) {
  this._dataChannels.add(dataChannel);
  return this;
};

/**
 * Remove an RTCDataChannel from the {@link DataTrackSender}.
 * @param {RTCDataChannel} dataChannel
 * @returns {this}
 */
DataTrackSender.prototype.removeDataChannel = function removeDataChannel(dataChannel) {
  this._dataChannels.delete(dataChannel);
  return this;
};

/**
 * Send data over the {@link DataTrackSender}. Internally, this calls
 * <code>send</code> over each of the underlying RTCDataChannels.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
 * @returns {this}
 */
DataTrackSender.prototype.send = function send(data) {
  this._dataChannels.forEach(function(dataChannel) {
    try {
      dataChannel.send(data);
    } catch (error) {
      // Do nothing.
    }
  });
  return this;
};

module.exports = DataTrackSender;

},{"../util":74,"./transceiver":7,"util":146}],7:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var TrackTransceiver = require('../transceiver');

/**
 * Construct a {@link DataTrackTransceiver}.
 * @class
 * @classdesc A {@link DataTrackTransceiver} represents either one or more local
 *   RTCDataChannels or a single remote RTCDataChannel. It can be used to send
 *   or receive data.
 * @param {string} id
 * @param {?number} maxPacketLifeTime
 * @param {?number} maxRetransmits
 * @param {boolean} ordered
 * @property {string} id
 * @property {string} kind - "data"
 * @property {?number} maxPacketLifeTime
 * @property {?number} maxRetransmits
 * @property {boolean} ordered
 * @implements TrackTransceiver
 */
function DataTrackTransceiver(id, maxPacketLifeTime, maxRetransmits, ordered) {
  EventEmitter.call(this);
  TrackTransceiver.call(this, id, 'data');
  Object.defineProperties(this, {
    maxPacketLifeTime: {
      enumerable: true,
      value: maxPacketLifeTime
    },
    maxRetransmits: {
      enumerable: true,
      value: maxRetransmits
    },
    ordered: {
      enumerable: true,
      value: ordered
    }
  });
}

inherits(DataTrackTransceiver, EventEmitter);

module.exports = DataTrackTransceiver;

},{"../transceiver":70,"events":142,"util":146}],8:[function(require,module,exports){
'use strict';

var request = require('./request');
var createTwilioError = require('./util/twilio-video-errors').createTwilioError;
var ConfigurationAcquireFailedError = require('./util/twilio-video-errors').ConfigurationAcquireFailedError;

var CONFIG_URL = 'https://ecs.us1.twilio.com/v1/Configuration';

/**
 * Request a configuration setting for the specified JWT.
 * @param {String} token - A JWT String representing a valid AccessToken.
 * @param {?ECS.getConfigurationOptions} [options]
 * @returns {Promise<Object>} configuration - An unformatted map of
 *   configuration settings specific to the specified service.
 * @throws {TwilioError}
 *//**
 * @typedef {Object} ECS.getConfigurationOptions
 * @property {?Object} [body] - A valid JSON payload to send to the
 *   ECS endpoint.
 * @property {?String} [configUrl='https://ecs.us1.twilio.com/v1/Configuration'] - A
 *   custom URL to POST ECS configuration requests to.
 */
function getConfiguration(token, options) {
  if (!token) {
    throw new Error('<String>token is a required argument.');
  }

  options = Object.assign({
    configUrl: CONFIG_URL
  }, options);

  var postData = {
    url: options.configUrl,
    headers: {
      'X-Twilio-Token': token,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  };

  if (options.body) {
    postData.body = toQueryString(options.body);
  }

  return request.post(postData).then(function(responseText) {
    return parseJsonTextFromECS(responseText);
  }, function(errorText) {
    var error = parseJsonTextFromECS(errorText);
    throw createTwilioError(error.code, error.message);
  });
}

function parseJsonTextFromECS(jsonText) {
  var json = null;
  try {
    json = JSON.parse(jsonText);
  } catch (error) {
    throw new ConfigurationAcquireFailedError();
  }
  return json;
}

function toQueryString(params) {
  return Object.keys(params || { }).map(function(key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
  }).join('&');
}

module.exports.getConfiguration = getConfiguration;

},{"./request":37,"./util/twilio-video-errors":86}],9:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

/**
 * EncodingParametersImpl
 * @class
 * @classdesc {@link EncodingParametersImpl} represents an object which notifies
 *   its listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements EncodingParameters
 * @fires EncodingParametersImpl#changed
 * @property {?number} maxAudioBitrate
 * @property {?number} maxVideoBitrate
 * @param {EncodingParamters} encodingParameters - Initial {@link EncodingParameters}
 */
function EncodingParametersImpl(encodingParameters) {
  if (!(this instanceof EncodingParametersImpl)) {
    return new EncodingParametersImpl(encodingParameters);
  }
  EventEmitter.call(this);

  encodingParameters = Object.assign({
    maxAudioBitrate: null,
    maxVideoBitrate: null
  }, encodingParameters);

  Object.defineProperties(this, {
    maxAudioBitrate: {
      value: encodingParameters.maxAudioBitrate,
      writable: true
    },
    maxVideoBitrate: {
      value: encodingParameters.maxVideoBitrate,
      writable: true
    }
  });
}

inherits(EncodingParametersImpl, EventEmitter);

/**
 * Returns the bitrate values in an {@link EncodingParameters}.
 * @returns {EncodingParameters}
 */
EncodingParametersImpl.prototype.toJSON = function toJSON() {
  return {
    maxAudioBitrate: this.maxAudioBitrate,
    maxVideoBitrate: this.maxVideoBitrate
  };
};

/**
 * Update the bitrate values with those in the given {@link EncodingParameters}.
 * @param {EncodingParameters} encodingParameters - The new {@link EncodingParameters}
 * @fires EncodingParametersImpl#changed
 */
EncodingParametersImpl.prototype.update = function update(encodingParameters) {
  encodingParameters = Object.assign({
    maxAudioBitrate: this.maxAudioBitrate,
    maxVideoBitrate: this.maxVideoBitrate
  }, encodingParameters);

  var self = this;
  var shouldEmitChanged = [
    'maxAudioBitrate',
    'maxVideoBitrate'
  ].reduce(function(shouldEmitChanged, maxKindBitrate) {
    if (self[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
      self[maxKindBitrate] = encodingParameters[maxKindBitrate];
      shouldEmitChanged = true;
    }
    return shouldEmitChanged;
  }, false);

  if (shouldEmitChanged) {
    this.emit('changed');
  }
};

/**
 * At least one of the {@link EncodingParametersImpl}'s bitrate values changed.
 * @event EncodingParametersImpl#changed
 */

module.exports = EncodingParametersImpl;

},{"events":142,"util":146}],10:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var instances = 0;

/**
 * Construct a {@link ConstantIceServerSource}.
 * @class
 * @classdesc A {@link ConstantIceServerSource} only ever returns a single set
 *   of ICE servers. It is useful for providing a hard-coded set of ICE servers.
 * @implements {IceServerSource}
 * @param {Array<RTCIceServerInit>} iceServers
 */
function ConstantIceServerSource(iceServers) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _instance: {
      value: ++instances
    },
    _iceServers: {
      enumerable: true,
      value: iceServers,
      writable: true
    },
    _isStarted: {
      value: false,
      writable: true
    },
    isStarted: {
      enumerable: true,
      get: function() {
        return this._isStarted;
      }
    }
  });
}

inherits(ConstantIceServerSource, EventEmitter);

ConstantIceServerSource.prototype.start = function start() {
  this._isStarted = true;
  return Promise.resolve(this._iceServers);
};

ConstantIceServerSource.prototype.stop = function stop() {
  this._isStarted = false;
};

ConstantIceServerSource.prototype.toString = function toString() {
  return '[ConstantIceServerSource #' + this._instance + ']';
};

module.exports = ConstantIceServerSource;

},{"events":142,"util":146}],11:[function(require,module,exports){
'use strict';

var constants = require('../util/constants');
var ECS = require('../ecs');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Log = require('../util/log');
var TimeoutPromise = require('../util/timeoutpromise');
var util = require('../util');
var version = require('../../package.json').version;

var instances = 0;

/**
 * @typedef {ECS.getConfigurationOptions} NTSIceServerSourceOptions
 * @property {Array<RTCIceServerInit>} [defaultIceServers]
 * @property {number} [defaultTTL]
 * @property {string} [ecsServer]
 * @property {string} [environment="prod"]
 * @property {function(string, ECS.getConfigurationOptions): Promise<object>} [getConfiguration]
 * @property {string} [realm="us1"]
 * @property {Log} [log]
 * @property {number} [timeout]
 */

/**
 * Construct an {@link NTSIceServerSource}.
 * @class
 * @classdesc A Network Traversal Service (NTS)-backed implementation of
 *   {@link IceServerSource}; useful for getting fresh TURN servers from Twilio
 * @implements {IceServerSource}
 * @param {string} token - Access Token
 * @param {NTSIceServerSourceOptions} [options]
 */
function NTSIceServerSource(token, options) {
  EventEmitter.call(this);

  options = Object.assign({
    defaultTTL: constants.ICE_SERVERS_DEFAULT_TTL,
    environment: constants.DEFAULT_ENVIRONMENT,
    getConfiguration: ECS.getConfiguration,
    realm: constants.DEFAULT_REALM,
    timeout: constants.ICE_SERVERS_TIMEOUT_MS
  }, options);

  /* eslint-disable new-cap */
  var defaultIceServers = constants.DEFAULT_ICE_SERVERS(options.environment);
  var ecsServer = options.ecsServer || constants.ECS_SERVER(options.environment, options.realm);
  /* eslint-enable new-cap */

  var log = options.log
    ? options.log.createLog('default', this)
    : new Log('default', this, util.buildLogLevels('off'));

  Object.defineProperties(this, {
    // This Promise represents the current invocation of `poll`. `start` sets it
    // and `stop` clears it out.
    _currentPoll: {
      value: null,
      writable: true
    },
    // In the event that ECS or NTS fail to return ICE servers in a timely
    // manner, NTSIceServerSource falls back to these servers.
    _defaultIceServers: {
      value: defaultIceServers
    },
    _defaultTTL: {
      value: options.defaultTTL
    },
    // This is the ECS server NTSIceServerSource communicates with.
    _ecsServer: {
      value: ecsServer
    },
    _getConfiguration: {
      value: options.getConfiguration
    },
    _instance: {
      value: ++instances
    },
    // This timer ID represents the next invocation of `poll`.
    _nextPoll: {
      value: null,
      writable: true
    },
    _log: {
      value: log
    },
    // This Deferred remains unresolved until `stop` is called. We use it to
    // short-circuit in `poll`.
    _stopped: {
      value: util.defer(),
      writable: true
    },
    // This value configures the amount of time NTSIceServerSource will wait
    // when fetching ICE servers.
    _timeout: {
      value: options.timeout
    },
    // This is the Access Token NTSIceServerSource makes requests to ECS with.
    _token: {
      value: token
    },
    isStarted: {
      enumerable: true,
      get: function() {
        return !!this._currentPoll;
      }
    }
  });

  this._log.info('Created a new NTSIceServerSource');
  this._log.debug('ECS server:', this._ecsServer);
}

inherits(NTSIceServerSource, EventEmitter);

NTSIceServerSource.prototype.start = function start() {
  if (!this.isStarted) {
    this._log.info('Starting');
    this._currentPoll = poll(this);
  } else {
    this._log.warn('Already started');
  }
  return this._currentPoll;
};

NTSIceServerSource.prototype.stop = function stop() {
  if (!this.isStarted) {
    this._log.warn('Already stopped');
    return;
  }
  this._log.info('Stopping');
  this._currentPoll = null;
  clearTimeout(this._nextPoll);
  this._stopped.resolve();
  this._stopped = util.defer();
  this._log.debug('Stopped');
};

NTSIceServerSource.prototype.toString = function toString() {
  return '[NTSIceServerSource #' + this._instance + ']';
};

/**
 * Parse an ECS configuration value, log any warnings, and return a tuple of
 * ICE servers and TTL.
 * @param {NTSIceServerSource} client
 * @param {object} config
 * @returns {Array<Array<RTCIceServerInit>|Number>} iceServersAndTTL
 * @throws {Error}
 */
function parseECSConfig(client, config) {
  var nts = util.getOrNull(config, 'video.network_traversal_service');
  if (!nts) {
    throw new Error('network_traversal_service not available');
  } else if (nts.warning) {
    client._log.warn(nts.warning);
  }

  var iceServers = nts.ice_servers;
  if (!iceServers) {
    throw new Error('ice_servers not available');
  }
  client._log.info('Got ICE servers: ' + JSON.stringify(iceServers));

  var ttl = nts.ttl || client._defaultTTL;
  return [iceServers, ttl];
}

/**
 * Get ICE servers and their TTL.
 * @private
 * @param {NTSIceServerSource} nts
 * @returns {Promise<Array<RTCIceServerInit>>} iceServers
 */
function poll(client) {
  // We race `getConfiguration` against the `_stopped` Promise so that, when
  // `stop` is called on the NTSIceServerSource, we can immediately proceed
  // without waiting on `getConfiguration`.
  client._log.debug('Getting ECS configuration');

  var options = {
    configUrl: client._ecsServer + '/v1/Configuration',
    body: {
      service: 'video',
      /* eslint-disable camelcase */
      sdk_version: version
      /* eslint-enable camelcase */
    }
  };

  var alreadyStopped = new Error('Already stopped');
  var config = client._getConfiguration(client._token, options);
  var configWithTimeout = new TimeoutPromise(config, client._timeout);

  return Promise.race([
    configWithTimeout,
    client._stopped.promise
  ]).then(function(config) {
    if (!config) {
      throw alreadyStopped;
    }
    return parseECSConfig(client, config);
  }).catch(function(error) {
    if (!client.isStarted) {
      throw alreadyStopped;
    } else if (configWithTimeout.isTimedOut) {
      client._log.warn('Getting ICE servers took too long (using defaults)');
    } else {
      // NOTE(mroberts): Stop if we get an Access Token error (2xxxx)
      if (error.code && Math.floor(error.code / 10000) === 2) {
        client.stop();
      }
      client._log.warn('Failed to get ICE servers (using defaults):', error);
    }
    return [client._defaultIceServers, client._defaultTTL];
  }).then(function(iceServersAndTTL) {
    var iceServers = iceServersAndTTL[0];
    var ttl = iceServersAndTTL[1];

    if (client.isStarted) {
      client._log.info('Getting ICE servers again in ' + ttl + ' seconds');
      client._nextPoll = setTimeout(function nextPoll() {
        if (client.isStarted) {
          client._currentPoll = poll(client);
        }
      }, (ttl - constants.ECS_TIMEOUT) * 1000);
    }

    client._iceServers = iceServers;
    try {
      client.emit('iceServers', iceServers);
    } catch (error) {
      // Do nothing.
    }
    return iceServers;
  });
}

module.exports = NTSIceServerSource;

},{"../../package.json":147,"../ecs":8,"../util":74,"../util/constants":72,"../util/log":77,"../util/timeoutpromise":85,"events":142,"util":146}],12:[function(require,module,exports){
'use strict';

var version = require('../package.json').version;
var Video = {};

Object.defineProperties(Video, {
  connect: {
    enumerable: true,
    value: require('./connect')
  },
  createLocalAudioTrack: {
    enumerable: true,
    value: require('./createlocaltrack').audio
  },
  createLocalTracks: {
    enumerable: true,
    value: require('./createlocaltracks')
  },
  createLocalVideoTrack: {
    enumerable: true,
    value: require('./createlocaltrack').video
  },
  isSupported: {
    enumerable: true,
    value: require('./util/support')()
  },
  LocalAudioTrack: {
    enumerable: true,
    value: require('./media/track/localaudiotrack')
  },
  LocalDataTrack: {
    enumerable: true,
    value: require('./media/track/localdatatrack')
  },
  LocalVideoTrack: {
    enumerable: true,
    value: require('./media/track/localvideotrack')
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;

},{"../package.json":147,"./connect":2,"./createlocaltrack":3,"./createlocaltracks":4,"./media/track/localaudiotrack":16,"./media/track/localdatatrack":18,"./media/track/localvideotrack":22,"./util/support":84}],13:[function(require,module,exports){
'use strict';

var util = require('./util');
var inherits = require('util').inherits;
var E = require('./util/constants').typeErrors;
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalDataTrack = require('./media/track/localdatatrack');
var LocalVideoTrack = require('./media/track/localvideotrack');
var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var Participant = require('./participant');
var LocalAudioTrackPublication = require('./media/track/localaudiotrackpublication');
var LocalDataTrackPublication = require('./media/track/localdatatrackpublication');
var LocalVideoTrackPublication = require('./media/track/localvideotrackpublication');

/**
 * Construct a {@link LocalParticipant}.
 * @class
 * @classdesc A {@link LocalParticipant} represents the local {@link Participant}
 * in a {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {Array<LocalTrack>} localTracks
 * @param {Object} options
 * @property {Map<Track.SID, LocalAudioTrackPublication>} audioTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalAudioTrackPublication}s
 * @property {Map<Track.ID, LocalAudioTrack>} audioTracks -
 *   The {@link LocalParticipant}'s {@link LocalAudioTrack}s
 * @property {Map<Track.SID, LocalDataTrackPublication>} dataTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalDataTrackPublication}s
 * @property {Map<Track.ID, LocalDataTrack>} dataTracks -
 *   The {@link LocalParticipant}'s {@link LocalDataTrack}s
 * @property {Map<Track.SID, LocalTrackPublication>} trackPublications -
 *    The {@link LocalParticipant}'s {@link LocalTrackPublication}s
 * @property {Map<Track.ID, LocalTrack>} tracks -
 *    The {@link LocalParticipant}'s {@link LocalTrack}s
 * @property {Map<Track.SID, LocalVideoTrackPublication>} videoTrackPublications -
 *    The {@link LocalParticipant}'s {@link LocalVideoTrackPublication}s
 * @property {Map<Track.ID, LocalVideoTrack>} videoTracks -
 *   The {@link LocalParticipant}'s {@link LocalVideoTrack}s
 * @fires LocalParticipant#trackAdded
 * @fires LocalParticipant#trackDimensionsChanged
 * @fires LocalParticipant#trackDisabled
 * @fires LocalParticipant#trackEnabled
 * @fires LocalParticipant#trackPublicationFailed
 * @fires LocalParticipant#trackPublished
 * @fires LocalParticipant#trackRemoved
 * @fires LocalParticipant#trackStarted
 * @fires LocalParticipant#trackStopped
 */
function LocalParticipant(signaling, localTracks, options) {
  if (!(this instanceof LocalParticipant)) {
    return new LocalParticipant(signaling, localTracks, options);
  }

  options = Object.assign({
    LocalAudioTrack: LocalAudioTrack,
    LocalVideoTrack: LocalVideoTrack,
    LocalDataTrack: LocalDataTrack,
    MediaStreamTrack: MediaStreamTrack,
    LocalAudioTrackPublication: LocalAudioTrackPublication,
    LocalVideoTrackPublication: LocalVideoTrackPublication,
    LocalDataTrackPublication: LocalDataTrackPublication,
    shouldStopLocalTracks: false,
    tracks: localTracks
  }, options);

  var tracksToStop = options.shouldStopLocalTracks
    ? new Set(localTracks.filter(function(localTrack) {
        return localTrack.kind !== 'data';
      }))
    : new Set();

  Object.defineProperties(this, {
    _LocalAudioTrack: {
      value: options.LocalAudioTrack
    },
    _LocalDataTrack: {
      value: options.LocalDataTrack
    },
    _LocalVideoTrack: {
      value: options.LocalVideoTrack
    },
    _MediaStreamTrack: {
      value: options.MediaStreamTrack
    },
    _LocalAudioTrackPublication: {
      value: options.LocalAudioTrackPublication
    },
    _LocalDataTrackPublication: {
      value: options.LocalDataTrackPublication
    },
    _LocalVideoTrackPublication: {
      value: options.LocalVideoTrackPublication
    },
    _tracksToStop: {
      value: tracksToStop
    },
    audioTrackPublications: {
      value: new Map()
    },
    dataTrackPublications: {
      value: new Map()
    },
    trackPublications: {
      value: new Map()
    },
    videoTrackPublications: {
      value: new Map()
    }
  });

  Participant.call(this, signaling, options);
}

inherits(LocalParticipant, Participant);

/**
 * Get the {@link LocalTrack} events to re-emit.
 * @private
 * @returns {Array<Array<string>>} events
 */
LocalParticipant.prototype._getTrackEvents = function _getTrackEvents() {
  return Participant.prototype._getTrackEvents.call(this).concat([
    ['disabled', 'trackDisabled'],
    ['enabled', 'trackEnabled'],
    ['stopped', 'trackStopped']
  ]);
};

LocalParticipant.prototype.toString = function toString() {
  return '[LocalParticipant #' + this._instanceId
    + (this.sid ? ': ' + this.sid : '')
    + ']';
};

LocalParticipant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var log = this._log;

  if (this.state === 'disconnected') {
    return;
  }

  var signaling = this._signaling;

  function localTrackAdded(localTrack) {
    signaling.addTrack(localTrack._trackSender, localTrack.name);
    log.info('Added a new ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  function localTrackDisabled(localTrack) {
    var trackSignaling = signaling.tracks.get(localTrack.id);
    trackSignaling.disable();
    log.debug('Disabled the ' + util.trackClass(localTrack, true) + ':', localTrack.id);
  }

  function localTrackEnabled(localTrack) {
    var trackSignaling = signaling.tracks.get(localTrack.id);
    trackSignaling.enable();
    log.debug('Enabled the ' + util.trackClass(localTrack, true) + ':', localTrack.id);
  }

  function localTrackRemoved(localTrack) {
    signaling.removeTrack(localTrack._trackSender);
    log.info('Removed a ' + util.trackClass(localTrack, true) + ':', localTrack.id);
    log.debug(util.trackClass(localTrack, true) + ':', localTrack);
  }

  this.on('trackAdded', localTrackAdded);
  this.on('trackDisabled', localTrackDisabled);
  this.on('trackEnabled', localTrackEnabled);
  this.on('trackRemoved', localTrackRemoved);

  this.tracks.forEach(function(track) {
    localTrackAdded(track);
    this._getOrCreateLocalTrackPublication(track).catch(function() {
      // Do nothing for now.
    });
  }, this);

  var self = this;
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    if (state === 'disconnected') {
      log.debug('Removing LocalTrack event listeners');
      signaling.removeListener('stateChanged', stateChanged);
      self.removeListener('trackAdded', localTrackAdded);
      self.removeListener('trackDisabled', localTrackDisabled);
      self.removeListener('trackEnabled', localTrackEnabled);
      self.removeListener('trackRemoved', localTrackRemoved);

      log.info('LocalParticipant disconnected. Stopping ' +
        self._tracksToStop.size + ' automatically-acquired LocalTracks');
      self._tracksToStop.forEach(function(track) {
        track.stop();
      });
    }
  });
};

LocalParticipant.prototype._getOrCreateLocalTrackPublication = function _getOrCreateLocalTrackPublication(localTrack) {
  var localTrackPublication = getTrackPublication(this.trackPublications, localTrack);
  if (localTrackPublication) {
    return localTrackPublication;
  }

  var log = this._log;
  var self = this;

  var trackSignaling = this._signaling.tracks.get(localTrack.id);
  if (!trackSignaling) {
    return Promise.reject(new Error('Unexpected error: The ' + localTrack
      + ' cannot be published'));
  }

  function unpublish(publication) {
    self.unpublishTrack(publication.track);
  }

  return new Promise(function(resolve, reject) {
    function updated() {
      var error = trackSignaling.error;
      if (error) {
        trackSignaling.removeListener('updated', updated);
        log.warn('Failed to publish the ' + util.trackClass(localTrack, true) + ': ' + error.message);
        self._removeTrack(localTrack);
        setTimeout(function() {
          self.emit('trackPublicationFailed', error, localTrack);
        });
        reject(error);
        return;
      }

      if (!self.tracks.has(localTrack.id)) {
        trackSignaling.removeListener('updated', updated);
        reject(new Error('The ' + localTrack + ' was unpublished'));
        return;
      }

      var sid = trackSignaling.sid;
      if (!sid) {
        return;
      }

      trackSignaling.removeListener('updated', updated);

      var options = {
        log: log,
        LocalAudioTrackPublication: self._LocalAudioTrackPublication,
        LocalDataTrackPublication: self._LocalDataTrackPublication,
        LocalVideoTrackPublication: self._LocalVideoTrackPublication
      };

      var publishedKindTracks = {
        audio: self.audioTrackPublications,
        video: self.videoTrackPublications,
        data: self.dataTrackPublications
      }[localTrack.kind];

      localTrackPublication = getTrackPublication(self.trackPublications, localTrack);

      if (!localTrackPublication) {
        localTrackPublication = util.asLocalTrackPublication(localTrack, sid, unpublish, options);
        self.trackPublications.set(sid, localTrackPublication);
        publishedKindTracks.set(sid, localTrackPublication);
        log.info('Created a new ' + util.trackClass(localTrack) + 'Publication:', sid);
      }

      if (self._signaling.state === 'connected') {
        setTimeout(function() {
          self.emit('trackPublished', localTrackPublication);
        });
      }
      resolve(localTrackPublication);
    }

    trackSignaling.on('updated', updated);
  });
};

/**
 * Adds a {@link LocalTrack} to the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#publishTrack} instead
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack} to add;
 *   if a MediaStreamTrack is provided, and a corresponding {@link LocalTrack}
 *   has not yet been added, this method will construct one
 * @returns {?LocalTrack} - The {@link LocalTrack} if added, null if already
 *   present
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTrack = function addTrack(track) {
  this._log.deprecated('LocalParticipant#addTrack has been deprecated. '
    + 'Use LocalParticipant#publishTrack instead.');
  util.validateLocalTrack(track, {
    LocalAudioTrack: this._LocalAudioTrack,
    LocalDataTrack: this._LocalDataTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  });
  if (this.tracks.has(track.id)) {
    return null;
  }
  this.publishTrack(track).catch(function() {
    // Do nothing.
  });
  return this.tracks.get(track.id);
};

/**
 * Adds multiple {@link LocalTrack}s to the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#publishTracks} instead
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to add; for any MediaStreamTracks provided, if a corresponding
 *   {@link LocalAudioTrack} or {@link LocalVideoTrack} has not yet been added,
 *   this method will construct one
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *   added; if the {@link LocalParticipant} already has a {@link LocalTrack},
 *   it won't be included in the Array
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.addTracks = function addTracks(tracks) {
  this._log.deprecated('LocalParticipant#addTracks has been deprecated. '
    + 'Use LocalParticipant#publishTracks instead.');
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
  }
  tracks = tracks.filter(function(track) {
    return !this.tracks.has(track.id);
  }, this);
  this.publishTracks(tracks).catch(function() {
    // Do nothing.
  });
  return tracks.map(function(track) {
    return this.tracks.get(track.id);
  }, this);
};

/**
 * Publishes a {@link LocalTrack} to the {@link Room}.
 * @param {LocalTrack} localTrack - The {@link LocalTrack} to publish
 * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
 *   {@link LocalTrackPublication} if successful
 * @fires Participant#trackAdded
*//**
 * Publishes a MediaStreamTrack to the {@link Room}.
 * @param {MediaStreamTrack} mediaStreamTrack - The MediaStreamTrack
 *   to publish; if a corresponding {@link LocalAudioTrack} or
 *   {@link LocalVideoTrack} has not yet been published, this method will
 *   construct one
 * @param {LocalTrackOptions} [options] - The {@link LocalTrackOptions} for
 *   constructing the  MediaStreamTrack's corresponding {@link LocalAudioTrack}
 *   or {@link LocalVideoTrack}
 * @returns {Promise<LocalTrackPublication>} - Resolves with the corresponding
 *   {@link LocalTrackPublication} if successful
 * @fires Participant#trackAdded
 * @example
 * var Video = require('twilio-video');
 *
 * Video.connect(token, {
 *   name: 'my-cool-room',
 *   audio: true
 * }).then(function(room) {
 *   // Publish a video MediaStreamTrack with a custom name
 *   return room.localParticipant.publishTrack(mediaStreamTrack, {
 *     name: 'camera'
 *   });
 * }).then(function(publication) {
 *   console.log('The LocalTrack "' + publication.trackName + '" was successfully published');
 * });
 */
LocalParticipant.prototype.publishTrack = function publishTrack(localTrackOrMediaStreamTrack, options) {
  var trackPublication = getTrackPublication(this.trackPublications, localTrackOrMediaStreamTrack);
  if (trackPublication) {
    return Promise.resolve(trackPublication);
  }

  options = Object.assign({
    log: this._log,
    LocalAudioTrack: this._LocalAudioTrack,
    LocalDataTrack: this._LocalDataTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  }, options);

  var localTrack;
  try {
    localTrack = util.asLocalTrack(localTrackOrMediaStreamTrack, options);
  } catch (error) {
    return Promise.reject(error);
  }

  localTrack = this._addTrack(localTrack) || this.tracks.get(localTrack.id);
  return this._getOrCreateLocalTrackPublication(localTrack);
};

/**
 * Publishes multiple {@link LocalTrack}s to the {@link Room}.
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to publish; for any MediaStreamTracks provided, if a corresponding
 *   {@link LocalAudioTrack} or {@link LocalVideoTrack} has not yet been
 *   published, this method will construct one
 * @returns {Promise<Array<LocalTrackPublication>>} - The resulting
 *   {@link LocalTrackPublication}s
 * @fires Participant#trackAdded
 * @throws {TypeError}
 */
LocalParticipant.prototype.publishTracks = function publishTracks(tracks) {
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
  }
  return Promise.all(tracks.map(this.publishTrack, this));
};

/**
 * Removes a {@link LocalTrack} from the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#unpublishTrack} instead
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack}
 *   to remove; if a MediaStreamTrack is provided, this method looks up the
 *   corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalAudioTrack#stop} or {@link LocalVideoTrack#stop}
 * @returns {?LocalTrack} - The {@link LocalTrack} removed, otherwise null
 * @fires Participant#trackRemoved
 * @throws {TypeError}
*/
LocalParticipant.prototype.removeTrack = function removeTrack(track, stop) {
  this._log.deprecated('LocalParticipant#removeTrack has been deprecated. '
    + 'Use LocalParticipant#unpublishTrack instead.');
  var publication = this.unpublishTrack(track);
  track = publication && publication.track;
  stop = typeof stop === 'boolean' ? stop : true;
  if (track && stop) {
    track.stop();
    this._log.info('Stopped LocalTrack:', track);
  }
  return track;
};

/**
 * Removes multiple {@link LocalTrack}s from the {@link LocalParticipant}.
 * @deprecated Use {@link LocalParticipant#unpublishTracks} instead
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to remove; for any MediaStreamTracks provided, this method looks up the
 *   corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to remove
 * @param {?boolean} [stop=true] - Whether or not to call
 *   {@link LocalAudioTrack#stop} or {@link LocalVideoTrack#stop} on each
 *   {@link LocalAudioTrack} or {@link LocalVideoTrack} that was successfully
 *   removed
 * @returns {Array<LocalTrack>} - The {@link LocalTrack}s that were successfully
 *   removed
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.removeTracks = function removeTracks(tracks, stop) {
  this._log.deprecated('LocalParticipant#removeTracks has been deprecated. '
    + 'Use LocalParticipant#unpublishTracks instead.');
  stop = typeof stop === 'boolean' ? stop : true;
  return this.unpublishTracks(tracks).map(function(publication) {
    var track = publication.track;
    if (stop) {
      track.stop();
    }
    return track;
  });
};


/**
 * Set the {@link LocalParticipant}'s {@link EncodingParameters}.
 * @param {?EncodingParameters} [encodingParameters] - The new
 *   {@link EncodingParameters}; If null, then the bitrate limits are removed;
 *   If not specified, then the existing bitrate limits are preserved
 * @returns {this}
 * @throws {TypeError}
 */
LocalParticipant.prototype.setParameters = function setParameters(encodingParameters) {
  if (typeof encodingParameters !== 'undefined'
    && typeof encodingParameters !== 'object') {
    throw new E.INVALID_TYPE('encodingParameters',
      'EncodingParameters, null or undefined');
  }

  if (encodingParameters) {
    ['maxAudioBitrate', 'maxVideoBitrate'].forEach(function(prop) {
      if (typeof encodingParameters[prop] !== 'undefined'
        && typeof encodingParameters[prop] !== 'number'
        && encodingParameters[prop] !== null) {
        throw new E.INVALID_TYPE('encodingParameters.' + prop, 'number, null or undefined');
      }
    });
  } else if (encodingParameters === null) {
    encodingParameters = { maxAudioBitrate: null, maxVideoBitrate: null };
  }

  this._signaling.setParameters(encodingParameters);
  return this;
};

/**
 * Stops publishing a {@link LocalTrack} to the {@link Room}.
 * @param {LocalTrack|MediaStreamTrack} track - The {@link LocalTrack}
 *   to stop publishing; if a MediaStreamTrack is provided, this method
 *   looks up the corresponding {@link LocalAudioTrack} or
 *   {@link LocalVideoTrack} to stop publishing
 * @returns {?LocalTrackPublication} - The corresponding
 *   {@link LocalTrackPublication} if the {@link LocalTrack} was previously
 *   published, null otherwise
 * @fires Participant#trackRemoved
 * @throws {TypeError}
*/
LocalParticipant.prototype.unpublishTrack = function unpublishTrack(track) {
  util.validateLocalTrack(track, {
    LocalAudioTrack: this._LocalAudioTrack,
    LocalDataTrack: this._LocalDataTrack,
    LocalVideoTrack: this._LocalVideoTrack,
    MediaStreamTrack: this._MediaStreamTrack
  });

  var localTrack = this.tracks.get(track.id);
  if (!localTrack) {
    return null;
  }

  var trackSignaling = this._signaling.tracks.get(localTrack.id);
  trackSignaling.publishFailed(new Error('The ' + localTrack + ' was unpublished'));

  var publishedKindTracks = {
    audio: this.audioTrackPublications,
    video: this.videoTrackPublications,
    data: this.dataTrackPublications
  }[localTrack.kind];
  var localTrackPublication = getTrackPublication(this.trackPublications, localTrack);

  if (localTrackPublication) {
    publishedKindTracks.delete(localTrackPublication.trackSid);
    this.trackPublications.delete(localTrackPublication.trackSid);
  }

  this._removeTrack(localTrack);

  return localTrackPublication;
};

/**
 * Stops publishing multiple {@link LocalTrack}s to the {@link Room}.
 * @param {Array<LocalTrack|MediaStreamTrack>} tracks - The {@link LocalTrack}s
 *   to stop publishing; for any MediaStreamTracks provided, this method looks
 *   up the corresponding {@link LocalAudioTrack} or {@link LocalVideoTrack} to
 *   stop publishing
 * @returns {Array<LocalTrackPublication>} - The corresponding
 *   {@link LocalTrackPublication}s that were successfully unpublished
 * @fires Participant#trackRemoved
 * @throws {TypeError}
 */
LocalParticipant.prototype.unpublishTracks = function unpublishTracks(tracks) {
  if (!Array.isArray(tracks)) {
    throw new E.INVALID_TYPE('tracks',
      'Array of LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
  }

  var self = this;
  return tracks.reduce(function(unpublishedTracks, track) {
    var unpublishedTrack = self.unpublishTrack(track);
    return unpublishedTrack ? unpublishedTracks.concat(unpublishedTrack) : unpublishedTracks;
  }, []);
};

/**
 * A {@link LocalTrack} was added by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was added
 * @event LocalParticipant#trackAdded
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalVideoTrack}'s dimensions changed.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} whose dimensions changed
 * @event LocalParticipant#trackDimensionsChanged
 */

/**
 * A {@link LocalTrack} was disabled by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was disabled
 * @event LocalParticipant#trackDisabled
 */

/**
 * A {@link LocalTrack} was enabled by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was enabled
 * @event LocalParticipant#trackEnabled
 */

/**
 * A {@link LocalTrack} failed to publish. Check the error message for more
 * information.
 * @param {TwilioError} error - A {@link TwilioError} explaining why publication
 *   failed
 * @param {LocalTrack} localTrack - The {@link LocalTrack} that failed to
 *   publish
 * @event LocalParticipant#trackPublicationFailed
 */

/**
 * A {@link LocalTrack} was successfully published.
 * @param {LocalTrackPublication} publication - The resulting
 *   {@link LocalTrackPublication} for the published {@link LocalTrack}
 * @event LocalParticipant#trackPublished
 */

/**
 * A {@link LocalTrack} was removed by the {@link LocalParticipant}.
 * @param {LocalTrack} track - The {@link LocalTrack} that was removed
 * @event LocalParticipant#trackRemoved
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrack}s started.
 * @param {LocalTrack} track - The {@link LocalTrack} that started
 * @event LocalParticipant#trackStarted
 */

/**
 * One of the {@link LocalParticipant}'s {@link LocalTrack}s stopped, either
 * because {@link LocalTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalTrack} track - The {@link LocalTrack} that stopped
 * @event LocalParticipant#trackStopped
 */

/**
 * Outgoing media encoding parameters.
 * @typedef {object} EncodingParameters
 * @property {?number} [maxAudioBitrate] - Max outgoing audio bitrate (bps);
 *   If not specified, retains the existing bitrate limit; A <code>null</code>
 *   value removes any previously set bitrate limit
 * @property {?number} [maxVideoBitrate] - Max outgoing video bitrate (bps);
 *   If not specified, retains the existing bitrate limit; A <code>null</code>
 *   value removes any previously set bitrate limit
 */

/**
 * @private
 * @param {Map<Track.SID, LocalTrackPublication>} trackPublications
 * @param {LocalTrack|MediaStreamTrack} track
 * @returns {LocalTrackPublication?} trackPublication
 */
function getTrackPublication(trackPublications, track) {
  return Array.from(trackPublications.values()).find(function(trackPublication) {
    return trackPublication.track === track
      || trackPublication.track.mediaStreamTrack === track;
  }) || null;
}

module.exports = LocalParticipant;

},{"./media/track/localaudiotrack":16,"./media/track/localaudiotrackpublication":17,"./media/track/localdatatrack":18,"./media/track/localdatatrackpublication":19,"./media/track/localvideotrack":22,"./media/track/localvideotrackpublication":23,"./participant":34,"./util":74,"./util/constants":72,"@twilio/webrtc":125,"util":146}],14:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var MediaTrack = require('./mediatrack');

/**
 * Construct an {@link AudioTrack}.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @extends Track
 * @param {MediaTrackTransceiver} mediaTrackTransceiver
 * @param {{log: Log}} options
 * @property {boolean} isStarted - Whether or not the {@link AudioTrack} has
 *   started; if the {@link AudioTrack} started, there is enough audio data to
 *   begin playback
 * @property {boolean} isEnabled - Whether or not the {@link AudioTrack} is
 *   enabled; if the {@link AudioTrack} is not enabled, it is "muted"
 * @property {Track.Kind} kind - "audio"
 * @property {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
 * @fires AudioTrack#disabled
 * @fires AudioTrack#enabled
 * @fires AudioTrack#started
 */
function AudioTrack(mediaTrackTransceiver, options) {
  MediaTrack.call(this, mediaTrackTransceiver, options);
}

inherits(AudioTrack, MediaTrack);

/**
 * Create an HTMLAudioElement and attach the {@link AudioTrack} to it.
 *
 * The HTMLAudioElement's <code>srcObject</code> will be set to a new
 * MediaStream containing the {@link AudioTrack}'s MediaStreamTrack.
 *
 * @method
 * @returns {HTMLAudioElement} audioElement
 * @example
 * const Video = require('twilio-video');
 *
 * Video.createLocalAudioTrack().then(function(audioTrack) {
 *   const audioElement = audioTrack.attach();
 *   document.body.appendChild(audioElement);
 * });
*//**
 * Attach the {@link AudioTrack} to an existing HTMLMediaElement. The
 * HTMLMediaElement could be an HTMLAudioElement or an HTMLVideoElement.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
 * this method sets it to a new MediaStream containing the {@link AudioTrack}'s
 * MediaStreamTrack; otherwise, it adds the {@link MediaTrack}'s
 * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
 * MediaStreamTracks of the same kind on the MediaStream, this method removes
 * them.
 *
 * @method
 * @param {HTMLMediaElement} mediaElement - The HTMLMediaElement to attach to
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const Video = require('twilio-video');
 *
 * const videoElement = document.createElement('video');
 * document.body.appendChild(videoElement);
 *
 * Video.createLocalAudioTrack().then(function(audioTrack) {
 *   audioTrack.attach(videoElement);
 * });
*//**
 * Attach the {@link AudioTrack} to an HTMLMediaElement selected by
 * <code>document.querySelector</code>. The HTMLMediaElement could be an
 * HTMLAudioElement or an HTMLVideoElement.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
 * this method sets it to a new MediaStream containing the {@link AudioTrack}'s
 * MediaStreamTrack; otherwise, it adds the {@link AudioTrack}'s
 * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
 * MediaStreamTracks of the same kind on the MediaStream, this method removes
 * them.
 *
 * @method
 * @param {string} selector - A query selector for the HTMLMediaElement to
 *   attach to
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const Video = require('twilio-video');
 *
 * const videoElement = document.createElement('video');
 * videoElement.id = 'my-video-element';
 * document.body.appendChild(videoElement);
 *
 * Video.createLocalAudioTrack().then(function(track) {
 *   track.attach('#my-video-element');
 * });
 */
AudioTrack.prototype.attach = MediaTrack.prototype.attach;

/**
 * Detach the {@link AudioTrack} from all previously attached HTMLMediaElements.
 * @method
 * @returns {Array<HTMLMediaElement>} mediaElements
 * @example
 * const mediaElements = audioTrack.detach();
 * mediaElements.forEach(mediaElement => mediaElement.remove());
*//**
 * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement.
 * @method
 * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
 *   which the {@link AudioTrack} is attached
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const videoElement = document.getElementById('my-video-element');
 * audioTrack.detach(videoElement).remove();
*//**
 * Detach the {@link AudioTrack} from a previously attached HTMLMediaElement
 *   specified by <code>document.querySelector</code>.
 * @method
 * @param {string} selector - The query selector of HTMLMediaElement to which
 *    the {@link AudioTrack} is attached
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * audioTrack.detach('#my-video-element').remove();
 */
AudioTrack.prototype.detach = MediaTrack.prototype.detach;

/**
 * The {@link AudioTrack} was disabled, i.e. "muted".
 * @param {AudioTrack} track - The {@link AudioTrack} that was disabled
 * @event AudioTrack#disabled
 */

/**
 * The {@link AudioTrack} was enabled, i.e. "unmuted".
 * @param {AudioTrack} track - The {@link AudioTrack} that was enabled
 * @event AudioTrack#enabled
 */

/**
 * The {@link AudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {AudioTrack} track - The {@link AudioTrack} that started
 * @event AudioTrack#started
 */

module.exports = AudioTrack;

},{"./mediatrack":24,"util":146}],15:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var nInstances = 0;

/**
 * Construct a {@link Track}.
 * @class
 * @classdesc A {@link Track} represents a stream of audio, video, or data.
 * @param {Track.ID} id - The {@link Track}'s ID
 * @param {Track.Kind} kind - The {@link Track}'s kind
 * @param {{ log: Log, name: ?string }} options
 * @property {Track.ID} id - The {@link Track}'s ID
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */
function Track(id, kind, options) {
  options = Object.assign({
    name: id
  }, options);

  EventEmitter.call(this);

  var name = String(options.name);

  Object.defineProperties(this, {
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: options.log.createLog('media', this)
    },
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    },
    name: {
      enumerable: true,
      value: name
    }
  });
}

inherits(Track, EventEmitter);

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @type string
 * @typedef Track.ID
 */

/**
 * The {@link Track} kind is either "audio", "video", or "data".
 * @type {string}
 * @typedef Track.Kind
 */

/**
 * The {@link Track} SID is a unique string identifier for the {@link Track}
 * that is published to a {@link Room}.
 * @type string
 * @typedef Track.SID
 */

/**
 * A {@link DataTrack} is a {@link LocalDataTrack} or {@link RemoteDataTrack}.
 * @type {LocalDataTrack|RemoteDataTrack}
 * @typedef DataTrack
 */

/**
 * A {@link LocalTrack} is a {@link LocalAudioTrack}, {@link LocalVideoTrack},
 * or {@link LocalDataTrack}.
 * @type {LocalAudioTrack|LocalVideoTrack|LocalDataTrack}
 * @typedef LocalTrack
 */

/**
 * {@link LocalTrack} options
 * @typedef {object} LocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 */

/**
 * A {@link RemoteTrack} is a {@link RemoteAudioTrack},
 * {@link RemoteVideoTrack}, or {@link RemoteDataTrack}.
 * @type {RemoteAudioTrack|RemoteVideoTrack|RemoteDataTrack}
 * @typedef RemoteTrack
 */

module.exports = Track;

},{"events":142,"util":146}],16:[function(require,module,exports){
'use strict';

var AudioTrack = require('./audiotrack');
var inherits = require('util').inherits;
var LocalMediaTrack = require('./localmediatrack');

/**
 * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalAudioTrack} is an {@link AudioTrack} representing
 *   audio that your {@link LocalParticipant} can publish to a {@link Room}. It
 *   can be enabled and disabled with {@link LocalAudioTrack#enable} and
 *   {@link LocalAudioTrack#disable} or stopped completely with
 *   {@link LocalAudioTrack#stop}.
 * @extends {AudioTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalAudioTrack} is
 *   stopped
 * @fires LocalAudioTrack#disabled
 * @fires LocalAudioTrack#enabled
 * @fires LocalAudioTrack#started
 * @fires LocalAudioTrack#stopped
 */
function LocalAudioTrack(mediaStreamTrack, options) {
  if (!(this instanceof LocalAudioTrack)) {
    return new LocalAudioTrack(mediaStreamTrack, options);
  }
  LocalMediaTrack.call(this, AudioTrack, mediaStreamTrack, options);
}

inherits(LocalAudioTrack, AudioTrack);

LocalAudioTrack.prototype._end = LocalMediaTrack.prototype._end;

LocalAudioTrack.prototype.toString = function toString() {
  return '[LocalAudioTrack #' + this._instanceId + ': ' + this.id + ']';
};

LocalAudioTrack.prototype.attach = function attach(el) {
  el = AudioTrack.prototype.attach.call(this, el);
  el.muted = true;
  return el;
};

/**
 * Disable the {@link LocalAudioTrack}. This is effectively "mute".
 * @method
 * @returns {this}
 * @fires LocalAudioTrack#disabled
 */
LocalAudioTrack.prototype.disable = LocalMediaTrack.prototype.disable;

/**
 * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires LocalAudioTrack#enabled
*//**
 * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute"
 * or "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the
 *   {@link LocalAudioTrack}
 * @returns {this}
 * @fires LocalAudioTrack#disabled
 * @fires LocalAudioTrack#enabled
 */
LocalAudioTrack.prototype.enable = LocalMediaTrack.prototype.enable;

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalAudioTrack}, you should unpublish it after stopping.
 * @returns {this}
 * @fires LocalAudioTrack#stopped
 */
LocalAudioTrack.prototype.stop = LocalMediaTrack.prototype.stop;

/**
 * The {@link LocalAudioTrack} was disabled, i.e. "muted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was
 *   disabled
 * @event LocalAudioTrack#disabled
 */

/**
 * The {@link LocalAudioTrack} was enabled, i.e. "unmuted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was enabled
 * @event LocalAudioTrack#enabled
 */

/**
 * The {@link LocalAudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that started
 * @event LocalAudioTrack#started
 */

/**
 * The {@link LocalAudioTrack} stopped, either because
 * {@link LocalAudioTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that stopped
 * @event LocalAudioTrack#stopped
 */

module.exports = LocalAudioTrack;

},{"./audiotrack":14,"./localmediatrack":20,"util":146}],17:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalAudioTrackPublication}.
 * @class
 * @classdesc A {@link LocalAudioTrackPublication} is a {@link LocalAudioTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalAudioTrack}
 * @param {LocalAudioTrack} track - the {@link LocalAudioTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "audio"
 * @property {LocalAudioTrack} track - the {@link LocalAudioTrack}
 */
function LocalAudioTrackPublication(sid, track, unpublish, options) {
  if (!(this instanceof LocalAudioTrackPublication)) {
    return new LocalAudioTrackPublication(sid, track, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, track, unpublish, options);
}

inherits(LocalAudioTrackPublication, LocalTrackPublication);

LocalAudioTrackPublication.prototype.toString = function toString() {
  return '[LocalAudioTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalAudioTrackPublication;

},{"./localtrackpublication":21,"util":146}],18:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var Track = require('./');
var DefaultDataTrackSender = require('../../data/sender');
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link LocalDataTrack}.
 * @class
 * @classdesc A {@link LocalDataTrack} is a {@link Track} representing data
 *   that your {@link LocalParticipant} can publish to a {@link Room}.
 * @extends {Track}
 * @param {LocalDataTrackOptions} [options] - {@link LocalDataTrack} options
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which the {@link LocalDataTrack} will send
 *   or re-send data if not acknowledged on the underlying RTCDataChannel(s).
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the {@link LocalDataTrack} will resend data if not successfully
 *   delivered on the underlying RTCDataChannel(s).
 * @property {boolean} ordered - true if data on the {@link LocalDataTrack} is
 *   guaranteed to be sent in order.
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of times the {@link LocalDataTrack} will attempt to send
 *   data, ensuring "reliable" transmission.
 * @example
 * var Video = require('twilio-video');
 *
 * var localDataTrack = new Video.LocalDataTrack();
 * window.addEventListener('mousemove', function(event) {
 *   localDataTrack.send({
 *     x: e.clientX,
 *     y: e.clientY
 *   });
 * });
 *
 * var token1 = getAccessToken();
 * Video.connect(token1, {
 *   name: 'my-cool-room',
 *   tracks: [localDataTrack]
 * });
 *
 * var token2 = getAccessToken();
 * Video.connect(token2, {
 *   name: 'my-cool-room',
 *   tracks: []
 * }).then(function(room) {
 *   room.on('trackSubscribed', function(track) {
 *     track.on('message', function(message) {
 *       console.log(message); // { x: <number>, y: <number> }
 *     });
 *   });
 * });
 */
function LocalDataTrack(options) {
  if (!(this instanceof LocalDataTrack)) {
    return new LocalDataTrack(options);
  }

  options = Object.assign({
    DataTrackSender: DefaultDataTrackSender,
    logLevel: DEFAULT_LOG_LEVEL,
    maxPacketLifeTime: null,
    maxRetransmits: null,
    ordered: true
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var DataTrackSender = options.DataTrackSender;
  var dataTrackSender = new DataTrackSender(
    options.maxPacketLifeTime,
    options.maxRetransmits,
    options.ordered);

  Track.call(this, dataTrackSender.id, 'data', options);

  Object.defineProperties(this, {
    _trackSender: {
      value: dataTrackSender
    },
    maxPacketLifeTime: {
      enumerable: true,
      value: options.maxPacketLifeTime
    },
    maxRetransmits: {
      enumerable: true,
      value: options.maxRetransmits
    },
    ordered: {
      enumerable: true,
      value: options.ordered
    },
    reliable: {
      enumerable: true,
      value: options.maxPacketLifeTime === null
        && options.maxRetransmits === null
    }
  });
}

inherits(LocalDataTrack, Track);

/**
 * Send a message over the {@link LocalDataTrack}.
 * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
 * @returns {void}
 */
LocalDataTrack.prototype.send = function send(data) {
  this._trackSender.send(data);
};

/**
 * {@link LocalDataTrack} options
 * @typedef {LocalTrackOptions} LocalDataTrackOptions
 * @property {?number} [maxPacketLifeTime=null] - Set this to limit the time
 *   (in milliseconds) during which the LocalDataTrack will send or re-send data
 *   if not successfully delivered on the underlying RTCDataChannel(s). It is an
 *   error to specify both this and <code>maxRetransmits</code>.
 * @property {?number} [maxRetransmits=null] - Set this to limit the number of
 *   times the {@link LocalDataTrack} will send or re-send data if not
 *   acknowledged on the underlying RTCDataChannel(s). It is an error to specify
 *   both this and <code>maxPacketLifeTime</code>.
 * @property {boolean} [ordered=true] - Set this to false to allow data on the
 *   LocalDataTrack to be sent out-of-order.
 */

module.exports = LocalDataTrack;

},{"../../data/sender":6,"../../util":74,"../../util/constants":72,"../../util/log":77,"./":15,"util":146}],19:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalDataTrackPublication}.
 * @class
 * @classdesc A {@link LocalDataTrackPublication} is a {@link LocalDataTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalDataTrack}
 * @param {LocalDataTrack} track - the {@link LocalDataTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "data"
 * @property {LocalDataTrack} track - the {@link LocalDataTrack}
 */
function LocalDataTrackPublication(sid, track, unpublish, options) {
  if (!(this instanceof LocalDataTrackPublication)) {
    return new LocalDataTrackPublication(sid, track, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, track, unpublish, options);
}

inherits(LocalDataTrackPublication, LocalTrackPublication);

LocalDataTrackPublication.prototype.toString = function toString() {
  return '[LocalDataTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalDataTrackPublication;

},{"./localtrackpublication":21,"util":146}],20:[function(require,module,exports){
'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var MediaTrack = require('./mediatrack');
var MediaTrackSender = require('./sender');

/**
 * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalMediaTrack} represents audio or video that your
 * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
 * enabled and disabled with {@link LocalMediaTrack#enable} and
 * {@link LocalMediaTrack#disable} or stopped completely with
 * {@link LocalMediaTrack#stop}.
 * @extends MediaTrack
 * @param {function(MediaTrackTransceiver, TrackSignaling): MediaTrack} - MediaTrack
 * @param {MediaStream} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalMediaTrack} is stopped
 * @fires LocalMediaTrack#stopped
 */
function LocalMediaTrack(MediaTrack, mediaStreamTrack, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);

  var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
  MediaTrack.call(this, mediaTrackSender, options);

  Object.defineProperties(this, {
    _didCallEnd: {
      value: false,
      writable: true
    },
    _trackSender: {
      value: mediaTrackSender
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this.mediaStreamTrack.enabled;
      }
    },
    isStopped: {
      get: function() {
        return this.mediaStreamTrack.readyState === 'ended';
      }
    }
  });
}

LocalMediaTrack.prototype._end = function _end() {
  if (this._didCallEnd) {
    return;
  }
  MediaTrack.prototype._end.call(this);
  this._didCallEnd = true;
  this.emit('stopped', this);
};

LocalMediaTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (enabled !== this.mediaStreamTrack.enabled) {
    this._log.info((enabled ? 'En' : 'Dis') + 'abling');
    this.mediaStreamTrack.enabled = enabled;
    this.emit(enabled ? 'enabled' : 'disabled', this);
  }
  return this;
};

LocalMediaTrack.prototype.disable = function disable() {
  return this.enable(false);
};

LocalMediaTrack.prototype.stop = function stop() {
  this._log.info('Stopping');
  this.mediaStreamTrack.stop();
  this._end();
  return this;
};

module.exports = LocalMediaTrack;

},{"../../util":74,"../../util/constants":72,"../../util/log":77,"./mediatrack":24,"./sender":31}],21:[function(require,module,exports){
'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var nInstances = 0;

/**
 * Construct a {@link LocalTrackPublication}.
 * @class
 * @classdesc A {@link LocalTrackPublication} is a {@link LocalTrack} that
 *   has been published to a {@link Room}.
 * @param {Track.SID} sid - SID assigned to the published {@link LocalTrack}
 * @param {LocalTrack} track - the {@link LocalTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *   that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication}
 *   options
 * @property {Track.Kind} kind - kind of the published {@link LocalTrack}
 * @property {LocalTrack} track - the {@link LocalTrack}
 * @property {string} trackName - the {@link LocalTrack}'s name
 * @property {Track.SID} trackSid - SID assigned to the published
 *   {@link LocalTrack}
 */
function LocalTrackPublication(sid, track, unpublish, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);

  Object.defineProperties(this, {
    _instanceId: {
      value: nInstances++
    },
    _log: {
      value: options.log || new Log('default', this, logLevels),
    },
    _unpublish: {
      value: unpublish
    },
    kind: {
      enumerable: true,
      value: track.kind
    },
    track: {
      enumerable: true,
      value: track
    },
    trackName: {
      enumerable: true,
      value: track.name
    },
    trackSid: {
      enumerable: true,
      value: sid
    }
  });
}

LocalTrackPublication.prototype.toString = function toString() {
  return '[LocalTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
};

/**
 * Unpublish a {@link LocalTrackPublication}. This means that the media
 * from this {@link LocalTrackPublication} is no longer available to the
 * {@link Room}'s {@link RemoteParticipant}s.
 * @returns {this}
 */
LocalTrackPublication.prototype.unpublish = function unpublish() {
  this._unpublish(this);
  return this;
};

/**
 * {@link LocalTrackPublication} options
 * @typedef {object} LocalTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = LocalTrackPublication;

},{"../../util":74,"../../util/constants":72,"../../util/log":77}],22:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalMediaTrack = require('./localmediatrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 *   video that your {@link LocalParticipant} can publish to a {@link Room}. It
 *   can be enabled and disabled with {@link LocalVideoTrack#enable} and
 *   {@link LocalVideoTrack#disable} or stopped completely with
 *   {@link LocalVideoTrack#stop}.
 * @extends {VideoTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @fires LocalVideoTrack#stopped
 */
function LocalVideoTrack(mediaStreamTrack, options) {
  if (!(this instanceof LocalVideoTrack)) {
    return new LocalVideoTrack(mediaStreamTrack, options);
  }
  LocalMediaTrack.call(this, VideoTrack, mediaStreamTrack, options);
}

inherits(LocalVideoTrack, VideoTrack);

LocalVideoTrack.prototype._end = LocalMediaTrack.prototype._end;

LocalVideoTrack.prototype.toString = function toString() {
  return '[LocalVideoTrack #' + this._instanceId + ': ' + this.id + ']';
};

/**
 * Disable the {@link LocalVideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires VideoTrack#disabled
 */
LocalVideoTrack.prototype.disable = LocalMediaTrack.prototype.disable;

/**
 * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires VideoTrack#enabled
*//**
 * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
 * or "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the
 *   {@link LocalVideoTrack}
 * @returns {this}
 * @fires VideoTrack#disabled
 * @fires VideoTrack#enabled
 */
LocalVideoTrack.prototype.enable = LocalMediaTrack.prototype.enable;

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalVideoTrack}, you should unpublish it after stopping.
 * @returns {this}
 * @fires LocalVideoTrack#stopped
 */
LocalVideoTrack.prototype.stop = LocalMediaTrack.prototype.stop;

/**
 * The {@link LocalVideoTrack} was disabled, i.e. "muted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */

/**
 * The {@link LocalVideoTrack} was enabled, i.e. "unmuted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */

/**
 * The {@link LocalVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that started
 * @event LocalVideoTrack#started
 */

/**
 * The {@link LocalVideoTrack} stopped, either because
 * {@link LocalVideoTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that stopped
 * @event LocalVideoTrack#stopped
 */

module.exports = LocalVideoTrack;

},{"./localmediatrack":20,"./videotrack":33,"util":146}],23:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackPublication = require('./localtrackpublication');

/**
 * Construct a {@link LocalVideoTrackPublication}.
 * @class
 * @classdesc A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that
 * has been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @param {Track.SID} sid - SID assigned to the published {@link LocalVideoTrack}
 * @param {LocalVideoTrack} track - the {@link LocalVideoTrack}
 * @param {function(LocalTrackPublication): void} unpublish - The callback
 *    that unpublishes the {@link LocalTrackPublication}
 * @param {LocalTrackPublicationOptions} options - {@link LocalTrackPublication} options
 * @property {Track.Kind} kind - "video"
 * @property {LocalVideoTrack} track - the {@link LocalVideoTrack}
 */
function LocalVideoTrackPublication(sid, track, unpublish, options) {
  if (!(this instanceof LocalVideoTrackPublication)) {
    return new LocalVideoTrackPublication(sid, track, unpublish, options);
  }
  LocalTrackPublication.call(this, sid, track, unpublish, options);
}

inherits(LocalVideoTrackPublication, LocalTrackPublication);

LocalVideoTrackPublication.prototype.toString = function toString() {
  return '[LocalVideoTrackPublication #' + this._instanceId + ': ' + this.sid + ']';
};

module.exports = LocalVideoTrackPublication;

},{"./localtrackpublication":21,"util":146}],24:[function(require,module,exports){
'use strict';

var MediaStream = require('@twilio/webrtc').MediaStream;
var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct a {@link MediaTrack}.
 * @class
 * @classdesc A {@link MediaTrack} represents audio or video that can be sent to
 *   or received from a {@link Room}.
 * @param {MediaTrackTransceiver} mediaTrackTransceiver
 * @param {{log: Log}} options
 * @property {Track.ID} id - This {@link Track}'s ID
 * @property {boolean} isStarted - Whether or not the {@link MediaTrack} has
 *   started
 * @property {boolean} isEnabled - Whether or not the {@link MediaTrack} is
 *   enabled (i.e., whether it is paused or muted)
 * @property {Track.Kind} kind - The kind of the underlying
 *   MediaStreamTrack, "audio" or "video"
 * @property {MediaStreamTrack} mediaStreamTrack - The underlying
 *   MediaStreamTrack
 * @fires MediaTrack#disabled
 * @fires MediaTrack#enabled
 * @fires MediaTrack#started
 */
function MediaTrack(mediaTrackTransceiver, options) {
  Track.call(this, mediaTrackTransceiver.id, mediaTrackTransceiver.kind, options);
  var isStarted = false;

  options = Object.assign({
    MediaStream: MediaStream
  }, options);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _attachments: {
      value: new Set()
    },
    _isStarted: {
      get: function() {
        return isStarted;
      },
      set: function(_isStarted) {
        isStarted = _isStarted;
      }
    },
    _MediaStream: {
      value: options.MediaStream
    },
    isStarted: {
      get: function() {
        return isStarted;
      }
    },
    mediaStreamTrack: {
      enumerable: true,
      value: mediaTrackTransceiver.track
    }
  });

  this._initialize();
}

MediaTrack.DISABLED = 'disabled';
MediaTrack.ENABLED = 'enabled';
var STARTED = MediaTrack.STARTED = 'started';

inherits(MediaTrack, Track);

MediaTrack.prototype._start = function _start() {
  this._log.debug('Started');
  this._isStarted = true;
  if (this._dummyEl) {
    this._detachElement(this._dummyEl);
    this._dummyEl.oncanplay = null;
  }
  this.emit(STARTED, this);
};

MediaTrack.prototype._initialize = function _initialize() {
  var self = this;

  this._log.debug('Initializing');
  this._dummyEl = this._createElement();

  this.mediaStreamTrack.addEventListener('ended', function onended() {
    self._end();
    self.mediaStreamTrack.removeEventListener('ended', onended);
  });

  if (this._dummyEl) {
    this._dummyEl.muted = true;
    this._dummyEl.oncanplay = this._start.bind(this, this._dummyEl);
    this._attach(this._dummyEl);
    this._attachments.delete(this._dummyEl);
  }
};

MediaTrack.prototype._end = function _end() {
  this._log.debug('Ended');
  if (this._dummyEl) {
    this._detachElement(this._dummyEl);
    this._dummyEl.oncanplay = null;
  }
};

MediaTrack.prototype.attach = function attach(el) {
  if (typeof el === 'string') {
    el = this._selectElement(el);
  } else if (!el) {
    el = this._createElement();
  }
  this._log.debug('Attempting to attach to element:', el);
  el = this._attach(el);

  return el;
};

MediaTrack.prototype._attach = function _attach(el) {
  var mediaStream = el.srcObject;
  if (!(mediaStream instanceof this._MediaStream)) {
    mediaStream = new this._MediaStream();
  }

  var getTracks = this.mediaStreamTrack.kind === 'audio'
    ? 'getAudioTracks'
    : 'getVideoTracks';

  mediaStream[getTracks]().forEach(function(mediaStreamTrack) {
    mediaStream.removeTrack(mediaStreamTrack);
  });
  mediaStream.addTrack(this.mediaStreamTrack);

  // NOTE(mroberts): Although we don't necessarily need to reset `srcObject`,
  // we've been doing it here for a while, and it turns out it has allowed us
  // to sidestep the following issue:
  //
  //   https://bugs.chromium.org/p/chromium/issues/detail?id=720258
  //
  el.srcObject = mediaStream;
  el.autoplay = true;
  el.playsInline = true;

  if (!this._attachments.has(el)) {
    this._attachments.add(el);
  }

  return el;
};

MediaTrack.prototype._selectElement = function _selectElement(selector) {
  var el = document.querySelector(selector);

  if (!el) {
    throw new Error('Selector matched no element: ' + selector);
  }

  return el;
};

MediaTrack.prototype._createElement = function _createElement() {
  return typeof document !== 'undefined'
    ? document.createElement(this.kind)
    : null;
};

MediaTrack.prototype.detach = function _detach(el) {
  var els;

  if (typeof el === 'string') {
    els = [this._selectElement(el)];
  } else if (!el) {
    els = this._getAllAttachedElements();
  } else {
    els = [el];
  }

  this._log.debug('Attempting to detach from elements:', els);
  this._detachElements(els);
  return el ? els[0] : els;
};

MediaTrack.prototype._detachElements = function _detachElements(elements) {
  return elements.map(this._detachElement.bind(this));
};

MediaTrack.prototype._detachElement = function _detachElement(el) {
  if (!this._attachments.has(el)) {
    return el;
  }

  var mediaStream = el.srcObject;
  if (mediaStream instanceof this._MediaStream) {
    mediaStream.removeTrack(this.mediaStreamTrack);
    // NOTE(mroberts): It's as if, in Chrome and Safari, the <audio> element's
    // `srcObject` setter is taking a "snapshot" of the MediaStream's
    // MediaStreamTracks in order to playback; hence, calls to `removeTrack`
    // don't take effect unless you set the <audio> element's `srcObject` again.
    //
    //   https://bugs.chromium.org/p/chromium/issues/detail?id=749928
    //
    el.srcObject = mediaStream;
  }

  this._attachments.delete(el);
  return el;
};

MediaTrack.prototype._getAllAttachedElements = function _getAllAttachedElements() {
  var els = [];

  this._attachments.forEach(function(el) {
    els.push(el);
  });

  return els;
};

module.exports = MediaTrack;

},{"./":15,"@twilio/webrtc":125,"util":146}],25:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackReceiver}.
 * @class
 * @classdesc A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
 * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
 */
function MediaTrackReceiver(id, mediaStreamTrack) {
  if (!(this instanceof MediaTrackReceiver)) {
    return new MediaTrackReceiver(id, mediaStreamTrack);
  }
  MediaTrackTransceiver.call(this, id, mediaStreamTrack);
}

inherits(MediaTrackReceiver, MediaTrackTransceiver);

module.exports = MediaTrackReceiver;

},{"./transceiver":32,"util":146}],26:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var AudioTrack = require('./audiotrack');
var RemoteMediaTrack = require('./remotemediatrack');

/**
 * Construct a {@link RemoteAudioTrack}.
 * @class
 * @classdesc A {@link RemoteAudioTrack} represents an {@link AudioTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {AudioTrack}
 * @param {MediaTrackReceiver} mediaTrackReceiver - An audio MediaStreamTrack container
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteAudioTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
 * @fires RemoteAudioTrack#disabled
 * @fires RemoteAudioTrack#enabled
 * @fires RemoteAudioTrack#started
 * @fires RemoteAudioTrack#unsubscribed
 */
function RemoteAudioTrack(mediaTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteAudioTrack)) {
    return new RemoteAudioTrack(mediaTrackReceiver, signaling, options);
  }
  RemoteMediaTrack.call(this, AudioTrack, mediaTrackReceiver, signaling, options);
}

inherits(RemoteAudioTrack, AudioTrack);

RemoteAudioTrack.prototype.toString = function toString() {
  return '[RemoteAudioTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteAudioTrack.prototype._unsubscribe = RemoteMediaTrack.prototype._unsubscribe;

/**
 * The {@link RemoteAudioTrack} was disabled, i.e. "muted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   disabled
 * @event RemoteAudioTrack#disabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled, i.e. "unmuted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   enabled
 * @event RemoteAudioTrack#enabled
 */

/**
 * The {@link RemoteAudioTrack} started. This means there is enough audio data
 * to begin playback.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that started
 * @event RemoteAudioTrack#started
 */

/**
 * The {@link RemoteAudioTrack} was unsubscribed from.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   unsubscribed from
 * @event RemoteAudioTrack#unsubscribed
 */

module.exports = RemoteAudioTrack;

},{"./audiotrack":14,"./remotemediatrack":28,"util":146}],27:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');
var Track = require('./');

/**
 * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
 * @class
 * @classdesc A {@link RemoteDataTrack} represents data published to a
 *   {@link Room} by a {@link RemoteParticipant}.
 * @extends {Track}
 * @param {DataTrackReceiver} dataTrackReceiver
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteDataTrack} is
 *   currently subscribed to
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @property {Track.SID} sid - The {@link RemoteDataTrack}'s SID
 * @fires RemoteDataTrack#message
 * @fires RemoteDataTrack#unsubscribed
 */
function RemoteDataTrack(dataTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteDataTrack)) {
    return new RemoteDataTrack(dataTrackReceiver, signaling, options);
  }

  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL,
    name: signaling.name
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  Track.call(this, dataTrackReceiver.id, 'data', options);

  var isSubscribed = signaling.isSubscribed;
  Object.defineProperties(this, {
    _isSubscribed: {
      set: function(_isSubscribed) {
        isSubscribed = _isSubscribed;
      },
      get: function() {
        return isSubscribed;
      }
    },
    _signaling: {
      value: signaling
    },
    isSubscribed: {
      enumerable: true,
      get: function() {
        return this._isSubscribed;
      }
    },
    maxPacketLifeTime: {
      enumerable: true,
      value: dataTrackReceiver.maxPacketLifeTime
    },
    maxRetransmits: {
      enumerable: true,
      value: dataTrackReceiver.maxRetransmits
    },
    ordered: {
      enumerable: true,
      value: dataTrackReceiver.ordered
    },
    reliable: {
      enumerable: true,
      value: dataTrackReceiver.maxPacketLifeTime === null
        && dataTrackReceiver.maxRetransmits === null
    },
    sid: {
      enumerable: true,
      value: signaling.sid
    }
  });

  var self = this;
  dataTrackReceiver.on('message', function(data) {
    self.emit('message', data, self);
  });
}

inherits(RemoteDataTrack, Track);

RemoteDataTrack.prototype._unsubscribe = function unsubscribe() {
  if (this.isSubscribed) {
    this._isSubscribed = false;
    this.emit('unsubscribed', this);
  }
  return this;
};

/**
 * A message was received over the {@link RemoteDataTrack}.
 * @event RemoteDataTrack#message
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that received
 *   the message
 */

/**
 * The {@link RemoteDataTrack} was unsubscribed from.
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   unsubscribed from
 * @event RemoteDataTrack#unsubscribed
 */

module.exports = RemoteDataTrack;

},{"../../util":74,"../../util/constants":72,"../../util/log":77,"./":15,"util":146}],28:[function(require,module,exports){
'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../../util/log');

/**
 * Construct a {@link RemoteMediaTrack}.
 * @class
 * @classdesc A {@link RemoteMediaTrack} represents a {@link MediaTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {MediaTrack}
 * @param {function(MediaTrackTransceiver, TrackSignaling): MediaTrack} MediaTrack
 * @param {MediaTrackReceiver} mediaTrackReceiver
 * @param {RemoteTrackSignaling} signaling
 * @param {{log: Log}} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteMediaTrack} is
 *   subscribed by the {@link LocalParticipant}
 * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
 * @fires RemoteTrack#unsubscribed
 */
function RemoteMediaTrack(MediaTrack, mediaTrackReceiver, signaling, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL,
    name: signaling.name
  }, options);

  var logLevels = buildLogLevels(options.logLevel);
  options.log = options.log || new Log('default', this, logLevels);
  MediaTrack.call(this, mediaTrackReceiver, options);

  var isSubscribed = signaling.isSubscribed;
  Object.defineProperties(this, {
    _isSubscribed: {
      set: function(_isSubscribed) {
        isSubscribed = _isSubscribed;
      },
      get: function() {
        return isSubscribed;
      }
    },
    _mediaTrackReceiver: {
      value: mediaTrackReceiver
    },
    _signaling: {
      value: signaling
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return signaling.isEnabled;
      }
    },
    isSubscribed: {
      enumerable: true,
      get: function() {
        return this._isSubscribed;
      }
    },
    sid: {
      enumerable: true,
      value: signaling.sid
    }
  });

  var self = this;
  this._signaling.on('updated', function onupdated() {
    self.emit(self.isEnabled ? 'enabled' : 'disabled', self);
  });
}

RemoteMediaTrack.prototype._unsubscribe = function unsubscribe() {
  if (this.isSubscribed) {
    this._isSubscribed = false;
    this.emit('unsubscribed', this);
  }
  return this;
};

module.exports = RemoteMediaTrack;

},{"../../util":74,"../../util/constants":72,"../../util/log":77}],29:[function(require,module,exports){
'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var nInstances = 0;

/**
 * Construct a {@link RemoteTrackPublication}.
 * @class
 * @classdesc A {@link RemoteTrackPublication} represents a {@link RemoteTrack}
 *   that has been published to a {@link Room}.
 * @param {Track.Kind} kind - the {@link RemoteTrack}'s kind
 * @param {Track.SID} trackSid - the {@link RemoteTrack}'s SID
 * @param {string} trackName - the {@link RemoteTrack}'s name
 * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
 *   options
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {?RemoteTrack} track - unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @property {string} trackName - the {@link RemoteTrack}'s name
 * @property {Track.SID} trackSid - the {@link RemoteTrack}'s SID
 */
function RemoteTrackPublication(kind, trackSid, trackName, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);

  Object.defineProperties(this, {
    _instanceId: {
      value: nInstances++
    },
    _log: {
      value: options.log || new Log('default', this, logLevels)
    },
    kind: {
      enumerable: true,
      value: kind
    },
    track: {
      enumerable: true,
      value: null
    },
    trackName: {
      enumerable: true,
      value: trackName
    },
    trackSid: {
      enumerable: true,
      value: trackSid
    }
  });
}

RemoteTrackPublication.prototype.toString = function toString() {
  return '[RemoteTrackPublication #' + this._instanceId + ': ' + this.trackSid + ']';
};

/**
/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = RemoteTrackPublication;

},{"../../util":74,"../../util/constants":72,"../../util/log":77}],30:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RemoteMediaTrack = require('./remotemediatrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link RemoteVideoTrack}.
 * @class
 * @classdesc A {@link RemoteVideoTrack} represents a {@link VideoTrack}
 *   published to a {@link Room} by a {@link RemoteParticipant}.
 * @extends {VideoTrack}
 * @param {MediaTrackReceiver} mediaTrackReceiver - A video MediaStreamTrack container
 * @param {RemoteTrackSignaling} signaling - The {@link Track} signaling
 * @param {{log: Log}} options - The {@link RemoteTrack} options
 * @property {boolean} isSubscribed - Whether the {@link RemoteVideoTrack} is
 *   currently subscribed to
 * @property {Track.SID} sid - The {@link RemoteVideoTrack}'s SID
 * @fires RemoteVideoTrack#disabled
 * @fires RemoteVideoTrack#enabled
 * @fires RemoteVideoTrack#started
 * @fires RemoteVideoTrack#unsubscribed
 */
function RemoteVideoTrack(mediaTrackReceiver, signaling, options) {
  if (!(this instanceof RemoteVideoTrack)) {
    return new RemoteVideoTrack(mediaTrackReceiver, signaling, options);
  }
  RemoteMediaTrack.call(this, VideoTrack, mediaTrackReceiver, signaling, options);
}

inherits(RemoteVideoTrack, VideoTrack);

RemoteVideoTrack.prototype.toString = function toString() {
  return '[RemoteVideoTrack #' + this._instanceId + ': ' + this.sid + ']';
};

RemoteVideoTrack.prototype._unsubscribe = RemoteMediaTrack.prototype._unsubscribe;

/**
 * The {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose
 *   dimensions changed
 * @event RemoteVideoTrack#dimensionsChanged
 */

/**
 * The {@link RemoteVideoTrack} was disabled, i.e. "paused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   disabled
 * @event RemoteVideoTrack#disabled
 */

/**
 * The {@link RemoteVideoTrack} was enabled, i.e. "unpaused".
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   enabled
 * @event RemoteVideoTrack#enabled
 */

/**
 * The {@link RemoteVideoTrack} was unsubscribed from.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} that was
 *   unsubscribed from
 * @event RemoteVideoTrack#unsubscribed
 */

module.exports = RemoteVideoTrack;

},{"./remotemediatrack":28,"./videotrack":33,"util":146}],31:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackSender}.
 * @class
 * @classdesc A {@link MediaTrackSender} represents one or more
 *   local RTCRtpSenders.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @extends MediaTrackTransceiver
 */
function MediaTrackSender(mediaStreamTrack) {
  if (!(this instanceof MediaTrackSender)) {
    return new MediaTrackSender(mediaStreamTrack);
  }
  MediaTrackTransceiver.call(this, mediaStreamTrack.id, mediaStreamTrack);
  Object.defineProperties(this, {
    _senders: {
      value: new Set()
    }
  });
}

inherits(MediaTrackSender, MediaTrackTransceiver);

/**
 * Add an RTCRtpSender.
 * @param {RTCRtpSender} sender
 * @returns {this}
 */
MediaTrackSender.prototype.addSender = function addSender(sender) {
  this._senders.add(sender);
  return this;
};

/**
 * Remove an RTCRtpSender.
 * @param {RTCRtpSender} sender
 * @returns {this}
 */
MediaTrackSender.prototype.removeSender = function removeSender(sender) {
  this._senders.delete(sender);
  return this;
};

module.exports = MediaTrackSender;

},{"./transceiver":32,"util":146}],32:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var TrackTransceiver = require('../../transceiver');

/**
 * Construct a {@link MediaTrackTransceiver}.
 * @class
 * @classdesc A {@link MediaTrackTransceiver} represents either one or more
 *   local RTCRtpSenders, or a single RTCRtpReceiver.
 * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
 * @param {MediaStreamTrack} mediaStreamTrack
 * @property {MediaStreamTrack} track
 * @extends TrackTransceiver
 */
function MediaTrackTransceiver(id, mediaStreamTrack) {
  TrackTransceiver.call(this, id, mediaStreamTrack.kind);
  Object.defineProperties(this, {
    readyState: {
      enumerable: true,
      get: function() {
        return mediaStreamTrack.readyState;
      }
    },
    track: {
      enumerable: true,
      value: mediaStreamTrack
    }
  });
}


inherits(MediaTrackTransceiver, TrackTransceiver);

module.exports = MediaTrackTransceiver;

},{"../../transceiver":70,"util":146}],33:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var MediaTrack = require('./mediatrack');

/**
 * Construct a {@link VideoTrack}.
 * @class
 * @classdesc A {@link VideoTrack} is a {@link Track} representing video.
 * @extends Track
 * @param {MediaTrackTransceiver} mediaTrackTransceiver
 * @param {{log: Log}} options
 * @property {boolean} isStarted - Whether or not the {@link VideoTrack} has
 *   started; if the {@link VideoTrack} started, there is enough video data to
 *   begin playback
 * @property {boolean} isEnabled - Whether or not the {@link VideoTrack} is
 *   enabled; if the {@link VideoTrack} is not enabled, it is "paused"
 * @property {VideoTrack.Dimensions} dimensions - The {@link VideoTrack}'s
 *   {@link VideoTrack.Dimensions}
 * @property {Track.Kind} kind - "video"
 * @property {MediaStreamTrack} mediaStreamTrack - A video MediaStreamTrack
 * @fires VideoTrack#dimensionsChanged
 * @fires VideoTrack#disabled
 * @fires VideoTrack#enabled
 * @fires VideoTrack#started
 */
function VideoTrack(mediaTrackTransceiver, options) {
  MediaTrack.call(this, mediaTrackTransceiver, options);
  Object.defineProperties(this, {
    dimensions: {
      enumerable: true,
      value: {
        width: null,
        height: null
      }
    }
  });
  Object.defineProperty(this, '_dimensionsChangedElem', {
    value: emitDimensionsChangedEvents(this)
  });
  return this;
}

var DIMENSIONS_CHANGED = VideoTrack.DIMENSIONS_CHANGED = 'dimensionsChanged';

function emitDimensionsChangedEvents(track) {
  if (typeof document === 'undefined') {
    return null;
  }
  var elem = document.createElement(track.kind);
  elem.muted = true;
  elem.onloadedmetadata = function onloadedmetadata() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
    }
  };
  elem.onresize = function onresize() {
    if (dimensionsChanged(track, elem)) {
      track.dimensions.width = elem.videoWidth;
      track.dimensions.height = elem.videoHeight;
      if (track.isStarted) {
        track._log.debug('Dimensions changed:', track.dimensions);
        track.emit(DIMENSIONS_CHANGED, track);
      }
    }
  };
  elem = track.attach(elem);
  track._attachments.delete(elem);
  return elem;
}

function dimensionsChanged(track, elem) {
  return track.dimensions.width !== elem.videoWidth
    || track.dimensions.height !== elem.videoHeight;
}

inherits(VideoTrack, MediaTrack);

VideoTrack.prototype._start = function _start(dummyEl) {
  this.dimensions.width = dummyEl.videoWidth;
  this.dimensions.height = dummyEl.videoHeight;

  this._log.debug('Dimensions:', this.dimensions);
  return MediaTrack.prototype._start.call(this, dummyEl);
};

/**
 * Create an HTMLVideoElement and attach the {@link VideoTrack} to it.
 *
 * The HTMLVideoElement's <code>srcObject</code> will be set to a new
 * MediaStream containing the {@link VideoTrack}'s MediaStreamTrack.
 *
 * @method
 * @returns {HTMLVideoElement} videoElement
 * @example
 * const Video = require('twilio-video');
 *
 * Video.createLocalVideoTrack().then(function(videoTrack) {
 *   const videoElement = videoTrack.attach();
 *   document.body.appendChild(videoElement);
 * });
*//**
 * Attach the {@link VideoTrack} to an existing HTMLMediaElement. The
 * HTMLMediaElement could be an HTMLAudioElement or an HTMLVideoElement.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
 * this method sets it to a new MediaStream containing the {@link VideoTrack}'s
 * MediaStreamTrack; otherwise, it adds the {@link MediaTrack}'s
 * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
 * MediaStreamTracks of the same kind on the MediaStream, this method removes
 * them.
 *
 * @method
 * @param {HTMLMediaElement} mediaElement - The HTMLMediaElement to attach to
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const Video = require('twilio-video');
 *
 * const videoElement = document.createElement('video');
 * document.body.appendChild(videoElement);
 *
 * Video.createLocalVideoTrack().then(function(videoTrack) {
 *   videoTrack.attach(videoElement);
 * });
*//**
 * Attach the {@link VideoTrack} to an HTMLMediaElement selected by
 * <code>document.querySelector</code>. The HTMLMediaElement could be an
 * HTMLAudioElement or an HTMLVideoElement.
 *
 * If the HTMLMediaElement's <code>srcObject</code> is not set to a MediaStream,
 * this method sets it to a new MediaStream containing the {@link VideoTrack}'s
 * MediaStreamTrack; otherwise, it adds the {@link VideoTrack}'s
 * MediaStreamTrack to the existing MediaStream. Finally, if there are any other
 * MediaStreamTracks of the same kind on the MediaStream, this method removes
 * them.
 *
 * @method
 * @param {string} selector - A query selector for the HTMLMediaElement to
 *   attach to
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const Video = require('twilio-video');
 *
 * const videoElement = document.createElement('video');
 * videoElement.id = 'my-video-element';
 * document.body.appendChild(videoElement);
 *
 * Video.createLocalVideoTrack().then(function(track) {
 *   track.attach('#my-video-element');
 * });
 */
VideoTrack.prototype.attach = MediaTrack.prototype.attach;

/**
 * Detach the {@link VideoTrack} from all previously attached HTMLMediaElements.
 * @method
 * @returns {Array<HTMLMediaElement>} mediaElements
 * @example
 * const mediaElements = videoTrack.detach();
 * mediaElements.forEach(mediaElement => mediaElement.remove());
*//**
 * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement.
 * @method
 * @param {HTMLMediaElement} mediaElement - One of the HTMLMediaElements to
 *   which the {@link VideoTrack} is attached
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * const videoElement = document.getElementById('my-video-element');
 * videoTrack.detach(videoElement).remove();
*//**
 * Detach the {@link VideoTrack} from a previously attached HTMLMediaElement
 *   specified by <code>document.querySelector</code>.
 * @method
 * @param {string} selector - The query selector of HTMLMediaElement to which
 *    the {@link VideoTrack} is attached
 * @returns {HTMLMediaElement} mediaElement
 * @example
 * videoTrack.detach('#my-video-element').remove();
 */
VideoTrack.prototype.detach = MediaTrack.prototype.detach;

/**
 * A {@link VideoTrack}'s width and height.
 * @typedef {object} VideoTrack.Dimensions
 * @property {?number} width - The {@link VideoTrack}'s width or null if the
 *   {@link VideoTrack} has not yet started
 * @property {?number} height - The {@link VideoTrack}'s height or null if the
 *   {@link VideoTrack} has not yet started
 */

/**
 * The {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event VideoTrack#dimensionsChanged
 */

/**
 * The {@link VideoTrack} was disabled, i.e. "paused".
 * @param {VideoTrack} track - The {@link VideoTrack} that was disabled
 * @event VideoTrack#disabled
 */

/**
 * The {@link VideoTrack} was enabled, i.e. "unpaused".
 * @param {VideoTrack} track - The {@link VideoTrack} that was enabled
 * @event VideoTrack#enabled
 */

/**
 * The {@link VideoTrack} started. This means there is enough video data to
 * begin playback.
 * @param {VideoTrack} track - The {@link VideoTrack} that started
 * @event VideoTrack#started
 */

module.exports = VideoTrack;

},{"./mediatrack":24,"util":146}],34:[function(require,module,exports){
'use strict';

var RemoteAudioTrack = require('./media/track/remoteaudiotrack');
var RemoteDataTrack = require('./media/track/remotedatatrack');
var RemoteTrackPublication = require('./media/track/remotetrackpublication');
var RemoteVideoTrack = require('./media/track/remotevideotrack');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');
var nInstances = 0;

/**
 * Construct a {@link Participant}.
 * @class
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.ID, AudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link AudioTrack}s.
 * @property {Map<Track.ID, DataTrack>} dataTracks -
 *    The {@link Participant}'s {@link DataTrack}s.
 * @property {Participant.Identity} identity - The identity of the {@link Participant}
 * @property {Participant.SID} sid - The {@link Participant}'s SID
 * @property {string} state - "connected", "disconnected" or "failed"
 * @property {Map<Track.ID, Track>} tracks -
 *    The {@link Participant}'s {@link Track}s
 * @property {Map<Track.ID, VideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link VideoTrack}s.
 * @fires Participant#disconnected
 * @fires Participant#trackAdded
 * @fires Participant#trackDimensionsChanged
 * @fires Participant#trackDisabled
 * @fires Participant#trackEnabled
 * @fires Participant#trackRemoved
 * @fires Participant#trackStarted
 */
function Participant(signaling, options) {
  EventEmitter.call(this);

  options = Object.assign({
    RemoteAudioTrack: RemoteAudioTrack,
    RemoteVideoTrack: RemoteVideoTrack,
    RemoteDataTrack: RemoteDataTrack,
    tracks: []
  }, options);

  var indexed = indexTracksById(options.tracks);
  var log = options.log.createLog('default', this);
  var audioTracks = new Map(indexed.audioTracks);
  var dataTracks = new Map(indexed.dataTracks);
  var tracks = new Map(indexed.tracks);
  var videoTracks = new Map(indexed.videoTracks);

  Object.defineProperties(this, {
    _RemoteAudioTrack: {
      value: options.RemoteAudioTrack
    },
    _RemoteDataTrack: {
      value: options.RemoteDataTrack
    },
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: log
    },
    _signaling: {
      value: signaling
    },
    _trackEventReemitters: {
      value: new Map()
    },
    _RemoteVideoTrack: {
      value: options.RemoteVideoTrack
    },
    audioTracks: {
      enumerable: true,
      value: audioTracks
    },
    dataTracks: {
      enumerable: true,
      value: dataTracks
    },
    identity: {
      enumerable: true,
      get: function() {
        return signaling.identity;
      }
    },
    sid: {
      enumerable: true,
      get: function() {
        return signaling.sid;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return signaling.state;
      }
    },
    tracks: {
      enumerable: true,
      value: tracks
    },
    videoTracks: {
      enumerable: true,
      value: videoTracks
    }
  });

  this.tracks.forEach(reemitTrackEvents.bind(null, this));
  reemitSignalingStateChangedEvents(this, signaling);
  this._handleTrackSignalingEvents();
  log.info('Created a new Participant' + (this.identity ? ': ' + this.identity : ''));
}

inherits(Participant, EventEmitter);

/**
 * Get the {@link RemoteTrack} events to re-emit.
 * @private
 * @returns {Array<Array<string>>} events
 */
Participant.prototype._getTrackEvents = function _getTrackEvents() {
  return [
    ['dimensionsChanged', 'trackDimensionsChanged'],
    ['disabled', 'trackDisabled'],
    ['enabled', 'trackEnabled'],
    ['message', 'trackMessage'],
    ['started', 'trackStarted']
  ];
};

Participant.prototype.toString = function toString() {
  return '[Participant #' + this._instanceId + ': ' + this.sid + ']';
};

Participant.prototype._addTrack = function _addTrack(track) {
  var log = this._log;
  if (this.tracks.has(track.id)) {
    return null;
  }
  this.tracks.set(track.id, track);

  var tracksByKind = {
    audio: this.audioTracks,
    video: this.videoTracks,
    data: this.dataTracks
  }[track.kind];
  tracksByKind.set(track.id, track);
  reemitTrackEvents(this, track);

  log.info('Added a new ' + util.trackClass(track) + ':', track.id);
  log.debug(util.trackClass(track) + ':', track);
  this.emit('trackAdded', track);

  return track;
};

Participant.prototype._handleTrackSignalingEvents = function _handleTrackSignalingEvents() {
  var log = this._log;
  var self = this;

  if (this.state === 'disconnected') {
    return;
  }

  var RemoteAudioTrack = this._RemoteAudioTrack;
  var RemoteVideoTrack = this._RemoteVideoTrack;
  var RemoteDataTrack = this._RemoteDataTrack;
  var signaling = this._signaling;

  function trackSignalingAdded(signaling) {
    function handleTrackSubscriptionFailed() {
      if (!signaling.error) {
        return;
      }
      signaling.removeListener('updated', handleTrackSubscriptionFailed);
      var remoteTrackPublication = new RemoteTrackPublication(
        signaling.kind,
        signaling.sid,
        signaling.name,
        { log: log });
      self._log.warn('Failed to subscribe to Remote' +
        util.capitalize(signaling.kind) + 'Track ' + signaling.sid + ' with ' +
        'name "' + signaling.name + '": ' + signaling.error.message);
      self.emit('trackSubscriptionFailed', signaling.error, remoteTrackPublication);
    }

    signaling.on('updated', handleTrackSubscriptionFailed);

    signaling.getTrackTransceiver().then(function(trackReceiver) {
      signaling.removeListener('updated', handleTrackSubscriptionFailed);

      var RemoteTrack = {
        audio: RemoteAudioTrack,
        video: RemoteVideoTrack,
        data: RemoteDataTrack
      }[signaling.kind];

      // NOTE(mroberts): It should never be the case that the TrackSignaling and
      // MediaStreamTrack or DataTrackReceiver kinds disagree; however, just in
      // case, we handle it here.
      if (!RemoteTrack || signaling.kind !== trackReceiver.kind) {
        return;
      }

      var track = new RemoteTrack(trackReceiver, signaling, { log: log });
      self._addTrack(track);
    });
  }

  function trackSignalingRemoved(signaling) {
    signaling.getTrackTransceiver().then(function() {
      var track = self.tracks.get(signaling.id);
      if (track) {
        self._removeTrack(track);
      }
    });
  }

  signaling.on('trackAdded', trackSignalingAdded);
  signaling.on('trackRemoved', trackSignalingRemoved);

  signaling.tracks.forEach(trackSignalingAdded);

  signaling.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      log.debug('Removing TrackSignaling listeners');
      signaling.removeListener('stateChanged', stateChanged);
      signaling.removeListener('trackAdded', trackSignalingAdded);
      signaling.removeListener('trackRemoved', trackSignalingRemoved);
    }
  });
};

Participant.prototype._deleteTrack = function _deleteTrack(track) {
  this.tracks.delete(track.id);

  var tracksByKind = {
    audio: this.audioTracks,
    video: this.videoTracks,
    data: this.dataTracks
  }[track.kind];
  tracksByKind.delete(track.id);

  var reemitters = this._trackEventReemitters.get(track.id) || new Map();
  reemitters.forEach(function(reemitter, event) {
    track.removeListener(event, reemitter);
  });

  var log = this._log;
  log.info('Removed a ' + util.trackClass(track) + ':', track.id);
  log.debug(util.trackClass(track) + ':', track);
};

Participant.prototype._removeTrack = function _removeTrack(track) {
  if (!this.tracks.has(track.id)) {
    return null;
  }
  track = this.tracks.get(track.id);
  this._deleteTrack(track);
  this.emit('trackRemoved', track);
  return track;
};

/**
 * A {@link Participant.SID} is a 34-character string starting with "PA"
 * that uniquely identifies a {@link Participant}.
 * @type string
 * @typedef Participant.SID
 */

/**
 * A {@link Participant.Identity} is a string that identifies a
 * {@link Participant}. You can think of it like a name.
 * @type string
 * @typedef Participant.Identity
 */

/**
 * The {@link Participant} has disconnected.
 * @param {Participant} participant - The {@link Participant} that disconnected.
 * @event Participant#disconnected
 */

/**
 * A {@link Track} was added by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was added
 * @event Participant#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @event Participant#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was disabled
 * @event Participant#trackDisabled
 */

/**
 * A {@link Track} was enabled by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was enabled
 * @event Participant#trackEnabled
 */

/**
 * A {@link Track} was removed by the {@link Participant}.
 * @param {Track} track - The {@link Track} that was removed
 * @event Participant#trackRemoved
 */

/**
 * One of the {@link Participant}'s {@link Track}s started.
 * @param {Track} track - The {@link Track} that started
 * @event Participant#trackStarted
 */

/**
 * Indexed {@link Track}s by {@link Track.ID}.
 * @typedef {object} IndexedTracks
 * @property {Array<{0: Track.ID, 1: AudioTrack}>} audioTracks - Indexed
 *   {@link AudioTrack}s
 * @property {Array<{0: Track.ID, 1: DataTrack}>} dataTracks - Indexed
 *   {@link DataTrack}s
 * @property {Array<{0: Track.ID, 1: Track}>} tracks - Indexed {@link Track}s
 * @property {Array<{0: Track.ID, 1: VideoTrack}>} videoTracks - Indexed
 *   {@link VideoTrack}s
 * @private
 */

/**
 * Index tracks by {@link Track.ID}.
 * @param {Array<Track>} tracks
 * @returns {IndexedTracks}
 * @private
 */
function indexTracksById(tracks) {
  var indexedTracks = tracks.map(function(track) {
    return [track.id, track];
  });
  var indexedAudioTracks = indexedTracks.filter(function(keyValue) {
    return keyValue[1].kind === 'audio';
  });
  var indexedVideoTracks = indexedTracks.filter(function(keyValue) {
    return keyValue[1].kind === 'video';
  });
  var indexedDataTracks = indexedTracks.filter(function(keyValue) {
    return keyValue[1].kind === 'data';
  });

  return {
    audioTracks: indexedAudioTracks,
    dataTracks: indexedDataTracks,
    tracks: indexedTracks,
    videoTracks: indexedVideoTracks
  };
}

/**
 * Re-emit {@link ParticipantSignaling} 'stateChanged' events.
 * @param {Participant} participant
 * @param {ParticipantSignaling} signaling
 * @private
 */
function reemitSignalingStateChangedEvents(participant, signaling) {
  var log = participant._log;

  if (participant.state === 'disconnected') {
    return;
  }

  // Reemit state transition events from the ParticipantSignaling.
  signaling.on('stateChanged', function stateChanged(state) {
    log.debug('Transitioned to state:', state);
    participant.emit(state, participant);
    if (state === 'disconnected') {
      log.debug('Removing Track event reemitters');
      signaling.removeListener('stateChanged', stateChanged);

      participant.tracks.forEach(function(track) {
        participant._trackEventReemitters.get(track.id)
          .forEach(function(reemitter, event) {
            track.removeListener(event, reemitter);
          });
      });
      participant._trackEventReemitters.clear();
    }
  });
}

/**
 * Re-emit {@link Track} events.
 * @param {Participant} participant
 * @param {Track} track
 * @private
 */
function reemitTrackEvents(participant, track) {
  var trackEventReemitters = new Map();

  if (participant.state === 'disconnected') {
    return;
  }

  participant._getTrackEvents().forEach(function(eventPair) {
    var trackEvent = eventPair[0];
    var participantEvent = eventPair[1];

    trackEventReemitters.set(trackEvent, function() {
      var args = [participantEvent].concat([].slice.call(arguments));
      return participant.emit.apply(participant, args);
    });

    track.on(trackEvent, trackEventReemitters.get(trackEvent));
  });

  participant._trackEventReemitters.set(track.id, trackEventReemitters);
}

module.exports = Participant;

},{"./media/track/remoteaudiotrack":26,"./media/track/remotedatatrack":27,"./media/track/remotetrackpublication":29,"./media/track/remotevideotrack":30,"./util":74,"events":142,"util":146}],35:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link QueueingEventEmitter}
 * @class
 * @classdesc A {@link QueueingEventEmitter} can queue events until a listener
 *   has been added.
 * @extends EventEmitter
 */
function QueueingEventEmitter() {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _queuedEvents: {
      value: new Map()
    }
  });
}

inherits(QueueingEventEmitter, EventEmitter);

/**
 * Emit any queued events.
 * @returns {boolean} true if every event had listeners, false otherwise
*//**
 * Emit any queued events matching the event name.
 * @param {string} event
 * @returns {boolean} true if every event had listeners, false otherwise
 */
QueueingEventEmitter.prototype.dequeue = function dequeue(event) {
  var result = true;
  if (!event) {
    this._queuedEvents.forEach(function(_, queuedEvent) {
      result = this.dequeue(queuedEvent) && result;
    }, this);
    return result;
  }
  var queue = this._queuedEvents.get(event) || [];
  this._queuedEvents.delete(event);
  var self = this;
  return queue.reduce(function(result, args) {
    return self.emit.apply(self, [event].concat(args)) && result;
  }, result);
};

/**
 * If the event has listeners, emit the event; otherwise, queue the event.
 * @param {string} event
 * @param {...*} args
 * @returns {boolean} true if the event had listeners, false if the event was queued
 */
QueueingEventEmitter.prototype.queue = function queue() {
  var args = [].slice.call(arguments);
  if (this.emit.apply(this, args)) {
    return true;
  }
  var event = args[0];
  if (!this._queuedEvents.has(event)) {
    this._queuedEvents.set(event, []);
  }
  this._queuedEvents.get(event).push(args.slice(1));
  return false;
};

module.exports = QueueingEventEmitter;

},{"events":142,"util":146}],36:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var Participant = require('./participant');

/**
 * Construct a {@link RemoteParticipant}.
 * @class
 * @classdesc A {@link RemoteParticipant} represents a remote {@link Participant}
 * in a {@link Room}.
 * @extends Participant
 * @param {ParticipantSignaling} signaling
 * @param {object} [options]
 * @property {Map<Track.SID, RemoteAudioTrack>} audioTracks -
 *    The {@link Participant}'s {@link RemoteAudioTrack}s.
 * @property {Map<Track.SID, RemoteDataTrack>} dataTracks -
 *    The {@link Participant}'s {@link RemoteDataTrack}s.
 * @property {Map<Track.SID, RemoteTrack>} tracks -
 *    The {@link Participant}'s {@link RemoteTrack}s
 * @property {Map<Track.SID, RemoteVideoTrack>} videoTracks -
 *    The {@link Participant}'s {@link RemoteVideoTrack}s.
 * @fires RemoteParticipant#trackAdded
 * @fires RemoteParticipant#trackDimensionsChanged
 * @fires RemoteParticipant#trackDisabled
 * @fires RemoteParticipant#trackEnabled
 * @fires RemoteParticipant#trackMessage
 * @fires RemoteParticipant#trackRemoved
 * @fires RemoteParticipant#trackStarted
 * @fires RemoteParticipant#trackSubscribed
 * @fires RemoteParticipant#trackSubscriptionFailed
 * @fires RemoteParticipant#trackUnsubscribed
 */
function RemoteParticipant(signaling, options) {
  if (!(this instanceof RemoteParticipant)) {
    return new RemoteParticipant(signaling, options);
  }
  Participant.call(this, signaling, options);
  this.once('disconnected', this._unsubscribeTracks.bind(this));
}

inherits(RemoteParticipant, Participant);

RemoteParticipant.prototype.toString = function toString() {
  return '[RemoteParticipant #' + this._instanceId
    + (this.sid ? ': ' + this.sid : '')
    + ']';
};

RemoteParticipant.prototype._addTrack = function _addTrack(remoteTrack) {
  if (!Participant.prototype._addTrack.call(this, remoteTrack)) {
    return null;
  }
  this.emit('trackSubscribed', remoteTrack);
  return remoteTrack;
};

RemoteParticipant.prototype._unsubscribeTracks = function _unsubscribeTracks() {
  var tracks = Array.from(this.tracks.values());
  tracks.forEach(this._unsubscribeTrack, this);
};

RemoteParticipant.prototype._unsubscribeTrack = function _unsubscribeTrack(remoteTrack) {
  var unsubscribedTrack = this.tracks.get(remoteTrack.id);
  if (unsubscribedTrack) {
    unsubscribedTrack._unsubscribe();
    this.emit('trackUnsubscribed', unsubscribedTrack);
  }
};

RemoteParticipant.prototype._removeTrack = function _removeTrack(remoteTrack) {
  var unsubscribedTrack = this.tracks.get(remoteTrack.id);
  if (!unsubscribedTrack) {
    return null;
  }

  this._deleteTrack(unsubscribedTrack);
  unsubscribedTrack._unsubscribe();
  this.emit('trackUnsubscribed', unsubscribedTrack);
  this.emit('trackRemoved', unsubscribedTrack);

  return unsubscribedTrack;
};

/**
 * A {@link RemoteTrack} was added by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @event RemoteParticipant#trackAdded
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteVideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @event RemoteParticipant#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @event RemoteParticipant#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
 * @event RemoteParticipant#trackEnabled
 */

/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}s.
 * @event RemoteParticipant#trackMessage
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} over which the
 *   message was received
 */

/**
 * A {@link RemoteTrack} was removed by the {@link RemoteParticipant}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @event RemoteParticipant#trackRemoved
 */

/**
 * One of the {@link RemoteParticipant}'s {@link RemoteTrack}s started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @event RemoteParticipant#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed to
 * @event RemoteParticipant#trackSubscribed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} could not be subscribed to.
 * @param {TwilioError} error - The reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @event RemoteParticipant#trackSubscriptionFailed
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed from
 * @event RemoteParticipant#trackUnsubscribed
 */

module.exports = RemoteParticipant;

},{"./participant":34,"util":146}],37:[function(require,module,exports){
'use strict';

var XHR = require('xmlhttprequest').XMLHttpRequest;

/**
 * Make a network request.
 * @param {String} method - HTTP method to use. e.g: GET, POST.
 * @param {RequestParams} params
 * @returns {Promise<String>} responseText
 *//**
 * @typedef {Object} RequestParams
 * @property {String} url - URL to access.
 * @property {Object} [headers] - An unformatted map of headers.
 * @property {Object} [body] - An unformatted map representing
 *   post body.
 * @property {Boolean} [withCredentials=false] - Whether to set the
 *   XHR withCredentials flag.
 */
function request(method, params) {
  return new Promise(function(resolve, reject) {
    if (typeof method !== 'string' || !params) {
      throw new Error('<String>method and <Object>params are required args.');
    }

    var xhr = new XHR();
    xhr.open(method.toUpperCase(), params.url, true);
    xhr.withCredentials = !!params.withCredentials;

    xhr.onreadystatechange = function onreadystatechange() {
      if (xhr.readyState !== 4) { return; }

      if (200 <= xhr.status && xhr.status < 300) {
        resolve(xhr.responseText);
      } else {
        reject(xhr.responseText);
      }
    };

    for (var headerName in params.headers) {
      xhr.setRequestHeader(headerName, params.headers[headerName]);
    }

    xhr.send(params.body);
  });
}

request.get = request.bind(null, 'GET');
request.post = request.bind(null, 'POST');

module.exports = request;

},{"xmlhttprequest":149}],38:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var RemoteParticipant = require('./remoteparticipant');
var nInstances = 0;

/**
 * Construct a {@link Room}.
 * @class
 * @classdesc A {@link Room} represents communication between you and one or
 *   more {@link RemoteParticipant}s sharing {@link AudioTrack}s
 *   and {@link VideoTrack}s.
 *   <br><br>
 *   You can connect to a {@link Room} by calling {@link connect}.
 * @param {RoomSignaling} signaling
 * @param {?object} [options={}]
 * @property {boolean} isRecording - Whether or not the {@link Room} is being
 *   recorded
 * @property {LocalParticipant} localParticipant - Your {@link LocalParticipant}
 *   in the {@link Room}
 * @property {string} name - The {@link Room}'s name
 * @property {Map<Participant.SID, RemoteParticipant>} participants -
 *   The {@link RemoteParticipant}s participating in this {@link Room}
 * @property {Room.SID} sid - The {@link Room}'s SID
 * @property {string} state - "connected" or "disconnected"
 * @throws {SignalingConnectionDisconnectedError}
 * @fires Room#disconnected
 * @fires Room#participantConnected
 * @fires Room#participantDisconnected
 * @fires Room#recordingStarted
 * @fires Room#recordingStopped
 * @fires Room#trackAdded
 * @fires Room#trackDimensionsChanged
 * @fires Room#trackDisabled
 * @fires Room#trackEnabled
 * @fires Room#trackMessage
 * @fires Room#trackRemoved
 * @fires Room#trackStarted
 * @fires Room#trackSubscribed
 * @fires Room#trackUnsubscribed
 */
function Room(localParticipant, signaling, options) {
  if (!(this instanceof Room)) {
    return new Room(localParticipant, signaling, options);
  }
  EventEmitter.call(this);

  var log = options.log.createLog('default', this);
  var participants = new Map();

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _log: {
      value: log
    },
    _instanceId: {
      value: ++nInstances
    },
    _options: {
      value: options
    },
    _participants: {
      value: participants
    },
    _signaling: {
      value: signaling
    },
    isRecording: {
      enumerable: true,
      get: function() {
        return signaling.recording.isEnabled || false;
      }
    },
    localParticipant: {
      enumerable: true,
      value: localParticipant
    },
    name: {
      enumerable: true,
      value: signaling.name
    },
    participants: {
      enumerable: true,
      value: participants
    },
    sid: {
      enumerable: true,
      value: signaling.sid
    },
    state: {
      enumerable: true,
      get: function() {
        return signaling.state;
      }
    }
  });

  handleRecordingEvents(this, signaling.recording);
  handleSignalingEvents(this, signaling);

  log.info('Created a new Room:', this.name);
  log.debug('Initial RemoteParticipants:', Array.from(this._participants.values()));
}

inherits(Room, EventEmitter);

Room.prototype.toString = function toString() {
  return '[Room #' + this._instanceId + ': ' + this.sid + ']';
};

/**
 * Disconnect from the {@link Room}.
 * @returns {this}
 */
Room.prototype.disconnect = function disconnect() {
  this._log.info('Disconnecting');
  this._signaling.disconnect();
  return this;
};

/**
 * Get the {@link Room}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
Room.prototype.getStats = function getStats() {
  return this._signaling.getStats();
};

/**
 * A {@link Room.SID} is a 34-character string starting with "RM"
 * that uniquely identifies a {@link Room}.
 * @type string
 * @typedef Room.SID
 */

/**
 * Your {@link LocalParticipant} was disconnected from the {@link Room} and all
 * other {@link RemoteParticipant}s.
 * @param {Room} room - The {@link Room} your
 *   {@link LocalParticipant} was disconnected from
 * @param {?TwilioError} error - Present when the {@link LocalParticipant} got
 *   disconnected from the {@link Room} unexpectedly
 * @event Room#disconnected
 * @example
 * myRoom.on('disconnected', function(room, error) {
 *   if (error) {
 *     console.log('Unexpectedly disconnected:', error);
 *   }
 *   myRoom.localParticipant.tracks.forEach(function(track) {
 *     track.stop();
 *     track.detach();
 *   });
 * });
 */

/**
 * A {@link RemoteParticipant} joined the {@link Room}.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who joined
 * @event Room#participantConnected
 * @example
 * myRoom.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Room');
 * });
 */

/**
 * A {@link RemoteParticipant} left the {@link Room}.
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who left
 * @event Room#participantDisconnected
 * @example
 * myRoom.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Room');
 *   participant.tracks.forEach(function(track) {
 *     track.detach().forEach(function(mediaElement) {
 *       mediaElement.remove();
 *     });
 *   });
 * });
 */

/**
 * The {@link Room} is now being recorded
 * @event Room#recordingStarted
 */

/**
 * The {@link Room} is no longer being recorded
 * @event Room#recordingStopped
 */

/**
 * A {@link RemoteTrack} was added by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was added
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   added the {@link RemoteTrack}
 * @event Room#trackAdded
 * @example
 * room.on('trackAdded', function(track, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
 */

/**
 * One of the {@link RemoteParticipant}'s {@link VideoTrack}'s dimensions changed.
 * @param {RemoteVideoTrack} track - The {@link RemoteVideoTrack} whose dimensions changed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteVideoTrack}'s dimensions changed
 * @event Room#trackDimensionsChanged
 */

/**
 * A {@link RemoteTrack} was disabled by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was disabled
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   disabled the {@link RemoteTrack}
 * @event Room#trackDisabled
 */

/**
 * A {@link RemoteTrack} was enabled by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was enabled
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   enabled the {@link RemoteTrack}
 * @event Room#trackEnabled
 */

/**
 * A message was received over one of the {@link RemoteParticipant}'s
 * {@link RemoteDataTrack}'s.
 * @param {string|ArrayBuffer} data
 * @param {RemoteVideoTrack} track - The {@link RemoteDataTrack} over which the
 *   message was received
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteDataTrack} received the message
 * @event Room#trackMessage
 */

/**
 * A {@link RemoteTrack} was removed by a {@link RemoteParticipant} in the {@link Room}.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was removed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} who
 *   removed the {@link RemoteTrack}
 * @event Room#trackRemoved
 * @example
 * room.on('trackRemoved', function(track, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
 * });
 */

/**
 * One of a {@link RemoteParticipant}'s {@link RemoteTrack}s in the {@link Room} started.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that started
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} started
 * @event Room#trackStarted
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was subscribed to.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was subscribed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was subscribed
 * @event Room#trackSubscribed
 * @example
 * room.on('trackSubscribed', function(track, participant) {
 *   var participantView = document.getElementById('participant-view-' + participant.identity);
 *   participantView.appendChild(track.attach());
 * });
 */

/**
 * A {@link RemoteParticipant}'s {@link RemoteTrack} was unsubscribed from.
 * @param {RemoteTrack} track - The {@link RemoteTrack} that was unsubscribed
 * @param {RemoteParticipant} participant - The {@link RemoteParticipant} whose
 *   {@link RemoteTrack} was unsubscribed
 * @event Room#trackUnsubscribed
 * @example
 * room.on('trackUnsubscribed', function(track, participant) {
 *   track.detach().forEach(function(mediaElement) {
 *     mediaElement.remove();
 *   });
 * });
 */

function connectParticipant(room, participantSignaling) {
  var log = room._log;
  var participant = new RemoteParticipant(participantSignaling, { log: log });

  log.info('A new RemoteParticipant connected:', participant);
  room._participants.set(participant.sid, participant);
  room.emit('participantConnected', participant);

  // Reemit Track events from the RemoteParticipant.
  var eventListeners = [
    'trackAdded',
    'trackDimensionsChanged',
    'trackDisabled',
    'trackEnabled',
    'trackMessage',
    'trackRemoved',
    'trackStarted',
    'trackSubscribed',
    'trackSubscriptionFailed',
    'trackUnsubscribed'
  ].map(function(event) {
    function reemit() {
      var args = [].slice.call(arguments);
      args.unshift(event);
      args.push(participant);
      room.emit.apply(room, args);
    }
    participant.on(event, reemit);
    return [event, reemit];
  });

  // Reemit state transition events from the RemoteParticipant.
  participant.once('disconnected', function participantDisconnected() {
    log.info('RemoteParticipant disconnected:', participant);
    room._participants.delete(participant.sid);
    eventListeners.forEach(function(args) {
      participant.removeListener(args[0], args[1]);
    });
    room.emit('participantDisconnected', participant);
  });
}

function handleRecordingEvents(room, recording) {
  recording.on('updated', function updated() {
    var started = recording.isEnabled;
    room._log.info('Recording ' + (started ? 'started' : 'stopped'));
    room.emit('recording' + (started ? 'Started' : 'Stopped'));
  });
}

function handleSignalingEvents(room, signaling) {
  var log = room._log;

  // Reemit RemoteParticipant events from the RoomSignaling.
  log.debug('Creating a new RemoteParticipant for each ParticipantSignaling '
    + 'in the RoomSignaling');
  signaling.participants.forEach(connectParticipant.bind(null, room));
  log.debug('Setting up RemoteParticipant creation for all subsequent '
    + 'ParticipantSignalings that connect to the RoomSignaling');
  signaling.on('participantConnected', connectParticipant.bind(null, room));

  // Reemit state transition events from the RoomSignaling.
  signaling.on('stateChanged', function stateChanged(state, error) {
    room.participants.forEach(function(participant) {
      participant._unsubscribeTracks();
    });
    log.info('Transitioned to state:', state);
    room.emit(state, room, error);
  });
}

module.exports = Room;

},{"./remoteparticipant":36,"events":142,"util":146}],39:[function(require,module,exports){
/* eslint consistent-return:0 */
'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('./participant');
var RoomSignaling = require('./room');
var StateMachine = require('../statemachine');

/*
Signaling States
----------------

              +---------+
              |         |
              | opening |
         +--->|         |
         |    +---------+
    +--------+   |   |   +------+
    |        |<--+   +-->|      |
    | closed |<----------| open |
    |        |<--+   +-->|      |
    +--------+   |   |   +------+
              +---------+   |
              |         |<--+
              | closing |
              |         |
              +---------+

*/

var states = {
  closed: [
    'opening'
  ],
  opening: [
    'closed',
    'open'
  ],
  open: [
    'closed',
    'closing'
  ],
  closing: [
    'closed',
    'open'
  ]
};

/**
 * Construct {@link Signaling}.
 * @class
 * @extends StateMachine
 * @property {string} state - one of "closed", "opening", "open", or "closing"
 */
function Signaling() {
  StateMachine.call(this, 'closed', states);
}

inherits(Signaling, StateMachine);

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._close = function _close(key) {
  this.transition('closing', key);
  this.transition('closed', key);
  return Promise.resolve(this);
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._connect = function _connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options) {
  localParticipant.connect('PA00000000000000000000000000000000', 'test');
  var sid = 'RM00000000000000000000000000000000';
  var promise = Promise.resolve(new RoomSignaling(localParticipant, sid, options));
  promise.cancel = function cancel() {};
  return promise;
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._open = function _open(key) {
  this.transition('opening', key);
  this.transition('open', key);
  return Promise.resolve(this);
};

/**
 * Close the {@link Signaling}.
 * @returns {Promise<this>}
 */
Signaling.prototype.close = function close() {
  var self = this;
  return this.bracket('close', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self;
      case 'open':
        return self._close(key);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Connect to a {@link RoomSignaling}.
 * @param {ParticipantSignaling} localParticipant
 * @param {string} token
 * @param {IceServerSource} iceServerSource
 * @param {EncodingParametersImpl} encodingParameters
 * @param {PreferredCodecs} preferredCodecs
 * @param {object} options
 * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
 */
Signaling.prototype.connect = function connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options) {
  var self = this;
  return this.bracket('connect', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
        // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
        // we just need to ensure the Signaling remains open.
        self.releaseLockCompletely(key);
        return self._connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Create a local {@link ParticipantSignaling}.
 * @returns {ParticipantSignaling}
 */
Signaling.prototype.createLocalParticipantSignaling = function createLocalParticipantSignaling() {
  return new ParticipantSignaling();
};

/**
 * Open the {@link Signaling}.
 * @returns {Promise<this>}
 */
Signaling.prototype.open = function open() {
  var self = this;
  return this.bracket('open', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key);
      case 'open':
        return self;
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

module.exports = Signaling;

},{"../statemachine":61,"./participant":41,"./room":45,"util":146}],40:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link LocalTrackPublicationSignaling}.
 * @class
 * @classdesc A {@link LocalTrackPublication} implementation
 * @extends TrackSignaling
 * @param {DataTrackSender|MediaTrackSender} trackSender
 * @param {string} name
 * @property {?Error} error - non-null if publication failed
 */
function LocalTrackPublicationSignaling(trackSender, name) {
  var enabled = trackSender.kind === 'data'
    ? true
    : trackSender.track.enabled;
  TrackSignaling.call(this, name, trackSender.id, trackSender.kind, enabled);
  this.setTrackTransceiver(trackSender);
  Object.defineProperties(this, {
    _error: {
      value: null,
      writable: true
    },
    error: {
      enumerable: true,
      get: function() {
        return this._error;
      }
    }
  });
}

inherits(LocalTrackPublicationSignaling, TrackSignaling);

/**
 * Rejects the SID's deferred promise with the given Error.
 * @param {Error} error
 * @returns {this}
 */
LocalTrackPublicationSignaling.prototype.publishFailed = function publishFailed(error) {
  if (setError(this, error)) {
    this.emit('updated');
  }
  return this;
};

LocalTrackPublicationSignaling.prototype.setSid = function setSid(sid) {
  if (this._error) {
    return this;
  }
  return TrackSignaling.prototype.setSid.call(this, sid);
};

/**
 * @param {LocalTrackPublication} publication
 * @param {Error} error
 * @returns {boolean} updated
 */
function setError(publication, error) {
  if (publication._sid !== null || publication._error) {
    return false;
  }
  publication._error = error;
  return true;
}

module.exports = LocalTrackPublicationSignaling;

},{"./track":46,"util":146}],41:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var StateMachine = require('../statemachine');

/*
ParticipantSignaling States
----------------------

    +------------+     +-----------+     +--------------+
    |            |     |           |     |              |
    | connecting |---->| connected |---->| disconnected |
    |            |     |           |     |              |
    +------------+     +-----------+     +--------------+

*/

var states = {
  connecting: [
    'connected'
  ],
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link ParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends StateMachine
 * @property {?string} identity
 * @property {?Participant.SID} sid
 * @property {string} state - "connecting", "connected", or "disconnected"
 * @property {Map<string, TrackSignaling>} tracks
 * @emits ParticipantSignaling#trackAdded
 * @emits ParticipantSignaling#trackRemoved
 */
function ParticipantSignaling() {
  StateMachine.call(this, 'connecting', states);

  Object.defineProperties(this, {
    _identity: {
      writable: true,
      value: null
    },
    _sid: {
      writable: true,
      value: null
    },
    identity: {
      enumerable: true,
      get: function() {
        return this._identity;
      }
    },
    sid: {
      enumerable: true,
      get: function() {
        return this._sid;
      }
    },
    tracks: {
      enumerable: true,
      value: new Map()
    }
  });
}

inherits(ParticipantSignaling, StateMachine);

/**
 * Add the {@link TrackSignaling}, MediaStreamTrack, or
 * {@link DataTrackSender} to the {@link ParticipantSignaling}.
 * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
 * @returns {this}
 * @fires ParticipantSignaling#trackAdded
 */
ParticipantSignaling.prototype.addTrack = function addTrack(track) {
  this.tracks.set(track.id, track);
  this.emit('trackAdded', track);
  return this;
};

/**
 * Disconnect the {@link ParticipantSignaling}.
 * @returns {boolean}
 */
ParticipantSignaling.prototype.disconnect = function disconnect() {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected');
    return true;
  }
  return false;
};

/**
 * Remove the {@link TrackSignaling}, MediaStreamTrack, or
 * {@link DataTrackSender} from the {@link ParticipantSignaling}.
 * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
 * @returns {boolean}
 * @fires ParticipantSignaling#trackRemoved
 */
ParticipantSignaling.prototype.removeTrack = function removeTrack(track) {
  var didDelete = this.tracks.delete(track.id);
  if (didDelete) {
    this.emit('trackRemoved', track);
  }
  return didDelete;
};

/**
 * Connect the {@link ParticipantSignaling}.
 * @param {Participant.SID} sid
 * @param {string} identity
 * @returns {boolean}
 */
ParticipantSignaling.prototype.connect = function connect(sid, identity) {
  if (this.state === 'connecting') {
    this._sid = sid;
    this._identity = identity;
    this.preempt('connected');
    return true;
  }
  return false;
};

/**
 * {@link TrackSignaling} was added to the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackAdded
 * @param {TrackSignaling} track
 */

/**
 * {@link TrackSignaling} was removed from the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackRemoved
 * @param {TrackSignaling} track
 */

module.exports = ParticipantSignaling;

},{"../statemachine":61,"util":146}],42:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link RecordingSignaling}.
 * @class
 * @classdesc Represents recording state
 * @property {?boolean} isEnabled
 */
function RecordingSignaling() {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _isEnabled: {
      value: null,
      writable: true
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this._isEnabled;
      }
    }
  });
}

inherits(RecordingSignaling, EventEmitter);

/**
 * Disable the {@link RecordingSignaling} if it is not already disabled.
 * @return {this}
 */
RecordingSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable (or disable) the {@link RecordingSignaling} if it is not already enabled
 * (or disabled).
 * @param {boolean} [enabled=true]
 * @return {this}
 */
RecordingSignaling.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (this.isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit('updated');
  }
  return this;
};

/**
 * Emitted whenever the {@link RecordingSignaling} is updated
 * @event RecordingSignaling#updated
 */

module.exports = RecordingSignaling;

},{"events":142,"util":146}],43:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('./participant');

/**
 * Construct a {@link RemoteParticipantSignaling}.
 * @class
 * @classdesc A {@link Participant} implementation
 * @extends ParticipantSignaling
 * @param {Participant.SID} sid
 * @param {string} identity
 * @property {string} identity
 * @property {Participant.SID} sid
 */
function RemoteParticipantSignaling(sid, identity) {
  ParticipantSignaling.call(this);
  this.connect(sid, identity);
}

inherits(RemoteParticipantSignaling, ParticipantSignaling);

module.exports = RemoteParticipantSignaling;

},{"./participant":41,"util":146}],44:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var TrackSignaling = require('./track');

/**
 * Construct a {@link RemoteTrackSignaling}.
 * @class
 * @classdesc A {@link RemoteTrack} implementation
 * @extends TrackSignaling
 * @param {Track.SID} sid
 * @param {string} name
 * @param {Track.ID} id
 * @param {Track.Kind} kind
 * @param {boolean} isEnabled
 * @property {boolean} isSubscribed
 * @property {?Error} error - non-null if subscription failed
 */
function RemoteTrackSignaling(sid, name, id, kind, isEnabled) {
  TrackSignaling.call(this, name, id, kind, isEnabled);
  Object.defineProperties(this, {
    _error: {
      value: null,
      writable: true
    },
    error: {
      enumerable: true,
      get: function() {
        return this._error;
      }
    },
    isSubscribed: {
      enumerable: true,
      get: function() {
        return !!this._trackTransceiver;
      }
    }
  });
  this.setSid(sid);
}

inherits(RemoteTrackSignaling, TrackSignaling);

/**
 * @param {Error} error
 * @returns {this}
 */
RemoteTrackSignaling.prototype.subscribeFailed = function subscribeFailed(error) {
  if (!this._error) {
    this._error = error;
    this.emit('updated');
  }
  return this;
};

module.exports = RemoteTrackSignaling;

},{"./track":46,"util":146}],45:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var DefaultRecordingSignaling = require('./recording');
var StateMachine = require('../statemachine');

/*
RoomSignaling States
-----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+

*/

var states = {
  connected: [
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link RoomSignaling}.
 * @class
 * @classdesc A {@link Room} implementation
 * @extends StateMachine
 * @param {ParticipantSignaling} localParticipant
 * @param {Room.SID} sid
 * @param {string} name
 * @property {ParticipantSignaling} localParticipant
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected" or "disconnected"
 */
function RoomSignaling(localParticipant, sid, name, options) {
  options = Object.assign({
    RecordingSignaling: DefaultRecordingSignaling
  }, options);

  StateMachine.call(this, 'connected', states);

  var RecordingSignaling = options.RecordingSignaling;

  Object.defineProperties(this, {
    _options: {
      value: options
    },
    localParticipant: {
      enumerable: true,
      value: localParticipant
    },
    name: {
      enumerable: true,
      value: name
    },
    participants: {
      enumerable: true,
      value: new Map()
    },
    recording: {
      enumerable: true,
      value: new RecordingSignaling()
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

inherits(RoomSignaling, StateMachine);

/**
 * Disconnect, possibly with an Error.
 * @param {Error} [error]
 * @returns {boolean}
 */
RoomSignaling.prototype._disconnect = function _disconnect(error) {
  if (this.state === 'connected') {
    this.preempt('disconnected', null, [error]);
    return true;
  }
  return false;
};

/**
 * Connect {@link RemoteParticipantSignaling} to the {@link RoomSignaling}.
 * @param {RemoteParticipantSignaling} participant
 * @returns {boolean}
 */
RoomSignaling.prototype.connectParticipant = function connectParticipant(participant) {
  var self = this;

  if (participant.state === 'disconnected') {
    return false;
  }

  if (this.participants.has(participant.sid)) {
    return false;
  }

  this.participants.set(participant.sid, participant);

  participant.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      participant.removeListener('stateChanged', stateChanged);
      self.participants.delete(participant.sid);
      self.emit('participantDisconnected', participant);
    }
  });

  this.emit('participantConnected', participant);

  return true;
};

/**
 * Disconnect.
 * @returns {boolean}
 */
RoomSignaling.prototype.disconnect = function disconnect() {
  return this._disconnect();
};

/**
 * {@link RemoteParticipantSignaling} connected to the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantConnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */

/**
 * {@link RemoteParticipantSignaling} disconnected from the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantDisconnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */

module.exports = RoomSignaling;

},{"../statemachine":61,"./recording":42,"util":146}],46:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('../util');

/**
 * Construct a {@link TrackSignaling}.
 * @class
 * @classdesc A {@link Track} implementation
 * @param {string} name
 * @param {Track.ID} id
 * @param {Track.Kind} kind
 * @param {boolean} isEnabled
 * @property {Track.ID} id
 * @property {boolean} isEnabled
 * @property {Track.Kind} kind
 * @property {?TrackTransceiver} trackTransceiver
 * @property {?Track.SID} sid
 */
function TrackSignaling(name, id, kind, isEnabled) {
  EventEmitter.call(this);
  var sid = null;
  var trackTransceiver = null;
  Object.defineProperties(this, {
    _isEnabled: {
      value: isEnabled,
      writable: true
    },
    _trackTransceiver: {
      get: function() {
        return trackTransceiver;
      },
      set: function(_trackTransceiver) {
        if (trackTransceiver === null) {
          trackTransceiver = _trackTransceiver;
          this._trackTransceiverDeferred.resolve(trackTransceiver);
        }
      }
    },
    _trackTransceiverDeferred: {
      value: util.defer()
    },
    _sid: {
      get: function() {
        return sid;
      },
      set: function(_sid) {
        if (sid === null) {
          sid = _sid;
        }
      }
    },
    id: {
      enumerable: true,
      value: id
    },
    isEnabled: {
      enumerable: true,
      get: function() {
        return this._isEnabled;
      }
    },
    kind: {
      enumerable: true,
      value: kind
    },
    trackTransceiver: {
      enumerable: true,
      get: function() {
        return trackTransceiver;
      }
    },
    name: {
      enumerable: true,
      value: name
    },
    sid: {
      enumerable: true,
      get: function() {
        return sid;
      }
    }
  });
}

inherits(TrackSignaling, EventEmitter);

/**
 * Disable the {@link TrackSignaling} if it is not already disabled.
 * @return {this}
 */
TrackSignaling.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
 * (or disabled).
 * @param {boolean} [enabled=true]
 * @return {this}
 */
TrackSignaling.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  if (this.isEnabled !== enabled) {
    this._isEnabled = enabled;
    this.emit('updated');
  }
  return this;
};

/**
 * Get the {@link TrackTransceiver} on the @link TrackSignaling}.
 * @returns {Promise<TrackTransceiver>}
 */
TrackSignaling.prototype.getTrackTransceiver = function getTrackTransceiver() {
  return this._trackTransceiverDeferred.promise;
};

/**
 * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
 * @param {TrackTransceiver} trackTransceiver
 * @returns {this}
 */
TrackSignaling.prototype.setTrackTransceiver = function setTrackTransceiver(trackTransceiver) {
  this._trackTransceiver = trackTransceiver;
  return this;
};

/**
 * Set the SID on the {@link TrackSignaling} once.
 * @param {string} sid
 * @returns {this}
 */
TrackSignaling.prototype.setSid = function setSid(sid) {
  if (this._sid === null) {
    this._sid = sid;
    this.emit('updated');
  }
  return this;
};

/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */

module.exports = TrackSignaling;

},{"../util":74,"events":142,"util":146}],47:[function(require,module,exports){
'use strict';

var CancelablePromise = require('../../util/cancelablepromise');
var DefaultPeerConnectionManager = require('./peerconnectionmanager');
var DefaultRoomV2 = require('./room');
var DefaultTransport = require('./transport');
var SignalingConnectionDisconnectedError = require('../../util/twilio-video-errors').SignalingConnectionDisconnectedError;
var SignalingIncomingMessageInvalidError = require('../../util/twilio-video-errors').SignalingIncomingMessageInvalidError;
var flatMap = require('../../util').flatMap;

function createCancelableRoomSignalingPromise(token, ua, localParticipant, iceServerSource, encodingParameters, preferredCodecs, options) {
  options = Object.assign({
    PeerConnectionManager: DefaultPeerConnectionManager,
    RoomV2: DefaultRoomV2,
    Transport: DefaultTransport
  }, options);

  var transport;

  var PeerConnectionManager = options.PeerConnectionManager;
  var RoomV2 = options.RoomV2;

  var peerConnectionManager = new PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options);

  var trackSenders = flatMap(localParticipant.tracks, function(trackV2) {
    return [trackV2.trackTransceiver];
  });

  peerConnectionManager.setConfiguration(options);
  peerConnectionManager.setTrackSenders(trackSenders);

  var cancelationError = new Error('Canceled');

  return new CancelablePromise(function onCreate(resolve, reject, isCanceled) {
    peerConnectionManager.createAndOffer().then(function createAndOfferSucceeded() {
      // NOTE(mmalavalli): PeerConnectionManager#createAndOffer() queues the
      // initial offer in the event queue for the 'description' event. So,
      // we are dequeueing to prevent the spurious 'update' message sent by
      // the client after connecting to a room.
      peerConnectionManager.dequeue('description');

      return new Promise(function(resolve, reject) {
        if (isCanceled()) {
          reject(cancelationError);
          return;
        }

        var transportOptions = typeof options.wsServerInsights === 'string'
          ? { wsServerInsights: options.wsServerInsights }
          : {};

        if (options.InsightsPublisher) {
          transportOptions.InsightsPublisher = options.InsightsPublisher;
        }

        if (options.NullInsightsPublisher) {
          transportOptions.NullInsightsPublisher = options.NullInsightsPublisher;
        }

        transportOptions = Object.assign({
          environment: options.environment,
          insights: options.insights,
          realm: options.realm
        }, transportOptions);

        var Transport = options.Transport;
        transport = new Transport(
          options.name,
          token,
          localParticipant,
          peerConnectionManager,
          ua,
          transportOptions);

        transport.once('connected', function connected(initialState) {
          if (isCanceled()) {
            reject(cancelationError);
            return;
          }

          var localParticipantState = initialState.participant;
          if (!localParticipantState) {
            reject(new SignalingIncomingMessageInvalidError());
            return;
          }

          resolve(new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options));
        });

        transport.once('stateChanged', function stateChanged(state, error) {
          if (state === 'disconnected') {
            error = error || new SignalingConnectionDisconnectedError();
            transport = null;
            reject(error);
          }
        });
      });
    }).then(function createRoomSignalingSucceeded(roomSignaling) {
      if (isCanceled()) {
        peerConnectionManager.close();
        roomSignaling.disconnect();
        reject(cancelationError);
        return;
      }
      resolve(roomSignaling);
    }).catch(function onError(error) {
      if (transport) {
        transport.disconnect();
        transport = null;
      }
      peerConnectionManager.close();
      reject(error);
    });
  }, function onCancel() {
    if (transport) {
      transport.disconnect();
      transport = null;
    }
  });
}

module.exports = createCancelableRoomSignalingPromise;

},{"../../util":74,"../../util/cancelablepromise":71,"../../util/twilio-video-errors":86,"./peerconnectionmanager":53,"./room":57,"./transport":59}],48:[function(require,module,exports){
'use strict';

var Filter = require('../../util/filter');

/**
 * Construct an {@link IceBox}.
 * @class
 * @classdesc An {@link IceBox} stores trickled ICE candidates. Candidates added
 * to the {@link IceBox} via {@link IceBox#update} are compared against
 * previously trickled candidates and only new candidates will be returned
 * (assuming they match the current ICE username fragment set by
 * {@link IceBox#setUfrag}.
 * @property {?string} ufrag
 */
function IceBox() {
  if (!(this instanceof IceBox)) {
    return new IceBox();
  }
  Object.defineProperties(this, {
    _filter: {
      value: new Filter({
        getKey: function getKey(iceState) {
          return iceState.ufrag;
        },
        isLessThanOrEqualTo: function isLessThanOrEqualTo(a, b) {
          return a.revision <= b.revision;
        }
      })
    },
    _ufrag: {
      writable: true,
      value: null
    },
    ufrag: {
      enumerable: true,
      get: function() {
        return this._ufrag;
      }
    }
  });
}

/**
 * Set the ICE username fragment on the {@link IceBox}. This method returns any
 * ICE candidates associated with the username fragment.
 * @param {string} ufrag
 * @returns {Array<RTCIceCandidateInit>}
 */
IceBox.prototype.setUfrag = function setUfrag(ufrag) {
  this._ufrag = ufrag;
  var ice = this._filter.toMap().get(ufrag);
  return ice ? ice.candidates : [];
};

/**
 * Update the {@link IceBox}. This method returns any new ICE candidates
 * associated with the current username fragment.
 * @param {object} iceState
 * @returns {Array<RTCIceCandidateInit>}
 */
IceBox.prototype.update = function update(iceState) {
  // NOTE(mroberts): The Server sometimes does not set the candidates property.
  iceState.candidates = iceState.candidates || [];
  var oldIceState = this._filter.toMap().get(iceState.ufrag);
  var oldCandidates = oldIceState ? oldIceState.candidates : [];
  return this._filter.update(iceState) && this._ufrag === iceState.ufrag
    ? iceState.candidates.slice(oldCandidates.length)
    : [];
};

module.exports = IceBox;

},{"../../util/filter":73}],49:[function(require,module,exports){
'use strict';

var constants = require('../../util/constants');
var defaultCreateCancelableRoomSignalingPromise = require('./cancelableroomsignalingpromise');
var inherits = require('util').inherits;
var LocalParticipantV2 = require('./localparticipant');
var Signaling = require('../');
var SIP = require('../../sip');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

/**
 * Construct {@link SignalingV2}.
 * @class
 * @classdesc {@link SignalingV2} implements version 2 of our signaling
 * protocol.
 * @extends {Signaling}
 * @param {string} wsServer
 * @param {?object} [options={}]
 */
function SignalingV2(wsServer, options) {
  var uri = util.makeClientSIPURI();

  /* eslint new-cap:0 */
  options = Object.assign({
    createCancelableRoomSignalingPromise: defaultCreateCancelableRoomSignalingPromise,
    registrarServer: constants.REGISTRAR_SERVER,
    UA: SIP.UA
  }, options);

  var debug = options.logLevel === 'debug';
  var useWssHack = wsServer.startsWith('wss://');

  var UA = options.UA;
  var ua = new UA({
    autostart: false,
    log: {
      builtinEnabled: debug
    },
    extraSupported: ['room-signaling', 'timer'],
    hackAllowUnregisteredOptionTags: true,
    keepAliveInterval: 30,
    mediaHandlerFactory: SIPJSMediaHandler.defaultFactory,
    register: false,
    registrarServer: options.registrarServer,
    traceSip: debug,
    uri: uri,
    wsServers: wsServer,
    hackWssInTransport: useWssHack
  });

  Signaling.call(this);

  Object.defineProperties(this, {
    _createCancelableRoomSignalingPromise: {
      value: options.createCancelableRoomSignalingPromise
    },
    _options: {
      value: options
    },
    _ua: {
      value: ua
    }
  });
}

inherits(SignalingV2, Signaling);

SignalingV2.prototype._close = function _close(key) {
  this.transition('closing', key);
  this._ua.stop();
  this._ua.transport.disconnect();
  this.transition('closed', key);
  return Promise.resolve(this);
};

SignalingV2.prototype._open = function _open(key) {
  var self = this;

  function startUA() {
    self._ua.start();
  }

  this.transition('opening', key);
  return util.promiseFromEvents(startUA, this._ua, 'connected', 'disconnected').then(function() {
    self.transition('open', key);
    return self;
  }, function() {
    self.transition('closed', key);
    throw new Error('Open failed');
  });
};

SignalingV2.prototype._connect = function _connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options) {
  options = Object.assign({}, this._options, options);

  var ua = this._ua;

  return this._createCancelableRoomSignalingPromise.bind(
    null,
    token,
    ua,
    localParticipant,
    iceServerSource,
    encodingParameters,
    preferredCodecs,
    options);
};

SignalingV2.prototype.createLocalParticipantSignaling = function createLocalParticipantSignaling(encodingParameters) {
  return new LocalParticipantV2(encodingParameters);
};

module.exports = SignalingV2;

},{"../":39,"../../sip":60,"../../util":74,"../../util/constants":72,"./cancelableroomsignalingpromise":47,"./localparticipant":50,"./sipjsmediahandler":58,"util":146}],50:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('../participant');
var LocalTrackPublicationV2 = require('./localtrackpublication');

/**
 * Construct a {@link LocalParticipantV2}.
 * @class
 * @extends ParticipantSignaling
 * @param {EncodingParametersImpl} encodingParameters
 * @param {object} [options]
 * @property {number} revision
 */
function LocalParticipantV2(encodingParameters, options) {
  if (!(this instanceof LocalParticipantV2)) {
    return new LocalParticipantV2(encodingParameters, options);
  }

  options = Object.assign({
    LocalTrackPublicationV2: LocalTrackPublicationV2
  }, options);

  ParticipantSignaling.call(this);
  Object.defineProperties(this, {
    _encodingParameters: {
      value: encodingParameters
    },
    _LocalTrackPublicationV2: {
      value: options.LocalTrackPublicationV2
    },
    _publishedRevision: {
      writable: true,
      value: 0
    },
    _revision: {
      writable: true,
      value: 1
    },
    revision: {
      enumerable: true,
      get: function() {
        return this._revision;
      }
    }
  });
}

inherits(LocalParticipantV2, ParticipantSignaling);

/**
 * Set the {@link EncodingParameters}.
 * @param {?EncodingParameters} encodingParameters
 * @returns {this}
 */
LocalParticipantV2.prototype.setParameters = function setParameters(encodingParameters) {
  this._encodingParameters.update(encodingParameters);
  return this;
};

/**
 * Update the {@link LocalParticipantV2} with the new state.
 * @param {Published} published
 * @returns {this}
 */
LocalParticipantV2.prototype.update = function update(published) {
  if (this._publishedRevision >= published.revision) {
    return this;
  }

  this._publishedRevision = published.revision;

  published.tracks.forEach(function(publicationState) {
    var localTrackPublicationV2 = this.tracks.get(publicationState.id);
    if (localTrackPublicationV2) {
      localTrackPublicationV2.update(publicationState);
    }
  }, this);

  return this;
};

/**
 * Add a {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
 * or {@link MediaTrackSender} to the {@link LocalParticipantV2}.
 * @param {DataTrackSender|MediaTrackSender} trackSender
 * @param {string} name
 * @returns {this}
 */
LocalParticipantV2.prototype.addTrack = function addTrack(trackSender, name) {
  var localTrackPublicationV2 = new this._LocalTrackPublicationV2(trackSender, name);
  return ParticipantSignaling.prototype.addTrack.call(this, localTrackPublicationV2);
};

/**
 * Get the current state of the {@link LocalParticipantV2}.
 * @returns {object}
 */
LocalParticipantV2.prototype.getState = function getState() {
  return {
    revision: this.revision,
    tracks: Array.from(this.tracks.values()).map(function(track) {
      return track.getState();
    })
  };
};

/**
 * Increment the revision for the {@link LocalParticipantV2}.
 * @returns {this}
 */
LocalParticipantV2.prototype.incrementRevision = function incrementRevision() {
  this._revision++;
  return this;
};

/**
 * Remove the {@link LocalTrackPublicationV2} for the given {@link DataTrackSender}
 * or {@link MediaTrackSender} from the {@link LocalParticipantV2}.
 * @param {DataTrackSender|MediaTrackSender} trackSender
 * @returns {boolean}
 */
LocalParticipantV2.prototype.removeTrack = function removeTrack(trackSender) {
  var localTrackPublicationV2 = this.tracks.get(trackSender.id);
  if (!localTrackPublicationV2) {
    return false;
  }
  return ParticipantSignaling.prototype.removeTrack.call(this, localTrackPublicationV2);
};

/**
 * @interface Published
 * @property {number} revision
 * @property {Array<PublishedTrack>} tracks
 */

/**
 * @typedef {CreatedTrack|ReadyTrack|FailedTrack} PublishedTrack
 */

/**
 * @interface CreatedTrack
 * @property {Track.ID} id
 * @property {string} state - "created"
 */

/**
 * @interface ReadyTrack
 * @property {Track.ID} id
 * @property {Track.SID} sid
 * @property {string} state - "ready"
 */

/**
 * @interface FailedTrack
 * @property {Track.ID} id
 * @property {TrackError} error
 * @property {string} state - "failed"
 */

/**
 * @interface TrackError
 * @property {number} code
 * @property {string} message
 */

module.exports = LocalParticipantV2;

},{"../participant":41,"./localtrackpublication":51,"util":146}],51:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackPublicationSignaling = require('../localtrackpublication');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

/**
 * Construct a {@link LocalTrackPublicationV2}.
 * @class
 * @extends LocalTrackPublicationSignaling
 * @param {DataTrackSender|MediaTrackSender} trackSender
 * @param {string} name
 */
function LocalTrackPublicationV2(trackSender, name) {
  if (!(this instanceof LocalTrackPublicationV2)) {
    return new LocalTrackPublicationV2(trackSender, name);
  }
  LocalTrackPublicationSignaling.call(this, trackSender, name);
}

inherits(LocalTrackPublicationV2, LocalTrackPublicationSignaling);

/**
 * Get the {@link LocalTrackPublicationV2#Representation} of a given {@link TrackSignaling}.
 * @returns {LocalTrackPublicationV2#Representation} - without the SID
 */
LocalTrackPublicationV2.prototype.getState = function getState() {
  return {
    enabled: this.isEnabled,
    id: this.id,
    kind: this.kind,
    name: this.name
  };
};

/**
 * Compare the {@link LocalTrackPublicationV2} to a {@link LocalTrackPublicationV2#Representation} of itself
 * and perform any updates necessary.
 * @param {PublishedTrack} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
LocalTrackPublicationV2.prototype.update = function update(track) {
  switch (track.state) {
    case 'ready':
      this.setSid(track.sid);
      break;
    case 'failed':
      var error = track.error;
      this.publishFailed(createTwilioError(error.code, error.message));
      break;
    default: // 'created'
      break;
  }
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link LocalTrackPublicationV2}.
 * @typedef {object} LocalTrackPublicationV2#Representation
 * @property {boolean} enabled
 * @property {Track.ID} id
 * @property {Track.Kind} kind
 * @property {string} name
 * @property {Track.SID} sid
 */

module.exports = LocalTrackPublicationV2;

},{"../../util/twilio-video-errors":86,"../localtrackpublication":40,"util":146}],52:[function(require,module,exports){
'use strict';

var WebRTC = require('@twilio/webrtc');
var DefaultMediaStream = WebRTC.MediaStream;
var DefaultRTCIceCandidate = WebRTC.RTCIceCandidate;
var DefaultRTCPeerConnection = WebRTC.RTCPeerConnection;
var DefaultRTCSessionDescription = WebRTC.RTCSessionDescription;
var getStatistics = WebRTC.getStats;
var getMediaSections = require('../../util/sdp').getMediaSections;
var guessBrowser = require('../../util').guessBrowser;
var oncePerTick = require('../../util').oncePerTick;
var setBitrateParameters = require('../../util/sdp').setBitrateParameters;
var setCodecPreferences = require('../../util/sdp').setCodecPreferences;
var setSimulcast = require('../../util/sdp').setSimulcast;
var IceBox = require('./icebox');
var inherits = require('util').inherits;
var MediaClientLocalDescFailedError = require('../../util/twilio-video-errors').MediaClientLocalDescFailedError;
var MediaClientRemoteDescFailedError = require('../../util/twilio-video-errors').MediaClientRemoteDescFailedError;
var DataTrackReceiver = require('../../data/receiver');
var MediaTrackReceiver = require('../../media/track/receiver');
var StateMachine = require('../../../lib/statemachine');
var StatsReport = require('../../stats/statsreport');
var IdentityTrackMatcher = require('../../util/sdp/trackmatcher/identity');
var OrderedTrackMatcher = require('../../util/sdp/trackmatcher/ordered');
var MIDTrackMatcher = require('../../util/sdp/trackmatcher/mid');
var workaroundIssue8329 = require('../../util/sdp/issue8329');

var isChrome = guessBrowser() === 'chrome';
var isFirefox = guessBrowser() === 'firefox';
var isSafari = guessBrowser() === 'safari';

/*
PeerConnectionV2 States
-----------------------

    +------+    +--------+
    |      |    |        |
    | open |--->| closed |
    |      |    |        |
    +------+    +--------+
      |  ^          ^
      |  |          |
      |  |          |
      v  |          |
  +----------+      |
  |          |      |
  | updating |------+
  |          |
  +----------+

*/

var states = {
  open: [
    'closed',
    'updating'
  ],
  updating: [
    'closed',
    'open'
  ],
  closed: []
};

/**
 * Construct a {@link PeerConnectionV2}.
 * @class
 * @extends StateMachine
 * @param {string} id
 * @param {EncodingParametersImpl} encodingParameters
 * @param {PreferredCodecs} preferredCodecs
 * @param {object} [options]
 * @property {id}
 * @fires PeerConnectionV2#candidates
 * @fires PeerConnectionV2#description
 */
function PeerConnectionV2(id, encodingParameters, preferredCodecs, options) {
  if (!(this instanceof PeerConnectionV2)) {
    return new PeerConnectionV2(id, encodingParameters, preferredCodecs, options);
  }
  StateMachine.call(this, 'open', states);

  options = Object.assign({
    iceServers: [],
    offerOptions: {},
    setBitrateParameters: setBitrateParameters,
    setCodecPreferences: setCodecPreferences,
    setSimulcast: setSimulcast,
    MediaStream: DefaultMediaStream,
    RTCIceCandidate: DefaultRTCIceCandidate,
    RTCPeerConnection: DefaultRTCPeerConnection,
    RTCSessionDescription: DefaultRTCSessionDescription
  }, options);

  var configuration = getConfiguration(options);
  var RTCPeerConnection = options.RTCPeerConnection;
  var peerConnection = new RTCPeerConnection(configuration);

  Object.defineProperties(this, {
    _dataChannels: {
      value: new Map()
    },
    _dataTrackReceivers: {
      value: new Set()
    },
    _descriptionRevision: {
      writable: true,
      value: 0
    },
    _encodingParameters: {
      value: encodingParameters
    },
    _lastStableDescriptionRevision: {
      writable: true,
      value: 0
    },
    _localCandidates: {
      writable: true,
      value: []
    },
    _localCandidatesRevision: {
      writable: true,
      value: 1
    },
    _localDescription: {
      writable: true,
      value: null
    },
    _localMediaStream: {
      value: new options.MediaStream()
    },
    _localUfrag: {
      writable: true,
      value: null
    },
    _log: {
      value: options.log
        ? options.log.createLog('signaling', this)
        : null
    },
    _rtpSenders: {
      value: new Map()
    },
    _mediaTrackReceivers: {
      value: new Set()
    },
    _needsInitialAnswer: {
      writable: true,
      value: false
    },
    _negotiationRole: {
      writable: true,
      value: null
    },
    _offerOptions: {
      writable: true,
      value: options.offerOptions
    },
    _peerConnection: {
      value: peerConnection
    },
    _preferredAudioCodecs: {
      value: preferredCodecs.audio
    },
    _preferredVideoCodecs: {
      value: preferredCodecs.video
    },
    _queuedDescription: {
      writable: true,
      value: null
    },
    _remoteCandidates: {
      writable: true,
      value: new IceBox()
    },
    _setBitrateParameters: {
      value: options.setBitrateParameters
    },
    _setCodecPreferences: {
      value: options.setCodecPreferences
    },
    _setSimulcast: {
      value: options.setSimulcast
    },
    _RTCIceCandidate: {
      value: options.RTCIceCandidate
    },
    _RTCPeerConnection: {
      value: options.RTCPeerConnection
    },
    _RTCSessionDescription: {
      value: options.RTCSessionDescription
    },
    _shouldOffer: {
      writable: true,
      value: false
    },
    _trackIdsToAttributes: {
      value: new Map()
    },
    _trackMatcher: {
      writable: true,
      value: null
    },
    id: {
      enumerable: true,
      value: id
    }
  });

  encodingParameters.on('changed', oncePerTick(this.offer.bind(this)));
  peerConnection.addEventListener('datachannel', this._handleDataChannelEvent.bind(this));
  peerConnection.addEventListener('icecandidate', this._handleIceCandidateEvent.bind(this));
  peerConnection.addEventListener('signalingstatechange', this._handleSignalingStateChange.bind(this));
  peerConnection.addEventListener('track', this._handleTrackEvent.bind(this));

  var self = this;
  this.on('stateChanged', function stateChanged(state) {
    if (state !== 'closed') {
      return;
    }
    self.removeListener('stateChanged', stateChanged);
    self._dataChannels.forEach(function(dataChannel, dataTrackSender) {
      self.removeDataTrackSender(dataTrackSender);
    });
  });
}

inherits(PeerConnectionV2, StateMachine);

/**
 * Add an ICE candidate to the {@link PeerConnectionV2}.
 * @param {object} candidate
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._addIceCandidate = function _addIceCandidate(candidate) {
  var self = this;
  return Promise.resolve().then(function() {
    candidate = new self._RTCIceCandidate(candidate);
    return self._peerConnection.addIceCandidate(candidate);
  });
};

/**
 * Add ICE candidates to the {@link PeerConnectionV2}.
 * @param {Array<object>} candidates
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._addIceCandidates = function _addIceCandidates(candidates) {
  return Promise.all(candidates.map(this._addIceCandidate, this)).then(function() {});
};

/**
 * Check the {@link IceBox}.
 * @param {RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._checkIceBox = function checkIceBox(description) {
  var ufrag = getUfrag(description);
  if (!ufrag) {
    return Promise.resolve();
  }
  var candidates = this._remoteCandidates.setUfrag(ufrag);
  return this._addIceCandidates(candidates);
};

/**
 * Create an answer and set it on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._answer = function _answer(offer) {
  var self = this;
  return Promise.resolve().then(function() {
    if (!self._negotiationRole) {
      self._negotiationRole = 'answerer';
    }
    return self._setRemoteDescription(offer);
  }).catch(function() {
    throw new MediaClientRemoteDescFailedError();
  }).then(function() {
    return self._peerConnection.createAnswer();
  }).then(function(answer) {
    if (!isFirefox) {
      answer = workaroundIssue8329(answer);
    }
    return self._setLocalDescription(answer);
  }).then(function() {
    return self._checkIceBox(offer);
  }).then(function() {
    return self._peerConnection.localDescription
      ? self._maybeReoffer(self._peerConnection.localDescription)
      : Promise.resolve();
  }).catch(function(error) {
    throw error instanceof MediaClientRemoteDescFailedError
      ? error
      : new MediaClientLocalDescFailedError();
  });
};

/**
 * Close the underlying RTCPeerConnection. Returns false if the
 * RTCPeerConnection was already closed.
 * @returns {boolean}
 */
PeerConnectionV2.prototype._close = function _close() {
  if (this._peerConnection.signalingState !== 'closed') {
    this._peerConnection.close();
    return true;
  }
  return false;
};

/**
 * Handle a "datachannel" event.
 * @param {RTCDataChannelEvent} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleDataChannelEvent = function _handleDataChannelEvent(event) {
  var dataChannel = event.channel;
  var dataTrackReceiver = new DataTrackReceiver(dataChannel);
  this._dataTrackReceivers.add(dataTrackReceiver);

  var self = this;
  dataChannel.addEventListener('close', function() {
    self._dataTrackReceivers.delete(dataTrackReceiver);
  });

  this.emit('trackAdded', dataTrackReceiver);
};

/**
 * Handle a glare scenario on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} offer
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._handleGlare = function _handleGlare(offer) {
  var self = this;
  return Promise.resolve().then(function() {
    return self._setLocalDescription({ type: 'rollback' });
  }).then(function() {
    return self._answer(offer);
  }).then(function() {
    return self._offer();
  });
};

/**
 * Handle an ICE candidate event.
 * @param {Event} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleIceCandidateEvent = function _handleIceCandidateEvent(event) {
  if (event.candidate) {
    this._localCandidates.push(event.candidate);
  }
  var peerConnectionState = {
    ice: {
      candidates: this._localCandidates.slice(),
      revision: this._localCandidatesRevision++,
      ufrag: this._localUfrag
    },
    id: this.id
  };
  if (!event.candidate) {
    peerConnectionState.ice.complete = true;
  }
  this.emit('candidates', peerConnectionState);
};


/**
 * Handle a signaling state change event.
 * @param {Event}
 * @returns {void}
 */
PeerConnectionV2.prototype._handleSignalingStateChange = function _handleSignalingStateChange() {
  if (this._peerConnection.signalingState === 'closed' && this.state !== 'closed') {
    this.preempt('closed');
  }
};

/**
 * Handle a track event.
 * @param {Event} event
 * @returns {void}
 */
PeerConnectionV2.prototype._handleTrackEvent = function _handleTrackEvent(event) {
  var sdp = this._peerConnection.remoteDescription
    ? this._peerConnection.remoteDescription.sdp
    : null;

  if (!this._trackMatcher) {
    this._trackMatcher = event.transceiver && event.transceiver.mid
      ? new MIDTrackMatcher()
      : isSafari ? new OrderedTrackMatcher() : new IdentityTrackMatcher();
  }
  this._trackMatcher.update(sdp);

  var mediaStreamTrack = event.track;
  var signaledTrackId = this._trackMatcher.match(event) || mediaStreamTrack.id;
  var mediaTrackReceiver = new MediaTrackReceiver(signaledTrackId, mediaStreamTrack);
  this._mediaTrackReceivers.add(mediaTrackReceiver);

  var self = this;
  mediaStreamTrack.addEventListener('ended', function() {
    self._mediaTrackReceivers.delete(mediaTrackReceiver);
  });

  this.emit('trackAdded', mediaTrackReceiver);
};

/**
 * Conditionally re-offer.
 * @param {RTCSessionDescriptionInit} localDescription
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._maybeReoffer = function _maybeReoffer(localDescription) {
  var shouldReoffer = this._shouldOffer;

  // NOTE(mmalavalli): In Firefox, if the remote RTCPeerConnection sends
  // an offer with fewer audio m= lines than the number of audio RTCRTPSenders
  // in the local RTCPeerConnection, then the local RTCPeerConnection creates
  // an answer with the same number of audio m= lines as in the offer. This
  // behavior was triggered by the removal of 'offerToReceiveAudio' from the
  // default RTCOfferOptions. Ideally, the local RTCPeerConnection should create
  // an answer with the same number of audio m= lines as the number of
  // RTCRTPSenders. In order to achieve this,the local RTCPeerConnection
  // initiates renegotiation.
  //
  // We can reduce the number of cases where renegotiation is needed by
  // re-introducing 'offerToReceiveAudio' to the default RTCOfferOptions with a
  // value > 1.
  if (isFirefox) {
    var senders = this._peerConnection.getSenders().filter(function(sender) {
      return sender.track;
    });
    shouldReoffer = ['audio', 'video'].reduce(function(shouldOffer, kind) {
      var mediaSections = getMediaSections(localDescription.sdp, kind, '(sendrecv|sendonly)');
      var sendersOfKind = senders.filter(isSenderOfKind.bind(null, kind));
      return shouldOffer || (mediaSections.length < sendersOfKind.length);
    }, shouldReoffer);
  }

  // NOTE(mroberts): We also need to re-offer if we have a DataTrack to share
  // but no m= application section.
  var hasDataTrack = this._dataChannels.size > 0;
  var hasApplicationMediaSection = getMediaSections(localDescription.sdp, 'application').length > 0;
  var needsApplicationMediaSection = hasDataTrack && !hasApplicationMediaSection;
  shouldReoffer = shouldReoffer || needsApplicationMediaSection;

  return shouldReoffer ? this._offer() : Promise.resolve();
};

/**
 * Create an offer and set it on the {@link PeerConnectionV2}.
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._offer = function _offer() {
  var self = this;
  return Promise.resolve().then(function() {
    return self._peerConnection.createOffer(self._offerOptions);
  }).catch(function() {
    throw new MediaClientLocalDescFailedError();
  }).then(function(offer) {
    if (!isFirefox) {
      offer = workaroundIssue8329(offer);
    }

    var updatedSdp = self._setCodecPreferences(
      offer.sdp,
      self._preferredAudioCodecs,
      self._preferredVideoCodecs);

    self._shouldOffer = false;
    if (!self._negotiationRole) {
      self._negotiationRole = 'offerer';
      self._needsInitialAnswer = true;
    }
    return self._setLocalDescription({
      type: 'offer',
      sdp: updatedSdp
    });
  });
};

/**
 * Set a local description on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescription|RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._setLocalDescription = function _setLocalDescription(description) {
  var revision = description.revision;
  var self = this;
  var vp8SimulcastRequested = this._preferredVideoCodecs.some(function(codecSettings) {
    return codecSettings.codec.toLowerCase() === 'vp8' && codecSettings.simulcast;
  });

  return Promise.resolve().then(function() {
    if (description.sdp) {
      // NOTE(mmalavalli): We do not directly modify "description.sdp" here as
      // "description" might be an RTCSessionDescription, in which case its
      // properties are immutable.
      description = {
        type: description.type,
        sdp: isChrome && vp8SimulcastRequested
          ? self._setSimulcast(description.sdp, self._trackIdsToAttributes)
          : description.sdp
      };
    }
    description = new self._RTCSessionDescription(description);
    if (description.type === 'answer') {
      self._lastStableDescriptionRevision = revision;
    }
    return self._peerConnection.setLocalDescription(description);
  }).catch(function(error) {
    if (self._log) {
      self._log.warn('Calling setLocalDescription with an RTCSessionDescription ' +
        'of type "' + description.type + '" failed with the error "' +
        error.message + '".');
      if (description.sdp) {
        self._log.warn('The SDP was ' + description.sdp);
      }
    }
    throw new MediaClientLocalDescFailedError();
  }).then(function setLocalDescriptionSucceeded() {
    if (description.type !== 'rollback') {
      self._localDescription = description;
      self._localCandidates = [];
      if (description.type === 'offer') {
        self._descriptionRevision++;
      }
      self._localUfrag = getUfrag(description);
      self.emit('description', self.getState());
    }
  });
};

/**
 * Set a remote RTCSessionDescription on the {@link PeerConnectionV2}.
 * @param {RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._setRemoteDescription = function _setRemoteDescription(description) {
  if (description.sdp) {
    description.sdp = this._setBitrateParameters(
      description.sdp,
      isFirefox ? 'TIAS' : 'AS',
      this._encodingParameters.maxAudioBitrate,
      this._encodingParameters.maxVideoBitrate);
    description.sdp = this._setCodecPreferences(
      description.sdp,
      this._preferredAudioCodecs,
      this._preferredVideoCodecs);
  }
  description = new this._RTCSessionDescription(description);
  var self = this;
  return this._peerConnection.setRemoteDescription(description).catch(function(error) {
    if (self._log) {
      self._log.warn('Calling setRemoteDescription with an RTCSessionDescription ' +
        'of type "' + description.type + '" failed with the error "' +
        error.message + '".');
      if (description.sdp) {
        self._log.warn('The SDP was ' + description.sdp);
      }
    }
    throw error;
  });
};

/**
 * Update the {@link PeerConnectionV2}'s description.
 * @param {RTCSessionDescriptionInit} description
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._updateDescription = function _updateDescription(description) {
  switch (description.type) {
    case 'answer':
    case 'pranswer':
      if (description.revision !== this._descriptionRevision
        || this._peerConnection.signalingState !== 'have-local-offer') {
        return Promise.resolve();
      }
      this._descriptionRevision = description.revision;
      break;
    case 'close':
      return this._close();
    case 'create-offer':
      if (description.revision <= this._lastStableDescriptionRevision) {
        return Promise.resolve();
      } else if (this._needsInitialAnswer) {
        this._queuedDescription = description;
        return Promise.resolve();
      }
      this._descriptionRevision = description.revision;
      return this._offer();
    case 'offer':
      if (description.revision <= this._lastStableDescriptionRevision
        || this._peerConnection.signalingState === 'closed') {
        return Promise.resolve();
      }
      if (this._peerConnection.signalingState === 'have-local-offer') {
        if (this._needsInitialAnswer) {
          this._queuedDescription = description;
          return Promise.resolve();
        }
        this._descriptionRevision = description.revision;
        return this._handleGlare(description);
      }
      this._descriptionRevision = description.revision;
      return this._answer(description);
    default:
      // Do nothing.
  }

  // Handle answer or pranswer.
  var revision = description.revision;
  var self = this;
  return Promise.resolve().then(function() {
    if (description.type === 'answer') {
      self._lastStableDescriptionRevision = revision;
    }
    return self._setRemoteDescription(description);
  }).catch(function() {
    throw new MediaClientRemoteDescFailedError();
  }).then(function() {
    if (description.type === 'answer') {
      self._needsInitialAnswer = false;
    }
    return self._checkIceBox(description);
  }).then(function() {
    return self._queuedDescription && self._updateDescription(self._queuedDescription);
  }).then(function() {
    self._queuedDescription = null;
    return self._peerConnection.localDescription
      ? self._maybeReoffer(self._peerConnection.localDescription)
      : Promise.resolve();
  });
};

/**
 * Update the {@link PeerConnectionV2}'s ICE candidates.
 * @param {object} iceState
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype._updateIce = function _updateIce(iceState) {
  var candidates = this._remoteCandidates.update(iceState);
  return this._addIceCandidates(candidates);
};

/**
 * Add a {@link DataTrackSender} to the {@link PeerConnectionV2}.
 * @param {DataTrackSender} dataTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.addDataTrackSender = function addDataTrackSender(dataTrackSender) {
  if (this._dataChannels.has(dataTrackSender)) {
    return;
  }
  try {
    var dataChannelDict = {
      ordered: dataTrackSender.ordered
    };
    if (dataTrackSender.maxPacketLifeTime !== null) {
      dataChannelDict.maxPacketLifeTime = dataTrackSender.maxPacketLifeTime;
    }
    if (dataTrackSender.maxRetransmits !== null) {
      dataChannelDict.maxRetransmits = dataTrackSender.maxRetransmits;
    }
    var dataChannel = this._peerConnection.createDataChannel(dataTrackSender.id, dataChannelDict);
    dataTrackSender.addDataChannel(dataChannel);
    this._dataChannels.set(dataTrackSender, dataChannel);
  } catch (error) {
    // Do nothing.
  }
};

/**
 * Add the {@link MediaTrackSender} to the {@link PeerConnectionV2}.
 * @param {MediaTrackSender} mediaTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.addMediaTrackSender = function addMediaTrackSender(mediaTrackSender) {
  if (this._peerConnection.signalingState === 'closed' || this._rtpSenders.has(mediaTrackSender)) {
    return;
  }
  this._localMediaStream.addTrack(mediaTrackSender.track);
  var sender = this._peerConnection.addTrack(mediaTrackSender.track, this._localMediaStream);
  mediaTrackSender.addSender(sender);
  this._rtpSenders.set(mediaTrackSender, sender);
};

/**
 * Close the {@link PeerConnectionV2}.
 * @returns {void}
 */
PeerConnectionV2.prototype.close = function close() {
  if (this._close()) {
    this._descriptionRevision++;
    this._localDescription = { type: 'close' };
    this.emit('description', this.getState());
  }
};

/**
 * Get the {@link DataTrackReceiver}s and the {@link MediaTrackReceivers} on the
 * {@link PeerConnectionV2}.
 * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
 */
PeerConnectionV2.prototype.getTrackReceivers = function getTrackReceivers() {
  return Array.from(this._dataTrackReceivers).concat(Array.from(this._mediaTrackReceivers));
};

/**
 * Get the {@link PeerConnectionV2}'s state (specifically, its description).
 * @returns {?object}
 */
PeerConnectionV2.prototype.getState = function getState() {
  if (!this._localDescription) {
    return null;
  }
  var localDescription = {
    type: this._localDescription.type,
    revision: this._descriptionRevision
  };
  if (this._localDescription.sdp) {
    localDescription.sdp = this._localDescription.sdp;
  }
  return {
    description: localDescription,
    id: this.id
  };
};

/**
 * Create an offer and set it on the {@link PeerConnectionV2}.
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype.offer = function offer() {
  if (this._needsInitialAnswer) {
    this._shouldOffer = true;
    return Promise.resolve();
  }

  var self = this;
  return this.bracket('offering', function transition(key) {
    self.transition('updating', key);
    return self._offer().then(function offerSucceeded() {
      self.tryTransition('open', key);
    }, function offerFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Remove a {@link DataTrackSender} from the {@link PeerConnectionV2}.
 * @param {DataTrackSender} dataTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.removeDataTrackSender = function removeDataTrackSender(dataTrackSender) {
  var dataChannel = this._dataChannels.get(dataTrackSender);
  if (dataChannel) {
    dataTrackSender.removeDataChannel(dataChannel);
    this._dataChannels.delete(dataTrackSender);
    dataChannel.close();
  }
};

/**
 * Remove the {@link MediaTrackSender} from the {@link PeerConnectionV2}.
 * @param {MediaTrackSender} mediaTrackSender
 * @returns {void}
 */
PeerConnectionV2.prototype.removeMediaTrackSender = function removeMediaTrackSender(mediaTrackSender) {
  if (this._peerConnection.signalingState === 'closed' || !this._rtpSenders.has(mediaTrackSender)) {
    return;
  }
  var sender = this._rtpSenders.get(mediaTrackSender);
  this._peerConnection.removeTrack(sender);
  this._localMediaStream.removeTrack(mediaTrackSender.track);
  mediaTrackSender.removeSender(sender);
  this._rtpSenders.delete(mediaTrackSender);
};

/**
 * Set the RTCConfiguration on the underlying RTCPeerConnection.
 * @param {RTCConfiguration} configuration
 * @returns {void}
 */
PeerConnectionV2.prototype.setConfiguration = function setConfiguration(configuration) {
  if (typeof this._peerConnection.setConfiguration === 'function') {
    this._peerConnection.setConfiguration(getConfiguration(configuration));
  }
};

/**
 * Update the {@link PeerConnectionV2}.
 * @param {object} peerConnectionState
 * @returns {Promise<void>}
 */
PeerConnectionV2.prototype.update = function update(peerConnectionState) {
  var self = this;
  return this.bracket('updating', function transition(key) {
    if (self.state === 'closed') {
      return Promise.resolve();
    }

    self.transition('updating', key);

    var updates = [];

    if (peerConnectionState.ice) {
      updates.push(self._updateIce(peerConnectionState.ice));
    }

    if (peerConnectionState.description) {
      updates.push(self._updateDescription(peerConnectionState.description));
    }

    return Promise.all(updates).then(function updatesSucceeded() {
      self.tryTransition('open', key);
    }, function updatesFailed(error) {
      self.tryTransition('open', key);
      throw error;
    });
  });
};

/**
 * Get the {@link PeerConnectionV2}'s media statistics.
 * @returns {Promise<StatsReport>}
 */
PeerConnectionV2.prototype.getStats = function getStats() {
  var self = this;
  return getStatistics(this._peerConnection).then(function(statsResponse) {
    return new StatsReport(self.id, statsResponse);
  });
};

/**
 * @event PeerConnectionV2#candidates
 * @param {object} candidates
 */

/**
 * @event PeerConnectionV2#description
 * @param {object} description
 */

/**
 * @event PeerConnectionV2#trackAdded
 * @param {DataTrackReceiver|MediaTrackReceiver} trackReceiver
 */

function getUfrag(description) {
  if (description.sdp) {
    var match = description.sdp.match(/^a=ice-ufrag:([a-zA-Z0-9+/]+)/m);
    if (match) {
      return match[1];
    }
  }
  return null;
}

function getConfiguration(configuration) {
  return Object.assign({
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  }, configuration);
}

/**
 * Whether the MediaStreamTrack of the given RTCRTPSender is a non-ended
 * MediaStreamTrack of a given kind.
 * @private
 * @param {string} kind
 * @param {RTCRTPSender} sender
 * @return {boolean}
 */
function isSenderOfKind(kind, sender) {
  var track = sender.track;
  return track && track.kind === kind && track.readyState !== 'ended';
}

/**
 * Preferred codecs.
 * @typedef {object} PreferredCodecs
 * @property {Array<AudioCodec>} audio
 * @property {Array<VideoCodec>} video
 */

module.exports = PeerConnectionV2;

},{"../../../lib/statemachine":61,"../../data/receiver":5,"../../media/track/receiver":25,"../../stats/statsreport":68,"../../util":74,"../../util/sdp":78,"../../util/sdp/issue8329":79,"../../util/sdp/trackmatcher/identity":81,"../../util/sdp/trackmatcher/mid":82,"../../util/sdp/trackmatcher/ordered":83,"../../util/twilio-video-errors":86,"./icebox":48,"@twilio/webrtc":125,"util":146}],53:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var PeerConnectionV2 = require('./peerconnection');
var MediaTrackSender = require('../../media/track/sender');
var QueueingEventEmitter = require('../../queueingeventemitter');
var util = require('../../util');

var isFirefox = util.guessBrowser() === 'firefox';

/**
 * Construct {@link PeerConnectionManager}.
 * @class
 * @classdesc {@link PeerConnectionManager} manages multiple
 * {@link PeerConnectionV2}s.
 * @extends {QueueingEventEmitter}
 * @param {IceServerSource} iceServerSource
 * @param {EncodingParametersImpl} encodingParameters
 * @param {PreferredCodecs} preferredCodecs
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#trackAdded
 */
function PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options) {
  if (!(this instanceof PeerConnectionManager)) {
    return new PeerConnectionManager(iceServerSource, encodingParameters, preferredCodecs, options);
  }
  QueueingEventEmitter.call(this);

  options = Object.assign({
    audioContextFactory: isFirefox
      ? require('../../webaudio/audiocontext')
      : null,
    PeerConnectionV2: PeerConnectionV2
  }, options);

  var audioContext = options.audioContextFactory
    ? options.audioContextFactory.getOrCreate(this)
    : null;

  // NOTE(mroberts): If we're using an AudioContext, we don't need to specify
  // `offerToReceiveAudio` in RTCOfferOptions.
  var offerOptions = audioContext
    ? { offerToReceiveVideo: true }
    : { offerToReceiveAudio: true, offerToReceiveVideo: true };

  Object.defineProperties(this, {
    _audioContextFactory: {
      value: options.audioContextFactory
    },
    _closedPeerConnectionIds: {
      value: new Set()
    },
    _configuration: {
      writable: true,
      value: null
    },
    _configurationDeferred: {
      writable: true,
      value: util.defer()
    },
    _dummyAudioTrackSender: {
      value: audioContext
        ? new MediaTrackSender(createDummyAudioMediaStreamTrack(audioContext))
        : null
    },
    _encodingParameters: {
      value: encodingParameters
    },
    _iceServerSource: {
      value: iceServerSource
    },
    _dataTrackSenders: {
      writable: true,
      value: new Set()
    },
    _mediaTrackSenders: {
      writable: true,
      value: new Set()
    },
    _offerOptions: {
      value: offerOptions
    },
    _peerConnections: {
      value: new Map()
    },
    _preferredCodecs: {
      value: preferredCodecs
    },
    _PeerConnectionV2: {
      value: options.PeerConnectionV2
    }
  });
}

inherits(PeerConnectionManager, QueueingEventEmitter);

/**
 * Get the {@link PeerConnectionManager}'s configuration.
 * @returns {Promise<object>}
 */
PeerConnectionManager.prototype._getConfiguration = function _getConfiguration() {
  return this._configurationDeferred.promise;
};

/**
 * Get or create a {@link PeerConnectionV2}.
 * @param {string} id
 * @param {object} [configuration]
 * @returns {PeerConnectionV2}
 */
PeerConnectionManager.prototype._getOrCreate = function _getOrCreate(id, configuration) {
  var self = this;
  var peerConnection = this._peerConnections.get(id);
  if (!peerConnection) {
    var PeerConnectionV2 = this._PeerConnectionV2;

    var options = Object.assign({
      offerOptions: this._offerOptions
    }, configuration);
    peerConnection = new PeerConnectionV2(id, this._encodingParameters, this._preferredCodecs, options);

    this._peerConnections.set(peerConnection.id, peerConnection);
    peerConnection.on('candidates', this.queue.bind(this, 'candidates'));
    peerConnection.on('description', this.queue.bind(this, 'description'));
    peerConnection.on('trackAdded', this.queue.bind(this, 'trackAdded'));
    peerConnection.on('stateChanged', function stateChanged(state) {
      if (state === 'closed') {
        peerConnection.removeListener('stateChanged', stateChanged);
        self._peerConnections.delete(peerConnection.id);
        self._closedPeerConnectionIds.add(peerConnection.id);
      }
    });

    this._dataTrackSenders.forEach(peerConnection.addDataTrackSender, peerConnection);
    this._mediaTrackSenders.forEach(peerConnection.addMediaTrackSender, peerConnection);
  }
  return peerConnection;
};

/**
 * Close all the {@link PeerConnectionV2}s in this {@link PeerConnectionManager}.
 * @returns {this}
 */
PeerConnectionManager.prototype.close = function close() {
  if (this._iceServerSource.isStarted) {
    this._iceServerSource.stop();
  }
  this._peerConnections.forEach(function(peerConnection) {
    peerConnection.close();
  });
  if (this._dummyAudioTrackSender) {
    this._dummyAudioTrackSender.track.stop();
  }
  if (this._audioContextFactory) {
    this._audioContextFactory.release(this);
  }
  return this;
};

/**
 * Create a new {@link PeerConnectionV2} on this {@link PeerConnectionManager}.
 * Then, create a new offer with the newly-created {@link PeerConnectionV2}.
 * @return {Promise<this>}
 */
PeerConnectionManager.prototype.createAndOffer = function createAndOffer() {
  var self = this;
  return this._getConfiguration().then(function getConfigurationSucceeded(configuration) {
    var id;
    do {
      id = util.makeUUID();
    } while (self._peerConnections.has(id));

    return self._getOrCreate(id, configuration);
  }).then(function createSucceeded(peerConnection) {
    return peerConnection.offer();
  }).then(function offerSucceeded() {
    return self;
  });
};

/**
 * Get the {@link DataTrackReceiver}s and {@link MediaTrackReceiver}s of all
 * the {@link PeerConnectionV2}s.
 * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
 */
PeerConnectionManager.prototype.getTrackReceivers = function getTrackReceivers() {
  return util.flatMap(this._peerConnections, function(peerConnection) {
    return peerConnection.getTrackReceivers();
  });
};

/**
 * Get the states of all {@link PeerConnectionV2}s.
 * @returns {Array<object>}
 */
PeerConnectionManager.prototype.getStates = function getStates() {
  var peerConnectionStates = [];
  this._peerConnections.forEach(function(peerConnection) {
    var peerConnectionState = peerConnection.getState();
    if (peerConnectionState) {
      peerConnectionStates.push(peerConnectionState);
    }
  });
  return peerConnectionStates;
};

/**
 * Set the {@link PeerConnectionManager}'s configuration.
 * @param {object} configuration
 * @returns {this}
 */
PeerConnectionManager.prototype.setConfiguration = function setConfiguration(configuration) {
  if (this._configuration) {
    this._configurationDeferred = util.defer();
    this._peerConnections.forEach(function(peerConnection) {
      peerConnection.setConfiguration(configuration);
    });
  }
  this._configuration = configuration;
  this._configurationDeferred.resolve(configuration);
  return this;
};

/**
 * Set the {@link DataTrackSender}s and {@link MediaTrackSenders} on the
 * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
 * @param {Array<DataTrackSender|MediaTrackSender>} trackSenders
 * @returns {this}
 */
PeerConnectionManager.prototype.setTrackSenders = function setTrackSenders(trackSenders) {
  var dataTrackSenders = new Set(trackSenders.filter(function(trackSender) {
    return trackSender.kind === 'data';
  }));
  var mediaTrackSenders = new Set(trackSenders.filter(function(trackSender) {
    return trackSender.kind === 'audio' || trackSender.kind === 'video';
  }));

  if (this._dummyAudioTrackSender) {
    mediaTrackSenders.add(this._dummyAudioTrackSender);
  }

  var changes = getTrackSenderChanges(this, dataTrackSenders, mediaTrackSenders);
  this._dataTrackSenders = dataTrackSenders;
  this._mediaTrackSenders = mediaTrackSenders;
  applyTrackSenderChanges(this, changes);

  return this;
};

/**
 * Update the {@link PeerConnectionManager}.
 * @param {Array<object>} peerConnectionStates
 * @returns {Promise<this>}
 */
PeerConnectionManager.prototype.update = function update(peerConnectionStates) {
  var self = this;
  return this._getConfiguration().then(function getConfigurationSucceeded(configuration) {
    return Promise.all(peerConnectionStates.map(function(peerConnectionState) {
      if (self._closedPeerConnectionIds.has(peerConnectionState.id)) {
        return null;
      }
      var peerConnection = self._getOrCreate(peerConnectionState.id, configuration);
      return peerConnection.update(peerConnectionState);
    }));
  }).then(function updatesSucceeded() {
    return self;
  });
};

/**
 * Get the {@link PeerConnectionManager}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
PeerConnectionManager.prototype.getStats = function getStats() {
  var peerConnections = Array.from(this._peerConnections.values());
  return Promise.all(peerConnections.map(function(peerConnection) {
    return peerConnection.getStats();
  }));
};

/**
 * Create a dummy audio MediaStreamTrack with the given AudioContext.
 * @private
 * @param {AudioContext} audioContext
 * @return {MediaStreamTrack}
 */
function createDummyAudioMediaStreamTrack(audioContext) {
  var mediaStreamDestination = audioContext.createMediaStreamDestination();
  return mediaStreamDestination.stream.getAudioTracks()[0];
}

/**
 * @event {PeerConnectionManager#candidates}
 * @param {object} candidates
 */

/**
 * @event {PeerConnectionManager#description}
 * @param {object} description
 */

/**
 * @event {PeerConnectionManager#trackAdded}
 * @param {MediaStreamTrack|DataTrackReceiver} mediaStreamTrackOrDataTrackReceiver
 */

/**
 * Apply {@link TrackSenderChanges}.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {TrackSenderChanges} changes
 * @returns {void}
 */
function applyTrackSenderChanges(peerConnectionManager, changes) {
  if (changes.data.add.size
    || changes.data.remove.size
    || changes.media.add.size
    || changes.media.remove.size) {
    peerConnectionManager._peerConnections.forEach(function(peerConnection) {
      changes.data.remove.forEach(peerConnection.removeDataTrackSender, peerConnection);
      changes.media.remove.forEach(peerConnection.removeMediaTrackSender, peerConnection);
      changes.data.add.forEach(peerConnection.addDataTrackSender, peerConnection);
      changes.media.add.forEach(peerConnection.addMediaTrackSender, peerConnection);
      peerConnection.offer();
    });
  }
}

/**
 * @interface DataTrackSenderChanges
 * @property {Set<DataTrackSender>} add
 * @property {Set<DataTrackSender>} remove
 */

/**
 * Get the {@Link DataTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @returns {DataTrackSenderChanges} changes
 */
function getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders) {
  var dataTrackSendersToAdd = util.difference(dataTrackSenders, peerConnectionManager._dataTrackSenders);
  var dataTrackSendersToRemove = util.difference(peerConnectionManager._dataTrackSenders, dataTrackSenders);
  return {
    add: dataTrackSendersToAdd,
    remove: dataTrackSendersToRemove
  };
}

/**
 * @interface TrackSenderChanges
 * @property {DataTrackSenderChanges} data
 * @property {MediaTrackSenderChanges} media
 */

/**
 * Get {@link DataTrackSender} and {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {TrackSenderChanges} changes
 */
function getTrackSenderChanges(peerConnectionManager, dataTrackSenders, mediaTrackSenders) {
  return {
    data: getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders),
    media: getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders)
  };
}

/**
 * @interface MediaTrackSenderChanges
 * @property {Set<MediaTrackSender>} add
 * @property {Set<MediaTrackSender>} remove
 */

/**
 * Get the {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {MediaTrackSenderChanges} changes
 */
function getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders) {
  var mediaTrackSendersToAdd = util.difference(mediaTrackSenders, peerConnectionManager._mediaTrackSenders);
  var mediaTrackSendersToRemove = util.difference(peerConnectionManager._mediaTrackSenders, mediaTrackSenders);
  return {
    add: mediaTrackSendersToAdd,
    remove: mediaTrackSendersToRemove
  };
}

module.exports = PeerConnectionManager;

},{"../../media/track/sender":31,"../../queueingeventemitter":35,"../../util":74,"../../webaudio/audiocontext":88,"./peerconnection":52,"util":146}],54:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RecordingSignaling = require('../recording');

/**
 * Construct a {@link RecordingV2}.
 * @class
 * @extends RecordingSignaling
 */
function RecordingV2() {
  RecordingSignaling.call(this);
  Object.defineProperties(this, {
    _revision: {
      value: 1,
      writable: true
    }
  });
}

inherits(RecordingV2, RecordingSignaling);

/**
 * Compare the {@link RecordingV2} to a {@link RecordingV2#Representation}
 * of itself and perform any updates necessary.
 * @param {RecordingV2#Representation} recording
 * @returns {this}
 * @fires RecordingSignaling#updated
 */
RecordingV2.prototype.update = function update(recording) {
  if (recording.revision < this._revision) {
    return this;
  }
  this._revision = recording.revision;
  return this.enable(recording.enabled);
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RecordingV2}
 * @typedef {object} RecordingV2#Representation
 * @property {boolean} enabled
 * @property {number} revision
 */

module.exports = RecordingV2;

},{"../recording":42,"util":146}],55:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RemoteParticipantSignaling = require('../remoteparticipant');
var RemoteTrackV2 = require('./remotetrack');

/**
 * Construct a {@link RemoteParticipantV2}.
 * @class
 * @extends RemoteParticipantSignaling
 * @param {object} participantState
 * @param {function(string): Promise<DataTrackReceiver|MediaTrackReceiver>} getTrackReceiver
 * @param {object} [options]
 * @property {?number} revision
 */
function RemoteParticipantV2(participantState, getTrackReceiver, options) {
  if (!(this instanceof RemoteParticipantV2)) {
    return new RemoteParticipantV2(participantState, getTrackReceiver, options);
  }

  RemoteParticipantSignaling.call(this, participantState.sid, participantState.identity);

  options = Object.assign({
    RemoteTrackV2: RemoteTrackV2
  }, options);

  Object.defineProperties(this, {
    _revision: {
      writable: true,
      value: null
    },
    _RemoteTrackV2: {
      value: options.RemoteTrackV2
    },
    _getTrackReceiver: {
      value: getTrackReceiver
    },
    revision: {
      enumerable: true,
      get: function() {
        return this._revision;
      }
    }
  });

  return this.update(participantState);
}

inherits(RemoteParticipantV2, RemoteParticipantSignaling);

RemoteParticipantV2.prototype._getOrCreateTrack = function _getOrCreateTrack(trackState) {
  var RemoteTrackV2 = this._RemoteTrackV2;
  var track = this.tracks.get(trackState.id);
  if (!track) {
    track = new RemoteTrackV2(trackState);
    this.addTrack(track);
  }
  return track;
};

/**
 * Update the {@link RemoteParticipantV2} with the new state.
 * @param {object} participantState
 * @returns {this}
 */
RemoteParticipantV2.prototype.update = function update(participantState) {
  if (this.revision !== null && participantState.revision <= this.revision) {
    return this;
  }
  this._revision = participantState.revision;

  var tracksToKeep = new Set();

  participantState.tracks.forEach(function(trackState) {
    var track = this._getOrCreateTrack(trackState);
    track.update(trackState);
    tracksToKeep.add(track);
  }, this);

  this.tracks.forEach(function(track) {
    if (!tracksToKeep.has(track)) {
      this.removeTrack(track);
    }
  }, this);

  if (participantState.state === 'disconnected' && this.state === 'connected') {
    this.preempt('disconnected');
  }

  return this;
};

/**
 * Add the {@link RemoteTrackV2} to the {@link RemoteParticipantV2}.
 * @param {RemoteTrackV2} track
 * @returns {this}
 */
RemoteParticipantV2.prototype.addTrack = function addTrack(track) {
  RemoteParticipantSignaling.prototype.addTrack.call(this, track);
  this._getTrackReceiver(track.id).then(track.setTrackTransceiver.bind(track));
  return this;
};

module.exports = RemoteParticipantV2;

},{"../remoteparticipant":43,"./remotetrack":56,"util":146}],56:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RemoteTrackSignaling = require('../remotetrack');

/**
 * Construct a {@link RemoteTrackV2}.
 * @class
 * @extends RemoteTrackSignaling
 * @param {RemoteTrackV2#Representation} track
 */
function RemoteTrackV2(track) {
  if (!(this instanceof RemoteTrackV2)) {
    return new RemoteTrackV2(track);
  }
  RemoteTrackSignaling.call(this,
    track.sid,
    track.name,
    track.id,
    track.kind,
    track.enabled);
}

inherits(RemoteTrackV2, RemoteTrackSignaling);

/**
 * Compare the {@link RemoteTrackV2} to a {@link RemoteTrackV2#Representation} of itself
 * and perform any updates necessary.
 * @param {RemoteTrackV2#Representation} track
 * @returns {this}
 * @fires TrackSignaling#updated
 */
RemoteTrackV2.prototype.update = function update(track) {
  this.enable(track.enabled);
  return this;
};

/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackV2}
 * @typedef {LocalTrackPublicationV2#Representation} RemoteTrackV2#Representation
 * @property (boolean} subscribed
 */

module.exports = RemoteTrackV2;

},{"../remotetrack":44,"util":146}],57:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RecordingV2 = require('./recording');
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var util = require('../../util');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

var STATS_PUBLISH_INTERVAL_MS = 1000;

function RoomV2(localParticipant, initialState, transport, peerConnectionManager, options) {
  if (!(this instanceof RoomV2)) {
    return new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options);
  }
  options = Object.assign({
    RecordingSignaling: RecordingV2,
    RemoteParticipantV2: RemoteParticipantV2,
    statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
  }, options);

  RoomSignaling.call(this, localParticipant, initialState.sid, initialState.name, options);

  Object.defineProperties(this, {
    _disconnectedParticipantSids: {
      value: new Set()
    },
    _peerConnectionManager: {
      value: peerConnectionManager
    },
    _published: {
      value: new Map()
    },
    _publishedRevision: {
      value: 0,
      writable: true
    },
    _RemoteParticipantV2: {
      value: options.RemoteParticipantV2
    },
    _subscribed: {
      value: new Map()
    },
    _subscribedRevision: {
      value: 0,
      writable: true
    },
    _subscriptionFailures: {
      value: new Map()
    },
    _transport: {
      value: transport
    },
    _trackReceiverDeferreds: {
      value: new Map()
    }
  });

  handleLocalParticipantEvents(this, localParticipant);
  handlePeerConnectionEvents(this, peerConnectionManager);
  handleTransportEvents(this, transport);
  periodicallyPublishStats(this, localParticipant, transport, options.statsPublishIntervalMs);

  this._update(initialState);
}

inherits(RoomV2, RoomSignaling);

RoomV2.prototype._deleteTrackReceiverDeferred = function _deleteTrackReceiverDeferred(id) {
  return this._trackReceiverDeferreds.delete(id);
};

RoomV2.prototype._getOrCreateTrackReceiverDeferred = function _getOrCreateTrackReceiverDeferred(id) {
  var deferred = this._trackReceiverDeferreds.get(id) || util.defer();
  var trackReceivers = this._peerConnectionManager.getTrackReceivers();

  // NOTE(mmalavalli): In Firefox, there can be instances where a MediaStreamTrack
  // for the given Track ID already exists, for example, when a Track is removed
  // and added back. If that is the case, then we should resolve 'deferred'.
  var trackReceiver = trackReceivers.find(function(trackReceiver) {
    return trackReceiver.id === id && trackReceiver.readyState !== 'ended';
  });

  if (trackReceiver) {
    deferred.resolve(trackReceiver);
  } else {
    // NOTE(mmalavalli): Only add the 'deferred' to the map if it's not
    // resolved. This will prevent old copies of the MediaStreamTrack from
    // being used when the remote peer removes and re-adds a MediaStreamTrack.
    this._trackReceiverDeferreds.set(id, deferred);
  }

  return deferred;
};

RoomV2.prototype._addTrackReceiver = function _addTrackReceiver(trackReceiver) {
  var deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver.id);
  deferred.resolve(trackReceiver);
  return this;
};

RoomV2.prototype._disconnect = function _disconnect(error) {
  var didDisconnect = RoomSignaling.prototype._disconnect.call(this, error);
  if (didDisconnect) {
    this._transport.disconnect();
    this._peerConnectionManager.close();
  }

  this.localParticipant.tracks.forEach(function(track) {
    track.publishFailed(error || new Error('LocalParticipant disconnected'));
  });

  return didDisconnect;
};

RoomV2.prototype._getTrackReceiver = function _getTrackReceiver(id) {
  var self = this;
  return this._getOrCreateTrackReceiverDeferred(id).promise.then(function(trackReceiver) {
    self._deleteTrackReceiverDeferred(id);
    return trackReceiver;
  });
};

RoomV2.prototype._getOrCreateRemoteParticipant = function _getOrCreateRemoteParticipant(participantState) {
  var RemoteParticipantV2 = this._RemoteParticipantV2;
  var participant = this.participants.get(participantState.sid);
  var self = this;
  if (!participant) {
    participant = new RemoteParticipantV2(participantState, this._getTrackReceiver.bind(this));
    participant.on('stateChanged', function stateChanged(state) {
      if (state === 'disconnected') {
        participant.removeListener('stateChanged', stateChanged);
        self.participants.delete(participant.sid);
        self._disconnectedParticipantSids.add(participant.sid);
      }
    });
    this.connectParticipant(participant);
  }
  return participant;
};

RoomV2.prototype._getState = function _getState() {
  return {
    participant: this.localParticipant.getState()
  };
};

RoomV2.prototype._publishNewLocalParticipantState = function _publishNewLocalParticipantState() {
  this.localParticipant.incrementRevision();
  this._transport.publish(this._getState());
};

RoomV2.prototype._publishPeerConnectionState = function _publishPeerConnectionState(peerConnectionState) {
  /* eslint camelcase:0 */
  this._transport.publish(Object.assign({
    peer_connections: [peerConnectionState]
  }, this._getState()));
};

RoomV2.prototype._update = function _update(roomState) {
  var participantsToKeep = new Set();

  if (roomState.subscribed && roomState.subscribed.revision > this._subscribedRevision) {
    this._subscribedRevision = roomState.subscribed.revision;
    roomState.subscribed.tracks.forEach(function(trackState) {
      if (trackState.id) {
        this._subscriptionFailures.delete(trackState.sid);
        this._subscribed.set(trackState.id, trackState.sid);
      } else if (trackState.error && !this._subscriptionFailures.has(trackState.sid)) {
        this._subscriptionFailures.set(trackState.sid, trackState.error);
      }
    }, this);
  }

  // TODO(mroberts): Remove me once the Server is fixed.
  (roomState.participants || []).forEach(function(participantState) {
    if (participantState.sid === this.localParticipant.sid ||
        this._disconnectedParticipantSids.has(participantState.sid)) {
      return;
    }
    var participant = this._getOrCreateRemoteParticipant(participantState);
    participant.update(participantState);
    participantsToKeep.add(participant);
  }, this);

  handleSubscriptionFailures(this);

  // TODO(mroberts): Remove me once the Server is fixed.
  /* eslint camelcase:0 */
  if (roomState.peer_connections) {
    this._peerConnectionManager.update(roomState.peer_connections);
  }

  if (roomState.recording) {
    this.recording.update(roomState.recording);
  }

  if (roomState.published && roomState.published.revision > this._publishedRevision) {
    this._publishedRevision = roomState.published.revision;
    roomState.published.tracks.forEach(function(track) {
      if (track.sid) {
        this._published.set(track.id, track.sid);
      }
    }, this);
    this.localParticipant.update(roomState.published);
  }

  if (roomState.participant) {
    this.localParticipant.connect(
      roomState.participant.sid,
      roomState.participant.identity);
  }

  return this;
};

/**
 * Get the {@link RoomV2}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
RoomV2.prototype.getStats = function getStats() {
  var self = this;

  function filterLocalTrackStats(trackStats) {
    return self._published.has(trackStats.trackId);
  }

  function filterRemoteTrackStats(trackStats) {
    return self._subscribed.has(trackStats.trackId);
  }

  return this._peerConnectionManager.getStats().then(function(reports) {
    return reports.map(function(report) {
      return Object.assign({}, report, {
        localAudioTrackStats: report.localAudioTrackStats.filter(filterLocalTrackStats),
        localVideoTrackStats: report.localVideoTrackStats.filter(filterLocalTrackStats),
        remoteAudioTrackStats: report.remoteAudioTrackStats.filter(filterRemoteTrackStats),
        remoteVideoTrackStats: report.remoteVideoTrackStats.filter(filterRemoteTrackStats),
      });
    });
  });
};

/**
 * @typedef {object} RoomV2#Representation
 * @property {string} name
 * @property {LocalParticipantV2#Representation} participant
 * @property {?Array<ParticipantV2#Representation>} participants
 * @property {?Array<PeerConnectionV2#Representation>} peer_connections
 * @property {?RecordingV2#Representation} recording
 * @property {string} sid
 */

function handleLocalParticipantEvents(roomV2, localParticipant) {
  var removeListeners = new Map();
  var peerConnectionManager = roomV2._peerConnectionManager;

  var updateLocalParticipantStateAndRenegotiate = util.oncePerTick(function() {
    roomV2._publishNewLocalParticipantState();
    renegotiate();
  });

  function renegotiate() {
    var trackSenders = util.flatMap(localParticipant.tracks, function(trackV2) {
      return trackV2.trackTransceiver;
    });
    peerConnectionManager.setTrackSenders(trackSenders);
  }

  function addListener(track) {
    var trackSid = track.sid;

    function updated() {
      // NOTE(mmalavalli): The LocalParticipantV2's state is only published if
      // the "updated" event is emitted due to LocalTrackPublicationV2's
      // .isEnabled being toggled. We do not publish if it is fired due to the
      // LocalTrackPublicationV2's .sid being set.
      if (trackSid === track.sid) {
        roomV2._publishNewLocalParticipantState();
      } else {
        trackSid = track.sid;
      }
    }

    track.on('updated', updated);

    removeListener(track);
    removeListeners.set(track, track.removeListener.bind(track, 'updated', updated));
  }

  function removeListener(track) {
    var removeListener = removeListeners.get(track);
    if (removeListener) {
      removeListener();
    }
  }

  function trackAdded(track) {
    addListener(track);
    updateLocalParticipantStateAndRenegotiate();
  }

  function trackRemoved(track) {
    removeListener(track);
    updateLocalParticipantStateAndRenegotiate();
  }

  localParticipant.on('trackAdded', trackAdded);
  localParticipant.on('trackRemoved', trackRemoved);

  localParticipant.tracks.forEach(addListener);

  roomV2.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      localParticipant.removeListener('trackAdded', trackAdded);
      localParticipant.removeListener('trackRemoved', trackRemoved);
      roomV2.removeListener('stateChanged', stateChanged);
      localParticipant.disconnect();
    }
  });
}

function handlePeerConnectionEvents(roomV2, peerConnectionManager) {
  peerConnectionManager.on('description', function onDescription(description) {
    roomV2._publishPeerConnectionState(description);
  });
  peerConnectionManager.dequeue('description');

  peerConnectionManager.on('candidates', function onCandidates(candidates) {
    roomV2._publishPeerConnectionState(candidates);
  });
  peerConnectionManager.dequeue('candidates');

  peerConnectionManager.on('trackAdded', roomV2._addTrackReceiver.bind(roomV2));
  peerConnectionManager.dequeue('trackAdded');
  peerConnectionManager.getTrackReceivers().forEach(roomV2._addTrackReceiver, roomV2);
}

function handleTransportEvents(roomV2, transport) {
  transport.on('message', roomV2._update.bind(roomV2));
  transport.on('stateChanged', function stateChanged(state, error) {
    if (state === 'disconnected') {
      if (roomV2.state === 'connected') {
        roomV2._disconnect(error);
      }
      transport.removeListener('stateChanged', stateChanged);
    }
  });
}

/**
 * Periodically publish {@link StatsReport}s.
 * @private
 * @param {RoomV2} roomV2
 * @param {LocalParticipantV2} localParticipant
 * @param {Transport} transport
 * @param {Number} intervalMs
 */
function periodicallyPublishStats(roomV2, localParticipant, transport, intervalMs) {
  var interval = setInterval(function() {
    roomV2.getStats().then(function(stats) {
      stats.forEach(function(report) {
        transport.publishEvent('quality', 'stats-report', {
          audioTrackStats: report.remoteAudioTrackStats,
          localAudioTrackStats: report.localAudioTrackStats,
          localVideoTrackStats: report.localVideoTrackStats,
          participantSid: localParticipant.sid,
          peerConnectionId: report.peerConnectionId,
          roomSid: roomV2.sid,
          videoTrackStats: report.remoteVideoTrackStats
        });
      });
    }, function() {
      // Do nothing.
    });
  }, intervalMs);

  roomV2.on('stateChanged', function onStateChanged(state) {
    if (state === 'disconnected') {
      clearInterval(interval);
      roomV2.removeListener('stateChanged', onStateChanged);
    }
  });
}

function handleSubscriptionFailures(room) {
  var remoteTracks = new Map(util.flatMap(room.participants, function(participant) {
    return Array.from(participant.tracks.values()).map(function(track) {
      return [track.sid, track];
    });
  }));

  room._subscriptionFailures.forEach(function(error, trackSid) {
    var remoteTrack = remoteTracks.get(trackSid);
    if (remoteTrack) {
      room._subscriptionFailures.delete(trackSid);
      remoteTrack.subscribeFailed(createTwilioError(error.code, error.message));
    }
  });
}
module.exports = RoomV2;

},{"../../util":74,"../../util/twilio-video-errors":86,"../room":45,"./recording":54,"./remoteparticipant":55,"util":146}],58:[function(require,module,exports){
'use strict';

var SIP = require('../../sip');

function SIPJSMediaHandler(peerConnectionManager, createMessage) {
  if (!(this instanceof SIPJSMediaHandler)) {
    return new SIPJSMediaHandler(peerConnectionManager);
  }
  Object.defineProperties(this, {
    createMessage: {
      enumerable: true,
      value: createMessage
    },
    peerConnectionManager: {
      enumerable: true,
      value: peerConnectionManager
    }
  });
}

SIPJSMediaHandler.defaultFactory = function defaultFactory() {
  // NOTE(mroberts): We don't use SIP.js's defaultFactory functionality.
};

SIPJSMediaHandler.defaultFactory.isSupported = function isSupported() {
  return SIP.WebRTC.isSupported();
};

SIPJSMediaHandler.prototype.close = function close() {
  this.peerConnectionManager.close();
};

SIPJSMediaHandler.prototype.getDescription = function getDescription() {
  var connectMessage = Object.assign({
    /* eslint camelcase:0 */
    peer_connections: this.peerConnectionManager.getStates()
  }, this.createMessage());
  return Promise.resolve({
    body: JSON.stringify(connectMessage),
    contentType: 'application/room-signaling+json'
  });
};

SIPJSMediaHandler.prototype.hasDescription = function hasDescription() {
  return true;
};

SIPJSMediaHandler.prototype.hold = function hold() {
  // NOTE(mroberts): We don't use SIP.js's hold functionality.
};

SIPJSMediaHandler.prototype.isReady = function isReady() {
  // NOTE(mroberts): We don't use SIP.js's isReady functionality.
  return true;
};

SIPJSMediaHandler.prototype.isMuted = function isMuted() {
  // NOTE(mroberts): We don't use SIP.js's isMuted functionality.
  return {
    audio: false,
    video: false
  };
};

SIPJSMediaHandler.prototype.mute = function mute() {
  // NOTE(mroberts): We don't use SIP.js's mute functionality.
};

SIPJSMediaHandler.prototype.render = function render() {
  // NOTE(mroberts): We don't use SIP.js's render functionality.
};

SIPJSMediaHandler.prototype.setDescription = function setDescription(message) {
  var roomState = getRoomState(message);
  if (roomState) {
    var peerConnectionStates = roomState.peer_connections;
    if (peerConnectionStates) {
      return this.peerConnectionManager.update(peerConnectionStates);
    }
  }
  return Promise.resolve();
};

SIPJSMediaHandler.prototype.unhold = function unhold() {
  // NOTE(mroberts): We don't use SIP.js's unhold functionality.
};

SIPJSMediaHandler.prototype.unmute = function unmute() {
  // NOTE(mroberts): We don't use SIP.js's unmute functionality.
};

SIPJSMediaHandler.prototype.updateIceServers = function updateIceServers() {
  // NOTE(mroberts): We don't use SIP.js's ICE server functionality.
};

function getRoomState(message) {
  try {
    return JSON.parse(message.body);
  } catch (error) {
    return null;
  }
}

module.exports = SIPJSMediaHandler;

},{"../../sip":60}],59:[function(require,module,exports){
'use strict';

var constants = require('../../util/constants');
var inherits = require('util').inherits;
var packageInfo = require('../../../package.json');
var InsightsPublisher = require('../../util/insightspublisher');
var NullInsightsPublisher = require('../../util/insightspublisher/null');
var SIP = require('../../sip');
var DefaultSIPJSMediaHandler = require('./sipjsmediahandler');
var StateMachine = require('../../statemachine');
var util = require('../../util');
var TwilioErrors = require('../../util/twilio-video-errors');
var createTwilioError = TwilioErrors.createTwilioError;
var SignalingConnectionError = TwilioErrors.SignalingConnectionError;
var SignalingConnectionTimeoutError = TwilioErrors.SignalingConnectionTimeoutError;
var SignalingIncomingMessageInvalidError = TwilioErrors.SignalingIncomingMessageInvalidError;

var SDK_NAME = packageInfo.name + '.js';
var SDK_VERSION = packageInfo.version;
var VERSION = 1;

/*
Transport States
----------------

                      +-----------+
                      |           |
                      |  syncing  |---------+
                      |           |         |
                      +-----------+         |
                         ^     |            |
                         |     |            |
                         |     v            v
    +------------+    +-----------+    +--------------+
    |            |    |           |    |              |
    | connecting |--->| connected |--->| disconnected |
    |            |    |           |    |              |
    +------------+    +-----------+    +--------------+
             |                              ^
             |                              |
             |                              |
             +------------------------------+

*/

var states = {
  connecting: [
    'connected',
    'disconnected'
  ],
  connected: [
    'disconnected',
    'syncing'
  ],
  syncing: [
    'connected',
    'disconnected'
  ],
  disconnected: []
};

/**
 * Construct a {@link Transport}.
 * @extends StateMachine
 * @class
 * @classdesc A {@link Transport} supports sending and receiving Room Signaling
 * Protocol (RSP) messages. It also supports RSP requests, such as Sync and
 * Disconnect.
 * @param {?string} name
 * @param {string} accessToken
 * @param {ParticipantSignaling} localParticipant
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {object} ua
 * @param {object} [options]
 * @emits Transport#connected
 * @emits Transport#message
 */
function Transport(name, accessToken, localParticipant, peerConnectionManager, ua, options) {
  if (!(this instanceof Transport)) {
    return new Transport(name, accessToken, localParticipant, peerConnectionManager, ua, options);
  }
  options = Object.assign({
    InsightsPublisher: InsightsPublisher,
    NullInsightsPublisher: NullInsightsPublisher,
    SIPJSMediaHandler: DefaultSIPJSMediaHandler
  }, options);
  StateMachine.call(this, 'connecting', states);

  var eventPublisherOptions = {};
  if (options.wsServerInsights) {
    eventPublisherOptions.gateway = options.wsServerInsights;
  }

  var session = createSession(this, name, accessToken, localParticipant, peerConnectionManager, ua, options.SIPJSMediaHandler);
  var EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;
  Object.defineProperties(this, {
    _eventPublisher: {
      value: new EventPublisher(
        accessToken,
        SDK_NAME,
        SDK_VERSION,
        options.environment,
        options.realm,
        eventPublisherOptions)
    },
    _session: {
      value: session
    },
    _updatesReceived: {
      value: []
    },
    _updatesToSend: {
      value: []
    }
  });
  setupEventListeners(this, session, ua);
}

inherits(Transport, StateMachine);

/**
 * Disconnect the {@link Transport}. Returns true if calling the method resulted
 * in disconnection.
 * @param {TwilioError} [error]
 * @returns {boolean}
 */
Transport.prototype.disconnect = function disconnect(error) {
  if (this.state !== 'disconnected') {
    this.preempt('disconnected', null, [error]);
    this._session.terminate({
      body: JSON.stringify({
        type: 'disconnect',
        version: VERSION
      }),
      extraHeaders: [
        'Content-Type: application/room-signaling+json'
      ]
    });
    this._eventPublisher.disconnect();
    return true;
  }
  return false;
};

/**
 * Publish an RSP Update. Returns true if calling the method resulted in
 * publishing (or eventually publishing) the update.
 * @param {object} update
 * @returns {boolean}
 */
Transport.prototype.publish = function publish(update) {
  update = Object.assign({
    type: 'update',
    version: VERSION
  }, update);
  switch (this.state) {
    case 'connected':
      publishWithRetries(this, this._session, update);
      return true;
    case 'connecting':
    case 'syncing':
      this._updatesToSend.push(update);
      return true;
    case 'disconnected':
    default:
      return false;
  }
};

/**
 * Publish (or queue) an event to the Insights gateway.
 * @method
 * @param {string} groupName - Event group name
 * @param {string} eventName - Event name
 * @param {object} payload - Event payload
 * @returns {boolean} true if queued or published, false if disconnected from the Insights gateway
 */
Transport.prototype.publishEvent = function publishEvent(groupName, eventName, payload) {
  return this._eventPublisher.publish(groupName, eventName, payload);
};

/**
 * Sync the {@link Transport}. Returns true if calling the method resulted in
 * syncing.
 * @returns {boolean}
 */
Transport.prototype.sync = function sync() {
  if (this.state === 'connected') {
    this.preempt('syncing');
    this._session.sendReinvite();
    return true;
  }
  return false;
};

/**
 * @event Transport#connected
 * @param {object} initialState
 */

/**
 * @event Transport#message
 * @param {object} state
 */

function createSession(transport, name, accessToken, localParticipant, peerConnectionManager, ua, SIPJSMediaHandler) {
  var target = 'sip:' + util.makeServerSIPURI();
  return ua.invite(target, {
    extraHeaders: [
      constants.headers.X_TWILIO_ACCESSTOKEN + ': ' + accessToken,
      'Session-Expires: 120'
    ],
    media: { stream: {} },
    mediaHandlerFactory: function mediaHandlerFactory() {
      return new SIPJSMediaHandler(peerConnectionManager, function createMessage() {
        if (transport.state === 'disconnected') {
          return {
            type: 'disconnect',
            version: VERSION
          };
        }
        var type = {
          connecting: 'connect',
          syncing: 'sync'
        }[transport.state] || 'update';

        var message = {
          name: name,
          participant: localParticipant.getState(),
          type: type,
          version: VERSION
        };

        var sdpFormat = util.getSdpFormat();
        if (type === 'connect' && sdpFormat) {
          message.format = sdpFormat;
        }

        return message;
      });
    },
    onInfo: function onInfo(request) {
      this.emit('info', request);
      request.reply(200);
    }
  });
}

/**
 * Add random jitter to a given value in the range [-jitter, jitter].
 * @private
 * @param {number} value
 * @param {number} jitter
 * @returns {number} value + random(-jitter, +jitter)
 */
function withJitter(value, jitter) {
  var rand = Math.random();
  return value - jitter + Math.floor(2 * jitter * rand + 0.5);
}

function publishWithRetries(transport, session, payload, attempts) {
  attempts = attempts || 0;
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publishWithRetries(transport, session, payload, ++attempts));
          } else {
            reject(new Error('Transport failed to send a message even '
              + 'after ' + constants.PUBLISH_MAX_ATTEMPTS + ' attempts'));
          }
          break;
        default:
          reject(response);
      }
    }
    function sendRequest() {
      if (transport.state === 'disconnected') {
        return;
      }
      session.sendRequest('INFO', {
        body: JSON.stringify(payload),
        extraHeaders: [
          'Content-Type: application/room-signaling+json',
          'Event: room-signaling',
          'Info-Package: room-signaling'
        ],
        receiveResponse: receiveResponse
      });
    }
    if (attempts === 0) {
      sendRequest();
      return;
    }

    var backOffMs = (1 << (attempts - 1)) * constants.PUBLISH_BACKOFF_MS;
    setTimeout(sendRequest, withJitter(backOffMs, constants.PUBLISH_BACKOFF_JITTER));
  });
}

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce(function(peerConnectionsById, update) {
    var reduced = peerConnectionsById.get(update.id) || update;

    // First, reduce the top-level `description` property.
    if (!reduced.description && update.description) {
      reduced.description = update.description;
    } else if (reduced.description && update.description) {
      if (update.description.revision > reduced.description.revision) {
        reduced.description = update.description;
      }
    }

    // Then, reduce the top-level `ice` property.
    if (!reduced.ice && update.ice) {
      reduced.ice = update.ice;
    } else if (reduced.ice && update.ice) {
      if (update.ice.revision > reduced.ice.revision) {
        reduced.ice = update.ice;
      }
    }

    // Finally, update the map.
    peerConnectionsById.set(reduced.id, reduced);

    return peerConnectionsById;
  }, new Map()).values());
}

function reduceUpdates(updates) {
  return updates.reduce(function(reduced, update) {
    // First, reduce the top-level `participant` property.
    if (!reduced.participant && update.participant) {
      reduced.participant = update.participant;
    } else if (reduced.participant && update.participant) {
      if (update.participant.revision > reduced.participant.revision) {
        reduced.participant = update.participant;
      }
    }

    // Then, reduce the top-level `peer_connections` property.
    /* eslint camelcase:0 */
    if (!reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(update.peer_connections);
    } else if (reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(
        reduced.peer_connections.concat(update.peer_connections));
    }

    return reduced;
  }, {
    type: 'update',
    version: VERSION
  });
}

/**
 * Parse the body of a SIP incoming request or response.
 * @param {object} requestOrResponse
 * @returns {?object}
 * @throws {SignalingIncomingMessageInvalidError}
 */
function parseRequestOrResponseBody(requestOrResponse) {
  if (requestOrResponse.body) {
    try {
      return JSON.parse(requestOrResponse.body);
    } catch (e) {
      throw new SignalingIncomingMessageInvalidError();
    }
  }
  return null;
}

/**
 * Get a {@link TwilioError} for a SIP incoming request or response from its body.
 * @param {object} requestOrResponse
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponseBody(requestOrResponse) {
  try {
    var message = parseRequestOrResponseBody(requestOrResponse);
    return message && message.type === 'error'
      ? createTwilioError(message.code, message.message)
      : null;
  } catch (error) {
    return error;
  }
}

/**
 * Get a {@link TwilioError} for a SIP incoming request or response from its headers.
 * @param {object} requestOrResponse
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse) {
  var headers = requestOrResponse.headers;
  if (headers && headers['X-Twilio-Error']) {
    var twilioErrorHeader = headers['X-Twilio-Error'][0].raw.split(' ');
    var code = parseInt(twilioErrorHeader[0], 10);
    var message = twilioErrorHeader.slice(1).join(' ');
    return createTwilioError(code, message);
  }
  return null;
}

/**
 * Create a {@link TwilioError} from a SIP request or response.
 * @param {object} requestOrResponse - SIP request or response
 * @returns {?TwilioError}
 */
function getTwilioErrorFromRequestOrResponse(requestOrResponse) {
  return getTwilioErrorFromRequestOrResponseHeaders(requestOrResponse)
    || getTwilioErrorFromRequestOrResponseBody(requestOrResponse);
}

function setupEventListeners(transport, session, ua) {
  function disconnect(requestOrResponse, cause) {
    var twilioError;

    if (requestOrResponse && !(requestOrResponse instanceof SIP.OutgoingRequest)) {
      twilioError = getTwilioErrorFromRequestOrResponse(requestOrResponse);
    }
    if (!twilioError) {
      switch (cause) {
        case SIP.C.causes.REQUEST_TIMEOUT:
          twilioError = new SignalingConnectionTimeoutError();
          break;
        case SIP.C.causes.CONNECTION_ERROR:
          twilioError = new SignalingConnectionError();
          break;
      }
    }

    transport.disconnect(twilioError);
  }

  function handleRequestOrResponse(requestOrResponse) {
    // We don't need to handle requests we sent ourselves.
    if (requestOrResponse instanceof SIP.OutgoingRequest) {
      return;
    }

    // Handle any errors first.
    var error;
    try {
      error = getTwilioErrorFromRequestOrResponse(requestOrResponse);
    } catch (e) {
      if (e instanceof SignalingIncomingMessageInvalidError) {
        return;
      }
      error = e;
    }

    // If we get an error other than a SignalingIncomingMessageInvalidError,
    // then disconnect.
    if (error) {
      transport.disconnect(error);
      return;
    }

    // Otherwise, try to parse the RSP message.
    var message;
    try {
      message = parseRequestOrResponseBody(requestOrResponse);
    } catch (e) {
      // Do nothing.
    }

    // If there's no RSP message to handle, just return.
    if (!message) {
      return;
    }

    switch (transport.state) {
      case 'connected':
        switch (message.type) {
          case 'connected':
          case 'synced':
          case 'update':
            transport.emit('message', message);
            return;
          case 'disconnected':
            transport.preempt('disconnected');
            return;
          default:
            // Do nothing.
            return;
        }
      case 'connecting':
        switch (message.type) {
          case 'connected':
            transport.emit('connected', message);
            transport.preempt('connected');
            return;
          case 'synced':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'disconnected':
            transport.preempt('disconnected');
            return;
          default:
            // Do nothing.
            return;
        }
      case 'disconnected':
        // Do nothing.
        return;
      case 'syncing':
        switch (message.type) {
          case 'connected':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'synced':
            transport.emit('message', message);
            transport.preempt('connected');
            return;
          case 'disconnected':
            transport.preempt('disconnected');
            return;
          default:
            // Do nothing.
            return;
        }
      default:
        // Impossible
        return;
    }
  }

  session.on('info', handleRequestOrResponse);
  session.once('bye', disconnect);

  session.once('accepted', handleRequestOrResponse);
  session.once('failed', disconnect);

  transport.on('stateChanged', function stateChanged(state) {
    switch (state) {
      case 'connected':
        session.removeListener('accepted', handleRequestOrResponse);
        session.removeListener('failed', disconnect);

        var updates = transport._updatesToSend.splice(0);
        if (updates.length) {
          transport.publish(reduceUpdates(updates));
        }

        transport._updatesReceived.splice(0).forEach(transport.emit.bind(transport, 'message'));

        return;
      case 'disconnected':
        session.removeListener('accepted', handleRequestOrResponse);
        session.removeListener('failed', disconnect);
        session.removeListener('info', handleRequestOrResponse);
        session.removeListener('bye', disconnect);
        transport.removeListener('stateChanged', stateChanged);
        ua.stop();
        return;
      case 'syncing':
        // Do nothing.
        return;
      default:
        // Impossible
        return;
    }
  });

  ua.once('disconnected', disconnect);
}

module.exports = Transport;

},{"../../../package.json":147,"../../sip":60,"../../statemachine":61,"../../util":74,"../../util/constants":72,"../../util/insightspublisher":75,"../../util/insightspublisher/null":76,"../../util/twilio-video-errors":86,"./sipjsmediahandler":58,"util":146}],60:[function(require,module,exports){
(function (global){
'use strict';

var toplevel = global.window || global;
var Transport = require('@twilio/sip.js/src/Transport');
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
var addEventListener = toplevel.addEventListener ? toplevel.addEventListener.bind(toplevel) : null;

module.exports = require('@twilio/sip.js/src/SIP')({
  addEventListener: addEventListener,
  console: toplevel.console,
  Promise: toplevel.Promise,
  WebSocket: WebSocket,
  timers: toplevel,
  Transport: Transport
});

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"@twilio/sip.js/src/SIP":107,"@twilio/sip.js/src/Transport":116,"ws":148}],61:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./util');

/**
 * Construct a {@link StateMachine}.
 * @class
 * @classdesc {@link StateMachine} represents a state machine. The state
 * machine supports a reentrant locking mechanism to allow asynchronous state
 * transitions to ensure they have not been preempted. Calls to
 * {@link StateMachine#takeLock} are guaranteed to be resolved in FIFO order.
 * @extends {EventEmitter}
 * @param {string} initialState - the intiial state
 * @param {object} states
 * @property {boolean} isLocked - whether or not the {@link StateMachine} is
 * locked performing asynchronous state transition
 * @property {string} state - the current state
 * @emits {@link StateMachine#stateChanged}
 */
function StateMachine(initialState, states) {
  EventEmitter.call(this);
  var lock = null;
  var state = initialState;
  states = transformStates(states);
  Object.defineProperties(this, {
    _lock: {
      get: function() {
        return lock;
      },
      set: function(_lock) {
        lock = _lock;
      }
    },
    _reachableStates: {
      value: reachable(states)
    },
    _state: {
      get: function() {
        return state;
      },
      set: function(_state) {
        state = _state;
      }
    },
    _states: {
      value: states
    },
    _whenDeferreds: {
      value: new Set()
    },
    isLocked: {
      enumerable: true,
      get: function() {
        return lock !== null;
      }
    },
    state: {
      enumerable: true,
      get: function() {
        return state;
      }
    }
  });

  var self = this;

  this.on('stateChanged', function(state) {
    self._whenDeferreds.forEach(function(deferred) {
      deferred.when(state, deferred.resolve, deferred.reject);
    });
  });
}

inherits(StateMachine, EventEmitter);

/**
 * Returns a promise whose executor function is called on each state change.
 * @param {function(state: string, resolve: function, reject: function): void} when
 * @returns {Promise.<*>}
 * @private
 */
StateMachine.prototype._whenPromise = function _whenPromise(when) {
  if (typeof when !== 'function') {
    return Promise.reject(new Error('when() executor must be a function'));
  }

  var deferred = util.defer();
  var self = this;

  deferred.when = when;
  this._whenDeferreds.add(deferred);

  return deferred.promise.then(function(payload) {
    self._whenDeferreds.delete(deferred);
    return payload;
  }, function(error) {
    self._whenDeferreds.delete(deferred);
    throw error;
  });
};

/**
 * This method takes a lock and passes the {@link StateMachine#Key} to your
 * transition function. You may perform zero or more state transitions in your
 * transition function, but you should check for preemption in each tick. You
 * may also reenter the lock. Once the Promise returned by your transition
 * function resolves or rejects, this method releases the lock it acquired for
 * you.
 * @param {string} name - a name for the lock
 * @param {function(StateMachine#Key): Promise} transitionFunction
 * @returns {Promise}
 */
// NOTE(mroberts): This method is named after a Haskell function:
// https://hackage.haskell.org/package/base-4.8.2.0/docs/Control-Exception.html#v:bracket
StateMachine.prototype.bracket = function bracket(name, transitionFunction) {
  var key;
  var self = this;

  function releaseLock(error) {
    if (self.hasLock(key)) {
      self.releaseLockCompletely(key);
    }
    if (error) {
      throw error;
    }
  }

  return this.takeLock(name).then(function gotKey(_key) {
    key = _key;
    return transitionFunction(key);
  }).then(function success(result) {
    releaseLock();
    return result;
  }, releaseLock);
};

/**
 * Check whether or not a {@link StateMachine#Key} matches the lock.
 * @param {StateMachine#Key} key
 * @returns {boolean}
 */
StateMachine.prototype.hasLock = function hasLock(key) {
  return this._lock === key;
};

/**
 * Preempt any pending state transitions and immediately transition to the new
 * state. If a lock name is specified, take the lock and return the
 * {@link StateMachine#Key}.
 * @param {string} newState
 * @param {?string} [name=null] - a name for the lock
 * @param {Array<*>} [payload=[]]
 * @returns {?StateMachine#Key}
 */
StateMachine.prototype.preempt = function preempt(newState, name, payload) {
  // 1. Check that the new state is valid.
  if (!isValidTransition(this._states, this.state, newState)) {
    throw new Error('Cannot transition from "' + this.state +
      '" to "' + newState + '"');
  }

  // 2. Release the old lock, if any.
  var oldLock;
  if (this.isLocked) {
    oldLock = this._lock;
    this._lock = null;
  }

  // 3. Take the lock, if requested.
  var key = null;
  if (name) {
    key = this.takeLockSync(name);
  }

  // 4. If a lock wasn't requested, take a "preemption" lock in order to
  // maintain FIFO order of those taking locks.
  var preemptionKey = key ? null : this.takeLockSync('preemption');

  // 5. Transition.
  this.transition(newState, key || preemptionKey, payload);

  // 6. Preempt anyone blocked on the old lock.
  if (oldLock) {
    oldLock.resolve();
  }

  // 7. Release the "preemption" lock, if we took it.
  if (preemptionKey) {
    this.releaseLock(preemptionKey);
  }

  return key;
};

/**
 * Release a lock. This method succeeds only if the {@link StateMachine} is
 * still locked and has not been preempted.
 * @param {StateMachine#Key} key
 * @throws Error
 */
StateMachine.prototype.releaseLock = function releaseLock(key) {
  if (!this.isLocked) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because the StateMachine is not locked');
  } else if (!this.hasLock(key)) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because ' + this._lock.name + ' has the lock');
  }
  if (key.depth === 0) {
    this._lock = null;
    key.resolve();
  } else {
    key.depth--;
  }
};

/**
 * Release a lock completely, even if it has been reentered. This method
 * succeeds only if the {@link StateMachine} is still locked and has not been
 * preempted.
 * @param {StateMachine#Key} key
 * @throws Error
 */
StateMachine.prototype.releaseLockCompletely = function releaseLockCompletely(
  key) {
  if (!this.isLocked) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because the StateMachine is not locked');
  } else if (!this.hasLock(key)) {
    throw new Error('Could not release the lock for ' + key.name +
      ' because ' + this._lock.name + ' has the lock');
  }
  key.depth = 0;
  this._lock = null;
  key.resolve();
};

/**
 * Take a lock, returning a Promise for the {@link StateMachine#Key}. You should
 * take a lock anytime you intend to perform asynchronous transitions. Calls to
 * this method are guaranteed to be resolved in FIFO order. You may reenter
 * a lock by passing its {@link StateMachine#Key}.
 * @param {string|StateMachine#Key} nameOrKey - a name for the lock or an
 * existing {@link StateMachine#Key}
 * @returns {Promise<object>}
 */
StateMachine.prototype.takeLock = function takeLock(nameOrKey) {
  // Reentrant lock
  if (typeof nameOrKey === 'object') {
    var key = nameOrKey;
    var self = this;
    return new Promise(function takeReentrantLock(resolve) {
      resolve(self.takeLockSync(key));
    });
  }

  // New lock
  var name = nameOrKey;
  if (this.isLocked) {
    var takeLock = this.takeLock.bind(this, name);
    return this._lock.promise.then(takeLock);
  }
  return Promise.resolve(this.takeLockSync(name));
};

/**
 * Take a lock, returning the {@Link StateMachine#Key}. This method throws if
 * the {@link StateMachine} is locked or the wrong {@link StateMachine#Key} is
 * provided. You may reenter a lock by passing its {@link StateMachine#Key}.
 * @param {string|StateMachine#Key} nameOrKey - a name for the lock or an
 * existing {@link StateMachine#Key}
 * @returns {object}
 * @throws Error
 */
StateMachine.prototype.takeLockSync = function takeLockSync(nameOrKey) {
  var key = typeof nameOrKey === 'string' ? null : nameOrKey;
  var name = key ? key.name : nameOrKey;

  if (key && !this.hasLock(key) || !key && this.isLocked) {
    throw new Error('Could not take the lock for ' + name + ' ' +
      'because the lock for ' + this._lock.name + ' was not released');
  }

  // Reentrant lock
  if (key) {
    key.depth++;
    return key;
  }

  // New lock
  var lock = makeLock(name);
  this._lock = lock;
  return lock;
};

/**
 * Transition to a new state. If the {@link StateMachine} is locked, you must
 * provide the {@link StateMachine#Key}. An invalid state or the wrong
 * {@link StateMachine#Key} will throw an error.
 * @param {string} newState
 * @param {?StateMachine#Key} [key=null]
 * @param {Array<*>} [payload=[]]
 * @throws {Error}
 */
StateMachine.prototype.transition = function transition(newState, key, payload) {
  payload = payload || [];

  // 1. If we're locked, required the key.
  if (this.isLocked) {
    if (!key) {
      throw new Error('You must provide the key in order to ' +
        'transition');
    } else if (!this.hasLock(key)) {
      throw new Error('Could not transition using the key for ' +
        key.name + ' because ' + this._lock.name + ' has the lock');
    }
  } else if (key) {
    throw new Error('Key provided for ' + key.name + ', but the ' +
      'StateMachine was not locked (possibly due to preemption)');
  }

  // 2. Check that the new state is valid.
  if (!isValidTransition(this._states, this.state, newState)) {
    throw new Error('Cannot transition from "' + this.state +
      '" to "' + newState + '"');
  }

  // 3. Update the state and emit an event.
  this._state = newState;
  this.emit.apply(this, ['stateChanged', newState].concat(payload));
};

/**
 * Attempt to transition to a new state. Unlike {@link StateMachine#transition},
 * this method does not throw.
 * @param {string} newState
 * @param {?StateMachine#Key} [key=null]
 * @param {Array<*>} [payload=[]]
 * @returns {boolean}
 */
StateMachine.prototype.tryTransition = function tryTransition(newState, key, payload) {
  try {
    this.transition(newState, key, payload);
  } catch (error) {
    return false;
  }
  return true;
};

/**
 * Return a Promise that resolves when the {@link StateMachine} transitions to
 * the specified state. If the {@link StateMachine} transitions such that the
 * requested state becomes unreachable, the Promise rejects.
 * @param {string} state
 * @returns {Promise<this>}
 */
StateMachine.prototype.when = function when(state) {
  var self = this;
  if (this.state === state) {
    return Promise.resolve(this);
  } else if (!isValidTransition(this._reachableStates, this.state, state)) {
    return Promise.reject(createUnreachableError(this.state, state));
  }
  return this._whenPromise(function when(newState, resolve, reject) {
    if (newState === state) {
      resolve(self);
    } else if (!isValidTransition(self._reachableStates, newState, state)) {
      reject(createUnreachableError(newState, state));
    }
  });
};

/**
 * @event StateMachine#stateChanged
 * @param {string} newState
 */

/**
 * Check if a transition is valid.
 * @private
 * @param {Map<*, Set<*>>} graph
 * @param {*} from
 * @param {*} to
 * @returns {boolean}
 */
function isValidTransition(graph, from, to) {
  return graph.get(from).has(to);
}

/**
 * @typedef {object} StateMachine#Key
 */

function makeLock(name) {
  var lock = util.defer();
  lock.name = name;
  lock.depth = 0;
  return lock;
}

/**
 * Compute the transitive closure of a graph (i.e. what nodes are reachable from
 * where).
 * @private
 * @param {Map<*, Set<*>>} graph
 * @returns {Map<*, Set<*>>}
 */
function reachable(graph) {
  return Array.from(graph.keys()).reduce(function(newGraph, from) {
    return newGraph.set(from, reachableFrom(graph, from));
  }, new Map());
}

/**
 * Compute the Set of node reachable from a particular node in the graph.
 * @private
 * @param {Map<*, Set<*>>} graph
 * @param {*} from
 * @param {Set<*>} [to]
 * @returns {Set<*>}
 */
function reachableFrom(graph, from, to) {
  to = to || new Set();
  graph.get(from).forEach(function(node) {
    if (!to.has(node)) {
      to.add(node);
      reachableFrom(graph, node, to).forEach(to.add, to);
    }
  });
  return to;
}

function transformStates(states) {
  var newStates = new Map();
  for (var key in states) {
    newStates.set(key, new Set(states[key]));
  }
  return newStates;
}

/**
 * Create an "unreachable state" Error.
 * @param {string} here
 * @param {string} there
 * @returns {Error}
 */
function createUnreachableError(here, there) {
  return new Error('"' + there + '" cannot be reached from "' + here + '"');
}

module.exports = StateMachine;

},{"./util":74,"events":142,"util":146}],62:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalAudioTrack}.
 * @extends LocalTrackStats
 * @property {?AudioLevel} audioLevel - Input {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 * @param {string} trackId - {@link LocalAudioTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function LocalAudioTrackStats(trackId, statsReport) {
  LocalTrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    audioLevel: {
      value: typeof statsReport.audioInputLevel === 'number'
        ? statsReport.audioInputLevel
        : null,
      enumerable: true
    },
    jitter: {
      value: typeof statsReport.jitter === 'number'
        ? statsReport.jitter
        : null,
      enumerable: true
    }
  });
}

inherits(LocalAudioTrackStats, LocalTrackStats);

/**
 * The maximum absolute amplitude of a set of audio samples in the
 * range of 0 to 32767 inclusive.
 * @typedef {number} AudioLevel
 */

module.exports = LocalAudioTrackStats;

},{"./localtrackstats":63,"util":146}],63:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var TrackStats = require('./trackstats');

/**
 * Statistics for a {@link LocalTrack}.
 * @extends TrackStats
 * @property {?number} bytesSent - Number of bytes sent
 * @property {?number} packetsSent - Number of packets sent
 * @property {?number} roundTripTime - Round trip time in milliseconds
 * @param {string} trackId - {@link LocalTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function LocalTrackStats(trackId, statsReport) {
  TrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    bytesSent: {
      value: typeof statsReport.bytesSent === 'number'
        ? statsReport.bytesSent
        : null,
      enumerable: true
    },
    packetsSent: {
      value: typeof statsReport.packetsSent === 'number'
        ? statsReport.packetsSent
        : null,
      enumerable: true
    },
    roundTripTime: {
      value: typeof statsReport.roundTripTime === 'number'
        ? statsReport.roundTripTime
        : null,
      enumerable: true
    }
  });
}

inherits(LocalTrackStats, TrackStats);

module.exports = LocalTrackStats;

},{"./trackstats":69,"util":146}],64:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var LocalTrackStats = require('./localtrackstats');

/**
 * Statistics for a {@link LocalVideoTrack}.
 * @extends LocalTrackStats
 * @property {?VideoTrack#Dimensions} captureDimensions - Video capture resolution
 * @property {?VideoTrack#Dimensions} dimensions - Video encoding resolution
 * @property {?number} captureFrameRate - Video capture frame rate
 * @property {?number} frameRate - Video encoding frame rate
 * @param {string} trackId - {@link LocalVideoTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function LocalVideoTrackStats(trackId, statsReport) {
  LocalTrackStats.call(this, trackId, statsReport);

  var captureDimensions = null;
  if (typeof statsReport.frameWidthInput === 'number' &&
      typeof statsReport.frameHeightInput === 'number') {
    captureDimensions = {};

    Object.defineProperties(captureDimensions, {
      width: {
        value: statsReport.frameWidthInput,
        enumerable: true
      },
      height: {
        value: statsReport.frameHeightInput,
        enumerable: true
      }
    });
  }

  var dimensions = null;
  if (typeof statsReport.frameWidthSent === 'number' &&
      typeof statsReport.frameHeightSent === 'number') {
    dimensions = {};

    Object.defineProperties(dimensions, {
      width: {
        value: statsReport.frameWidthSent,
        enumerable: true
      },
      height: {
        value: statsReport.frameHeightSent,
        enumerable: true
      }
    });
  }

  Object.defineProperties(this, {
    captureDimensions: {
      value: captureDimensions,
      enumerable: true
    },
    dimensions: {
      value: dimensions,
      enumerable: true
    },
    captureFrameRate: {
      value: typeof statsReport.frameRateInput === 'number'
        ? statsReport.frameRateInput
        : null,
      enumerable: true
    },
    frameRate: {
      value: typeof statsReport.frameRateSent === 'number'
        ? statsReport.frameRateSent
        : null,
      enumerable: true
    }
  });
}

inherits(LocalVideoTrackStats, LocalTrackStats);

module.exports = LocalVideoTrackStats;

},{"./localtrackstats":63,"util":146}],65:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for an {@link AudioTrack}.
 * @extends RemoteTrackStats
 * @property {?AudioLevel} audioLevel - Output {@link AudioLevel}
 * @property {?number} jitter - Audio jitter in milliseconds
 * @param {string} trackId - {@link AudioTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function RemoteAudioTrackStats(trackId, statsReport) {
  RemoteTrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    audioLevel: {
      value: typeof statsReport.audioOutputLevel === 'number'
        ? statsReport.audioOutputLevel
        : null,
      enumerable: true
    },
    jitter: {
      value: typeof statsReport.jitter === 'number'
        ? statsReport.jitter
        : null,
      enumerable: true
    }
  });
}

inherits(RemoteAudioTrackStats, RemoteTrackStats);

module.exports = RemoteAudioTrackStats;

},{"./remotetrackstats":66,"util":146}],66:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var TrackStats = require('./trackstats');

/**
 * Statistics for a remote {@link Track}.
 * @extends TrackStats
 * @property {?number} bytesReceived - Number of bytes received
 * @property {?number} packetsReceived - Number of packets received
 * @param {string} trackId - {@link Track} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function RemoteTrackStats(trackId, statsReport) {
  TrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    bytesReceived: {
      value: typeof statsReport.bytesReceived === 'number'
        ? statsReport.bytesReceived
        : null,
      enumerable: true
    },
    packetsReceived: {
      value: typeof statsReport.packetsReceived === 'number'
        ? statsReport.packetsReceived
        : null,
      enumerable: true
    }
  });
}

inherits(RemoteTrackStats, TrackStats);

module.exports = RemoteTrackStats;

},{"./trackstats":69,"util":146}],67:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;
var RemoteTrackStats = require('./remotetrackstats');

/**
 * Statistics for a {@link VideoTrack}.
 * @extends RemoteTrackStats
 * @property {?VideoTrack#Dimensions} dimensions - Received video resolution
 * @property {?number} frameRate - Received video frame rate
 * @param {string} trackId - {@link VideoTrack} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function RemoteVideoTrackStats(trackId, statsReport) {
  RemoteTrackStats.call(this, trackId, statsReport);

  var dimensions = null;
  if (typeof statsReport.frameWidthReceived === 'number' &&
      typeof statsReport.frameHeightReceived === 'number') {
    dimensions = {};

    Object.defineProperties(dimensions, {
      width: {
        value: statsReport.frameWidthReceived,
        enumerable: true
      },
      height: {
        value: statsReport.frameHeightReceived,
        enumerable: true
      }
    });
  }

  Object.defineProperties(this, {
    dimensions: {
      value: dimensions,
      enumerable: true
    },
    frameRate: {
      value: typeof statsReport.frameRateReceived === 'number'
        ? statsReport.frameRateReceived
        : null,
      enumerable: true
    }
  });
}

inherits(RemoteVideoTrackStats, RemoteTrackStats);

module.exports = RemoteVideoTrackStats;

},{"./remotetrackstats":66,"util":146}],68:[function(require,module,exports){
'use strict';

var LocalAudioTrackStats = require('./localaudiotrackstats');
var LocalVideoTrackStats = require('./localvideotrackstats');
var RemoteAudioTrackStats = require('./remoteaudiotrackstats');
var RemoteVideoTrackStats = require('./remotevideotrackstats');

/**
 * Statistics report for an RTCPeerConnection.
 * @property {Array<LocalAudioTrackStats>} localAudioTrackStats - List of {@link LocalAudioTrackStats}
 * @property {Array<LocalVideoTrackStats>} localVideoTrackStats - List of {@link LocalVideoTrackStats}
 * @property {Array<RemoteAudioTrackStats>} remoteAudioTrackStats - List of {@link RemoteAudioTrackStats}
 * @property {Array<RemoteVideoTrackStats>} remoteVideoTrackStats - List of {@link RemoteVideoTrackStats}
 * @param {string} peerConnectionId - RTCPeerConnection ID
 * @param {StandardizedStatsResponse} statsResponse
 * @constructor
 */
function StatsReport(peerConnectionId, statsResponse) {
  if (typeof peerConnectionId !== 'string') {
    throw new Error('RTCPeerConnection id must be a string');
  }

  Object.defineProperties(this, {
    peerConnectionId: {
      value: peerConnectionId,
      enumerable: true
    },
    localAudioTrackStats: {
      value: statsResponse.localAudioTrackStats.map(function(report) {
        return new LocalAudioTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    localVideoTrackStats: {
      value: statsResponse.localVideoTrackStats.map(function(report) {
        return new LocalVideoTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    remoteAudioTrackStats: {
      value: statsResponse.remoteAudioTrackStats.map(function(report) {
        return new RemoteAudioTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    remoteVideoTrackStats: {
      value: statsResponse.remoteVideoTrackStats.map(function(report) {
        return new RemoteVideoTrackStats(report.trackId, report);
      }),
      enumerable: true
    }
  });
}

module.exports = StatsReport;

},{"./localaudiotrackstats":62,"./localvideotrackstats":64,"./remoteaudiotrackstats":65,"./remotevideotrackstats":67}],69:[function(require,module,exports){
'use strict';

/**
 * Statistics for a {@link Track}.
 * @property {string} trackId - MediaStreamTrack ID
 * @property {number} timestamp - The Unix timestamp in milliseconds
 * @property {string} ssrc - SSRC of the MediaStreamTrack
 * @property {?number} packetsLost - Then number of packets lost
 * @property {?string} codec - Name of the codec used to encode the MediaStreamTrack's media
 * @param {string} trackId - {@link Track} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function TrackStats(trackId, statsReport) {
  if (typeof trackId !== 'string') {
    throw new Error('Track id must be a string');
  }

  Object.defineProperties(this, {
    trackId: {
      value: trackId,
      enumerable: true
    },
    timestamp: {
      value: statsReport.timestamp,
      enumerable: true
    },
    ssrc: {
      value: statsReport.ssrc,
      enumerable: true
    },
    packetsLost: {
      value: typeof statsReport.packetsLost === 'number'
        ? statsReport.packetsLost
        : null,
      enumerable: true
    },
    codec: {
      value: typeof statsReport.codecName === 'string'
        ? statsReport.codecName
        : null,
      enumerable: true
    }
  });
}

module.exports = TrackStats;

},{}],70:[function(require,module,exports){
'use strict';

/**
 * Construct a {@link TrackTransceiver}.
 * @class
 * @classdesc A {@link TrackTransceiver} represents either one or more
 *   local RTCRtpSenders or RTCDataChannels, or a single RTCRtpReceiver
 *   or remote RTCDataChannel.
 * @param {Track.ID} id
 * @param {Track.kind} kind
 * @property {Track.ID} id
 * @property {Track.kind} kind
 */
function TrackTransceiver(id, kind) {
  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    }
  });
}

module.exports = TrackTransceiver;

},{}],71:[function(require,module,exports){
'use strict';

/**
 * Construct a new {@link CancelablePromise}.
 * @class
 * @classdesc A Promise that can be canceled with {@link CancelablePromise#cancel}.
 * @extends Promise
 * @param {CancelablePromise.OnCreate} onCreate
 * @param {CancelablePromise.OnCancel} onCancel
*//**
 * A function to be called on {@link CancelablePromise} creation
 * @typedef {function} CancelablePromise.OnCreate
 * @param {function(*)} resolve
 * @param {function(*)} reject
 * @param {function(): boolean} isCanceled
*//**
 * A function to be called when {@link CancelablePromise#cancel} is called
 * @typedef {function} CancelablePromise.OnCancel
 */
function CancelablePromise(onCreate, onCancel) {
  var self = this;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _isCancelable: {
      writable: true,
      value: true
    },
    _isCanceled: {
      writable: true,
      value: false
    },
    _onCancel: {
      value: onCancel
    }
  });

  Object.defineProperty(this, '_promise', {
    value: new Promise(function(resolve, reject) {
      onCreate(function _resolve(value) {
        self._isCancelable = false;
        resolve(value);
      }, function _reject(reason) {
        self._isCancelable = false;
        reject(reason);
      }, function isCanceled() {
        return self._isCanceled;
      });
    })
  });
}

/**
 * Create a synchronously-rejected {@link CancelablePromise}.
 * @param {*} reason
 * @returns {Promise<*>}
 */
CancelablePromise.reject = function reject(reason) {
  return new CancelablePromise(function rejected(resolve, reject) {
    reject(reason);
  }, function onCancel() {
    // Do nothing.
  });
};

/**
 * Create a synchronously-resolved {@link CancelablePromise}.
 * @param {*|Promise<*>|Thenable<*>} result
 * @returns {CancelablePromise<*>}
 */
CancelablePromise.resolve = function resolve(result) {
  return new CancelablePromise(function resolved(resolve) {
    resolve(result);
  }, function onCancel() {
    // Do nothing.
  });
};

/**
 * Attempt to cancel the {@link CancelablePromise}.
 * @returns {this}
 */
CancelablePromise.prototype.cancel = function cancel() {
  if (this._isCancelable) {
    this._isCanceled = true;
    this._onCancel();
  }
  return this;
};

/**
 * @param {function} onRejected
 * @returns {CancelablePromise}
 */
CancelablePromise.prototype.catch = function _catch() {
  var args = [].slice.call(arguments);
  var promise = this._promise;
  return new CancelablePromise(function onCreate(resolve, reject) {
    promise.catch.apply(promise, args).then(resolve, reject);
  }, this._onCancel);
};

/**
 * @param {?function} onResolved
 * @param {function} [onRejected]
 * @returns {CancelablePromise}
 */
CancelablePromise.prototype.then = function then() {
  var args = [].slice.call(arguments);
  var promise = this._promise;
  return new CancelablePromise(function onCreate(resolve, reject) {
    promise.then.apply(promise, args).then(resolve, reject);
  }, this._onCancel);
};

module.exports = CancelablePromise;

},{}],72:[function(require,module,exports){
'use strict';

module.exports.DEFAULT_ENVIRONMENT = 'prod';
module.exports.DEFAULT_REALM = 'us1';
module.exports.DEFAULT_LOG_LEVEL = 'warn';
module.exports.REGISTRAR_SERVER = 'endpoint.twilio.com';
module.exports.WS_SERVER = function(environment, realm) {
  switch (environment) {
    case 'prod':
      switch (realm) {
        case 'us1':
          return 'wss://endpoint.twilio.com';
        default:
          return 'wss://endpoint.' + realm + '.twilio.com';
      }
    default:
      return 'wss://endpoint.' + environment + '-' + realm + '.twilio.com';
  }
};
module.exports.ECS_SERVER = function(environment, realm) {
  switch (environment) {
    case 'prod':
      return 'https://ecs.' + realm + '.twilio.com';
    default:
      return 'https://ecs.' + environment + '-' + realm + '.twilio.com';
  }
};
module.exports.ECS_TIMEOUT = 60;
module.exports.PUBLISH_MAX_ATTEMPTS = 5;
module.exports.PUBLISH_BACKOFF_JITTER = 10;
module.exports.PUBLISH_BACKOFF_MS = 20;

module.exports.ICE_SERVERS_TIMEOUT_MS = 3000;
module.exports.ICE_SERVERS_DEFAULT_TTL = 3600;
module.exports.DEFAULT_ICE_SERVERS = function(environment) {
  switch (environment) {
    case 'prod':
      return [
        { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }
      ];
    default:
      return [
        { urls: 'stun:global.stun.' + environment + '.twilio.com:3478?transport=udp' }
      ];
  }
};

// Headers
/* eslint key-spacing:0 */
module.exports.headers = {
  X_TWILIO_ACCESSTOKEN:   'X-Twilio-AccessToken'
};

/**
 * Returns the appropriate indefinite article ("a" | "an").
 * @param {string} word - The word which determines whether "a" | "an" is returned
 * @returns {string} "a" if word's first letter is a vowel, "an" otherwise
 */
function article(word) {
  // NOTE(mmalavalli): This will not be accurate for words like "hour",
  // which have consonants as their first character, but are pronounced like
  // vowels. We can address this issue if the need arises.
  return ['a', 'e', 'i', 'o', 'u'].indexOf(word.toLowerCase()[0]) >= 0 ? 'an' : 'a';
}

module.exports.typeErrors = {
  INVALID_TYPE: function(name, type) {
    return new TypeError(name + ' must be ' + article(type) + ' ' + type);
  },
  INVALID_VALUE: function(name, values) {
    return new RangeError(name + ' must be one of ', values.join(', '));
  },
  REQUIRED_ARGUMENT: function(name) {
    return new TypeError(name + ' must be specified');
  }
};

},{}],73:[function(require,module,exports){
'use strict';

function Filter(options) {
  if (!(this instanceof Filter)) {
    return new Filter(options);
  }
  options = Object.assign({
    getKey: function defaultGetKey(a) { return a; },
    getValue: function defaultGetValue(a) { return a; },
    isLessThanOrEqualTo: function defaultIsLessThanOrEqualTo(a, b) { return a <= b; }
  }, options);
  Object.defineProperties(this, {
    _getKey: {
      value: options.getKey
    },
    _getValue: {
      value: options.getValue
    },
    _isLessThanOrEqualTo: {
      value: options.isLessThanOrEqualTo
    },
    _map: {
      value: new Map()
    }
  });
}

Filter.prototype.toMap = function toMap() {
  return new Map(this._map);
};

Filter.prototype.updateAndFilter = function filter(entries) {
  return entries.filter(this.update, this);
};

Filter.prototype.update = function update(entry) {
  var key = this._getKey(entry);
  var value = this._getValue(entry);
  if (this._map.has(key) &&
      this._isLessThanOrEqualTo(value, this._map.get(key))) {
    return false;
  }
  this._map.set(key, value);
  return true;
};

module.exports = Filter;

},{}],74:[function(require,module,exports){
/* globals mozRTCPeerConnection */
'use strict';

var constants = require('./constants');

/**
 * Return the given {@link LocalTrack} or a new {@link LocalTrack} for the
 * given MediaStreamTrack.
 * @param {LocalTrack|MediaStreamTrack} track
 * @param {object} options
 * @returns {LocalTrack}
 * @throws {TypeError}
 */
function asLocalTrack(track, options) {
  if (track instanceof options.LocalAudioTrack
    || track instanceof options.LocalVideoTrack
    || track instanceof options.LocalDataTrack) {
    return track;
  }
  if (track instanceof options.MediaStreamTrack) {
    return track.kind === 'audio'
      ? new options.LocalAudioTrack(track, options)
      : new options.LocalVideoTrack(track, options);
  }
  throw new constants.typeErrors.INVALID_TYPE('track',
    'LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
}

/**
 * Create a new {@link LocalTrackPublication} for the given {@link LocalTrack}.
 * @param {LocalTrack} track
 * @param {string} sid
 * @param {function(track: LocalTrackPublication): void} unpublish
 * @param {object} options
 */
function asLocalTrackPublication(track, sid, unpublish, options) {
  var LocalTrackPublication = {
    audio: options.LocalAudioTrackPublication,
    video: options.LocalVideoTrackPublication,
    data: options.LocalDataTrackPublication
  }[track.kind];
  return new LocalTrackPublication(sid, track, unpublish, options);
}

/**
 * Capitalize a word.
 * @param {string} word
 * @param {string} capitalized
 */
function capitalize(word) {
  return word[0].toUpperCase() + word.slice(1);
}

/**
 * Finds the items in list1 that are not in list2.
 * @param {Array<*>|Map<*>|Set<*>} list1
 * @param {Array<*>|Map<*>|Set<*>} list2
 * @returns {Set}
 */
function difference(list1, list2) {
  list1 = Array.isArray(list1) ? new Set(list1) : new Set(list1.values());
  list2 = Array.isArray(list2) ? new Set(list2) : new Set(list2.values());

  var difference = new Set();

  list1.forEach(function(item) {
    if (!list2.has(item)) {
      difference.add(item);
    }
  });

  return difference;
}

/**
 * Filter out the keys in an object with a given value.
 * @param {object} object - Object to be filtered
 * @param {*} [filterValue] - Value to be filtered out; If not specified, then
 *   filters out all keys which have an explicit value of "undefined"
 * @returns {object} - Filtered object
 */
function filterObject(object, filterValue) {
  return Object.keys(object).reduce(function(filtered, key) {
    if (object[key] !== filterValue) {
      filtered[key] = object[key];
    }
    return filtered;
  }, {});
}

/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
  var listArray = list instanceof Map || list instanceof Set
    ? Array.from(list.values())
    : list;

  mapFn = mapFn || function mapFn(item) {
    return item;
  };

  return listArray.reduce(function(flattened, item) {
    var mapped = mapFn(item);
    return flattened.concat(mapped);
  }, []);
}

/**
 * Guess the browser.
 * @returns {?string} browser - "chrome", "firefox", "safari", or null
 */
function guessBrowser() {
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    return 'chrome';
  } else if (typeof mozRTCPeerConnection !== 'undefined') {
    return 'firefox';
  } else if (typeof RTCPeerConnection !== 'undefined') {
    if (typeof navigator !== 'undefined' && navigator.userAgent.match(/AppleWebKit\/(\d+)\./)) {
      return 'safari';
    }
    // NOTE(mroberts): Could be Edge.
  }
  return null;
}

/**
 * Construct the SIP URI for a client.
 * @returns {string}
 */
function makeClientSIPURI() {
  /* eslint new-cap:0 */
  return makeUUID() + '@' + constants.REGISTRAR_SERVER;
}

/**
 * Construct the SIP URI for the server.
 * @returns {string}
 */
function makeServerSIPURI() {
  /* eslint new-cap:0 */
  return 'orchestrator@' + constants.REGISTRAR_SERVER;
}

function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Ensure that the given function is called once per tick.
 * @param {function} fn - Function to be executed
 * @returns {function} - Schedules the given function to be called on the next tick
 */
function oncePerTick(fn) {
  var timeout = null;

  function nextTick() {
    timeout = null;
    fn();
  }

  return function scheduleNextTick() {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(nextTick);
  };
}

function promiseFromEvents(operation, eventEmitter, successEvent, failureEvent) {
  return new Promise(function(resolve, reject) {
    function onSuccess() {
      var args = [].slice.call(arguments);
      if (failureEvent) {
        eventEmitter.removeListener(failureEvent, onFailure);
      }
      resolve.apply(null, args);
    }
    function onFailure() {
      var args = [].slice.call(arguments);
      eventEmitter.removeListener(successEvent, onSuccess);
      reject.apply(null, args);
    }
    eventEmitter.once(successEvent, onSuccess);
    if (failureEvent) {
      eventEmitter.once(failureEvent, onFailure);
    }
    operation();
  });
}

/**
 * Traverse down multiple nodes on an object and return null if
 * any link in the path is unavailable.
 * @param {Object} obj - Object to traverse
 * @param {String} path - Path to traverse. Period-separated.
 * @returns {Any|null}
 */
function getOrNull(obj, path) {
  return path.split('.').reduce(function(output, step) {
    if (!output) { return null; }
    return output[step];
  }, obj);
}

/**
 * @typedef {object} Deferred
 * @property {Promise} promise
 * @property {function} reject
 * @property {function} resolve
 */

/**
 * Create a {@link Deferred}.
 * @returns {Deferred}
 */
function defer() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

/**
 * Copy a method from a `source` prototype onto a `wrapper` prototype. Invoking
 * the method on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} methodName
 * @returns {undefined}
 */
function delegateMethod(source, wrapper, target, methodName) {
  if (methodName in wrapper) {
    // Skip any methods already set.
    return;
  } else if (methodName.match(/^on[a-z]+$/)) {
    // Skip EventHandlers (these are handled in the constructor).
    return;
  }

  var type;
  try {
    type = typeof source[methodName];
  } catch (error) {
    // NOTE(mroberts): Attempting to check the type of non-function members
    // on the prototype throws an error for some types.
  }

  if (type !== 'function') {
    // Skip non-function members.
    return;
  }

  /* eslint no-loop-func:0 */
  wrapper[methodName] = function() {
    return this[target][methodName].apply(this[target], arguments);
  };
}

/**
 * Copy methods from a `source` prototype onto a `wrapper` prototype. Invoking
 * the methods on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function delegateMethods(source, wrapper, target) {
  for (var methodName in source) {
    delegateMethod(source, wrapper, target, methodName);
  }
}

/**
 * For each property name on the `source` prototype, add getters and/or setters
 * to `wrapper` that proxy to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function proxyProperties(source, wrapper, target) {
  Object.getOwnPropertyNames(source).forEach(function(propertyName) {
    proxyProperty(source, wrapper, target, propertyName);
  });
}

/**
 * For the property name on the `source` prototype, add a getter and/or setter
 * to `wrapper` that proxies to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} propertyName
 * @returns {undefined}
 */
function proxyProperty(source, wrapper, target, propertyName) {
  if (propertyName in wrapper) {
    // Skip any properties already set.
    return;
  } else if (propertyName.match(/^on[a-z]+$/)) {
    Object.defineProperty(wrapper, propertyName, {
      value: null,
      writable: true
    });

    target.addEventListener(propertyName.slice(2), function() {
      wrapper.dispatchEvent.apply(wrapper, arguments);
    });

    return;
  }

  Object.defineProperty(wrapper, propertyName, {
    enumerable: true,
    get: function() {
      return target[propertyName];
    }
  });
}

/**
 * This is a function for turning a Promise into the kind referenced in the
 * Legacy Interface Extensions section of the WebRTC spec.
 * @param {Promise<*>} promise
 * @param {function<*>} onSuccess
 * @param {function<Error>} onFailure
 * @returns {Promise<undefined>}
 */
function legacyPromise(promise, onSuccess, onFailure) {
  if (onSuccess) {
    return promise.then(function(result) {
      onSuccess(result);
    }, function(error) {
      onFailure(error);
    });
  }
  return promise;
}

/**
 * Build the {@link LogLevels} object.
 * @param {String|LogLevel} logLevel - Log level name or object
 * @returns {LogLevels}
 */
function buildLogLevels(logLevel) {
  if (typeof logLevel === 'string') {
    return {
      default: logLevel,
      media: logLevel,
      signaling: logLevel,
      webrtc: logLevel
    };
  }
  return logLevel;
}

/**
 * Get the {@link Track}'s derived class name
 * @param {Track} track
 * @param {?boolean} [local=undefined]
 * @returns {string}
 */
function trackClass(track, local) {
  local = local ? 'Local' : '';
  return local + (track.kind || '').replace(/\w{1}/, function(m) {
      return m.toUpperCase();
    }) + 'Track';
}

/**
 * Throw if the given track is not a {@link LocalAudioTrack}, a
 * {@link LocalVideoTrack} or a MediaStreamTrack.
 * @param {*} track
 * @param {object} options
 */
function validateLocalTrack(track, options) {
  if (!(track instanceof options.LocalAudioTrack
    || track instanceof options.LocalDataTrack
    || track instanceof options.LocalVideoTrack
    || track instanceof options.MediaStreamTrack)) {
    throw new constants.typeErrors.INVALID_TYPE('track',
      'LocalAudioTrack, LocalVideoTrack, LocalDataTrack, or MediaStreamTrack');
  }
}

/**
 * Use unified plan SDP format on Firefox
 * @returns {?string} SDP format
 */
function getSdpFormat() {
  return typeof mozRTCPeerConnection !== 'undefined' ? 'unified' : null;
}

exports.constants = constants;
exports.asLocalTrack = asLocalTrack;
exports.asLocalTrackPublication = asLocalTrackPublication;
exports.capitalize = capitalize;
exports.difference = difference;
exports.filterObject = filterObject;
exports.flatMap = flatMap;
exports.guessBrowser = guessBrowser;
exports.makeClientSIPURI = makeClientSIPURI;
exports.makeServerSIPURI = makeServerSIPURI;
exports.makeUUID = makeUUID;
exports.oncePerTick = oncePerTick;
exports.promiseFromEvents = promiseFromEvents;
exports.getOrNull = getOrNull;
exports.defer = defer;
exports.delegateMethods = delegateMethods;
exports.proxyProperties = proxyProperties;
exports.legacyPromise = legacyPromise;
exports.buildLogLevels = buildLogLevels;
exports.trackClass = trackClass;
exports.validateLocalTrack = validateLocalTrack;
exports.getSdpFormat = getSdpFormat;

},{"./constants":72}],75:[function(require,module,exports){
(function (global){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var MAX_RECONNECT_ATTEMPTS = 5;
var RECONNECT_INTERVAL_MS = 50;
var WS_CLOSE_NORMAL = 1000;

var toplevel = global.window || global;
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

/**
 * Publish events to the Insights gateway.
 * @constructor
 * @param {string} token - Insights gateway token
 * @param {string} sdkName - Name of the SDK using the {@link InsightsPublisher}
 * @param {string} sdkVersion - Version of the SDK using the {@link InsightsPublisher}
 * @param {string} environment - One of 'dev', 'stage' or 'prod'
 * @param {string} realm - Region identifier
 * @param {InsightsPublisherOptions} options - Override default behavior
 * @fires InsightsPublisher#connected
 * @fires InsightsPublisher#disconnected
 * @fires InsightsPublisher#reconnecting
 */
function InsightsPublisher(token, sdkName, sdkVersion, environment, realm, options) {
  if (!(this instanceof InsightsPublisher)) {
    return new InsightsPublisher(token, sdkName, sdkVersion, environment, realm, options);
  }
  EventEmitter.call(this);

  options = Object.assign({
    gateway: createGateway(environment, realm) + '/v1/VideoEvents',
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectIntervalMs: RECONNECT_INTERVAL_MS,
    userAgent: navigator.userAgent,
    WebSocket: WebSocket
  }, options);

  Object.defineProperties(this, {
    _connectTimestamp: {
      value: 0,
      writable: true
    },
    _eventQueue: {
      value: []
    },
    _reconnectAttemptsLeft: {
      value: options.maxReconnectAttempts,
      writable: true
    },
    _ws: {
      value: null,
      writable: true
    },
    _WebSocket: {
      value: options.WebSocket
    }
  });

  var self = this;

  this.on('disconnected', function maybeReconnect(error) {
    self._session = null;
    if (error && self._reconnectAttemptsLeft > 0) {
      self.emit('reconnecting');
      reconnect(self, token, sdkName, sdkVersion, options);
      return;
    }
    self.removeListener('disconnected', maybeReconnect);
  });

  connect(this, token, sdkName, sdkVersion, options);
}

inherits(InsightsPublisher, EventEmitter);

/**
 * Publish an event to the Insights gateway.
 * @private
 * @param {*} event
 */
InsightsPublisher.prototype._publish = function _publish(event) {
  event.session = this._session;
  this._ws.send(JSON.stringify(event));
};

/**
 * Disconnect from the Insights gateway.
 * @method
 * @returns {boolean} true if called when connecting/open, false if not
 */
InsightsPublisher.prototype.disconnect = function disconnect() {
  if (this._ws.readyState === this._WebSocket.CLOSING || this._ws.readyState === this._WebSocket.CLOSED) {
    return false;
  }

  try {
    this._ws.close();
  } catch (error) {
    // Do nothing.
  }
  this.emit('disconnected');

  return true;
};

/**
 * Publish (or queue, if not connected) an event to the Insights gateway.
 * @method
 * @param {string} groupName - Event group name
 * @param {string} eventName - Event name
 * @param {object} payload - Event payload
 * @returns {boolean} true if queued or published, false if disconnect() called
 */
InsightsPublisher.prototype.publish = function publish(groupName, eventName, payload) {
  if (this._ws.readyState === this._WebSocket.CLOSING || this._ws.readyState === this._WebSocket.CLOSED) {
    return false;
  }

  var publishOrEnqueue = typeof this._session === 'string'
    ? this._publish.bind(this)
    : this._eventQueue.push.bind(this._eventQueue);

  publishOrEnqueue({
    group: groupName,
    name: eventName,
    payload: payload,
    timestamp: Date.now(),
    type: 'event',
    version: 1
  });

  return true;
};

/**
 * Start connecting to the Insights gateway.
 * @private
 * @param {InsightsPublisher} publisher
 * @param {string} name
 * @param {string} token
 * @param {string} sdkName
 * @param {string} sdkVersion
 * @param {InsightsPublisherOptions} options
 */
function connect(publisher, token, sdkName, sdkVersion, options) {
  publisher._connectTimestamp = Date.now();
  publisher._reconnectAttemptsLeft--;
  publisher._ws = new options.WebSocket(options.gateway);
  var ws = publisher._ws;

  ws.addEventListener('close', function(event) {
    if (event.code === WS_CLOSE_NORMAL) {
      publisher.emit('disconnected');
      return;
    }
    publisher.emit('disconnected', new Error('WebSocket Error ' + event.code + ': ' + event.reason));
  });

  ws.addEventListener('message', function(message) {
    handleConnectResponse(publisher, JSON.parse(message.data), options);
  });

  ws.addEventListener('open', function() {
    var connectRequest = {
      type: 'connect',
      token: token,
      version: 1
    };

    connectRequest.publisher = {
      name: sdkName,
      sdkVersion: sdkVersion,
      userAgent: options.userAgent
    };

    ws.send(JSON.stringify(connectRequest));
  });
}

/**
 * Create the Insights Websocket gateway URL.
 * @param {string} environment
 * @param {string} realm
 * @returns {string}
 */
function createGateway(environment, realm) {
  return environment === 'prod' ? 'wss://sdkgw.' + realm + '.twilio.com'
    : 'wss://sdkgw.' + environment + '-' + realm + '.twilio.com';
}

/**
 * Handle connect response from the Insights gateway.
 * @param {InsightsPublisher} publisher
 * @param {*} response
 * @param {InsightsPublisherOptions} options
 */
function handleConnectResponse(publisher, response, options) {
  switch (response.type) {
    case 'connected':
      publisher._session = response.session;
      publisher._reconnectAttemptsLeft = options.maxReconnectAttempts;
      publisher._eventQueue.splice(0).forEach(publisher._publish, publisher);
      publisher.emit('connected');
      break;
    case 'error':
      publisher._ws.close();
      publisher.emit('disconnected', new Error(response.message));
      break;
  }
}

/**
 * Start re-connecting to the Insights gateway with an appropriate delay based
 * on InsightsPublisherOptions#reconnectIntervalMs.
 * @private
 * @param {InsightsPublisher} publisher
 * @param {string} token
 * @param {string} sdkName
 * @param {string} sdkVersion
 * @param {InsightsPublisherOptions} options
 */
function reconnect(publisher, token, sdkName, sdkVersion, options) {
  var connectInterval = Date.now() - publisher._connectTimestamp;
  var timeToWait = options.reconnectIntervalMs - connectInterval;

  if (timeToWait > 0) {
    setTimeout(function() {
      connect(publisher, token, sdkName, sdkVersion, options);
    }, timeToWait);
    return;
  }

  connect(publisher, token, sdkName, sdkVersion, options);
}

/**
 * The {@link InsightsPublisher} is connected to the gateway.
 * @event InsightsPublisher#connected
 */

/**
 * The {@link InsightsPublisher} is disconnected from the gateway.
 * @event InsightsPublisher#disconnected
 * @param {Error} [error] - Optional error if disconnected unintentionally
 */

/**
 * The {@link InsightsPublisher} is re-connecting to the gateway.
 * @event InsightsPublisher#reconnecting
 */

/**
 * {@link InsightsPublisher} options.
 * @typedef {object} InsightsPublisherOptions
 * @property {string} [gateway=sdkgw.{environment}-{realm}.twilio.com] - Insights WebSocket gateway url
 * @property {number} [maxReconnectAttempts=5] - Max re-connect attempts
 * @property {number} [reconnectIntervalMs=50] - Re-connect interval in ms
 */

module.exports = InsightsPublisher;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"events":142,"util":146,"ws":148}],76:[function(require,module,exports){
'use strict';

/**
 * Null Insights publisher.
 * @constructor
 */
function InsightsPublisher() {
  if (!(this instanceof InsightsPublisher)) {
    return new InsightsPublisher();
  }
  Object.defineProperties(this, {
    _connected: {
      writable: true,
      value: true
    }
  });
}

/**
 * Disconnect.
 * @returns {boolean}
 */
InsightsPublisher.prototype.disconnect = function disconnect() {
  if (this._connected) {
    this._connected = false;
    return true;
  }
  return false;
};

/**
 * Publish.
 * @returns {boolean}
 */
InsightsPublisher.prototype.publish = function publish() {
  return this._connected;
};

module.exports = InsightsPublisher;

},{}],77:[function(require,module,exports){
/* eslint no-console:0 */
'use strict';

// Dependencies
var constants = require('./constants');
var DEFAULT_LOG_LEVEL = constants.DEFAULT_LOG_LEVEL;
var E = require('./constants').typeErrors;

/**
 * Construct a new {@link Log} object.
 * @class
 * @classdesc Selectively outputs messages to console.log
 *   based on specified minimum module specific log levels.
 *
 * NOTE: The values in the logLevels object passed to the constructor is changed
 *       by subsequent calls to {@link Log#setLevels}.
 *
 * @param {String} moduleName - Name of the logging module (webrtc/media/signaling)
 * @param {object} component - Component owning this instance of {@link Log}
 * @param {LogLevels} logLevels - Logging levels. See {@link LogLevels}
 */
function Log(moduleName, component, logLevels) {
  if (!(this instanceof Log)) {
    return new Log(moduleName, component, logLevels);
  }

  if (typeof moduleName !== 'string') {
    throw new E.INVALID_TYPE('moduleName', 'string');
  }

  if (!component) {
    throw new E.REQUIRED_ARGUMENT('component');
  }

  if (typeof logLevels !== 'object') {
    logLevels = {};
  }

  validateLogLevels(logLevels);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deprecationWarnings: {
      value: new Set()
    },
    _logLevels: {
      value: logLevels
    },
    _warnings: {
      value: new Set()
    },
    logLevel: {
      get: function get() {
        return Log.getLevelByName(logLevels[moduleName] || DEFAULT_LOG_LEVEL);
      }
    },
    name: { get: component.toString.bind(component) }
  });
}

// Singleton Constants
/* eslint key-spacing:0 */
/* istanbul ignore next */
Object.defineProperties(Log, {
  DEBUG: { value: 0 },
  INFO:  { value: 1 },
  WARN:  { value: 2 },
  ERROR: { value: 3 },
  OFF:   { value: 4 },
  _levels: {
    value: [
      { name: 'DEBUG', logFn: console.log },
      { name: 'INFO',  logFn: console.info },
      { name: 'WARN',  logFn: console.warn },
      { name: 'ERROR', logFn: console.error },
      { name: 'OFF', logFn: function noop() {} }
    ]
  }
});

var LOG_LEVELS_SET = {};
var LOG_LEVEL_VALUES = [];

var LOG_LEVEL_NAMES = Log._levels.map(function(level, i) {
  LOG_LEVELS_SET[level.name] = true;
  LOG_LEVEL_VALUES.push(i);
  return level.name;
});

function validateLogLevel(level) {
  if (!(level in LOG_LEVELS_SET)) {
    throw new E.INVALID_VALUE('level', LOG_LEVEL_NAMES);
  }
}

function validateLogLevels(levels) {
  Object.keys(levels).forEach(function(moduleName) {
    validateLogLevel(levels[moduleName].toUpperCase());
  });
}

/**
 * Get the log level (number) by its name (string)
 * @param {String} name - Name of the log level
 * @returns {Number} Requested log level
 * @throws {TwilioError} INVALID_LOG_LEVEL (32056)
 * @public
 */
Log.getLevelByName = function getLevelByName(name) {
  if (!isNaN(name)) {
    return parseInt(name, 10);
  }
  name = name.toUpperCase();
  validateLogLevel(name);
  return Log[name];
};

/**
 * Create a child {@link Log} instance with this._logLevels
 * @param moduleName - Name of the logging module
 * @param component - Component owning this instance of {@link Log}
 * @returns {Log} this
 */
Log.prototype.createLog = function createLog(moduleName, component) {
  return new Log(moduleName, component, this._logLevels);
};

/**
 * Set new log levels.
 * This changes the levels for all its ancestors,
 * siblings, and children and descendants instances of {@link Log}.
 * @param {LogLevels} levels - New log levels
 * @throws {TwilioError} INVALID_ARGUMENT
 * @returns {Log} this
 */
Log.prototype.setLevels = function setLevels(levels) {
  validateLogLevels(levels);
  Object.assign(this._logLevels, levels);
  return this;
};

/**
 * Log a message using the console method appropriate for the specified logLevel
 * @param {Number} logLevel - Log level of the message being logged
 * @param {String} message - Message(s) to log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.log = function log(logLevel, message) {
  var logSpec = Log._levels[logLevel];
  if (!logSpec) { throw new E.INVALID_VALUE('logLevel', LOG_LEVEL_VALUES); }

  if (this.logLevel <= logLevel) {
    var levelName = logSpec.name;
    var prefix = new Date().toISOString().split('T').concat([
      '|', levelName, 'in', this.name + ':'
    ]);
    logSpec.logFn.apply(console, prefix.concat(message));
  }

  return this;
};

/**
 * Log a debug message using console.log
 * @param {...String} messages - Message(s) to pass to console.log
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.debug = function debug() {
  return this.log(Log.DEBUG, [].slice.call(arguments));
};

/**
 * Log a deprecation warning. Deprecation warnings are logged as warnings and
 * they are only ever logged once.
 * @param {String} deprecationWarning - The deprecation warning
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.deprecated = function deprecated(deprecationWarning) {
  if (this._deprecationWarnings.has(deprecationWarning)) {
    return this;
  }
  this._deprecationWarnings.add(deprecationWarning);
  return this.warn(deprecationWarning);
};

/**
 * Log an info message using console.info
 * @param {...String} messages - Message(s) to pass to console.info
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.info = function info() {
  return this.log(Log.INFO, [].slice.call(arguments));
};

/**
 * Log a warn message using console.warn
 * @param {...String} messages - Message(s) to pass to console.warn
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.warn = function warn() {
  return this.log(Log.WARN, [].slice.call(arguments));
};

/**
 * Log a warning once.
 * @param {String} warning
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.warnOnce = function warnOnce(warning) {
  if (this._warnings.has(warning)) {
    return this;
  }
  this._warnings.add(warning);
  return this.warn(warning);
};

/**
 * Log an error message using console.error
 * @param {...String} messages - Message(s) to pass to console.error
 * @returns {Log} This instance of {@link Log}
 * @public
 */
Log.prototype.error = function error() {
  return this.log(Log.ERROR, [].slice.call(arguments));
};

/**
 * Log an error message using console.error and throw an exception
 * @param {TwilioError} error - Error to throw
 * @param {String} customMessage - Custom message for the error
 * @public
 */
Log.prototype.throw = function throwFn(error, customMessage) {
  if (error.clone) {
    error = error.clone(customMessage);
  }

  this.log(Log.ERROR, error);
  throw error;
};

module.exports = Log;

},{"./constants":72}],78:[function(require,module,exports){
'use strict';

var difference = require('../').difference;
var flatMap = require('../').flatMap;
var setSimulcastInMediaSection = require('./simulcast');

var ptToFixedBitrateAudioCodecName = {
  0: 'PCMU',
  8: 'PCMA'
};

/**
 * A payload type
 * @typedef {number} PT
 */

/**
 * An {@link AudioCodec} or {@link VideoCodec}
 * @typedef {AudioCodec|VideoCodec} Codec
 */

// NOTE(mmalavalli): This value is derived from the IETF spec
// for JSEP, and it is used to convert a 'b=TIAS' value in bps
// to a 'b=AS' value in kbps.
// Spec: https://tools.ietf.org/html/draft-ietf-rtcweb-jsep-21#section-5.9
var RTCP_BITRATE = 16000;

/**
 * Construct a b= line string for the given max bitrate in bps. If the modifier
 * is 'AS', then the max bitrate will be converted to kbps using the formula
 * specified in the IETF spec for JSEP mentioned above.
 * @param {string} modifier - 'AS' | 'TIAS'
 * @param {?number} maxBitrate - Max outgoing bitrate (bps)
 * @returns {?string} - If "maxBitrate" is null, then returns null;
 *   otherwise return the constructed b= line string
 */
function createBLine(modifier, maxBitrate) {
  if (!maxBitrate) {
    return null;
  }
  return '\r\nb=' + modifier + ':' + (modifier === 'AS'
    ? Math.round((maxBitrate + RTCP_BITRATE) / 950)
    : maxBitrate);
}

/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<Codec, Array<PT>>}
 */
function createCodecMapForMediaSection(section) {
  return Array.from(createPtToCodecName(section)).reduce(function(codecMap, pair) {
    var pt = pair[0];
    var codecName = pair[1];
    var pts = codecMap.get(codecName) || [];
    return codecMap.set(codecName, pts.concat(pt));
  }, new Map());
}

/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
  return getPayloadTypesInMediaSection(mediaSection).reduce(function(ptToCodecName, pt) {
    var rtpmapPattern = new RegExp('a=rtpmap:' + pt + ' ([^/]+)');
    var matches = mediaSection.match(rtpmapPattern);
    var codecName = matches
      ? matches[1].toLowerCase()
      : ptToFixedBitrateAudioCodecName[pt]
        ? ptToFixedBitrateAudioCodecName[pt].toLowerCase()
        : '';
    return ptToCodecName.set(pt, codecName);
  }, new Map());
}

/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
  return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function(mediaSection) {
    return 'm=' + mediaSection;
  }).filter(function(mediaSection) {
    var kindPattern = new RegExp('m=' + (kind || '.*'), 'gm');
    var directionPattern = new RegExp('a=' + (direction || '.*'), 'gm');
    return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
  });
}

/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PT>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
  var mLine = section.split('\r\n')[0];

  // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
  // the regex matches <port> and the PayloadTypes.
  var matches = mLine.match(/([0-9]+)/g);

  // This should not happen, but in case there are no PayloadTypes in
  // the m= line, return an empty array.
  if (!matches) {
    return [];
  }

  // Since only the PayloadTypes are needed, we discard the <port>.
  return matches.slice(1).map(function(match) {
    return parseInt(match, 10);
  });
}

/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<Codec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
  preferredCodecs = preferredCodecs.map(function(codecName) {
    return codecName.toLowerCase();
  });

  var preferredPayloadTypes = flatMap(preferredCodecs, function(codecName) {
    return codecMap.get(codecName) || [];
  });

  var remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
  var remainingPayloadTypes = flatMap(remainingCodecs, function(codecName) {
    return codecMap.get(codecName);
  });

  return preferredPayloadTypes.concat(remainingPayloadTypes);
}

/**
 * Set the specified max bitrate in the given m= section.
 * @param {string} modifier - 'AS' | 'TIAS'
 * @param {?number} maxBitrate - Max outgoing bitrate (bps)
 * @param {string} section - m= section string
 * @returns {string} The updated m= section
 */
function setBitrateInMediaSection(modifier, maxBitrate, section) {
  var bLine = createBLine(modifier, maxBitrate) || '';
  var bLinePattern = /\r\nb=(AS|TIAS):([0-9]+)/;
  var bLineMatched = section.match(bLinePattern);

  if (!bLineMatched) {
    return section.replace(/(\r\n)?$/, bLine + '$1');
  }

  var maxBitrateMatched = parseInt(bLineMatched[2], 10);
  maxBitrate = maxBitrate || Infinity;
  bLine = createBLine(modifier, Math.min(maxBitrateMatched, maxBitrate));
  return section.replace(bLinePattern, bLine);
}

/**
 * Set maximum bitrates to the media sections in a given sdp.
 * @param {string} sdp - sdp string
 * @param {string} modifier - 'AS' | 'TIAS"
 * @param {?number} maxAudioBitrate - Max outgoing audio bitrate (bps), null
 *   if no limit is to be applied
 * @param {?number} maxVideoBitrate - Max outgoing video bitrate (bps), null
 *   if no limit is to be applied
 * @returns {string} - The updated sdp string
 */
function setBitrateParameters(sdp, modifier, maxAudioBitrate, maxVideoBitrate) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(function(section) {
    // Bitrate parameters should not be applied to m=application sections
    // or to m=(audio|video) sections that do not receive media.
    if (!/^m=(audio|video)/.test(section) || !/a=(recvonly|sendrecv)/.test(section)) {
      return section;
    }
    var kind = section.match(/^m=(audio|video)/)[1];
    var maxBitrate = kind === 'audio' ? maxAudioBitrate : maxVideoBitrate;
    return setBitrateInMediaSection(modifier, maxBitrate, section);
  })).join('\r\n');
}

/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
  var lines = section.split('\r\n');
  var mLine = lines[0];
  var otherLines = lines.slice(1);
  mLine = mLine.replace(/([0-9]+\s?)+$/, payloadTypes.join(' '));
  return [mLine].concat(otherLines).join('\r\n');
}

/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredAudioCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @param {Array<VideoCodecSettings>} preferredVideoCodecs - If empty, the
 *   existing order of video codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredAudioCodecs, preferredVideoCodecs) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(function(section) {
    // Codec preferences should not be applied to m=application sections.
    if (!/^m=(audio|video)/.test(section)) {
      return section;
    }
    var kind = section.match(/^m=(audio|video)/)[1];
    var codecMap = createCodecMapForMediaSection(section);
    var preferredCodecs = kind === 'audio' ? preferredAudioCodecs : preferredVideoCodecs.map(function(codec) {
      return codec.codec;
    });
    var payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
    var newSection = setPayloadTypesInMediaSection(payloadTypes, section);

    var pcmaPayloadTypes = codecMap.get('pcma') || [];
    var pcmuPayloadTypes = codecMap.get('pcmu') || [];
    var fixedBitratePayloadTypes = kind === 'audio'
      ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes))
      : new Set();

    return fixedBitratePayloadTypes.has(payloadTypes[0])
      ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '')
      : newSection;
  })).join('\r\n');
}

/**
 * Return a new SDP string with simulcast settings.
 * @param {string} sdp
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes
 * @returns {string} Updated SDP string
 */
function setSimulcast(sdp, trackIdsToAttributes) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session].concat(mediaSections.map(function(section) {
    section = section.replace(/\r\n$/, '');
    if (!/^m=video/.test(section)) {
      return section;
    }
    var codecMap = createCodecMapForMediaSection(section);
    var payloadTypes = getPayloadTypesInMediaSection(section);
    var vp8PayloadTypes = new Set(codecMap.get('vp8') || []);

    var hasVP8PayloadType = payloadTypes.some(function(payloadType) {
      return vp8PayloadTypes.has(payloadType);
    });
    return hasVP8PayloadType
      ? setSimulcastInMediaSection(section, trackIdsToAttributes)
      : section;
  })).concat('').join('\r\n');
}

/**
 * Codec Payload Type.
 * @typedef {number} PayloadType
 */

exports.createCodecMapForMediaSection = createCodecMapForMediaSection;
exports.createPtToCodecName = createPtToCodecName;
exports.getMediaSections = getMediaSections;
exports.setBitrateParameters = setBitrateParameters;
exports.setCodecPreferences = setCodecPreferences;
exports.setSimulcast = setSimulcast;

},{"../":74,"./simulcast":80}],79:[function(require,module,exports){
'use strict';

var RTCSessionDescription = require('@twilio/webrtc').RTCSessionDescription;

var createPtToCodecName = require('./').createPtToCodecName;
var getMediaSections = require('./').getMediaSections;

/**
 * An RTX payload type
 * @typedef {PT} RtxPT
 */

/**
 * A non-RTX payload type
 * @typedef {PT} NonRtxPT
 */

/**
 * A Set with at least one element
 * @typedef {Set} NonEmptySet
 */

/**
 * Apply the workaround for Issue 8329 to an RTCSessionDescriptionInit.
 * @param {RTCSessionDescriptionInit} description
 * @returns {RTCSessionDescription} newDescription
 */
function workaround(description) {
  var descriptionInit = { type: description.type };
  if (description.type !== 'rollback') {
    descriptionInit.sdp = sdpWorkaround(description.sdp);
  }
  return new RTCSessionDescription(descriptionInit);
}

/**
 * @param {string} sdp
 * @returns {string} newSdp
 */
function sdpWorkaround(sdp) {
  var mediaSections = getMediaSections(sdp);
  var session = sdp.split('\r\nm=')[0];
  return [session]
    .concat(mediaSections.map(mediaSectionWorkaround))
    .join('\r\n');
}

/**
 * @param {string} mediaSection
 * @returns {string} newMediaSection
 */
function mediaSectionWorkaround(mediaSection) {
  var ptToCodecName = createPtToCodecName(mediaSection);
  var codecNameToPts = createCodecNameToPts(ptToCodecName);
  var rtxPts = codecNameToPts.get('rtx') || new Set();

  var invalidRtxPts = new Set();
  var rtxPtToAssociatedPt = createRtxPtToAssociatedPt(
    mediaSection, ptToCodecName, rtxPts, invalidRtxPts);
  var associatedPtToRtxPt = createAssociatedPtToRtxPt(
    rtxPtToAssociatedPt, invalidRtxPts);

  var unassociatedRtxPts = Array.from(invalidRtxPts);

  // NOTE(mroberts): We normalize to lowercase.
  var knownCodecNames = ['h264', 'vp8', 'vp9'];
  var unassociatedPts = knownCodecNames.reduce(function(unassociatedPts, codecName) {
    var pts = codecNameToPts.get(codecName) || new Set();
    return Array.from(pts).reduce(function(unassociatedPts, pt) {
      return associatedPtToRtxPt.has(pt)
        ? unassociatedPts
        : unassociatedPts.add(pt);
    }, unassociatedPts);
  }, new Set());

  unassociatedPts.forEach(function(pt) {
    if (unassociatedRtxPts.length) {
      var rtxPt = unassociatedRtxPts.shift();
      mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
      mediaSection = addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt);
    }
  });

  unassociatedRtxPts.forEach(function(rtxPt) {
    mediaSection = deleteFmtpAttributesForRtxPt(mediaSection, rtxPt);
    mediaSection = deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt);
  });

  return mediaSection;
}

/**
 * @param {Map<PT, Codec>} ptToCodecName
 * @returns {Map<string, NonEmptySet<PT>>} codecNameToPts
 */
function createCodecNameToPts(ptToCodecName) {
  var codecNameToPts = new Map();
  ptToCodecName.forEach(function(codecName, pt) {
    var pts = codecNameToPts.get(codecName) || new Set();
    return codecNameToPts.set(codecName, pts.add(pt));
  });
  return codecNameToPts;
}

/**
 * @param {string} mediaSection
 * @param {Map<PT, Codec>} ptToCodecName
 * @param {Set<RtxPT>} rtxPts
 * @param {Set<RtxPT>} invalidRtxPts
 * @returns {Map<RtxPT, NonRtxPT>} rtxPtToAssociatedPt
 */
function createRtxPtToAssociatedPt(mediaSection, ptToCodecName, rtxPts, invalidRtxPts) {
  return Array.from(rtxPts).reduce(function(rtxPtToAssociatedPt, rtxPt) {
    var fmtpPattern = new RegExp('a=fmtp:' + rtxPt + ' apt=(\\d+)');
    var matches = mediaSection.match(fmtpPattern);
    if (!matches) {
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    var pt = Number.parseInt(matches[1]);
    if (!ptToCodecName.has(pt)) {
      // This is Issue 8329.
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    var codecName = ptToCodecName.get(pt);
    if (codecName === 'rtx') {
      // Strange
      invalidRtxPts.add(rtxPt);
      return rtxPtToAssociatedPt;
    }

    return rtxPtToAssociatedPt.set(rtxPt, pt);
  }, new Map());
}

/**
 * @param {string} mediaSection
 * @param {Map<RtxPT, NonRtxPT>} rtxPtToAssociatedPt
 * @param {Set<RtxPT>} invalidRtxPts
 * @returns {Map<NonRtxPT, RtxPT>} associatedPtToRtxPt
 */
function createAssociatedPtToRtxPt(rtxPtToAssociatedPt, invalidRtxPts) {
  // First, we construct a Map<NonRtxPT, NonEmptySet<RtxPT>>.
  var associatedPtToRtxPts = Array.from(rtxPtToAssociatedPt).reduce(function(associatedPtToRtxPts, pair) {
    var rtxPt = pair[0];
    var pt = pair[1];
    var rtxPts = associatedPtToRtxPts.get(pt) || new Set();
    return associatedPtToRtxPts.set(pt, rtxPts.add(rtxPt));
  }, new Map());

  // Then, we filter down to a Map<NonRtxPT, RtxPt>. Any RtxPTs that map to the
  // same NonRtxPT are removed and added to invalidRtxPts.
  return Array.from(associatedPtToRtxPts).reduce(function(associatedPtToRtxPt, pair) {
    var pt = pair[0];
    var rtxPts = Array.from(pair[1]);
    if (rtxPts.length > 1) {
      rtxPts.forEach(function(rtxPt) {
        invalidRtxPts.add(rtxPt);
      });
      return associatedPtToRtxPt;
    }
    return associatedPtToRtxPt.set(pt, rtxPts[0]);
  }, new Map());
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @returns {string} newMediaSection
 */
function deleteFmtpAttributesForRtxPt(mediaSection, rtxPt) {
  var pattern = new RegExp('a=fmtp:' + rtxPt + '.*\r\n', 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @returns {string} newMediaSection
 */
function deleteRtpmapAttributesForRtxPt(mediaSection, rtxPt) {
  var pattern = new RegExp('a=rtpmap:' + rtxPt + '.*\r\n', 'gm');
  return mediaSection.replace(pattern, '');
}

/**
 * @param {string} mediaSection
 * @param {RtxPT} rtxPt
 * @param {NonRtxPT} pt
 * @returns {string} newMediaSection
 */
function addFmtpAttributeForRtxPt(mediaSection, rtxPt, pt) {
  return mediaSection + 'a=fmtp:' + rtxPt + ' apt=' + pt + '\r\n';
}

module.exports = workaround;

},{"./":78,"@twilio/webrtc":125}],80:[function(require,module,exports){
'use strict';

var difference = require('../').difference;
var flatMap = require('../').flatMap;

/**
 * Create a random {@link SSRC}.
 * @returns {SSRC}
 */
function createSSRC() {
  var ssrcMax = 0xffffffff;
  return String(Math.floor(Math.random() * ssrcMax));
}

/**
 * Construct a {@link MediaStreamTrack} attribute store.
 * @class
 * @param {Track.ID} trackId - The MediaStreamTrack ID
 * @param {string} streamId - The MediaStream ID
 * @param {string} cName - The MediaStream cname
 * @property {string} cName
 * @property {boolean} isSimulcastEnabled
 * @property {Map<RtxSSRC, PrimarySSRC>} rtxPairs
 * @property {Set<PrimarySSRC>} primarySSRCs
 * @property {string} streamId
 * @property {Track.ID} trackId
 */
function TrackAttributes(trackId, streamId, cName) {
  Object.defineProperties(this, {
    cName: {
      enumerable: true,
      value: cName
    },
    isSimulcastEnabled: {
      enumerable: true,
      value: false,
      writable: true
    },
    primarySSRCs: {
      enumerable: true,
      value: new Set()
    },
    rtxPairs: {
      enumerable: true,
      value: new Map()
    },
    streamId: {
      enumerable: true,
      value: streamId
    },
    trackId: {
      enumerable: true,
      value: trackId
    }
  });
}

/**
 * Add {@link SimSSRC}s to the {@link TrackAttributes}.
 * @returns {void}
 */
TrackAttributes.prototype.addSimulcastSSRCs = function addSimulcastSSRCs() {
  if (this.isSimulcastEnabled) {
    return;
  }
  var simulcastSSRCs = [createSSRC(), createSSRC()];
  simulcastSSRCs.forEach(function(ssrc) {
    this.primarySSRCs.add(ssrc);
  }, this);

  if (this.rtxPairs.size) {
    simulcastSSRCs.forEach(function(ssrc) {
      this.rtxPairs.set(createSSRC(), ssrc);
    }, this);
  }
};

/**
 * Add the given {@link PrimarySSRC} or {@link RtxSSRC} to the {@link TrackAttributes}
 * and update the "isSimulcastEnabled" flag if it is also a {@link SimSSRC}.
 * @param {SSRC} ssrc - The {@link SSRC} to be added
 * @param {?PrimarySSRC} primarySSRC - The {@link PrimarySSRC}; if the given
 *   {@link SSRC} itself is the {@link PrimarySSRC}, then this is set to null
 * @param {boolean} isSimSSRC - true if the given {@link SSRC} is a
 *   {@link SimSSRC}; false otherwise
 * @returns {void}
 */
TrackAttributes.prototype.addSSRC = function addSSRC(ssrc, primarySSRC, isSimSSRC) {
  if (primarySSRC) {
    this.rtxPairs.set(ssrc, primarySSRC);
  } else {
    this.primarySSRCs.add(ssrc);
  }
  this.isSimulcastEnabled = this.isSimulcastEnabled || isSimSSRC;
};

/**
 * Construct the SDP lines for the {@link TrackAttributes}.
 * @returns {Array<string>} Array of SDP lines
 */
TrackAttributes.prototype.toSdpLines = function toSdpLines() {
  var rtxPairs = Array.from(this.rtxPairs.entries()).map(function(rtxPair) {
    return rtxPair.reverse();
  });

  var simSSRCs = Array.from(this.primarySSRCs.values());
  var ssrcs = rtxPairs.length ? flatMap(rtxPairs) : simSSRCs;
  var self = this;

  var attrLines = flatMap(ssrcs, function(ssrc) {
    return [
      'a=ssrc:' + ssrc + ' cname:' + self.cName,
      'a=ssrc:' + ssrc + ' msid:' + self.streamId + ' ' + self.trackId
    ];
  });
  var rtxPairLines = rtxPairs.map(function(rtxPair) {
    return 'a=ssrc-group:FID ' + rtxPair.join(' ');
  });
  var simGroupLines = [
    'a=ssrc-group:SIM ' + simSSRCs.join(' ')
  ];

  return rtxPairLines.concat(attrLines).concat(simGroupLines);
};

/**
 * Get the matches for a given RegEx pattern.
 * @param {string} section - SDP media section
 * @param {string} pattern - RegEx pattern
 * @returns {Array<Array<string>>} - Array of pattern matches
 */
function getMatches(section, pattern) {
  var matches = section.match(new RegExp(pattern, 'gm')) || [];
  return matches.map(function(match) {
    var matches = match.match(new RegExp(pattern)) || [];
    return matches.slice(1);
  });
}

/**
 * Get the {@link SimSSRC}s that belong to a simulcast group.
 * @param {string} section - SDP media section
 * @returns {Set<SimSSRC>} Set of simulcast {@link SSRC}s
 */
function getSimulcastSSRCs(section) {
  var simGroupPattern = '^a=ssrc-group:SIM ([0-9]+) ([0-9]+) ([0-9]+)$';
  return new Set(flatMap(getMatches(section, simGroupPattern)));
}

/**
 * Get the value of the given attribute for an SSRC.
 * @param {string} section - SDP media section
 * @param {SSRC} ssrc - {@link SSRC} whose attribute's value is to be determinded
 * @param {string} attribute - {@link SSRC} attribute name
 * @param {string} - {@link SSRC} attribute value
 */
function getSSRCAttribute(section, ssrc, attribute) {
  var pattern = 'a=ssrc:' + ssrc + ' ' + attribute + ':(.+)';
  return section.match(new RegExp(pattern))[1];
}

/**
 * Create a Map of {@link PrimarySSRC}s and their {@link RtxSSRC}s.
 * @param {string} section - SDP media section
 * @returns {Map<RtxSSRC, PrimarySSRC>} - Map of {@link RtxSSRC}s and their
 *   corresponding {@link PrimarySSRC}s
 */
function getSSRCRtxPairs(section) {
  var rtxPairPattern = '^a=ssrc-group:FID ([0-9]+) ([0-9]+)$';
  return new Map(getMatches(section, rtxPairPattern).map(function(pair) {
    return pair.reverse();
  }));
}

/**
 * Create a Map of MediaStreamTrack IDs and their {@link TrackAttributes}.
 * @param {string} section - SDP media section
 * @returns {Map<Track.ID, TrackAttributes>}
 */
function createTrackIdsToAttributes(section) {
  var simSSRCs = getSimulcastSSRCs(section);
  var ssrcAttrTuples = getMatches(section, '^a=ssrc:([0-9]+) msid:([^\\s]+) ([^\\s]+)$');
  var rtxPairs = getSSRCRtxPairs(section);

  return ssrcAttrTuples.reduce(function(trackIdsToSSRCs, tuple) {
    var ssrc = tuple[0];
    var streamId = tuple[1];
    var trackId = tuple[2];

    var trackAttributes = trackIdsToSSRCs.get(trackId) || new TrackAttributes(
      trackId,
      streamId,
      getSSRCAttribute(section, ssrc, 'cname'));

    var primarySSRC = rtxPairs.get(ssrc) || null;
    trackAttributes.addSSRC(ssrc, primarySSRC, simSSRCs.has(ssrc));
    return trackIdsToSSRCs.set(trackId, trackAttributes);
  }, new Map());
}

/**
 * Apply simulcast settings to the given SDP media section.
 * @param {string} section - SDP media section
 * @param {Map<Track.ID, TrackAttributes>} trackIdsToAttributes - Existing
 *   map which will be updated for new MediaStreamTrack IDs
 * @returns {string} - The transformed SDP media section
 */
function setSimulcastInMediaSection(section, trackIdsToAttributes) {
  var newTrackIdsToAttributes = createTrackIdsToAttributes(section);
  var newTrackIds = Array.from(newTrackIdsToAttributes.keys());
  var trackIds = Array.from(trackIdsToAttributes.keys());
  var trackIdsToAdd = difference(newTrackIds, trackIds);
  var trackIdsToIgnore = difference(trackIds, newTrackIds);

  // Update "trackIdsToAttributes" with TrackAttributes for new
  // MediaStreamTrack IDs.
  var trackAttributesToAdd = flatMap(trackIdsToAdd, function(trackId) {
    return newTrackIdsToAttributes.get(trackId);
  });
  trackAttributesToAdd.forEach(function(trackAttributes) {
    trackAttributes.addSimulcastSSRCs();
    trackIdsToAttributes.set(trackAttributes.trackId, trackAttributes);
  });

  // Get the SDP lines of the relevant MediaStreamTrack IDs from
  // "trackIdsToAttributes".
  trackIds = Array.from(trackIdsToAttributes.keys());
  var relevantTrackIds = difference(trackIds, trackIdsToIgnore);
  var relevantTrackAttributes = flatMap(relevantTrackIds, function(trackId) {
    return trackIdsToAttributes.get(trackId);
  });
  var relevantSdpLines = flatMap(relevantTrackAttributes, function(trackAttributes) {
    return trackAttributes.toSdpLines();
  });

  // Add the simulcast SSRC SDP lines to the media section. The Set ensures
  // that the duplicates of the SSRC SDP lines that are in both "section" and
  // "relevantSdpLines" are removed.
  var sectionLines = new Set(section.split('\r\n').concat(relevantSdpLines));
  return flatMap(sectionLines).join('\r\n');
}

/**
 * String representing the SSRC of a MediaStreamTrack.
 * @typedef {string} SSRC
 */

/**
 * Primary SSRC.
 * @typedef {SSRC} PrimarySSRC
 */

/**
 * Retransmission SSRC.
 * @typedef {SSRC} RtxSSRC
 */

/**
 * Simulcast SSRC.
 * @typedef {SSRC} SimSSRC
 */

module.exports = setSimulcastInMediaSection;

},{"../":74}],81:[function(require,module,exports){
'use strict';

/**
 * Construct an {@link IdentityTrackMatcher}.
 * @class
 * @classdesc An {@link IdentityTrackMatcher} matches RTCTrackEvents
 *   with their respective MediaStreamTrack IDs.
 */
function IdentityTrackMatcher() {
  if (!(this instanceof IdentityTrackMatcher)) {
    return new IdentityTrackMatcher();
  }
}

/**
 * Match a given MediaStreamTrack with its ID.
 * @param {RTCTrackEvent} event
 * @returns {Track.ID}
 */
IdentityTrackMatcher.prototype.match = function match(event) {
  return event.track.id;
};

/**
 * Update the {@link IdentityTrackMatcher} with a new SDP.
 * @param {string} sdp
 */
IdentityTrackMatcher.prototype.update = function update(/* sdp */) {};

module.exports = IdentityTrackMatcher;

},{}],82:[function(require,module,exports){
'use strict';

var getMediaSections = require('../').getMediaSections;

/**
 * Construct an {@link MIDTrackMatcher}.
 * @class
 * @classdesc An {@link MIDTrackMatcher} matches an RTCTrackEvent with a
 *   MediaStreamTrack ID based on the MID of the underlying RTCRtpTransceiver.
 */
function MIDTrackMatcher() {
  if (!(this instanceof MIDTrackMatcher)) {
    return new MIDTrackMatcher();
  }
  Object.defineProperties(this, {
    _midsToTrackIds: {
      value: new Map(),
      writable: true
    }
  });
}

/**
 * Match a given MediaStreamTrack with its ID.
 * @param {RTCTrackEvent} event
 * @returns {?Track.ID}
 */
MIDTrackMatcher.prototype.match = function match(event) {
  return this._midsToTrackIds.get(event.transceiver.mid) || null;
};

/**
 * Update the {@link MIDTrackMatcher} with a new SDP.
 * @param {string} sdp
 */
MIDTrackMatcher.prototype.update = function update(sdp) {
  var sections = getMediaSections(sdp, '(audio|video)');
  this._midsToTrackIds = sections.reduce(function(midsToTrackIds, section) {
    var midMatches = section.match(/^a=mid:(.+)$/m) || [];
    var trackIdMatches = section.match(/^a=msid:.+ (.+)$/m) || [];
    var mid = midMatches[1];
    var trackId = trackIdMatches[1];
    return mid && trackId ? midsToTrackIds.set(mid, trackId) : midsToTrackIds;
  }, this._midsToTrackIds);
};

module.exports = MIDTrackMatcher;

},{"../":78}],83:[function(require,module,exports){
'use strict';

var util = require('../../');
var getMediaSections = require('../').getMediaSections;

// NOTE(mroberts): OrderedTrackMatcher is meant to solve the problem identified in
//
//   https://bugs.webkit.org/show_bug.cgi?id=174519
//
// Namely that, without MIDs, we cannot "correctly" identify MediaStreamTracks
// in Safari's current WebRTC implementation. So, this module tries to hack
// around this by making a possibly dangerous assumption: "track" events will
// be raised for MediaStreamTracks of a particular kind in the same order that
// those kinds' MSIDs appear in the SDP. By calling `update` with an
// RTCPeerConnection's `remoteDescription` and then invoking `match`, we ought
// to be able to dequeue MediaStreamTrack IDs in the correct order to be
// assigned to "track" events.

/**
 * @interface MatchedAndUnmatched
 * @property {Set<Track.ID>} matched
 * @property {Set<Track.ID>} unmatched
 */

/**
 * Create a new instance of {@link MatchedAndUnmatched}.
 * @returns {MatchedAndUnmatched}
 */
function create() {
  return {
    matched: new Set(),
    unmatched: new Set()
  };
}

/**
 * Attempt to match a MediaStreamTrack ID.
 * @param {MatchedAndUnmatched} mAndM
 * @returns {?Track.ID} id
 */
function match(mAndM) {
  var unmatched = Array.from(mAndM.unmatched);
  if (!unmatched.length) {
    return null;
  }
  var id = unmatched[0];
  mAndM.matched.add(id);
  mAndM.unmatched.delete(id);
  return id;
}

/**
 * Update a {@link MatchedAndUnmatched}'s MediaStreamTrack IDs.
 * @param {MatchedAndUnmatched} mAndM
 * @param {Set<Track.ID>} ids
 * @returns {void}
 */
function update(mAndM, ids) {
  ids = new Set(ids);
  var removedMatchedIds = util.difference(mAndM.matched, ids);
  removedMatchedIds.forEach(mAndM.matched.delete, mAndM.matched);
  mAndM.unmatched = util.difference(ids, mAndM.matched);
}

/**
 * Parse MediaStreamTrack IDs of a particular kind from an SDP.
 * @param {string} kind
 * @param {string} sdp
 * @returns {Set<Track.ID>} ids
 */
function parse(kind, sdp) {
  var mediaSections = getMediaSections(sdp, kind);
  var pattern = 'msid: ?(.+) +(.+) ?$';
  return new Set(util.flatMap(mediaSections, function(mediaSection) {
    return mediaSection.match(new RegExp(pattern, 'mg')) || [];
  }).map(function(msid) {
    return msid.match(new RegExp(pattern))[2];
  }));
}

/**
 * A {@link OrderedTrackMatcher} is used to match RTCTrackEvents.
 * @property {MatchedAndUnmatched} audio
 * @property {MatchedAndUnmatched} video
 */
function OrderedTrackMatcher() {
  if (!(this instanceof OrderedTrackMatcher)) {
    return new OrderedTrackMatcher();
  }
  Object.defineProperties(this, {
    audio: {
      enumerable: true,
      value: create()
    },
    video: {
      enumerable: true,
      value: create()
    }
  });
}

/**
 * Attempt to match a new MediaStreamTrack ID.
 * @param {RTCTrackEvent} event
 * @returns {?Track.ID} id
 */
OrderedTrackMatcher.prototype.match = function(event) {
  return match(this[event.track.kind]);
};

/**
 * Update the {@link OrderedTrackMatcher} with a new SDP.
 * @param {string} sdp
 * @returns {void}
 */
OrderedTrackMatcher.prototype.update = function(sdp) {
  ['audio', 'video'].forEach(function(kind) {
    update(this[kind], parse(kind, sdp));
  }, this);
};

module.exports = OrderedTrackMatcher;

},{"../":78,"../../":74}],84:[function(require,module,exports){
/* globals RTCPeerConnection, webkitRTCPeerConnection, mozRTCPeerConnection, navigator */
'use strict';

var guessBrowser = require('./').guessBrowser;

/**
 * Check whether PeerConnection API is supported.
 * @returns {boolean}
 */
function isRTCPeerConnectionSupported() {
  return typeof RTCPeerConnection !== 'undefined'
    || typeof webkitRTCPeerConnection !== 'undefined'
    || typeof mozRTCPeerConnection !== 'undefined';
}

/**
 * Check whether GetUserMedia API is supported.
 * @returns {boolean}
 */
function isGetUserMediaSupported() {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    || !!(navigator.getUserMedia)
    || !!(navigator.webkitGetUserMedia)
    || !!(navigator.mozGetUserMedia);
}

/**
 * Check if the current environment is supported by the SDK.
 * @returns {boolean}
 */
function isSupported() {
  return !!guessBrowser()
    && isGetUserMediaSupported()
    && isRTCPeerConnectionSupported();
}

module.exports = isSupported;

},{"./":74}],85:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var util = require('./');

/**
 * Construct a new {@link TimeoutPromise}.
 * @class
 * @classdesc A Promise that can time out.
 * @extends Promise
 * @param {Promise} original - a Promise
 * @param {?number} [timeout] - the timeout, in milliseconds; providing this in
 *   the constructor invokes {@link TimeoutPromise#start} (otherwise, you must
 *   call {@link TimeoutPromise#start} yourself)
 * @property {?number} timeout - the timeout, in milliseconds
 * @property {boolean} isTimedOut - whether or not the
 *   {@link TimeoutPromise} timed out
 * @fires TimeoutPromise#timedOut
 */
function TimeoutPromise(original, initialTimeout) {
  if (!(this instanceof TimeoutPromise)) {
    return new TimeoutPromise(original, initialTimeout);
  }
  EventEmitter.call(this);

  var deferred = util.defer();
  var isTimedOut = false;
  var timedOut = new Error('Timed out');
  var timeout = null;
  var timer = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _deferred: {
      value: deferred
    },
    _isTimedOut: {
      get: function() {
        return isTimedOut;
      },
      set: function(_isTimedOut) {
        isTimedOut = _isTimedOut;
      }
    },
    _timedOut: {
      value: timedOut
    },
    _timeout: {
      get: function() {
        return timeout;
      },
      set: function(_timeout) {
        timeout = _timeout;
      }
    },
    _timer: {
      get: function() {
        return timer;
      },
      set: function(_timer) {
        timer = _timer;
      }
    },
    _promise: {
      value: deferred.promise
    },
    isTimedOut: {
      enumerable: true,
      get: function() {
        return isTimedOut;
      }
    },
    timeout: {
      enumerable: true,
      get: function() {
        return timeout;
      }
    }
  });

  var self = this;
  original.then(function originalResolved() {
    clearTimeout(self._timer);
    deferred.resolve.apply(deferred.promise, arguments);
  }, function originalRejected() {
    clearTimeout(self._timer);
    deferred.reject.apply(deferred.promise, arguments);
  });

  if (initialTimeout) {
    this.start(initialTimeout);
  }
}

inherits(TimeoutPromise, EventEmitter);

TimeoutPromise.prototype.catch = function _catch() {
  return this._promise.catch.apply(this._promise, arguments);
};

/**
 * Start the timer that will time out the {@link TimeoutPromise} if the
 * original Promise has neither resolved nor rejected. Subsequent calls have no
 * effect once the {@link TimeoutPromise} is started.
 * @param {number} timeout - the timeout, in milliseconds
 * @returns {this}
 */
TimeoutPromise.prototype.start = function start(timeout) {
  if (this._timer) {
    return this;
  }
  var self = this;
  this._timeout = timeout;
  this._timer = setTimeout(function timer() {
    if (self._timer) {
      self._isTimedOut = true;
      self.emit('timedOut', self);
      self._deferred.reject(self._timedOut);
    }
  }, this.timeout);
  return this;
};

TimeoutPromise.prototype.then = function then() {
  return this._promise.then.apply(this._promise, arguments);
};

/**
 * The {@link TimeoutPromise} timed out.
 * @param {TimeoutPromise} promise - The {@link TimeoutPromise}
 * @event TimeoutPromise#timedOut
 */

module.exports = TimeoutPromise;

},{"./":74,"events":142,"util":146}],86:[function(require,module,exports){
// NOTE: Do not edit this file. This code is auto-generated. Contact the
// Twilio SDK Team for more information.

'use strict';

var inherits = require('util').inherits;
var TwilioError = require('./twilioerror');
var TwilioErrorByCode = {};

/**
 * Create a {@link TwilioError} for a given code and message.
 * @private
 * @param {number} [code] - Error code
 * @param {string} [message] - Error message
 * @returns {TwilioError}
 */
exports.createTwilioError = function createTwilioError(code, message) {
  code = typeof code === 'number' ? code : 0;
  message = typeof message === 'string' && message ? message : 'Unknown error';
  return TwilioErrorByCode[code] ? new TwilioErrorByCode[code]() : new TwilioError(code, message);
};

/**
 * @class AccessTokenInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room is invalid.
 * @extends TwilioError
 * @property {number} code - 20101
 * @property {string} message - 'Invalid Access Token'
 */
function AccessTokenInvalidError() {
  TwilioError.call(this,
    20101,
    'Invalid Access Token'
  );
}
inherits(AccessTokenInvalidError, TwilioError);
exports.AccessTokenInvalidError = AccessTokenInvalidError;
Object.defineProperty(TwilioErrorByCode, 20101, { value: AccessTokenInvalidError });

/**
 * @class AccessTokenHeaderInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room has an invalid header.
 * @extends TwilioError
 * @property {number} code - 20102
 * @property {string} message - 'Invalid Access Token header'
 */
function AccessTokenHeaderInvalidError() {
  TwilioError.call(this,
    20102,
    'Invalid Access Token header'
  );
}
inherits(AccessTokenHeaderInvalidError, TwilioError);
exports.AccessTokenHeaderInvalidError = AccessTokenHeaderInvalidError;
Object.defineProperty(TwilioErrorByCode, 20102, { value: AccessTokenHeaderInvalidError });

/**
 * @class AccessTokenIssuerInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room contains an invalid issuer or subject.
 * @extends TwilioError
 * @property {number} code - 20103
 * @property {string} message - 'Invalid Access Token issuer/subject'
 */
function AccessTokenIssuerInvalidError() {
  TwilioError.call(this,
    20103,
    'Invalid Access Token issuer/subject'
  );
}
inherits(AccessTokenIssuerInvalidError, TwilioError);
exports.AccessTokenIssuerInvalidError = AccessTokenIssuerInvalidError;
Object.defineProperty(TwilioErrorByCode, 20103, { value: AccessTokenIssuerInvalidError });

/**
 * @class AccessTokenExpiredError
 * @classdesc Raised whenever the AccessToken used for connecting to Room has expired.
 * @extends TwilioError
 * @property {number} code - 20104
 * @property {string} message - 'Access Token expired or expiration date invalid'
 */
function AccessTokenExpiredError() {
  TwilioError.call(this,
    20104,
    'Access Token expired or expiration date invalid'
  );
}
inherits(AccessTokenExpiredError, TwilioError);
exports.AccessTokenExpiredError = AccessTokenExpiredError;
Object.defineProperty(TwilioErrorByCode, 20104, { value: AccessTokenExpiredError });

/**
 * @class AccessTokenNotYetValidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room is not yet valid.
 * @extends TwilioError
 * @property {number} code - 20105
 * @property {string} message - 'Access Token not yet valid'
 */
function AccessTokenNotYetValidError() {
  TwilioError.call(this,
    20105,
    'Access Token not yet valid'
  );
}
inherits(AccessTokenNotYetValidError, TwilioError);
exports.AccessTokenNotYetValidError = AccessTokenNotYetValidError;
Object.defineProperty(TwilioErrorByCode, 20105, { value: AccessTokenNotYetValidError });

/**
 * @class AccessTokenGrantsInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room has invalid grants.
 * @extends TwilioError
 * @property {number} code - 20106
 * @property {string} message - 'Invalid Access Token grants'
 */
function AccessTokenGrantsInvalidError() {
  TwilioError.call(this,
    20106,
    'Invalid Access Token grants'
  );
}
inherits(AccessTokenGrantsInvalidError, TwilioError);
exports.AccessTokenGrantsInvalidError = AccessTokenGrantsInvalidError;
Object.defineProperty(TwilioErrorByCode, 20106, { value: AccessTokenGrantsInvalidError });

/**
 * @class AccessTokenSignatureInvalidError
 * @classdesc Raised whenever the AccessToken used for connecting to Room has an invalid signature.
 * @extends TwilioError
 * @property {number} code - 20107
 * @property {string} message - 'Invalid Access Token signature'
 */
function AccessTokenSignatureInvalidError() {
  TwilioError.call(this,
    20107,
    'Invalid Access Token signature'
  );
}
inherits(AccessTokenSignatureInvalidError, TwilioError);
exports.AccessTokenSignatureInvalidError = AccessTokenSignatureInvalidError;
Object.defineProperty(TwilioErrorByCode, 20107, { value: AccessTokenSignatureInvalidError });

/**
 * @class SignalingConnectionError
 * @classdesc Raised whenever a signaling connection error occurs that is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53000
 * @property {string} message - 'Signaling connection error'
 */
function SignalingConnectionError() {
  TwilioError.call(this,
    53000,
    'Signaling connection error'
  );
}
inherits(SignalingConnectionError, TwilioError);
exports.SignalingConnectionError = SignalingConnectionError;
Object.defineProperty(TwilioErrorByCode, 53000, { value: SignalingConnectionError });

/**
 * @class SignalingConnectionDisconnectedError
 * @classdesc Raised whenever the signaling connection is unexpectedly disconnected.
 * @extends TwilioError
 * @property {number} code - 53001
 * @property {string} message - 'Signaling connection disconnected'
 */
function SignalingConnectionDisconnectedError() {
  TwilioError.call(this,
    53001,
    'Signaling connection disconnected'
  );
}
inherits(SignalingConnectionDisconnectedError, TwilioError);
exports.SignalingConnectionDisconnectedError = SignalingConnectionDisconnectedError;
Object.defineProperty(TwilioErrorByCode, 53001, { value: SignalingConnectionDisconnectedError });

/**
 * @class SignalingConnectionTimeoutError
 * @classdesc Raised whenever the signaling connection times out.
 * @extends TwilioError
 * @property {number} code - 53002
 * @property {string} message - 'Signaling connection timed out'
 */
function SignalingConnectionTimeoutError() {
  TwilioError.call(this,
    53002,
    'Signaling connection timed out'
  );
}
inherits(SignalingConnectionTimeoutError, TwilioError);
exports.SignalingConnectionTimeoutError = SignalingConnectionTimeoutError;
Object.defineProperty(TwilioErrorByCode, 53002, { value: SignalingConnectionTimeoutError });

/**
 * @class SignalingIncomingMessageInvalidError
 * @classdesc Raised whenever the Client receives a message from the Server that the Client cannot handle.
 * @extends TwilioError
 * @property {number} code - 53003
 * @property {string} message - 'Client received an invalid signaling message'
 */
function SignalingIncomingMessageInvalidError() {
  TwilioError.call(this,
    53003,
    'Client received an invalid signaling message'
  );
}
inherits(SignalingIncomingMessageInvalidError, TwilioError);
exports.SignalingIncomingMessageInvalidError = SignalingIncomingMessageInvalidError;
Object.defineProperty(TwilioErrorByCode, 53003, { value: SignalingIncomingMessageInvalidError });

/**
 * @class SignalingOutgoingMessageInvalidError
 * @classdesc Raised whenever the Client sends a message to the Server that the Server cannot handle.
 * @extends TwilioError
 * @property {number} code - 53004
 * @property {string} message - 'Client sent an invalid signaling message'
 */
function SignalingOutgoingMessageInvalidError() {
  TwilioError.call(this,
    53004,
    'Client sent an invalid signaling message'
  );
}
inherits(SignalingOutgoingMessageInvalidError, TwilioError);
exports.SignalingOutgoingMessageInvalidError = SignalingOutgoingMessageInvalidError;
Object.defineProperty(TwilioErrorByCode, 53004, { value: SignalingOutgoingMessageInvalidError });

/**
 * @class RoomNameInvalidError
 * @classdesc Raised whenever a Room name is invalid, and the scenario is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53100
 * @property {string} message - 'Room name is invalid'
 */
function RoomNameInvalidError() {
  TwilioError.call(this,
    53100,
    'Room name is invalid'
  );
}
inherits(RoomNameInvalidError, TwilioError);
exports.RoomNameInvalidError = RoomNameInvalidError;
Object.defineProperty(TwilioErrorByCode, 53100, { value: RoomNameInvalidError });

/**
 * @class RoomNameTooLongError
 * @classdesc Raised whenever a Room name is too long.
 * @extends TwilioError
 * @property {number} code - 53101
 * @property {string} message - 'Room name is too long'
 */
function RoomNameTooLongError() {
  TwilioError.call(this,
    53101,
    'Room name is too long'
  );
}
inherits(RoomNameTooLongError, TwilioError);
exports.RoomNameTooLongError = RoomNameTooLongError;
Object.defineProperty(TwilioErrorByCode, 53101, { value: RoomNameTooLongError });

/**
 * @class RoomNameCharsInvalidError
 * @classdesc Raised whenever a Room name contains invalid characters.
 * @extends TwilioError
 * @property {number} code - 53102
 * @property {string} message - 'Room name contains invalid characters'
 */
function RoomNameCharsInvalidError() {
  TwilioError.call(this,
    53102,
    'Room name contains invalid characters'
  );
}
inherits(RoomNameCharsInvalidError, TwilioError);
exports.RoomNameCharsInvalidError = RoomNameCharsInvalidError;
Object.defineProperty(TwilioErrorByCode, 53102, { value: RoomNameCharsInvalidError });

/**
 * @class RoomCreateFailedError
 * @classdesc Raised whenever the Server is unable to create a Room.
 * @extends TwilioError
 * @property {number} code - 53103
 * @property {string} message - 'Unable to create Room'
 */
function RoomCreateFailedError() {
  TwilioError.call(this,
    53103,
    'Unable to create Room'
  );
}
inherits(RoomCreateFailedError, TwilioError);
exports.RoomCreateFailedError = RoomCreateFailedError;
Object.defineProperty(TwilioErrorByCode, 53103, { value: RoomCreateFailedError });

/**
 * @class RoomConnectFailedError
 * @classdesc Raised whenever a Client is unable to connect to a Room, and the scenario is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53104
 * @property {string} message - 'Unable to connect to Room'
 */
function RoomConnectFailedError() {
  TwilioError.call(this,
    53104,
    'Unable to connect to Room'
  );
}
inherits(RoomConnectFailedError, TwilioError);
exports.RoomConnectFailedError = RoomConnectFailedError;
Object.defineProperty(TwilioErrorByCode, 53104, { value: RoomConnectFailedError });

/**
 * @class RoomMaxParticipantsExceededError
 * @classdesc Raised whenever a Client is unable to connect to a Room because the Room contains too many Participants.
 * @extends TwilioError
 * @property {number} code - 53105
 * @property {string} message - 'Room contains too many Participants'
 */
function RoomMaxParticipantsExceededError() {
  TwilioError.call(this,
    53105,
    'Room contains too many Participants'
  );
}
inherits(RoomMaxParticipantsExceededError, TwilioError);
exports.RoomMaxParticipantsExceededError = RoomMaxParticipantsExceededError;
Object.defineProperty(TwilioErrorByCode, 53105, { value: RoomMaxParticipantsExceededError });

/**
 * @class RoomNotFoundError
 * @classdesc Raised whenever attempting operation on a non-existent Room.
 * @extends TwilioError
 * @property {number} code - 53106
 * @property {string} message - 'Room not found'
 */
function RoomNotFoundError() {
  TwilioError.call(this,
    53106,
    'Room not found'
  );
}
inherits(RoomNotFoundError, TwilioError);
exports.RoomNotFoundError = RoomNotFoundError;
Object.defineProperty(TwilioErrorByCode, 53106, { value: RoomNotFoundError });

/**
 * @class RoomMaxParticipantsOutOfRangeError
 * @classdesc Raised in the REST API when MaxParticipants is set out of range.
 * @extends TwilioError
 * @property {number} code - 53107
 * @property {string} message - 'MaxParticipants is out of range'
 */
function RoomMaxParticipantsOutOfRangeError() {
  TwilioError.call(this,
    53107,
    'MaxParticipants is out of range'
  );
}
inherits(RoomMaxParticipantsOutOfRangeError, TwilioError);
exports.RoomMaxParticipantsOutOfRangeError = RoomMaxParticipantsOutOfRangeError;
Object.defineProperty(TwilioErrorByCode, 53107, { value: RoomMaxParticipantsOutOfRangeError });

/**
 * @class RoomTypeInvalidError
 * @classdesc Raised in the REST API when the user attempts to create a Room with an invalid RoomType
 * @extends TwilioError
 * @property {number} code - 53108
 * @property {string} message - 'RoomType is not valid'
 */
function RoomTypeInvalidError() {
  TwilioError.call(this,
    53108,
    'RoomType is not valid'
  );
}
inherits(RoomTypeInvalidError, TwilioError);
exports.RoomTypeInvalidError = RoomTypeInvalidError;
Object.defineProperty(TwilioErrorByCode, 53108, { value: RoomTypeInvalidError });

/**
 * @class RoomTimeoutOutOfRangeError
 * @classdesc Raised in the REST API when Timeout is set out of range.
 * @extends TwilioError
 * @property {number} code - 53109
 * @property {string} message - 'Timeout is out of range'
 */
function RoomTimeoutOutOfRangeError() {
  TwilioError.call(this,
    53109,
    'Timeout is out of range'
  );
}
inherits(RoomTimeoutOutOfRangeError, TwilioError);
exports.RoomTimeoutOutOfRangeError = RoomTimeoutOutOfRangeError;
Object.defineProperty(TwilioErrorByCode, 53109, { value: RoomTimeoutOutOfRangeError });

/**
 * @class RoomStatusCallbackMethodInvalidError
 * @classdesc Raised in the REST API when StatusCallbackMethod is set to an invalid value.
 * @extends TwilioError
 * @property {number} code - 53110
 * @property {string} message - 'StatusCallbackMethod is invalid'
 */
function RoomStatusCallbackMethodInvalidError() {
  TwilioError.call(this,
    53110,
    'StatusCallbackMethod is invalid'
  );
}
inherits(RoomStatusCallbackMethodInvalidError, TwilioError);
exports.RoomStatusCallbackMethodInvalidError = RoomStatusCallbackMethodInvalidError;
Object.defineProperty(TwilioErrorByCode, 53110, { value: RoomStatusCallbackMethodInvalidError });

/**
 * @class RoomStatusCallbackInvalidError
 * @classdesc Raised in the REST API when StatusCallback is not a valid URL or the url is too long.
 * @extends TwilioError
 * @property {number} code - 53111
 * @property {string} message - 'StatusCallback is invalid'
 */
function RoomStatusCallbackInvalidError() {
  TwilioError.call(this,
    53111,
    'StatusCallback is invalid'
  );
}
inherits(RoomStatusCallbackInvalidError, TwilioError);
exports.RoomStatusCallbackInvalidError = RoomStatusCallbackInvalidError;
Object.defineProperty(TwilioErrorByCode, 53111, { value: RoomStatusCallbackInvalidError });

/**
 * @class RoomStatusInvalidError
 * @classdesc Raised in the REST API when Status is not valid or the Room is not in-progress.
 * @extends TwilioError
 * @property {number} code - 53112
 * @property {string} message - 'Status is invalid'
 */
function RoomStatusInvalidError() {
  TwilioError.call(this,
    53112,
    'Status is invalid'
  );
}
inherits(RoomStatusInvalidError, TwilioError);
exports.RoomStatusInvalidError = RoomStatusInvalidError;
Object.defineProperty(TwilioErrorByCode, 53112, { value: RoomStatusInvalidError });

/**
 * @class RoomRoomExistsError
 * @classdesc Raised in the REST API when the Room creation fails because a Room exists with the same name.
 * @extends TwilioError
 * @property {number} code - 53113
 * @property {string} message - 'Room exists'
 */
function RoomRoomExistsError() {
  TwilioError.call(this,
    53113,
    'Room exists'
  );
}
inherits(RoomRoomExistsError, TwilioError);
exports.RoomRoomExistsError = RoomRoomExistsError;
Object.defineProperty(TwilioErrorByCode, 53113, { value: RoomRoomExistsError });

/**
 * @class ParticipantIdentityInvalidError
 * @classdesc Raised whenever a Participant identity is invalid, and the scenario is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53200
 * @property {string} message - 'Participant identity is invalid'
 */
function ParticipantIdentityInvalidError() {
  TwilioError.call(this,
    53200,
    'Participant identity is invalid'
  );
}
inherits(ParticipantIdentityInvalidError, TwilioError);
exports.ParticipantIdentityInvalidError = ParticipantIdentityInvalidError;
Object.defineProperty(TwilioErrorByCode, 53200, { value: ParticipantIdentityInvalidError });

/**
 * @class ParticipantIdentityTooLongError
 * @classdesc Raised whenever a Participant identity is too long.
 * @extends TwilioError
 * @property {number} code - 53201
 * @property {string} message - 'Participant identity is too long'
 */
function ParticipantIdentityTooLongError() {
  TwilioError.call(this,
    53201,
    'Participant identity is too long'
  );
}
inherits(ParticipantIdentityTooLongError, TwilioError);
exports.ParticipantIdentityTooLongError = ParticipantIdentityTooLongError;
Object.defineProperty(TwilioErrorByCode, 53201, { value: ParticipantIdentityTooLongError });

/**
 * @class ParticipantIdentityCharsInvalidError
 * @classdesc Raised whenever a Participant identity contains invalid characters.
 * @extends TwilioError
 * @property {number} code - 53202
 * @property {string} message - 'Participant identity contains invalid characters'
 */
function ParticipantIdentityCharsInvalidError() {
  TwilioError.call(this,
    53202,
    'Participant identity contains invalid characters'
  );
}
inherits(ParticipantIdentityCharsInvalidError, TwilioError);
exports.ParticipantIdentityCharsInvalidError = ParticipantIdentityCharsInvalidError;
Object.defineProperty(TwilioErrorByCode, 53202, { value: ParticipantIdentityCharsInvalidError });

/**
 * @class ParticipantMaxTracksExceededError
 * @classdesc Raised whenever a Participant has too many Tracks.
 * @extends TwilioError
 * @property {number} code - 53203
 * @property {string} message - 'Participant has too many Tracks'
 */
function ParticipantMaxTracksExceededError() {
  TwilioError.call(this,
    53203,
    'Participant has too many Tracks'
  );
}
inherits(ParticipantMaxTracksExceededError, TwilioError);
exports.ParticipantMaxTracksExceededError = ParticipantMaxTracksExceededError;
Object.defineProperty(TwilioErrorByCode, 53203, { value: ParticipantMaxTracksExceededError });

/**
 * @class ParticipantNotFoundError
 * @classdesc Raised whenever attempting operation on a non-existent Participant.
 * @extends TwilioError
 * @property {number} code - 53204
 * @property {string} message - 'Participant not found'
 */
function ParticipantNotFoundError() {
  TwilioError.call(this,
    53204,
    'Participant not found'
  );
}
inherits(ParticipantNotFoundError, TwilioError);
exports.ParticipantNotFoundError = ParticipantNotFoundError;
Object.defineProperty(TwilioErrorByCode, 53204, { value: ParticipantNotFoundError });

/**
 * @class ParticipantDuplicateIdentityError
 * @classdesc Raised by the server to the existing Participant when a new Participant joins a Room with the same identity as the existing Participant.
 * @extends TwilioError
 * @property {number} code - 53205
 * @property {string} message - 'Participant disconnected because of duplicate identity'
 */
function ParticipantDuplicateIdentityError() {
  TwilioError.call(this,
    53205,
    'Participant disconnected because of duplicate identity'
  );
}
inherits(ParticipantDuplicateIdentityError, TwilioError);
exports.ParticipantDuplicateIdentityError = ParticipantDuplicateIdentityError;
Object.defineProperty(TwilioErrorByCode, 53205, { value: ParticipantDuplicateIdentityError });

/**
 * @class TrackInvalidError
 * @classdesc Raised whenever a Track is invalid, and the scenario is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53300
 * @property {string} message - 'Track is invalid'
 */
function TrackInvalidError() {
  TwilioError.call(this,
    53300,
    'Track is invalid'
  );
}
inherits(TrackInvalidError, TwilioError);
exports.TrackInvalidError = TrackInvalidError;
Object.defineProperty(TwilioErrorByCode, 53300, { value: TrackInvalidError });

/**
 * @class TrackNameInvalidError
 * @classdesc Raised whenever a Track name is invalid, and the scenario is not covered by a more specific error code.
 * @extends TwilioError
 * @property {number} code - 53301
 * @property {string} message - 'Track name is invalid'
 */
function TrackNameInvalidError() {
  TwilioError.call(this,
    53301,
    'Track name is invalid'
  );
}
inherits(TrackNameInvalidError, TwilioError);
exports.TrackNameInvalidError = TrackNameInvalidError;
Object.defineProperty(TwilioErrorByCode, 53301, { value: TrackNameInvalidError });

/**
 * @class TrackNameTooLongError
 * @classdesc Raised whenever a Track name is too long.
 * @extends TwilioError
 * @property {number} code - 53302
 * @property {string} message - 'Track name is too long'
 */
function TrackNameTooLongError() {
  TwilioError.call(this,
    53302,
    'Track name is too long'
  );
}
inherits(TrackNameTooLongError, TwilioError);
exports.TrackNameTooLongError = TrackNameTooLongError;
Object.defineProperty(TwilioErrorByCode, 53302, { value: TrackNameTooLongError });

/**
 * @class TrackNameCharsInvalidError
 * @classdesc Raised whenever a Track name contains invalid characters.
 * @extends TwilioError
 * @property {number} code - 53303
 * @property {string} message - 'Track name contains invalid characters'
 */
function TrackNameCharsInvalidError() {
  TwilioError.call(this,
    53303,
    'Track name contains invalid characters'
  );
}
inherits(TrackNameCharsInvalidError, TwilioError);
exports.TrackNameCharsInvalidError = TrackNameCharsInvalidError;
Object.defineProperty(TwilioErrorByCode, 53303, { value: TrackNameCharsInvalidError });

/**
 * @class TrackNameIsDuplicatedError
 * @classdesc Raised whenever a Participant is currently publishing a Track with the same name.
 * @extends TwilioError
 * @property {number} code - 53304
 * @property {string} message - 'Track name is duplicated'
 */
function TrackNameIsDuplicatedError() {
  TwilioError.call(this,
    53304,
    'Track name is duplicated'
  );
}
inherits(TrackNameIsDuplicatedError, TwilioError);
exports.TrackNameIsDuplicatedError = TrackNameIsDuplicatedError;
Object.defineProperty(TwilioErrorByCode, 53304, { value: TrackNameIsDuplicatedError });

/**
 * @class MediaClientLocalDescFailedError
 * @classdesc Raised whenever a Client is unable to create or apply a local media description.
 * @extends TwilioError
 * @property {number} code - 53400
 * @property {string} message - 'Client is unable to create or apply a local media description'
 */
function MediaClientLocalDescFailedError() {
  TwilioError.call(this,
    53400,
    'Client is unable to create or apply a local media description'
  );
}
inherits(MediaClientLocalDescFailedError, TwilioError);
exports.MediaClientLocalDescFailedError = MediaClientLocalDescFailedError;
Object.defineProperty(TwilioErrorByCode, 53400, { value: MediaClientLocalDescFailedError });

/**
 * @class MediaServerLocalDescFailedError
 * @classdesc Raised whenever the Server is unable to create or apply a local media description.
 * @extends TwilioError
 * @property {number} code - 53401
 * @property {string} message - 'Server is unable to create or apply a local media description'
 */
function MediaServerLocalDescFailedError() {
  TwilioError.call(this,
    53401,
    'Server is unable to create or apply a local media description'
  );
}
inherits(MediaServerLocalDescFailedError, TwilioError);
exports.MediaServerLocalDescFailedError = MediaServerLocalDescFailedError;
Object.defineProperty(TwilioErrorByCode, 53401, { value: MediaServerLocalDescFailedError });

/**
 * @class MediaClientRemoteDescFailedError
 * @classdesc Raised whenever the Client receives a remote media description but is unable to apply it.
 * @extends TwilioError
 * @property {number} code - 53402
 * @property {string} message - 'Client is unable to apply a remote media description'
 */
function MediaClientRemoteDescFailedError() {
  TwilioError.call(this,
    53402,
    'Client is unable to apply a remote media description'
  );
}
inherits(MediaClientRemoteDescFailedError, TwilioError);
exports.MediaClientRemoteDescFailedError = MediaClientRemoteDescFailedError;
Object.defineProperty(TwilioErrorByCode, 53402, { value: MediaClientRemoteDescFailedError });

/**
 * @class MediaServerRemoteDescFailedError
 * @classdesc Raised whenever the Server receives a remote media description but is unable to apply it.
 * @extends TwilioError
 * @property {number} code - 53403
 * @property {string} message - 'Server is unable to apply a remote media description'
 */
function MediaServerRemoteDescFailedError() {
  TwilioError.call(this,
    53403,
    'Server is unable to apply a remote media description'
  );
}
inherits(MediaServerRemoteDescFailedError, TwilioError);
exports.MediaServerRemoteDescFailedError = MediaServerRemoteDescFailedError;
Object.defineProperty(TwilioErrorByCode, 53403, { value: MediaServerRemoteDescFailedError });

/**
 * @class MediaNoSupportedCodecError
 * @classdesc Raised whenever the intersection of codecs supported by the Client and the Server (or, in peer-to-peer, the Client and another Participant) is empty.
 * @extends TwilioError
 * @property {number} code - 53404
 * @property {string} message - 'No supported codec'
 */
function MediaNoSupportedCodecError() {
  TwilioError.call(this,
    53404,
    'No supported codec'
  );
}
inherits(MediaNoSupportedCodecError, TwilioError);
exports.MediaNoSupportedCodecError = MediaNoSupportedCodecError;
Object.defineProperty(TwilioErrorByCode, 53404, { value: MediaNoSupportedCodecError });

/**
 * @class MediaConnectionError
 * @classdesc Raised by the Client whenever a media connection fails.
 * @extends TwilioError
 * @property {number} code - 53405
 * @property {string} message - 'Media connection failed'
 */
function MediaConnectionError() {
  TwilioError.call(this,
    53405,
    'Media connection failed'
  );
}
inherits(MediaConnectionError, TwilioError);
exports.MediaConnectionError = MediaConnectionError;
Object.defineProperty(TwilioErrorByCode, 53405, { value: MediaConnectionError });

/**
 * @class ConfigurationAcquireFailedError
 * @classdesc Raised whenever the Client is unable to acquire configuration information from the Server.
 * @extends TwilioError
 * @property {number} code - 53500
 * @property {string} message - 'Unable to acquire configuration'
 */
function ConfigurationAcquireFailedError() {
  TwilioError.call(this,
    53500,
    'Unable to acquire configuration'
  );
}
inherits(ConfigurationAcquireFailedError, TwilioError);
exports.ConfigurationAcquireFailedError = ConfigurationAcquireFailedError;
Object.defineProperty(TwilioErrorByCode, 53500, { value: ConfigurationAcquireFailedError });

/**
 * @class ConfigurationAcquireTurnFailedError
 * @classdesc Raised whenever the Server is unable to return TURN credentials to the Client
 * @extends TwilioError
 * @property {number} code - 53501
 * @property {string} message - 'Unable to acquire TURN credentials'
 */
function ConfigurationAcquireTurnFailedError() {
  TwilioError.call(this,
    53501,
    'Unable to acquire TURN credentials'
  );
}
inherits(ConfigurationAcquireTurnFailedError, TwilioError);
exports.ConfigurationAcquireTurnFailedError = ConfigurationAcquireTurnFailedError;
Object.defineProperty(TwilioErrorByCode, 53501, { value: ConfigurationAcquireTurnFailedError });

},{"./twilioerror":87,"util":146}],87:[function(require,module,exports){
'use strict';

var inherits = require('util').inherits;

/**
 * Creates a new {@link TwilioError}
 * @extends Error
 * @param {number} code - Error code
 * @param {string} [message] - Error message
 * @param {string} [fileName] - Name of the script file where error was generated
 * @param {number} [lineNumber] - Line number of the script file where error was generated
 * @property {number} code - Error code
 * @constructor
 */
function TwilioError(code) {
  var error = Error.apply(this, [].slice.call(arguments, 1));
  error.name = 'TwilioError';

  Object.defineProperty(this, 'code', {
    value: code,
    enumerable: true
  });

  Object.getOwnPropertyNames(error).forEach(function(prop) {
    Object.defineProperty(this, prop, {
      value: error[prop],
      enumerable: true
    });
  }, this);
}

inherits(TwilioError, Error);

/**
 * Returns human readable string describing the error.
 * @returns {string}
 */
TwilioError.prototype.toString = function toString() {
  var message = this.message ? ': ' + this.message : '';
  return this.name + ' ' + this.code + message;
};

module.exports = TwilioError;

},{"util":146}],88:[function(require,module,exports){
/* globals webkitAudioContext, AudioContext */
'use strict';

var NativeAudioContext = typeof AudioContext !== 'undefined'
  ? AudioContext
  : typeof webkitAudioContext !== 'undefined'
    ? webkitAudioContext
    : null;

/**
 * @interface AudioContextFactoryOptions
 * @property {AudioContext} [AudioContext] - The AudioContext constructor
 */

/**
 * {@link AudioContextFactory} ensures we construct at most one AudioContext
 * at a time, and that it is eventually closed when we no longer need it.
 * @param {AudioContextFactoryOptions} [options]
 * @property {AudioContextFactory} AudioContextFactory - The
 *   {@link AudioContextFactory} constructor
 */
function AudioContextFactory(options) {
  options = Object.assign({
    AudioContext: NativeAudioContext
  }, options);
  Object.defineProperties(this, {
    _AudioContext: {
      value: options.AudioContext
    },
    _audioContext: {
      value: null,
      writable: true
    },
    _holders: {
      value: new Set()
    },
    AudioContextFactory: {
      enumerable: true,
      value: AudioContextFactory
    }
  });
}

/**
 * Each call to {@link AudioContextFactory#getOrCreate} should be paired with a
 * call to {@link AudioContextFactory#release}. Calling this increments an
 * internal reference count.
 * @param {*} holder - The object to hold a reference to the AudioContext
 * @returns {?AudioContext}
 */
AudioContextFactory.prototype.getOrCreate = function getOrCreate(holder) {
  if (!this._holders.has(holder)) {
    this._holders.add(holder);
    if (this._AudioContext && !this._audioContext) {
      try {
        this._audioContext = new this._AudioContext();
      } catch (error) {
        // Do nothing;
      }
    }
  }
  return this._audioContext;
};

/**
 * Decrement the internal reference count. If it reaches zero, close and destroy
 * the AudioContext.
 * @param {*} holder - The object that held a reference to the AudioContext
 * @returns {void}
 */
AudioContextFactory.prototype.release = function release(holder) {
  if (this._holders.has(holder)) {
    this._holders.delete(holder);
    if (!this._holders.size && this._audioContext) {
      this._audioContext.close();
      this._audioContext = null;
    }
  }
};

module.exports = new AudioContextFactory();

},{}],89:[function(require,module,exports){
module.exports={
  "_args": [
    [
      {
        "raw": "@twilio/sip.js@^0.7.7",
        "scope": "@twilio",
        "escapedName": "@twilio%2fsip.js",
        "name": "@twilio/sip.js",
        "rawSpec": "^0.7.7",
        "spec": ">=0.7.7 <0.8.0",
        "type": "range"
      },
      "/home/travis/build/twilio/twilio-video.js"
    ]
  ],
  "_from": "@twilio/sip.js@>=0.7.7 <0.8.0",
  "_id": "@twilio/sip.js@0.7.7",
  "_inCache": true,
  "_location": "/@twilio/sip.js",
  "_nodeVersion": "7.10.1",
  "_npmOperationalInternal": {
    "host": "s3://npm-registry-packages",
    "tmp": "tmp/sip.js-0.7.7.tgz_1515514639204_0.5576584048103541"
  },
  "_npmUser": {
    "name": "twilio-ci",
    "email": "mroberts+twilio-ci@twilio.com"
  },
  "_npmVersion": "4.2.0",
  "_phantomChildren": {},
  "_requested": {
    "raw": "@twilio/sip.js@^0.7.7",
    "scope": "@twilio",
    "escapedName": "@twilio%2fsip.js",
    "name": "@twilio/sip.js",
    "rawSpec": "^0.7.7",
    "spec": ">=0.7.7 <0.8.0",
    "type": "range"
  },
  "_requiredBy": [
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/@twilio/sip.js/-/sip.js-0.7.7.tgz",
  "_shasum": "cff50f66f9b295d46f219737b72780c7d0e6df52",
  "_shrinkwrap": null,
  "_spec": "@twilio/sip.js@^0.7.7",
  "_where": "/home/travis/build/twilio/twilio-video.js",
  "author": {
    "name": "OnSIP",
    "email": "developer@onsip.com",
    "url": "http://sipjs.com/authors/"
  },
  "browser": {
    "./src/environment.js": "./src/environment_browser.js"
  },
  "bugs": {
    "url": "https://github.com/onsip/SIP.js/issues"
  },
  "contributors": [
    {
      "url": "https://github.com/onsip/SIP.js/blob/master/THANKS.md"
    }
  ],
  "dependencies": {},
  "description": "A simple, intuitive, and powerful JavaScript signaling library",
  "devDependencies": {
    "beefy": "^2.1.5",
    "browserify": "^4.1.8",
    "grunt": "~0.4.0",
    "grunt-browserify": "^4.0.1",
    "grunt-cli": "~0.1.6",
    "grunt-contrib-copy": "^0.5.0",
    "grunt-contrib-jasmine": "^1.0.3",
    "grunt-contrib-jshint": ">0.5.0",
    "grunt-contrib-uglify": "~0.2.0",
    "grunt-peg": "~1.3.1",
    "grunt-trimtrailingspaces": "^0.4.0",
    "pegjs": "^0.8.0",
    "release-tool": "^0.2.2"
  },
  "directories": {},
  "dist": {
    "shasum": "cff50f66f9b295d46f219737b72780c7d0e6df52",
    "tarball": "https://registry.npmjs.org/@twilio/sip.js/-/sip.js-0.7.7.tgz"
  },
  "engines": {
    "node": ">=0.12"
  },
  "gitHead": "8aa75d3444f37a4974df3fc63106543b38d386f0",
  "homepage": "http://sipjs.com",
  "keywords": [
    "sip",
    "websocket",
    "webrtc",
    "library",
    "javascript"
  ],
  "license": "MIT",
  "main": "src/index.js",
  "maintainers": [
    {
      "name": "twilio-ci",
      "email": "mroberts+twilio-ci@twilio.com"
    }
  ],
  "name": "@twilio/sip.js",
  "optionalDependencies": {},
  "readme": "ERROR: No README data found!",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/onsip/SIP.js.git"
  },
  "scripts": {
    "build": "grunt build",
    "repl": "beefy test/repl.js --open",
    "test": "grunt travis --verbose"
  },
  "title": "SIP.js",
  "version": "0.7.7"
}

},{}],90:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {
var ClientContext;

ClientContext = function (ua, method, target, options) {
  var originalTarget = target;

  // Validate arguments
  if (target === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.ua = ua;
  this.logger = ua.getLogger('sip.clientcontext');
  this.method = method;
  target = ua.normalizeTarget(target);
  if (!target) {
    throw new TypeError('Invalid target: ' + originalTarget);
  }

  /* Options
   * - extraHeaders
   * - params
   * - contentType
   * - body
   */
  options = Object.create(options || Object.prototype);
  options.extraHeaders = (options.extraHeaders || []).slice();

  // Build the request
  this.request = new SIP.OutgoingRequest(this.method,
                                         target,
                                         this.ua,
                                         options.params,
                                         options.extraHeaders);
  if (options.body) {
    this.body = {};
    this.body.body = options.body;
    if (options.contentType) {
      this.body.contentType = options.contentType;
    }
    this.request.body = this.body;
  }

  /* Set other properties from the request */
  this.localIdentity = this.request.from;
  this.remoteIdentity = this.request.to;

  this.data = {};
};
ClientContext.prototype = Object.create(SIP.EventEmitter.prototype);

ClientContext.prototype.send = function () {
  (new SIP.RequestSender(this, this.ua)).send();
  return this;
};

ClientContext.prototype.cancel = function (options) {
  options = options || {};

  options.extraHeaders = (options.extraHeaders || []).slice();

  var cancel_reason = SIP.Utils.getCancelReason(options.status_code, options.reason_phrase);
  this.request.cancel(cancel_reason, options.extraHeaders);

  this.emit('cancel');
};

ClientContext.prototype.receiveResponse = function (response) {
  var cause = SIP.Utils.getReasonPhrase(response.status_code);

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      this.emit('progress', response, cause);
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      if(this.ua.applicants[this]) {
        delete this.ua.applicants[this];
      }
      this.emit('accepted', response, cause);
      break;

    default:
      if(this.ua.applicants[this]) {
        delete this.ua.applicants[this];
      }
      this.emit('rejected', response, cause);
      this.emit('failed', response, cause);
      break;
  }

};

ClientContext.prototype.onRequestTimeout = function () {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
};

ClientContext.prototype.onTransportError = function () {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
};

SIP.ClientContext = ClientContext;
};

},{}],91:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Constants
 */

/**
 * SIP Constants.
 * @augments SIP
 */

module.exports = function (name, version) {
return {
  USER_AGENT: name +'/'+ version,

  // SIP scheme
  SIP:  'sip',
  SIPS: 'sips',

  // End and Failure causes
  causes: {
    // Generic error causes
    CONNECTION_ERROR:         'Connection Error',
    REQUEST_TIMEOUT:          'Request Timeout',
    SIP_FAILURE_CODE:         'SIP Failure Code',
    INTERNAL_ERROR:           'Internal Error',

    // SIP error causes
    BUSY:                     'Busy',
    REJECTED:                 'Rejected',
    REDIRECTED:               'Redirected',
    UNAVAILABLE:              'Unavailable',
    NOT_FOUND:                'Not Found',
    ADDRESS_INCOMPLETE:       'Address Incomplete',
    INCOMPATIBLE_SDP:         'Incompatible SDP',
    AUTHENTICATION_ERROR:     'Authentication Error',
    DIALOG_ERROR:             'Dialog Error',

    // Session error causes
    WEBRTC_NOT_SUPPORTED:     'WebRTC Not Supported',
    WEBRTC_ERROR:             'WebRTC Error',
    CANCELED:                 'Canceled',
    NO_ANSWER:                'No Answer',
    EXPIRES:                  'Expires',
    NO_ACK:                   'No ACK',
    NO_PRACK:                 'No PRACK',
    USER_DENIED_MEDIA_ACCESS: 'User Denied Media Access',
    BAD_MEDIA_DESCRIPTION:    'Bad Media Description',
    RTP_TIMEOUT:              'RTP Timeout'
  },

  supported: {
    UNSUPPORTED:        'none',
    SUPPORTED:          'supported',
    REQUIRED:           'required'
  },

  SIP_ERROR_CAUSES: {
    REDIRECTED: [300,301,302,305,380],
    BUSY: [486,600],
    REJECTED: [403,603],
    NOT_FOUND: [404,604],
    UNAVAILABLE: [480,410,408,430],
    ADDRESS_INCOMPLETE: [484],
    INCOMPATIBLE_SDP: [488,606],
    AUTHENTICATION_ERROR:[401,407]
  },

  // SIP Methods
  ACK:        'ACK',
  BYE:        'BYE',
  CANCEL:     'CANCEL',
  INFO:       'INFO',
  INVITE:     'INVITE',
  MESSAGE:    'MESSAGE',
  NOTIFY:     'NOTIFY',
  OPTIONS:    'OPTIONS',
  REGISTER:   'REGISTER',
  UPDATE:     'UPDATE',
  SUBSCRIBE:  'SUBSCRIBE',
  REFER:      'REFER',
  PRACK:      'PRACK',

  /* SIP Response Reasons
   * DOC: http://www.iana.org/assignments/sip-parameters
   * Copied from https://github.com/versatica/OverSIP/blob/master/lib/oversip/sip/constants.rb#L7
   */
  REASON_PHRASE: {
    100: 'Trying',
    180: 'Ringing',
    181: 'Call Is Being Forwarded',
    182: 'Queued',
    183: 'Session Progress',
    199: 'Early Dialog Terminated',  // draft-ietf-sipcore-199
    200: 'OK',
    202: 'Accepted',  // RFC 3265
    204: 'No Notification',  //RFC 5839
    300: 'Multiple Choices',
    301: 'Moved Permanently',
    302: 'Moved Temporarily',
    305: 'Use Proxy',
    380: 'Alternative Service',
    400: 'Bad Request',
    401: 'Unauthorized',
    402: 'Payment Required',
    403: 'Forbidden',
    404: 'Not Found',
    405: 'Method Not Allowed',
    406: 'Not Acceptable',
    407: 'Proxy Authentication Required',
    408: 'Request Timeout',
    410: 'Gone',
    412: 'Conditional Request Failed',  // RFC 3903
    413: 'Request Entity Too Large',
    414: 'Request-URI Too Long',
    415: 'Unsupported Media Type',
    416: 'Unsupported URI Scheme',
    417: 'Unknown Resource-Priority',  // RFC 4412
    420: 'Bad Extension',
    421: 'Extension Required',
    422: 'Session Interval Too Small',  // RFC 4028
    423: 'Interval Too Brief',
    428: 'Use Identity Header',  // RFC 4474
    429: 'Provide Referrer Identity',  // RFC 3892
    430: 'Flow Failed',  // RFC 5626
    433: 'Anonymity Disallowed',  // RFC 5079
    436: 'Bad Identity-Info',  // RFC 4474
    437: 'Unsupported Certificate',  // RFC 4744
    438: 'Invalid Identity Header',  // RFC 4744
    439: 'First Hop Lacks Outbound Support',  // RFC 5626
    440: 'Max-Breadth Exceeded',  // RFC 5393
    469: 'Bad Info Package',  // draft-ietf-sipcore-info-events
    470: 'Consent Needed',  // RFC 5360
    478: 'Unresolvable Destination',  // Custom code copied from Kamailio.
    480: 'Temporarily Unavailable',
    481: 'Call/Transaction Does Not Exist',
    482: 'Loop Detected',
    483: 'Too Many Hops',
    484: 'Address Incomplete',
    485: 'Ambiguous',
    486: 'Busy Here',
    487: 'Request Terminated',
    488: 'Not Acceptable Here',
    489: 'Bad Event',  // RFC 3265
    491: 'Request Pending',
    493: 'Undecipherable',
    494: 'Security Agreement Required',  // RFC 3329
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Server Time-out',
    505: 'Version Not Supported',
    513: 'Message Too Large',
    580: 'Precondition Failure',  // RFC 3312
    600: 'Busy Everywhere',
    603: 'Decline',
    604: 'Does Not Exist Anywhere',
    606: 'Not Acceptable'
  },

  /* SIP Option Tags
   * DOC: http://www.iana.org/assignments/sip-parameters/sip-parameters.xhtml#sip-parameters-4
   */
  OPTION_TAGS: {
    '100rel':                   true,  // RFC 3262
    199:                        true,  // RFC 6228
    answermode:                 true,  // RFC 5373
    'early-session':            true,  // RFC 3959
    eventlist:                  true,  // RFC 4662
    explicitsub:                true,  // RFC-ietf-sipcore-refer-explicit-subscription-03
    'from-change':              true,  // RFC 4916
    'geolocation-http':         true,  // RFC 6442
    'geolocation-sip':          true,  // RFC 6442
    gin:                        true,  // RFC 6140
    gruu:                       true,  // RFC 5627
    histinfo:                   true,  // RFC 7044
    ice:                        true,  // RFC 5768
    join:                       true,  // RFC 3911
    'multiple-refer':           true,  // RFC 5368
    norefersub:                 true,  // RFC 4488
    nosub:                      true,  // RFC-ietf-sipcore-refer-explicit-subscription-03
    outbound:                   true,  // RFC 5626
    path:                       true,  // RFC 3327
    policy:                     true,  // RFC 6794
    precondition:               true,  // RFC 3312
    pref:                       true,  // RFC 3840
    privacy:                    true,  // RFC 3323
    'recipient-list-invite':    true,  // RFC 5366
    'recipient-list-message':   true,  // RFC 5365
    'recipient-list-subscribe': true,  // RFC 5367
    replaces:                   true,  // RFC 3891
    'resource-priority':        true,  // RFC 4412
    'sdp-anat':                 true,  // RFC 4092
    'sec-agree':                true,  // RFC 3329
    tdialog:                    true,  // RFC 4538
    timer:                      true,  // RFC 4028
    uui:                        true   // RFC 7433
  }
};
};

},{}],92:[function(require,module,exports){
"use strict";

/**
 * @fileoverview In-Dialog Request Sender
 */

/**
 * @augments SIP.Dialog
 * @class Class creating an In-dialog request sender.
 * @param {SIP.Dialog} dialog
 * @param {Object} applicant
 * @param {SIP.OutgoingRequest} request
 */
/**
 * @fileoverview in-Dialog Request Sender
 */

module.exports = function (SIP) {
var RequestSender;

RequestSender = function(dialog, applicant, request) {

  this.dialog = dialog;
  this.applicant = applicant;
  this.request = request;

  // RFC3261 14.1 Modifying an Existing Session. UAC Behavior.
  this.reattempt = false;
  this.reattemptTimer = null;
};

RequestSender.prototype = {
  send: function() {
    var self = this,
      request_sender = new SIP.RequestSender(this, this.dialog.owner.ua);

      request_sender.send();

    // RFC3261 14.2 Modifying an Existing Session -UAC BEHAVIOR-
    if (this.request.method === SIP.C.INVITE && request_sender.clientTransaction.state !== SIP.Transactions.C.STATUS_TERMINATED) {
      this.dialog.uac_pending_reply = true;
      request_sender.clientTransaction.on('stateChanged', function stateChanged(){
        if (this.state === SIP.Transactions.C.STATUS_ACCEPTED ||
            this.state === SIP.Transactions.C.STATUS_COMPLETED ||
            this.state === SIP.Transactions.C.STATUS_TERMINATED) {

          this.removeListener('stateChanged', stateChanged);
          self.dialog.uac_pending_reply = false;

          if (self.dialog.uas_pending_reply === false) {
            self.dialog.owner.onReadyToReinvite();
          }
        }
      });
    }
  },

  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  onTransportError: function() {
    this.applicant.onTransportError();
  },

  receiveResponse: function(response) {
    var self = this;

    // RFC3261 12.2.1.2 408 or 481 is received for a request within a dialog.
    if (response.status_code === 408 || response.status_code === 481) {
      this.applicant.onDialogError(response);
    } else if (response.method === SIP.C.INVITE && response.status_code === 491) {
      if (this.reattempt) {
        this.applicant.receiveResponse(response);
      } else {
        this.request.cseq.value = this.dialog.local_seqnum += 1;
        this.reattemptTimer = SIP.Timers.setTimeout(
          function() {
            if (self.applicant.owner.status !== SIP.Session.C.STATUS_TERMINATED) {
              self.reattempt = true;
              self.request_sender.send();
            }
          },
          this.getReattemptTimeout()
        );
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

return RequestSender;
};

},{}],93:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Dialog
 */

/**
 * @augments SIP
 * @class Class creating a SIP dialog.
 * @param {SIP.RTCSession} owner
 * @param {SIP.IncomingRequest|SIP.IncomingResponse} message
 * @param {Enum} type UAC / UAS
 * @param {Enum} state SIP.Dialog.C.STATUS_EARLY / SIP.Dialog.C.STATUS_CONFIRMED
 */
module.exports = function (SIP) {

var RequestSender = require('./Dialog/RequestSender')(SIP);

var Dialog,
  C = {
    // Dialog states
    STATUS_EARLY:       1,
    STATUS_CONFIRMED:   2
  };

// RFC 3261 12.1
Dialog = function(owner, message, type, state) {
  var contact;

  this.uac_pending_reply = false;
  this.uas_pending_reply = false;

  if(!message.hasHeader('contact')) {
    return {
      error: 'unable to create a Dialog without Contact header field'
    };
  }

  if(message instanceof SIP.IncomingResponse) {
    state = (message.status_code < 200) ? C.STATUS_EARLY : C.STATUS_CONFIRMED;
  } else {
    // Create confirmed dialog if state is not defined
    state = state || C.STATUS_CONFIRMED;
  }

  contact = message.parseHeader('contact');

  // RFC 3261 12.1.1
  if(type === 'UAS') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.to_tag,
      remote_tag: message.from_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.remote_seqnum = message.cseq;
    this.local_uri = message.parseHeader('to').uri;
    this.remote_uri = message.parseHeader('from').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route');
    this.invite_seqnum = message.cseq;
    this.local_seqnum = message.cseq;
  }
  // RFC 3261 12.1.2
  else if(type === 'UAC') {
    this.id = {
      call_id: message.call_id,
      local_tag: message.from_tag,
      remote_tag: message.to_tag,
      toString: function() {
        return this.call_id + this.local_tag + this.remote_tag;
      }
    };
    this.state = state;
    this.invite_seqnum = message.cseq;
    this.local_seqnum = message.cseq;
    this.local_uri = message.parseHeader('from').uri;
    this.pracked = [];
    this.remote_uri = message.parseHeader('to').uri;
    this.remote_target = contact.uri;
    this.route_set = message.getHeaders('record-route').reverse();

    //RENDERBODY
    if (this.state === C.STATUS_EARLY && (!owner.hasOffer)) {
      this.mediaHandler = owner.mediaHandlerFactory(owner);
    }
  }

  this.logger = owner.ua.getLogger('sip.dialog', this.id.toString());
  this.owner = owner;
  owner.ua.dialogs[this.id.toString()] = this;
  this.logger.log('new ' + type + ' dialog created with status ' + (this.state === C.STATUS_EARLY ? 'EARLY': 'CONFIRMED'));
  owner.emit('dialog', this);
};

Dialog.prototype = {
  /**
   * @param {SIP.IncomingMessage} message
   * @param {Enum} UAC/UAS
   */
  update: function(message, type) {
    this.state = C.STATUS_CONFIRMED;

    this.logger.log('dialog '+ this.id.toString() +'  changed to CONFIRMED state');

    if(type === 'UAC') {
      // RFC 3261 13.2.2.4
      this.route_set = message.getHeaders('record-route').reverse();
    }
  },

  terminate: function() {
    this.logger.log('dialog ' + this.id.toString() + ' deleted');
    if (this.mediaHandler && this.state !== C.STATUS_CONFIRMED) {
      this.mediaHandler.peerConnection.close();
    }
    delete this.owner.ua.dialogs[this.id.toString()];
  },

  /**
  * @param {String} method request method
  * @param {Object} extraHeaders extra headers
  * @returns {SIP.OutgoingRequest}
  */

  // RFC 3261 12.2.1.1
  createRequest: function(method, extraHeaders, body) {
    var cseq, request;
    extraHeaders = (extraHeaders || []).slice();

    if(!this.local_seqnum) { this.local_seqnum = Math.floor(Math.random() * 10000); }

    cseq = (method === SIP.C.CANCEL || method === SIP.C.ACK) ? this.invite_seqnum : this.local_seqnum += 1;

    request = new SIP.OutgoingRequest(
      method,
      this.remote_target,
      this.owner.ua, {
        'cseq': cseq,
        'call_id': this.id.call_id,
        'from_uri': this.local_uri,
        'from_tag': this.id.local_tag,
        'to_uri': this.remote_uri,
        'to_tag': this.id.remote_tag,
        'route_set': this.route_set
      }, extraHeaders, body);

    request.dialog = this;

    return request;
  },

  /**
  * @param {SIP.IncomingRequest} request
  * @returns {Boolean}
  */

  // RFC 3261 12.2.2
  checkInDialogRequest: function(request) {
    var self = this;

    if(!this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    } else if(request.cseq < this.remote_seqnum) {
        //Do not try to reply to an ACK request.
        if (request.method !== SIP.C.ACK) {
          request.reply(500);
        }
        if (request.cseq === this.invite_seqnum) {
          return true;
        }
        return false;
    } else if(request.cseq > this.remote_seqnum) {
      this.remote_seqnum = request.cseq;
    }

    switch(request.method) {
      // RFC3261 14.2 Modifying an Existing Session -UAS BEHAVIOR-
      case SIP.C.INVITE:
        if (this.uac_pending_reply === true) {
          request.reply(491);
        } else if (this.uas_pending_reply === true) {
          var retryAfter = (Math.random() * 10 | 0) + 1;
          request.reply(500, null, ['Retry-After:' + retryAfter]);
          return false;
        } else {
          this.uas_pending_reply = true;
          request.server_transaction.on('stateChanged', function stateChanged(){
            if (this.state === SIP.Transactions.C.STATUS_ACCEPTED ||
                this.state === SIP.Transactions.C.STATUS_COMPLETED ||
                this.state === SIP.Transactions.C.STATUS_TERMINATED) {

              this.removeListener('stateChanged', stateChanged);
              self.uas_pending_reply = false;

              if (self.uac_pending_reply === false) {
                self.owner.onReadyToReinvite();
              }
            }
          });
        }

        // RFC3261 12.2.2 Replace the dialog`s remote target URI if the request is accepted
        if(request.hasHeader('contact')) {
          request.server_transaction.on('stateChanged', function(){
            if (this.state === SIP.Transactions.C.STATUS_ACCEPTED) {
              self.remote_target = request.parseHeader('contact').uri;
            }
          });
        }
        break;
      case SIP.C.NOTIFY:
        // RFC6665 3.2 Replace the dialog`s remote target URI if the request is accepted
        if(request.hasHeader('contact')) {
          request.server_transaction.on('stateChanged', function(){
            if (this.state === SIP.Transactions.C.STATUS_COMPLETED) {
              self.remote_target = request.parseHeader('contact').uri;
            }
          });
        }
        break;
    }

    return true;
  },

  sendRequest: function(applicant, method, options) {
    options = options || {};

    var extraHeaders = (options.extraHeaders || []).slice();

    var body = null;
    if (options.body) {
      if (options.body.body) {
        body = options.body;
      } else {
        body = {};
        body.body = options.body;
        if (options.contentType) {
          body.contentType = options.contentType;
        }
      }
    }

    var request = this.createRequest(method, extraHeaders, body),
      request_sender = new RequestSender(this, applicant, request);

    request_sender.send();

    return request;
  },

  /**
  * @param {SIP.IncomingRequest} request
  */
  receiveRequest: function(request) {
    //Check in-dialog request
    if(!this.checkInDialogRequest(request)) {
      return;
    }

    this.owner.receiveRequest(request);
  }
};

Dialog.C = C;
SIP.Dialog = Dialog;
};

},{"./Dialog/RequestSender":92}],94:[function(require,module,exports){
"use strict";

/**
 * @fileoverview SIP Digest Authentication
 */

/**
 * SIP Digest Authentication.
 * @augments SIP.
 * @function Digest Authentication
 * @param {SIP.UA} ua
 */
module.exports = function (Utils) {
var DigestAuthentication;

DigestAuthentication = function(ua) {
  this.logger = ua.getLogger('sipjs.digestauthentication');
  this.username = ua.configuration.authorizationUser;
  this.password = ua.configuration.password;
  this.cnonce = null;
  this.nc = 0;
  this.ncHex = '00000000';
  this.response = null;
};


/**
* Performs Digest authentication given a SIP request and the challenge
* received in a response to that request.
* Returns true if credentials were successfully generated, false otherwise.
*
* @param {SIP.OutgoingRequest} request
* @param {Object} challenge
*/
DigestAuthentication.prototype.authenticate = function(request, challenge) {
  // Inspect and validate the challenge.

  this.algorithm = challenge.algorithm;
  this.realm = challenge.realm;
  this.nonce = challenge.nonce;
  this.opaque = challenge.opaque;
  this.stale = challenge.stale;

  if (this.algorithm) {
    if (this.algorithm !== 'MD5') {
      this.logger.warn('challenge with Digest algorithm different than "MD5", authentication aborted');
      return false;
    }
  } else {
    this.algorithm = 'MD5';
  }

  if (! this.realm) {
    this.logger.warn('challenge without Digest realm, authentication aborted');
    return false;
  }

  if (! this.nonce) {
    this.logger.warn('challenge without Digest nonce, authentication aborted');
    return false;
  }

  // 'qop' can contain a list of values (Array). Let's choose just one.
  if (challenge.qop) {
    if (challenge.qop.indexOf('auth') > -1) {
      this.qop = 'auth';
    } else if (challenge.qop.indexOf('auth-int') > -1) {
      this.qop = 'auth-int';
    } else {
      // Otherwise 'qop' is present but does not contain 'auth' or 'auth-int', so abort here.
      this.logger.warn('challenge without Digest qop different than "auth" or "auth-int", authentication aborted');
      return false;
    }
  } else {
    this.qop = null;
  }

  // Fill other attributes.

  this.method = request.method;
  this.uri = request.ruri;
  this.cnonce = Utils.createRandomToken(12);
  this.nc += 1;
  this.updateNcHex();

  // nc-value = 8LHEX. Max value = 'FFFFFFFF'.
  if (this.nc === 4294967296) {
    this.nc = 1;
    this.ncHex = '00000001';
  }

  // Calculate the Digest "response" value.
  this.calculateResponse();

  return true;
};


/**
* Generate Digest 'response' value.
* @private
*/
DigestAuthentication.prototype.calculateResponse = function() {
  var ha1, ha2;

  // HA1 = MD5(A1) = MD5(username:realm:password)
  ha1 = Utils.calculateMD5(this.username + ":" + this.realm + ":" + this.password);

  if (this.qop === 'auth') {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth:" + ha2);

  } else if (this.qop === 'auth-int') {
    // HA2 = MD5(A2) = MD5(method:digestURI:MD5(entityBody))
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri + ":" + Utils.calculateMD5(this.body ? this.body : ""));
    // response = MD5(HA1:nonce:nonceCount:credentialsNonce:qop:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + this.ncHex + ":" + this.cnonce + ":auth-int:" + ha2);

  } else if (this.qop === null) {
    // HA2 = MD5(A2) = MD5(method:digestURI)
    ha2 = Utils.calculateMD5(this.method + ":" + this.uri);
    // response = MD5(HA1:nonce:HA2)
    this.response = Utils.calculateMD5(ha1 + ":" + this.nonce + ":" + ha2);
  }
};


/**
* Return the Proxy-Authorization or WWW-Authorization header value.
*/
DigestAuthentication.prototype.toString = function() {
  var auth_params = [];

  if (! this.response) {
    throw new Error('response field does not exist, cannot generate Authorization header');
  }

  auth_params.push('algorithm=' + this.algorithm);
  auth_params.push('username="' + this.username + '"');
  auth_params.push('realm="' + this.realm + '"');
  auth_params.push('nonce="' + this.nonce + '"');
  auth_params.push('uri="' + this.uri + '"');
  auth_params.push('response="' + this.response + '"');
  if (this.opaque) {
    auth_params.push('opaque="' + this.opaque + '"');
  }
  if (this.qop) {
    auth_params.push('qop=' + this.qop);
    auth_params.push('cnonce="' + this.cnonce + '"');
    auth_params.push('nc=' + this.ncHex);
  }

  return 'Digest ' + auth_params.join(', ');
};


/**
* Generate the 'nc' value as required by Digest in this.ncHex by reading this.nc.
* @private
*/
DigestAuthentication.prototype.updateNcHex = function() {
  var hex = Number(this.nc).toString(16);
  this.ncHex = '00000000'.substr(0, 8-hex.length) + hex;
};

return DigestAuthentication;
};

},{}],95:[function(require,module,exports){
"use strict";
var NodeEventEmitter = require('events').EventEmitter;

module.exports = function (console) {

// Don't use `new SIP.EventEmitter()` for inheriting.
// Use Object.create(SIP.EventEmitter.prototoype);
function EventEmitter () {
  NodeEventEmitter.call(this);
}

EventEmitter.prototype = Object.create(NodeEventEmitter.prototype, {
  constructor: {
    value: EventEmitter,
    enumerable: false,
    writable: true,
    configurable: true
  }
});

EventEmitter.prototype.off = function off (eventName, listener) {
  var warning = '';
  warning += 'SIP.EventEmitter#off is deprecated and may be removed in future SIP.js versions.\n';
  warning += 'Please use removeListener or removeAllListeners instead.\n';
  warning += 'See here for more details:\n';
  warning += 'http://nodejs.org/api/events.html#events_emitter_removelistener_event_listener';
  console.warn(warning);

  if (arguments.length < 2) {
    return this.removeAllListeners.apply(this, arguments);
  } else {
    return this.removeListener(eventName, listener);
  }
};

return EventEmitter;

};

},{"events":142}],96:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Exceptions
 */

/**
 * SIP Exceptions.
 * @augments SIP
 */
module.exports = {
  ConfigurationError: (function(){
    var exception = function(parameter, value) {
      this.code = 1;
      this.name = 'CONFIGURATION_ERROR';
      this.parameter = parameter;
      this.value = value;
      this.message = (!this.value)? 'Missing parameter: '+ this.parameter : 'Invalid value '+ JSON.stringify(this.value) +' for parameter "'+ this.parameter +'"';
    };
    exception.prototype = new Error();
    return exception;
  }()),

  InvalidStateError: (function(){
    var exception = function(status) {
      this.code = 2;
      this.name = 'INVALID_STATE_ERROR';
      this.status = status;
      this.message = 'Invalid status: ' + status;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  NotSupportedError: (function(){
    var exception = function(message) {
      this.code = 3;
      this.name = 'NOT_SUPPORTED_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }()),

  GetDescriptionError: (function(){
    var exception = function(message) {
      this.code = 4;
      this.name = 'GET_DESCRIPTION_ERROR';
      this.message = message;
    };
    exception.prototype = new Error();
    return exception;
  }())
};

},{}],97:[function(require,module,exports){
"use strict";
var Grammar = require('./Grammar/dist/Grammar');

module.exports = function (SIP) {

return {
  parse: function parseCustom (input, startRule) {
    var options = {startRule: startRule, SIP: SIP};
    try {
      Grammar.parse(input, options);
    } catch (e) {
      options.data = -1;
    }
    return options.data;
  }
};

};

},{"./Grammar/dist/Grammar":98}],98:[function(require,module,exports){
module.exports = (function() {
  /*
   * Generated by PEG.js 0.8.0.
   *
   * http://pegjs.majda.cz/
   */

  function peg$subclass(child, parent) {
    function ctor() { this.constructor = child; }
    ctor.prototype = parent.prototype;
    child.prototype = new ctor();
  }

  function SyntaxError(message, expected, found, offset, line, column) {
    this.message  = message;
    this.expected = expected;
    this.found    = found;
    this.offset   = offset;
    this.line     = line;
    this.column   = column;

    this.name     = "SyntaxError";
  }

  peg$subclass(SyntaxError, Error);

  function parse(input) {
    var options = arguments.length > 1 ? arguments[1] : {},

        peg$FAILED = {},

        peg$startRuleIndices = { Contact: 118, Name_Addr_Header: 155, Record_Route: 175, Request_Response: 81, SIP_URI: 45, Subscription_State: 185, Supported: 190, Require: 181, Via: 193, absoluteURI: 84, Call_ID: 117, Content_Disposition: 129, Content_Length: 134, Content_Type: 135, CSeq: 145, displayName: 121, Event: 148, From: 150, host: 52, Max_Forwards: 153, Min_SE: 212, Proxy_Authenticate: 156, quoted_string: 40, Refer_To: 177, Replaces: 178, Session_Expires: 209, stun_URI: 216, To: 191, turn_URI: 223, uuid: 226, WWW_Authenticate: 208, challenge: 157 },
        peg$startRuleIndex   = 118,

        peg$consts = [
          "\r\n",
          { type: "literal", value: "\r\n", description: "\"\\r\\n\"" },
          /^[0-9]/,
          { type: "class", value: "[0-9]", description: "[0-9]" },
          /^[a-zA-Z]/,
          { type: "class", value: "[a-zA-Z]", description: "[a-zA-Z]" },
          /^[0-9a-fA-F]/,
          { type: "class", value: "[0-9a-fA-F]", description: "[0-9a-fA-F]" },
          /^[\0-\xFF]/,
          { type: "class", value: "[\\0-\\xFF]", description: "[\\0-\\xFF]" },
          /^["]/,
          { type: "class", value: "[\"]", description: "[\"]" },
          " ",
          { type: "literal", value: " ", description: "\" \"" },
          "\t",
          { type: "literal", value: "\t", description: "\"\\t\"" },
          /^[a-zA-Z0-9]/,
          { type: "class", value: "[a-zA-Z0-9]", description: "[a-zA-Z0-9]" },
          ";",
          { type: "literal", value: ";", description: "\";\"" },
          "/",
          { type: "literal", value: "/", description: "\"/\"" },
          "?",
          { type: "literal", value: "?", description: "\"?\"" },
          ":",
          { type: "literal", value: ":", description: "\":\"" },
          "@",
          { type: "literal", value: "@", description: "\"@\"" },
          "&",
          { type: "literal", value: "&", description: "\"&\"" },
          "=",
          { type: "literal", value: "=", description: "\"=\"" },
          "+",
          { type: "literal", value: "+", description: "\"+\"" },
          "$",
          { type: "literal", value: "$", description: "\"$\"" },
          ",",
          { type: "literal", value: ",", description: "\",\"" },
          "-",
          { type: "literal", value: "-", description: "\"-\"" },
          "_",
          { type: "literal", value: "_", description: "\"_\"" },
          ".",
          { type: "literal", value: ".", description: "\".\"" },
          "!",
          { type: "literal", value: "!", description: "\"!\"" },
          "~",
          { type: "literal", value: "~", description: "\"~\"" },
          "*",
          { type: "literal", value: "*", description: "\"*\"" },
          "'",
          { type: "literal", value: "'", description: "\"'\"" },
          "(",
          { type: "literal", value: "(", description: "\"(\"" },
          ")",
          { type: "literal", value: ")", description: "\")\"" },
          peg$FAILED,
          "%",
          { type: "literal", value: "%", description: "\"%\"" },
          null,
          [],
          function() {return " "; },
          function() {return ':'; },
          /^[!-~]/,
          { type: "class", value: "[!-~]", description: "[!-~]" },
          /^[\x80-\uFFFF]/,
          { type: "class", value: "[\\x80-\\uFFFF]", description: "[\\x80-\\uFFFF]" },
          /^[\x80-\xBF]/,
          { type: "class", value: "[\\x80-\\xBF]", description: "[\\x80-\\xBF]" },
          /^[a-f]/,
          { type: "class", value: "[a-f]", description: "[a-f]" },
          "`",
          { type: "literal", value: "`", description: "\"`\"" },
          "<",
          { type: "literal", value: "<", description: "\"<\"" },
          ">",
          { type: "literal", value: ">", description: "\">\"" },
          "\\",
          { type: "literal", value: "\\", description: "\"\\\\\"" },
          "[",
          { type: "literal", value: "[", description: "\"[\"" },
          "]",
          { type: "literal", value: "]", description: "\"]\"" },
          "{",
          { type: "literal", value: "{", description: "\"{\"" },
          "}",
          { type: "literal", value: "}", description: "\"}\"" },
          function() {return "*"; },
          function() {return "/"; },
          function() {return "="; },
          function() {return "("; },
          function() {return ")"; },
          function() {return ">"; },
          function() {return "<"; },
          function() {return ","; },
          function() {return ";"; },
          function() {return ":"; },
          function() {return "\""; },
          /^[!-']/,
          { type: "class", value: "[!-']", description: "[!-']" },
          /^[*-[]/,
          { type: "class", value: "[*-[]", description: "[*-[]" },
          /^[\]-~]/,
          { type: "class", value: "[\\]-~]", description: "[\\]-~]" },
          function(contents) {
                                  return contents; },
          /^[#-[]/,
          { type: "class", value: "[#-[]", description: "[#-[]" },
          /^[\0-\t]/,
          { type: "class", value: "[\\0-\\t]", description: "[\\0-\\t]" },
          /^[\x0B-\f]/,
          { type: "class", value: "[\\x0B-\\f]", description: "[\\x0B-\\f]" },
          /^[\x0E-]/,
          { type: "class", value: "[\\x0E-]", description: "[\\x0E-]" },
          function() {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                },
          function() {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port, options.data.uri_params, options.data.uri_headers);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                  delete options.data.uri_params;

                                  if (options.startRule === 'SIP_URI') { options.data = options.data.uri;}
                                },
          "sips",
          { type: "literal", value: "sips", description: "\"sips\"" },
          "sip",
          { type: "literal", value: "sip", description: "\"sip\"" },
          function(uri_scheme) {
                              options.data.scheme = uri_scheme; },
          function() {
                              options.data.user = decodeURIComponent(text().slice(0, -1));},
          function() {
                              options.data.password = text(); },
          function() {
                              options.data.host = text();
                              return options.data.host; },
          function() {
                            options.data.host_type = 'domain';
                            return text(); },
          /^[a-zA-Z0-9_\-]/,
          { type: "class", value: "[a-zA-Z0-9_\\-]", description: "[a-zA-Z0-9_\\-]" },
          /^[a-zA-Z0-9\-]/,
          { type: "class", value: "[a-zA-Z0-9\\-]", description: "[a-zA-Z0-9\\-]" },
          function() {
                              options.data.host_type = 'IPv6';
                              return text(); },
          "::",
          { type: "literal", value: "::", description: "\"::\"" },
          function() {
                            options.data.host_type = 'IPv6';
                            return text(); },
          function() {
                              options.data.host_type = 'IPv4';
                              return text(); },
          "25",
          { type: "literal", value: "25", description: "\"25\"" },
          /^[0-5]/,
          { type: "class", value: "[0-5]", description: "[0-5]" },
          "2",
          { type: "literal", value: "2", description: "\"2\"" },
          /^[0-4]/,
          { type: "class", value: "[0-4]", description: "[0-4]" },
          "1",
          { type: "literal", value: "1", description: "\"1\"" },
          /^[1-9]/,
          { type: "class", value: "[1-9]", description: "[1-9]" },
          function(port) {
                              port = parseInt(port.join(''));
                              options.data.port = port;
                              return port; },
          "transport=",
          { type: "literal", value: "transport=", description: "\"transport=\"" },
          "udp",
          { type: "literal", value: "udp", description: "\"udp\"" },
          "tcp",
          { type: "literal", value: "tcp", description: "\"tcp\"" },
          "sctp",
          { type: "literal", value: "sctp", description: "\"sctp\"" },
          "tls",
          { type: "literal", value: "tls", description: "\"tls\"" },
          function(transport) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['transport'] = transport.toLowerCase(); },
          "user=",
          { type: "literal", value: "user=", description: "\"user=\"" },
          "phone",
          { type: "literal", value: "phone", description: "\"phone\"" },
          "ip",
          { type: "literal", value: "ip", description: "\"ip\"" },
          function(user) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['user'] = user.toLowerCase(); },
          "method=",
          { type: "literal", value: "method=", description: "\"method=\"" },
          function(method) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['method'] = method; },
          "ttl=",
          { type: "literal", value: "ttl=", description: "\"ttl=\"" },
          function(ttl) {
                                if(!options.data.params) options.data.params={};
                                options.data.params['ttl'] = ttl; },
          "maddr=",
          { type: "literal", value: "maddr=", description: "\"maddr=\"" },
          function(maddr) {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['maddr'] = maddr; },
          "lr",
          { type: "literal", value: "lr", description: "\"lr\"" },
          function() {
                                if(!options.data.uri_params) options.data.uri_params={};
                                options.data.uri_params['lr'] = undefined; },
          function(param, value) {
                                if(!options.data.uri_params) options.data.uri_params = {};
                                if (value === null){
                                  value = undefined;
                                }
                                else {
                                  value = value[1];
                                }
                                options.data.uri_params[param.toLowerCase()] = value && value.toLowerCase();},
          function(hname, hvalue) {
                                hname = hname.join('').toLowerCase();
                                hvalue = hvalue.join('');
                                if(!options.data.uri_headers) options.data.uri_headers = {};
                                if (!options.data.uri_headers[hname]) {
                                  options.data.uri_headers[hname] = [hvalue];
                                } else {
                                  options.data.uri_headers[hname].push(hvalue);
                                }},
          function() {
                                // lots of tests fail if this isn't guarded...
                                if (options.startRule === 'Refer_To') {
                                  options.data.uri = new options.SIP.URI(options.data.scheme, options.data.user, options.data.host, options.data.port, options.data.uri_params, options.data.uri_headers);
                                  delete options.data.scheme;
                                  delete options.data.user;
                                  delete options.data.host;
                                  delete options.data.host_type;
                                  delete options.data.port;
                                  delete options.data.uri_params;
                                }
                              },
          "//",
          { type: "literal", value: "//", description: "\"//\"" },
          function() {
                              options.data.scheme= text(); },
          { type: "literal", value: "SIP", description: "\"SIP\"" },
          function() {
                              options.data.sip_version = text(); },
          "INVITE",
          { type: "literal", value: "INVITE", description: "\"INVITE\"" },
          "ACK",
          { type: "literal", value: "ACK", description: "\"ACK\"" },
          "VXACH",
          { type: "literal", value: "VXACH", description: "\"VXACH\"" },
          "OPTIONS",
          { type: "literal", value: "OPTIONS", description: "\"OPTIONS\"" },
          "BYE",
          { type: "literal", value: "BYE", description: "\"BYE\"" },
          "CANCEL",
          { type: "literal", value: "CANCEL", description: "\"CANCEL\"" },
          "REGISTER",
          { type: "literal", value: "REGISTER", description: "\"REGISTER\"" },
          "SUBSCRIBE",
          { type: "literal", value: "SUBSCRIBE", description: "\"SUBSCRIBE\"" },
          "NOTIFY",
          { type: "literal", value: "NOTIFY", description: "\"NOTIFY\"" },
          "REFER",
          { type: "literal", value: "REFER", description: "\"REFER\"" },
          function() {

                              options.data.method = text();
                              return options.data.method; },
          function(status_code) {
                            options.data.status_code = parseInt(status_code.join('')); },
          function() {
                            options.data.reason_phrase = text(); },
          function() {
                        options.data = text(); },
          function() {
                                  var idx, length;
                                  length = options.data.multi_header.length;
                                  for (idx = 0; idx < length; idx++) {
                                    if (options.data.multi_header[idx].parsed === null) {
                                      options.data = null;
                                      break;
                                    }
                                  }
                                  if (options.data !== null) {
                                    options.data = options.data.multi_header;
                                  } else {
                                    options.data = -1;
                                  }},
          function() {
                                  var header;
                                  if(!options.data.multi_header) options.data.multi_header = [];
                                  try {
                                    header = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                                    delete options.data.uri;
                                    delete options.data.displayName;
                                    delete options.data.params;
                                  } catch(e) {
                                    header = null;
                                  }
                                  options.data.multi_header.push( { 'position': peg$currPos,
                                                            'offset': offset(),
                                                            'parsed': header
                                                          });},
          function(displayName) {
                                  displayName = text().trim();
                                  if (displayName[0] === '\"') {
                                    displayName = displayName.substring(1, displayName.length-1);
                                  }
                                  options.data.displayName = displayName; },
          "q",
          { type: "literal", value: "q", description: "\"q\"" },
          function(q) {
                                  if(!options.data.params) options.data.params = {};
                                  options.data.params['q'] = q; },
          "expires",
          { type: "literal", value: "expires", description: "\"expires\"" },
          function(expires) {
                                  if(!options.data.params) options.data.params = {};
                                  options.data.params['expires'] = expires; },
          function(delta_seconds) {
                                  return parseInt(delta_seconds.join('')); },
          "0",
          { type: "literal", value: "0", description: "\"0\"" },
          function() {
                                  return parseFloat(text()); },
          function(param, value) {
                                  if(!options.data.params) options.data.params = {};
                                  if (value === null){
                                    value = undefined;
                                  }
                                  else {
                                    value = value[1];
                                  }
                                  options.data.params[param.toLowerCase()] = value;},
          "render",
          { type: "literal", value: "render", description: "\"render\"" },
          "session",
          { type: "literal", value: "session", description: "\"session\"" },
          "icon",
          { type: "literal", value: "icon", description: "\"icon\"" },
          "alert",
          { type: "literal", value: "alert", description: "\"alert\"" },
          function() {
                                      if (options.startRule === 'Content_Disposition') {
                                        options.data.type = text().toLowerCase();
                                      }
                                    },
          "handling",
          { type: "literal", value: "handling", description: "\"handling\"" },
          "optional",
          { type: "literal", value: "optional", description: "\"optional\"" },
          "required",
          { type: "literal", value: "required", description: "\"required\"" },
          function(length) {
                                  options.data = parseInt(length.join('')); },
          function() {
                                  options.data = text(); },
          "text",
          { type: "literal", value: "text", description: "\"text\"" },
          "image",
          { type: "literal", value: "image", description: "\"image\"" },
          "audio",
          { type: "literal", value: "audio", description: "\"audio\"" },
          "video",
          { type: "literal", value: "video", description: "\"video\"" },
          "application",
          { type: "literal", value: "application", description: "\"application\"" },
          "message",
          { type: "literal", value: "message", description: "\"message\"" },
          "multipart",
          { type: "literal", value: "multipart", description: "\"multipart\"" },
          "x-",
          { type: "literal", value: "x-", description: "\"x-\"" },
          function(cseq_value) {
                            options.data.value=parseInt(cseq_value.join('')); },
          function(expires) {options.data = expires; },
          function(event_type) {
                                 options.data.event = event_type.toLowerCase(); },
          function() {
                          var tag = options.data.tag;
                            options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                            if (tag) {options.data.setParam('tag',tag)}
                          },
          "tag",
          { type: "literal", value: "tag", description: "\"tag\"" },
          function(tag) {options.data.tag = tag; },
          function(forwards) {
                            options.data = parseInt(forwards.join('')); },
          function(min_expires) {options.data = min_expires; },
          function() {
                                  options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                                },
          "digest",
          { type: "literal", value: "Digest", description: "\"Digest\"" },
          "realm",
          { type: "literal", value: "realm", description: "\"realm\"" },
          function(realm) { options.data.realm = realm; },
          "domain",
          { type: "literal", value: "domain", description: "\"domain\"" },
          "nonce",
          { type: "literal", value: "nonce", description: "\"nonce\"" },
          function(nonce) { options.data.nonce=nonce; },
          "opaque",
          { type: "literal", value: "opaque", description: "\"opaque\"" },
          function(opaque) { options.data.opaque=opaque; },
          "stale",
          { type: "literal", value: "stale", description: "\"stale\"" },
          "true",
          { type: "literal", value: "true", description: "\"true\"" },
          function() { options.data.stale=true; },
          "false",
          { type: "literal", value: "false", description: "\"false\"" },
          function() { options.data.stale=false; },
          "algorithm",
          { type: "literal", value: "algorithm", description: "\"algorithm\"" },
          "md5",
          { type: "literal", value: "MD5", description: "\"MD5\"" },
          "md5-sess",
          { type: "literal", value: "MD5-sess", description: "\"MD5-sess\"" },
          function(algorithm) {
                                options.data.algorithm=algorithm.toUpperCase(); },
          "qop",
          { type: "literal", value: "qop", description: "\"qop\"" },
          "auth-int",
          { type: "literal", value: "auth-int", description: "\"auth-int\"" },
          "auth",
          { type: "literal", value: "auth", description: "\"auth\"" },
          function(qop_value) {
                                  options.data.qop || (options.data.qop=[]);
                                  options.data.qop.push(qop_value.toLowerCase()); },
          function(rack_value) {
                            options.data.value=parseInt(rack_value.join('')); },
          function() {
                            var idx, length;
                            length = options.data.multi_header.length;
                            for (idx = 0; idx < length; idx++) {
                              if (options.data.multi_header[idx].parsed === null) {
                                options.data = null;
                                break;
                              }
                            }
                            if (options.data !== null) {
                              options.data = options.data.multi_header;
                            } else {
                              options.data = -1;
                            }},
          function() {
                            var header;
                            if(!options.data.multi_header) options.data.multi_header = [];
                            try {
                              header = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                              delete options.data.uri;
                              delete options.data.displayName;
                              delete options.data.params;
                            } catch(e) {
                              header = null;
                            }
                            options.data.multi_header.push( { 'position': peg$currPos,
                                                      'offset': offset(),
                                                      'parsed': header
                                                    });},
          function() {
                        options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                      },
          function() {
                                if (!(options.data.replaces_from_tag && options.data.replaces_to_tag)) {
                                  options.data = -1;
                                }
                              },
          function() {
                                options.data = {
                                  call_id: options.data
                                };
                              },
          "from-tag",
          { type: "literal", value: "from-tag", description: "\"from-tag\"" },
          function(from_tag) {
                                options.data.replaces_from_tag = from_tag;
                              },
          "to-tag",
          { type: "literal", value: "to-tag", description: "\"to-tag\"" },
          function(to_tag) {
                                options.data.replaces_to_tag = to_tag;
                              },
          "early-only",
          { type: "literal", value: "early-only", description: "\"early-only\"" },
          function() {
                                options.data.early_only = true;
                              },
          function(r) {return r;},
          function(first, rest) { return list(first, rest); },
          function(value) {
                          if (options.startRule === 'Require') {
                            options.data = value || [];
                          }
                        },
          function(rseq_value) {
                            options.data.value=parseInt(rseq_value.join('')); },
          "active",
          { type: "literal", value: "active", description: "\"active\"" },
          "pending",
          { type: "literal", value: "pending", description: "\"pending\"" },
          "terminated",
          { type: "literal", value: "terminated", description: "\"terminated\"" },
          function() {
                                  options.data.state = text(); },
          "reason",
          { type: "literal", value: "reason", description: "\"reason\"" },
          function(reason) {
                                  if (typeof reason !== 'undefined') options.data.reason = reason; },
          function(expires) {
                                  if (typeof expires !== 'undefined') options.data.expires = expires; },
          "retry_after",
          { type: "literal", value: "retry_after", description: "\"retry_after\"" },
          function(retry_after) {
                                  if (typeof retry_after !== 'undefined') options.data.retry_after = retry_after; },
          "deactivated",
          { type: "literal", value: "deactivated", description: "\"deactivated\"" },
          "probation",
          { type: "literal", value: "probation", description: "\"probation\"" },
          "rejected",
          { type: "literal", value: "rejected", description: "\"rejected\"" },
          "timeout",
          { type: "literal", value: "timeout", description: "\"timeout\"" },
          "giveup",
          { type: "literal", value: "giveup", description: "\"giveup\"" },
          "noresource",
          { type: "literal", value: "noresource", description: "\"noresource\"" },
          "invariant",
          { type: "literal", value: "invariant", description: "\"invariant\"" },
          function(value) {
                          if (options.startRule === 'Supported') {
                            options.data = value || [];
                          }
                        },
          function() {
                        var tag = options.data.tag;
                          options.data = new options.SIP.NameAddrHeader(options.data.uri, options.data.displayName, options.data.params);
                          if (tag) {options.data.setParam('tag',tag)}
                        },
          "ttl",
          { type: "literal", value: "ttl", description: "\"ttl\"" },
          function(via_ttl_value) {
                                options.data.ttl = via_ttl_value; },
          "maddr",
          { type: "literal", value: "maddr", description: "\"maddr\"" },
          function(via_maddr) {
                                options.data.maddr = via_maddr; },
          "received",
          { type: "literal", value: "received", description: "\"received\"" },
          function(via_received) {
                                options.data.received = via_received; },
          "branch",
          { type: "literal", value: "branch", description: "\"branch\"" },
          function(via_branch) {
                                options.data.branch = via_branch; },
          "rport",
          { type: "literal", value: "rport", description: "\"rport\"" },
          function() {
                                if(typeof response_port !== 'undefined')
                                  options.data.rport = response_port.join(''); },
          function(via_protocol) {
                                options.data.protocol = via_protocol; },
          { type: "literal", value: "UDP", description: "\"UDP\"" },
          { type: "literal", value: "TCP", description: "\"TCP\"" },
          { type: "literal", value: "TLS", description: "\"TLS\"" },
          { type: "literal", value: "SCTP", description: "\"SCTP\"" },
          function(via_transport) {
                                options.data.transport = via_transport; },
          function() {
                                options.data.host = text(); },
          function(via_sent_by_port) {
                                options.data.port = parseInt(via_sent_by_port.join('')); },
          function(ttl) {
                                return parseInt(ttl.join('')); },
          function(deltaSeconds) {
                                if (options.startRule === 'Session_Expires') {
                                  options.data.deltaSeconds = deltaSeconds;
                                }
                              },
          "refresher",
          { type: "literal", value: "refresher", description: "\"refresher\"" },
          "uas",
          { type: "literal", value: "uas", description: "\"uas\"" },
          "uac",
          { type: "literal", value: "uac", description: "\"uac\"" },
          function(endpoint) {
                                if (options.startRule === 'Session_Expires') {
                                  options.data.refresher = endpoint;
                                }
                              },
          function(deltaSeconds) {
                                if (options.startRule === 'Min_SE') {
                                  options.data = deltaSeconds;
                                }
                              },
          "stuns",
          { type: "literal", value: "stuns", description: "\"stuns\"" },
          "stun",
          { type: "literal", value: "stun", description: "\"stun\"" },
          function(scheme) {
                                options.data.scheme = scheme; },
          function(host) {
                                options.data.host = host; },
          "?transport=",
          { type: "literal", value: "?transport=", description: "\"?transport=\"" },
          "turns",
          { type: "literal", value: "turns", description: "\"turns\"" },
          "turn",
          { type: "literal", value: "turn", description: "\"turn\"" },
          function() {
                                options.data.transport = transport; },
          function() {
                            options.data = text(); }
        ],

        peg$bytecode = [
          peg$decode(". \"\"2 3!"),
          peg$decode("0\"\"\"1!3#"),
          peg$decode("0$\"\"1!3%"),
          peg$decode("0&\"\"1!3'"),
          peg$decode("7'*# \"7("),
          peg$decode("0(\"\"1!3)"),
          peg$decode("0*\"\"1!3+"),
          peg$decode(".,\"\"2,3-"),
          peg$decode("..\"\"2.3/"),
          peg$decode("00\"\"1!31"),
          peg$decode(".2\"\"2233*\x89 \".4\"\"2435*} \".6\"\"2637*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("7)*# \"7,"),
          peg$decode(".F\"\"2F3G*} \".H\"\"2H3I*q \".J\"\"2J3K*e \".L\"\"2L3M*Y \".N\"\"2N3O*M \".P\"\"2P3Q*A \".R\"\"2R3S*5 \".T\"\"2T3U*) \".V\"\"2V3W"),
          peg$decode("!!.Y\"\"2Y3Z+7$7#+-%7#+#%'#%$## X$\"# X\"# X+! (%"),
          peg$decode("!! \\7$,#&7$\"+-$7 +#%'\"%$\"# X\"# X*# \" [+@$ \\7$+&$,#&7$\"\"\" X+'%4\"6]\" %$\"# X\"# X"),
          peg$decode("7.*# \" ["),
          peg$decode("! \\7'*# \"7(,)&7'*# \"7(\"+A$.8\"\"2839+1%7/+'%4#6^# %$## X$\"# X\"# X"),
          peg$decode("!! \\72+&$,#&72\"\"\" X+o$ \\! \\7.,#&7.\"+-$72+#%'\"%$\"# X\"# X,@&! \\7.,#&7.\"+-$72+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+! (%"),
          peg$decode("0_\"\"1!3`*# \"73"),
          peg$decode("0a\"\"1!3b"),
          peg$decode("0c\"\"1!3d"),
          peg$decode("7!*) \"0e\"\"1!3f"),
          peg$decode("! \\7)*\x95 \".F\"\"2F3G*\x89 \".J\"\"2J3K*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O+\x9E$,\x9B&7)*\x95 \".F\"\"2F3G*\x89 \".J\"\"2J3K*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O\"\"\" X+! (%"),
          peg$decode("! \\7)*\x89 \".F\"\"2F3G*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O+\x92$,\x8F&7)*\x89 \".F\"\"2F3G*} \".L\"\"2L3M*q \".Y\"\"2Y3Z*e \".P\"\"2P3Q*Y \".H\"\"2H3I*M \".@\"\"2@3A*A \".g\"\"2g3h*5 \".R\"\"2R3S*) \".N\"\"2N3O\"\"\" X+! (%"),
          peg$decode(".T\"\"2T3U*\xE3 \".V\"\"2V3W*\xD7 \".i\"\"2i3j*\xCB \".k\"\"2k3l*\xBF \".:\"\"2:3;*\xB3 \".D\"\"2D3E*\xA7 \".2\"\"2233*\x9B \".8\"\"2839*\x8F \".m\"\"2m3n*\x83 \"7&*} \".4\"\"2435*q \".o\"\"2o3p*e \".q\"\"2q3r*Y \".6\"\"2637*M \".>\"\"2>3?*A \".s\"\"2s3t*5 \".u\"\"2u3v*) \"7'*# \"7("),
          peg$decode("! \\7)*\u012B \".F\"\"2F3G*\u011F \".J\"\"2J3K*\u0113 \".L\"\"2L3M*\u0107 \".Y\"\"2Y3Z*\xFB \".P\"\"2P3Q*\xEF \".H\"\"2H3I*\xE3 \".@\"\"2@3A*\xD7 \".g\"\"2g3h*\xCB \".R\"\"2R3S*\xBF \".N\"\"2N3O*\xB3 \".T\"\"2T3U*\xA7 \".V\"\"2V3W*\x9B \".i\"\"2i3j*\x8F \".k\"\"2k3l*\x83 \".8\"\"2839*w \".m\"\"2m3n*k \"7&*e \".4\"\"2435*Y \".o\"\"2o3p*M \".q\"\"2q3r*A \".6\"\"2637*5 \".s\"\"2s3t*) \".u\"\"2u3v+\u0134$,\u0131&7)*\u012B \".F\"\"2F3G*\u011F \".J\"\"2J3K*\u0113 \".L\"\"2L3M*\u0107 \".Y\"\"2Y3Z*\xFB \".P\"\"2P3Q*\xEF \".H\"\"2H3I*\xE3 \".@\"\"2@3A*\xD7 \".g\"\"2g3h*\xCB \".R\"\"2R3S*\xBF \".N\"\"2N3O*\xB3 \".T\"\"2T3U*\xA7 \".V\"\"2V3W*\x9B \".i\"\"2i3j*\x8F \".k\"\"2k3l*\x83 \".8\"\"2839*w \".m\"\"2m3n*k \"7&*e \".4\"\"2435*Y \".o\"\"2o3p*M \".q\"\"2q3r*A \".6\"\"2637*5 \".s\"\"2s3t*) \".u\"\"2u3v\"\"\" X+! (%"),
          peg$decode("!7/+A$.P\"\"2P3Q+1%7/+'%4#6w# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.4\"\"2435+1%7/+'%4#6x# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.>\"\"2>3?+1%7/+'%4#6y# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.T\"\"2T3U+1%7/+'%4#6z# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.V\"\"2V3W+1%7/+'%4#6{# %$## X$\"# X\"# X"),
          peg$decode("!.k\"\"2k3l+1$7/+'%4\"6|\" %$\"# X\"# X"),
          peg$decode("!7/+7$.i\"\"2i3j+'%4\"6}\" %$\"# X\"# X"),
          peg$decode("!7/+A$.D\"\"2D3E+1%7/+'%4#6~# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.2\"\"2233+1%7/+'%4#6# %$## X$\"# X\"# X"),
          peg$decode("!7/+A$.8\"\"2839+1%7/+'%4#6\x80# %$## X$\"# X\"# X"),
          peg$decode("!7/+1$7&+'%4\"6\x81\" %$\"# X\"# X"),
          peg$decode("!7&+1$7/+'%4\"6\x81\" %$\"# X\"# X"),
          peg$decode("!7=+W$ \\7G*) \"7K*# \"7F,/&7G*) \"7K*# \"7F\"+-%7>+#%'#%$## X$\"# X\"# X"),
          peg$decode("0\x82\"\"1!3\x83*A \"0\x84\"\"1!3\x85*5 \"0\x86\"\"1!3\x87*) \"73*# \"7."),
          peg$decode("!!7/+U$7&+K% \\7J*# \"7K,)&7J*# \"7K\"+-%7&+#%'$%$$# X$## X$\"# X\"# X+! (%"),
          peg$decode("!7/+`$7&+V%! \\7J*# \"7K,)&7J*# \"7K\"+! (%+2%7&+(%4$6\x88$!!%$$# X$## X$\"# X\"# X"),
          peg$decode("7.*G \".L\"\"2L3M*; \"0\x89\"\"1!3\x8A*/ \"0\x86\"\"1!3\x87*# \"73"),
          peg$decode("!.m\"\"2m3n+K$0\x8B\"\"1!3\x8C*5 \"0\x8D\"\"1!3\x8E*) \"0\x8F\"\"1!3\x90+#%'\"%$\"# X\"# X"),
          peg$decode("!7N+Q$.8\"\"2839+A%7O*# \" [+1%7S+'%4$6\x91$ %$$# X$## X$\"# X\"# X"),
          peg$decode("!7N+k$.8\"\"2839+[%7O*# \" [+K%7S+A%7_+7%7l*# \" [+'%4&6\x92& %$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\x93\"\"1$3\x94*) \"/\x95\"\"1#3\x96+' 4!6\x97!! %"),
          peg$decode("!7P+b$!.8\"\"2839+-$7R+#%'\"%$\"# X\"# X*# \" [+7%.:\"\"2:3;+'%4#6\x98# %$## X$\"# X\"# X"),
          peg$decode(" \\7+*) \"7-*# \"7Q+2$,/&7+*) \"7-*# \"7Q\"\"\" X"),
          peg$decode(".<\"\"2<3=*q \".>\"\"2>3?*e \".@\"\"2@3A*Y \".B\"\"2B3C*M \".D\"\"2D3E*A \".2\"\"2233*5 \".6\"\"2637*) \".4\"\"2435"),
          peg$decode("! \\7+*_ \"7-*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E,e&7+*_ \"7-*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E\"+& 4!6\x99! %"),
          peg$decode("!7T+N$!.8\"\"2839+-$7^+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7U*) \"7\\*# \"7X+& 4!6\x9A! %"),
          peg$decode("! \\!7V+3$.J\"\"2J3K+#%'\"%$\"# X\"# X,>&!7V+3$.J\"\"2J3K+#%'\"%$\"# X\"# X\"+G$7W+=%.J\"\"2J3K*# \" [+'%4#6\x9B# %$## X$\"# X\"# X"),
          peg$decode(" \\0\x9C\"\"1!3\x9D+,$,)&0\x9C\"\"1!3\x9D\"\"\" X"),
          peg$decode("!0$\"\"1!3%+A$ \\0\x9E\"\"1!3\x9F,)&0\x9E\"\"1!3\x9F\"+#%'\"%$\"# X\"# X"),
          peg$decode("!.o\"\"2o3p+A$7Y+7%.q\"\"2q3r+'%4#6\xA0# %$## X$\"# X\"# X"),
          peg$decode("!!7Z+\xBF$.8\"\"2839+\xAF%7Z+\xA5%.8\"\"2839+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'-%$-# X$,# X$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0838 \"!.\xA1\"\"2\xA13\xA2+\xAF$7Z+\xA5%.8\"\"2839+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%',%$,# X$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0795 \"!.\xA1\"\"2\xA13\xA2+\x95$7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'*%$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u070C \"!.\xA1\"\"2\xA13\xA2+{$7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u069D \"!.\xA1\"\"2\xA13\xA2+a$7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'&%$&# X$%# X$$# X$## X$\"# X\"# X*\u0648 \"!.\xA1\"\"2\xA13\xA2+G$7Z+=%.8\"\"2839+-%7[+#%'$%$$# X$## X$\"# X\"# X*\u060D \"!.\xA1\"\"2\xA13\xA2+-$7[+#%'\"%$\"# X\"# X*\u05EC \"!.\xA1\"\"2\xA13\xA2+-$7Z+#%'\"%$\"# X\"# X*\u05CB \"!7Z+\xA5$.\xA1\"\"2\xA13\xA2+\x95%7Z+\x8B%.8\"\"2839+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'+%$+# X$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0538 \"!7Z+\xB6$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x8B%.\xA1\"\"2\xA13\xA2+{%7Z+q%.8\"\"2839+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%'*%$*# X$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0494 \"!7Z+\xC7$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x9C%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+q%.\xA1\"\"2\xA13\xA2+a%7Z+W%.8\"\"2839+G%7Z+=%.8\"\"2839+-%7[+#%')%$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u03DF \"!7Z+\xD8$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xAD%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x82%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+W%.\xA1\"\"2\xA13\xA2+G%7Z+=%.8\"\"2839+-%7[+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0319 \"!7Z+\xE9$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xBE%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x93%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+h%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+=%.\xA1\"\"2\xA13\xA2+-%7[+#%''%$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0242 \"!7Z+\u0114$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xE9%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xBE%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x93%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+h%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+=%.\xA1\"\"2\xA13\xA2+-%7Z+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X*\u0140 \"!7Z+\u0135$!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\u010A%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xDF%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\xB4%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+\x89%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+^%!.8\"\"2839+-$7Z+#%'\"%$\"# X\"# X*# \" [+3%.\xA1\"\"2\xA13\xA2+#%'(%$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X+& 4!6\xA3! %"),
          peg$decode("!7#+S$7#*# \" [+C%7#*# \" [+3%7#*# \" [+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!7Z+=$.8\"\"2839+-%7Z+#%'#%$## X$\"# X\"# X*# \"7\\"),
          peg$decode("!7]+u$.J\"\"2J3K+e%7]+[%.J\"\"2J3K+K%7]+A%.J\"\"2J3K+1%7]+'%4'6\xA4' %$'# X$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!.\xA5\"\"2\xA53\xA6+3$0\xA7\"\"1!3\xA8+#%'\"%$\"# X\"# X*\xA0 \"!.\xA9\"\"2\xA93\xAA+=$0\xAB\"\"1!3\xAC+-%7!+#%'#%$## X$\"# X\"# X*o \"!.\xAD\"\"2\xAD3\xAE+7$7!+-%7!+#%'#%$## X$\"# X\"# X*D \"!0\xAF\"\"1!3\xB0+-$7!+#%'\"%$\"# X\"# X*# \"7!"),
          peg$decode("!!7!*# \" [+c$7!*# \" [+S%7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'%%$%# X$$# X$## X$\"# X\"# X+' 4!6\xB1!! %"),
          peg$decode(" \\!.2\"\"2233+-$7`+#%'\"%$\"# X\"# X,>&!.2\"\"2233+-$7`+#%'\"%$\"# X\"# X\""),
          peg$decode("7a*A \"7b*; \"7c*5 \"7d*/ \"7e*) \"7f*# \"7g"),
          peg$decode("!/\xB2\"\"1*3\xB3+b$/\xB4\"\"1#3\xB5*G \"/\xB6\"\"1#3\xB7*; \"/\xB8\"\"1$3\xB9*/ \"/\xBA\"\"1#3\xBB*# \"76+(%4\"6\xBC\"! %$\"# X\"# X"),
          peg$decode("!/\xBD\"\"1%3\xBE+J$/\xBF\"\"1%3\xC0*/ \"/\xC1\"\"1\"3\xC2*# \"76+(%4\"6\xC3\"! %$\"# X\"# X"),
          peg$decode("!/\xC4\"\"1'3\xC5+2$7\x8F+(%4\"6\xC6\"! %$\"# X\"# X"),
          peg$decode("!/\xC7\"\"1$3\xC8+2$7\xEF+(%4\"6\xC9\"! %$\"# X\"# X"),
          peg$decode("!/\xCA\"\"1&3\xCB+2$7T+(%4\"6\xCC\"! %$\"# X\"# X"),
          peg$decode("!/\xCD\"\"1\"3\xCE+R$!.>\"\"2>3?+-$76+#%'\"%$\"# X\"# X*# \" [+'%4\"6\xCF\" %$\"# X\"# X"),
          peg$decode("!7h+T$!.>\"\"2>3?+-$7i+#%'\"%$\"# X\"# X*# \" [+)%4\"6\xD0\"\"! %$\"# X\"# X"),
          peg$decode("! \\7j+&$,#&7j\"\"\" X+! (%"),
          peg$decode("! \\7j+&$,#&7j\"\"\" X+! (%"),
          peg$decode("7k*) \"7+*# \"7-"),
          peg$decode(".o\"\"2o3p*e \".q\"\"2q3r*Y \".4\"\"2435*M \".8\"\"2839*A \".<\"\"2<3=*5 \".@\"\"2@3A*) \".B\"\"2B3C"),
          peg$decode("!.6\"\"2637+u$7m+k% \\!.<\"\"2<3=+-$7m+#%'\"%$\"# X\"# X,>&!.<\"\"2<3=+-$7m+#%'\"%$\"# X\"# X\"+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7n+C$.>\"\"2>3?+3%7o+)%4#6\xD1#\"\" %$## X$\"# X\"# X"),
          peg$decode(" \\7p*) \"7+*# \"7-+2$,/&7p*) \"7+*# \"7-\"\"\" X"),
          peg$decode(" \\7p*) \"7+*# \"7-,/&7p*) \"7+*# \"7-\""),
          peg$decode(".o\"\"2o3p*e \".q\"\"2q3r*Y \".4\"\"2435*M \".6\"\"2637*A \".8\"\"2839*5 \".@\"\"2@3A*) \".B\"\"2B3C"),
          peg$decode("7\x90*# \"7r"),
          peg$decode("!7\x8F+K$7'+A%7s+7%7'+-%7\x84+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7M*# \"7t"),
          peg$decode("!7+G$.8\"\"2839+7%7u*# \"7x+'%4#6\xD2# %$## X$\"# X\"# X"),
          peg$decode("!7v*# \"7w+N$!.6\"\"2637+-$7\x83+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!.\xD3\"\"2\xD33\xD4+=$7\x80+3%7w*# \" [+#%'#%$## X$\"# X\"# X"),
          peg$decode("!.4\"\"2435+-$7{+#%'\"%$\"# X\"# X"),
          peg$decode("!7z+5$ \\7y,#&7y\"+#%'\"%$\"# X\"# X"),
          peg$decode("7**) \"7+*# \"7-"),
          peg$decode("7+*\x8F \"7-*\x89 \".2\"\"2233*} \".6\"\"2637*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("!7|+k$ \\!.4\"\"2435+-$7|+#%'\"%$\"# X\"# X,>&!.4\"\"2435+-$7|+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7~,#&7~\"+k$ \\!.2\"\"2233+-$7}+#%'\"%$\"# X\"# X,>&!.2\"\"2233+-$7}+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode(" \\7~,#&7~\""),
          peg$decode("7+*w \"7-*q \".8\"\"2839*e \".:\"\"2:3;*Y \".<\"\"2<3=*M \".>\"\"2>3?*A \".@\"\"2@3A*5 \".B\"\"2B3C*) \".D\"\"2D3E"),
          peg$decode("!7\"+\x8D$ \\7\"*G \"7!*A \".@\"\"2@3A*5 \".F\"\"2F3G*) \".J\"\"2J3K,M&7\"*G \"7!*A \".@\"\"2@3A*5 \".F\"\"2F3G*) \".J\"\"2J3K\"+'%4\"6\xD5\" %$\"# X\"# X"),
          peg$decode("7\x81*# \"7\x82"),
          peg$decode("!!7O+3$.:\"\"2:3;+#%'\"%$\"# X\"# X*# \" [+-$7S+#%'\"%$\"# X\"# X*# \" ["),
          peg$decode(" \\7+*\x83 \"7-*} \".B\"\"2B3C*q \".D\"\"2D3E*e \".2\"\"2233*Y \".8\"\"2839*M \".:\"\"2:3;*A \".<\"\"2<3=*5 \".>\"\"2>3?*) \".@\"\"2@3A+\x8C$,\x89&7+*\x83 \"7-*} \".B\"\"2B3C*q \".D\"\"2D3E*e \".2\"\"2233*Y \".8\"\"2839*M \".:\"\"2:3;*A \".<\"\"2<3=*5 \".>\"\"2>3?*) \".@\"\"2@3A\"\"\" X"),
          peg$decode(" \\7y,#&7y\""),
          peg$decode("!/\x95\"\"1#3\xD6+y$.4\"\"2435+i% \\7!+&$,#&7!\"\"\" X+P%.J\"\"2J3K+@% \\7!+&$,#&7!\"\"\" X+'%4%6\xD7% %$%# X$$# X$## X$\"# X\"# X"),
          peg$decode(".\xD8\"\"2\xD83\xD9"),
          peg$decode(".\xDA\"\"2\xDA3\xDB"),
          peg$decode(".\xDC\"\"2\xDC3\xDD"),
          peg$decode(".\xDE\"\"2\xDE3\xDF"),
          peg$decode(".\xE0\"\"2\xE03\xE1"),
          peg$decode(".\xE2\"\"2\xE23\xE3"),
          peg$decode(".\xE4\"\"2\xE43\xE5"),
          peg$decode(".\xE6\"\"2\xE63\xE7"),
          peg$decode(".\xE8\"\"2\xE83\xE9"),
          peg$decode(".\xEA\"\"2\xEA3\xEB"),
          peg$decode("!7\x85*S \"7\x86*M \"7\x88*G \"7\x89*A \"7\x8A*; \"7\x8B*5 \"7\x8C*/ \"7\x8D*) \"7\x8E*# \"76+& 4!6\xEC! %"),
          peg$decode("!7\x84+K$7'+A%7\x91+7%7'+-%7\x93+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!7\x92+' 4!6\xED!! %"),
          peg$decode("!7!+7$7!+-%7!+#%'#%$## X$\"# X\"# X"),
          peg$decode("! \\7**A \"7+*; \"7-*5 \"73*/ \"74*) \"7'*# \"7(,G&7**A \"7+*; \"7-*5 \"73*/ \"74*) \"7'*# \"7(\"+& 4!6\xEE! %"),
          peg$decode("!7\xB5+_$ \\!7A+-$7\xB5+#%'\"%$\"# X\"# X,8&!7A+-$7\xB5+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!79+R$!.:\"\"2:3;+-$79+#%'\"%$\"# X\"# X*# \" [+'%4\"6\xEF\" %$\"# X\"# X"),
          peg$decode("!7:*j \"!7\x97+_$ \\!7A+-$7\x97+#%'\"%$\"# X\"# X,8&!7A+-$7\x97+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+& 4!6\xF0! %"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\x9A+#%'\"%$\"# X\"# X,8&!7B+-$7\x9A+#%'\"%$\"# X\"# X\"+'%4\"6\xF1\" %$\"# X\"# X"),
          peg$decode("!7\x99*# \" [+A$7@+7%7M+-%7?+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!!76+_$ \\!7.+-$76+#%'\"%$\"# X\"# X,8&!7.+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X*# \"7H+' 4!6\xF2!! %"),
          peg$decode("7\x9B*) \"7\x9C*# \"7\x9F"),
          peg$decode("!/\xF3\"\"1!3\xF4+<$7<+2%7\x9E+(%4#6\xF5#! %$## X$\"# X\"# X"),
          peg$decode("!/\xF6\"\"1'3\xF7+<$7<+2%7\x9D+(%4#6\xF8#! %$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\xF9!! %"),
          peg$decode("!.\xFA\"\"2\xFA3\xFB+x$!.J\"\"2J3K+S$7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'$%$$# X$## X$\"# X\"# X*# \" [+'%4\"6\xFC\" %$\"# X\"# X"),
          peg$decode("!76+N$!7<+-$7\xA0+#%'\"%$\"# X\"# X*# \" [+)%4\"6\xFD\"\"! %$\"# X\"# X"),
          peg$decode("76*) \"7T*# \"7H"),
          peg$decode("!7\xA2+_$ \\!7B+-$7\xA3+#%'\"%$\"# X\"# X,8&!7B+-$7\xA3+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!/\xFE\"\"1&3\xFF*G \"/\u0100\"\"1'3\u0101*; \"/\u0102\"\"1$3\u0103*/ \"/\u0104\"\"1%3\u0105*# \"76+& 4!6\u0106! %"),
          peg$decode("7\xA4*# \"7\x9F"),
          peg$decode("!/\u0107\"\"1(3\u0108+O$7<+E%/\u0109\"\"1(3\u010A*/ \"/\u010B\"\"1(3\u010C*# \"76+#%'#%$## X$\"# X\"# X"),
          peg$decode("!76+_$ \\!7A+-$76+#%'\"%$\"# X\"# X,8&!7A+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u010D!! %"),
          peg$decode("!7\xA8+& 4!6\u010E! %"),
          peg$decode("!7\xA9+s$7;+i%7\xAE+_% \\!7B+-$7\xAF+#%'\"%$\"# X\"# X,8&!7B+-$7\xAF+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("7\xAA*# \"7\xAB"),
          peg$decode("/\u010F\"\"1$3\u0110*S \"/\u0111\"\"1%3\u0112*G \"/\u0113\"\"1%3\u0114*; \"/\u0115\"\"1%3\u0116*/ \"/\u0117\"\"1+3\u0118*# \"7\xAC"),
          peg$decode("/\u0119\"\"1'3\u011A*/ \"/\u011B\"\"1)3\u011C*# \"7\xAC"),
          peg$decode("76*# \"7\xAD"),
          peg$decode("!/\u011D\"\"1\"3\u011E+-$76+#%'\"%$\"# X\"# X"),
          peg$decode("7\xAC*# \"76"),
          peg$decode("!76+7$7<+-%7\xB0+#%'#%$## X$\"# X\"# X"),
          peg$decode("76*# \"7H"),
          peg$decode("!7\xB2+7$7.+-%7\x8F+#%'#%$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u011F!! %"),
          peg$decode("!7\x9D+' 4!6\u0120!! %"),
          peg$decode("!7\xB5+d$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+(%4\"6\u0121\"!!%$\"# X\"# X"),
          peg$decode("!!77+k$ \\!.J\"\"2J3K+-$77+#%'\"%$\"# X\"# X,>&!.J\"\"2J3K+-$77+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+! (%"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\xB7+#%'\"%$\"# X\"# X,8&!7B+-$7\xB7+#%'\"%$\"# X\"# X\"+'%4\"6\u0122\" %$\"# X\"# X"),
          peg$decode("7\xB8*# \"7\x9F"),
          peg$decode("!/\u0123\"\"1#3\u0124+<$7<+2%76+(%4#6\u0125#! %$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u0126!! %"),
          peg$decode("!7\x9D+' 4!6\u0127!! %"),
          peg$decode("! \\7\x99,#&7\x99\"+\x81$7@+w%7M+m%7?+c% \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4%6\u0128% %$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7\xBD"),
          peg$decode("!/\u0129\"\"1&3\u012A+s$7.+i%7\xC0+_% \\!7A+-$7\xC0+#%'\"%$\"# X\"# X,8&!7A+-$7\xC0+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X*# \"7\xBE"),
          peg$decode("!76+s$7.+i%7\xBF+_% \\!7A+-$7\xBF+#%'\"%$\"# X\"# X,8&!7A+-$7\xBF+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!76+=$7<+3%76*# \"7H+#%'#%$## X$\"# X\"# X"),
          peg$decode("7\xC1*G \"7\xC3*A \"7\xC5*; \"7\xC7*5 \"7\xC8*/ \"7\xC9*) \"7\xCA*# \"7\xBF"),
          peg$decode("!/\u012B\"\"1%3\u012C+7$7<+-%7\xC2+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7I+' 4!6\u012D!! %"),
          peg$decode("!/\u012E\"\"1&3\u012F+\xA5$7<+\x9B%7D+\x91%7\xC4+\x87% \\! \\7'+&$,#&7'\"\"\" X+-$7\xC4+#%'\"%$\"# X\"# X,G&! \\7'+&$,#&7'\"\"\" X+-$7\xC4+#%'\"%$\"# X\"# X\"+-%7E+#%'&%$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("7t*# \"7w"),
          peg$decode("!/\u0130\"\"1%3\u0131+7$7<+-%7\xC6+#%'#%$## X$\"# X\"# X"),
          peg$decode("!7I+' 4!6\u0132!! %"),
          peg$decode("!/\u0133\"\"1&3\u0134+<$7<+2%7I+(%4#6\u0135#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0136\"\"1%3\u0137+_$7<+U%!/\u0138\"\"1$3\u0139+& 4!6\u013A! %*4 \"!/\u013B\"\"1%3\u013C+& 4!6\u013D! %+#%'#%$## X$\"# X\"# X"),
          peg$decode("!/\u013E\"\"1)3\u013F+T$7<+J%/\u0140\"\"1#3\u0141*/ \"/\u0142\"\"1(3\u0143*# \"76+(%4#6\u0144#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0145\"\"1#3\u0146+\x9E$7<+\x94%7D+\x8A%!7\xCB+k$ \\!.D\"\"2D3E+-$7\xCB+#%'\"%$\"# X\"# X,>&!.D\"\"2D3E+-$7\xCB+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X+-%7E+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\u0147\"\"1(3\u0148*/ \"/\u0149\"\"1$3\u014A*# \"76+' 4!6\u014B!! %"),
          peg$decode("!76+_$ \\!7A+-$76+#%'\"%$\"# X\"# X,8&!7A+-$76+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\xCE+K$7.+A%7\xCE+7%7.+-%7\x8F+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u014C!! %"),
          peg$decode("!7\xD0+c$ \\!7A+-$7\xD0+#%'\"%$\"# X\"# X,8&!7A+-$7\xD0+#%'\"%$\"# X\"# X\"+'%4\"6\u014D\" %$\"# X\"# X"),
          peg$decode("!7\x98+c$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4\"6\u014E\" %$\"# X\"# X"),
          peg$decode("!7L*T \"7\x98*N \"!7@*# \" [+=$7t+3%7?*# \" [+#%'#%$## X$\"# X\"# X+c$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+'%4\"6\u014F\" %$\"# X\"# X"),
          peg$decode("!7\xD3+c$ \\!7B+-$7\xD4+#%'\"%$\"# X\"# X,8&!7B+-$7\xD4+#%'\"%$\"# X\"# X\"+'%4\"6\u0150\" %$\"# X\"# X"),
          peg$decode("!7\x95+& 4!6\u0151! %"),
          peg$decode("!/\u0152\"\"1(3\u0153+<$7<+2%76+(%4#6\u0154#! %$## X$\"# X\"# X*j \"!/\u0155\"\"1&3\u0156+<$7<+2%76+(%4#6\u0157#! %$## X$\"# X\"# X*: \"!/\u0158\"\"1*3\u0159+& 4!6\u015A! %*# \"7\x9F"),
          peg$decode("!!76+o$ \\!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X,=&!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X\"+)%4\"6\u015C\"\"! %$\"# X\"# X*# \" [+' 4!6\u015D!! %"),
          peg$decode("!7\xD7+_$ \\!7A+-$7\xD7+#%'\"%$\"# X\"# X,8&!7A+-$7\xD7+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\x98+_$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("! \\7!+&$,#&7!\"\"\" X+' 4!6\u015E!! %"),
          peg$decode("!7\xDA+_$ \\!7B+-$7\xDB+#%'\"%$\"# X\"# X,8&!7B+-$7\xDB+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!/\u015F\"\"1&3\u0160*; \"/\u0161\"\"1'3\u0162*/ \"/\u0163\"\"1*3\u0164*# \"76+& 4!6\u0165! %"),
          peg$decode("!/\u0166\"\"1&3\u0167+<$7<+2%7\xDC+(%4#6\u0168#! %$## X$\"# X\"# X*\x83 \"!/\xF6\"\"1'3\xF7+<$7<+2%7\x9D+(%4#6\u0169#! %$## X$\"# X\"# X*S \"!/\u016A\"\"1+3\u016B+<$7<+2%7\x9D+(%4#6\u016C#! %$## X$\"# X\"# X*# \"7\x9F"),
          peg$decode("/\u016D\"\"1+3\u016E*k \"/\u016F\"\"1)3\u0170*_ \"/\u0171\"\"1(3\u0172*S \"/\u0173\"\"1'3\u0174*G \"/\u0175\"\"1&3\u0176*; \"/\u0177\"\"1*3\u0178*/ \"/\u0179\"\"1)3\u017A*# \"76"),
          peg$decode("71*# \" ["),
          peg$decode("!!76+o$ \\!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X,=&!7A+2$76+(%4\"6\u015B\"! %$\"# X\"# X\"+)%4\"6\u015C\"\"! %$\"# X\"# X*# \" [+' 4!6\u017B!! %"),
          peg$decode("!7L*# \"7\x98+c$ \\!7B+-$7\xE0+#%'\"%$\"# X\"# X,8&!7B+-$7\xE0+#%'\"%$\"# X\"# X\"+'%4\"6\u017C\" %$\"# X\"# X"),
          peg$decode("7\xB8*# \"7\x9F"),
          peg$decode("!7\xE2+_$ \\!7A+-$7\xE2+#%'\"%$\"# X\"# X,8&!7A+-$7\xE2+#%'\"%$\"# X\"# X\"+#%'\"%$\"# X\"# X"),
          peg$decode("!7\xE9+s$7.+i%7\xEC+_% \\!7B+-$7\xE3+#%'\"%$\"# X\"# X,8&!7B+-$7\xE3+#%'\"%$\"# X\"# X\"+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("7\xE4*; \"7\xE5*5 \"7\xE6*/ \"7\xE7*) \"7\xE8*# \"7\x9F"),
          peg$decode("!/\u017D\"\"1#3\u017E+<$7<+2%7\xEF+(%4#6\u017F#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0180\"\"1%3\u0181+<$7<+2%7T+(%4#6\u0182#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0183\"\"1(3\u0184+B$7<+8%7\\*# \"7Y+(%4#6\u0185#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0186\"\"1&3\u0187+<$7<+2%76+(%4#6\u0188#! %$## X$\"# X\"# X"),
          peg$decode("!/\u0189\"\"1%3\u018A+T$!7<+5$ \\7!,#&7!\"+#%'\"%$\"# X\"# X*# \" [+'%4\"6\u018B\" %$\"# X\"# X"),
          peg$decode("!7\xEA+K$7;+A%76+7%7;+-%7\xEB+#%'%%$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!/\x95\"\"1#3\xD6*# \"76+' 4!6\u018C!! %"),
          peg$decode("!/\xB4\"\"1#3\u018D*G \"/\xB6\"\"1#3\u018E*; \"/\xBA\"\"1#3\u018F*/ \"/\xB8\"\"1$3\u0190*# \"76+' 4!6\u0191!! %"),
          peg$decode("!7\xED+H$!7C+-$7\xEE+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7U*) \"7\\*# \"7X+& 4!6\u0192! %"),
          peg$decode("!!7!*# \" [+c$7!*# \" [+S%7!*# \" [+C%7!*# \" [+3%7!*# \" [+#%'%%$%# X$$# X$## X$\"# X\"# X+' 4!6\u0193!! %"),
          peg$decode("!!7!+C$7!*# \" [+3%7!*# \" [+#%'#%$## X$\"# X\"# X+' 4!6\u0194!! %"),
          peg$decode("7\xBD"),
          peg$decode("!7\x9D+d$ \\!7B+-$7\xF2+#%'\"%$\"# X\"# X,8&!7B+-$7\xF2+#%'\"%$\"# X\"# X\"+(%4\"6\u0195\"!!%$\"# X\"# X"),
          peg$decode("7\xF3*# \"7\x9F"),
          peg$decode("!.\u0196\"\"2\u01963\u0197+N$7<+D%.\u0198\"\"2\u01983\u0199*) \".\u019A\"\"2\u019A3\u019B+(%4#6\u019C#! %$## X$\"# X\"# X"),
          peg$decode("!7\x9D+d$ \\!7B+-$7\x9F+#%'\"%$\"# X\"# X,8&!7B+-$7\x9F+#%'\"%$\"# X\"# X\"+(%4\"6\u019D\"!!%$\"# X\"# X"),
          peg$decode("!76+7$70+-%7\xF6+#%'#%$## X$\"# X\"# X"),
          peg$decode(" \\72*) \"74*# \"7.,/&72*) \"74*# \"7.\""),
          peg$decode(" \\7%,#&7%\""),
          peg$decode("!7\xF9+=$.8\"\"2839+-%7\xFA+#%'#%$## X$\"# X\"# X"),
          peg$decode("!/\u019E\"\"1%3\u019F*) \"/\u01A0\"\"1$3\u01A1+' 4!6\u01A2!! %"),
          peg$decode("!7\xFB+N$!.8\"\"2839+-$7^+#%'\"%$\"# X\"# X*# \" [+#%'\"%$\"# X\"# X"),
          peg$decode("!7\\*) \"7X*# \"7\x82+' 4!6\u01A3!! %"),
          peg$decode("! \\7\xFD*) \"7-*# \"7\xFE,/&7\xFD*) \"7-*# \"7\xFE\"+! (%"),
          peg$decode("7\"*S \"7!*M \".F\"\"2F3G*A \".J\"\"2J3K*5 \".H\"\"2H3I*) \".N\"\"2N3O"),
          peg$decode(".L\"\"2L3M*\x95 \".B\"\"2B3C*\x89 \".<\"\"2<3=*} \".R\"\"2R3S*q \".T\"\"2T3U*e \".V\"\"2V3W*Y \".P\"\"2P3Q*M \".@\"\"2@3A*A \".D\"\"2D3E*5 \".2\"\"2233*) \".>\"\"2>3?"),
          peg$decode("!7\u0100+h$.8\"\"2839+X%7\xFA+N%!.\u01A4\"\"2\u01A43\u01A5+-$7\xEB+#%'\"%$\"# X\"# X*# \" [+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!/\u01A6\"\"1%3\u01A7*) \"/\u01A8\"\"1$3\u01A9+' 4!6\u01A2!! %"),
          peg$decode("!7\xEB+Q$/\xB4\"\"1#3\xB5*7 \"/\xB6\"\"1#3\xB7*+ \" \\7+,#&7+\"+'%4\"6\u01AA\" %$\"# X\"# X"),
          peg$decode("!7\u0104+\x8F$.F\"\"2F3G+%7\u0103+u%.F\"\"2F3G+e%7\u0103+[%.F\"\"2F3G+K%7\u0103+A%.F\"\"2F3G+1%7\u0105+'%4)6\u01AB) %$)# X$(# X$'# X$&# X$%# X$$# X$## X$\"# X\"# X"),
          peg$decode("!7#+A$7#+7%7#+-%7#+#%'$%$$# X$## X$\"# X\"# X"),
          peg$decode("!7\u0103+-$7\u0103+#%'\"%$\"# X\"# X"),
          peg$decode("!7\u0103+7$7\u0103+-%7\u0103+#%'#%$## X$\"# X\"# X")
        ],

        peg$currPos          = 0,
        peg$reportedPos      = 0,
        peg$cachedPos        = 0,
        peg$cachedPosDetails = { line: 1, column: 1, seenCR: false },
        peg$maxFailPos       = 0,
        peg$maxFailExpected  = [],
        peg$silentFails      = 0,

        peg$result;

    if ("startRule" in options) {
      if (!(options.startRule in peg$startRuleIndices)) {
        throw new Error("Can't start parsing from rule \"" + options.startRule + "\".");
      }

      peg$startRuleIndex = peg$startRuleIndices[options.startRule];
    }

    function text() {
      return input.substring(peg$reportedPos, peg$currPos);
    }

    function offset() {
      return peg$reportedPos;
    }

    function line() {
      return peg$computePosDetails(peg$reportedPos).line;
    }

    function column() {
      return peg$computePosDetails(peg$reportedPos).column;
    }

    function expected(description) {
      throw peg$buildException(
        null,
        [{ type: "other", description: description }],
        peg$reportedPos
      );
    }

    function error(message) {
      throw peg$buildException(message, null, peg$reportedPos);
    }

    function peg$computePosDetails(pos) {
      function advance(details, startPos, endPos) {
        var p, ch;

        for (p = startPos; p < endPos; p++) {
          ch = input.charAt(p);
          if (ch === "\n") {
            if (!details.seenCR) { details.line++; }
            details.column = 1;
            details.seenCR = false;
          } else if (ch === "\r" || ch === "\u2028" || ch === "\u2029") {
            details.line++;
            details.column = 1;
            details.seenCR = true;
          } else {
            details.column++;
            details.seenCR = false;
          }
        }
      }

      if (peg$cachedPos !== pos) {
        if (peg$cachedPos > pos) {
          peg$cachedPos = 0;
          peg$cachedPosDetails = { line: 1, column: 1, seenCR: false };
        }
        advance(peg$cachedPosDetails, peg$cachedPos, pos);
        peg$cachedPos = pos;
      }

      return peg$cachedPosDetails;
    }

    function peg$fail(expected) {
      if (peg$currPos < peg$maxFailPos) { return; }

      if (peg$currPos > peg$maxFailPos) {
        peg$maxFailPos = peg$currPos;
        peg$maxFailExpected = [];
      }

      peg$maxFailExpected.push(expected);
    }

    function peg$buildException(message, expected, pos) {
      function cleanupExpected(expected) {
        var i = 1;

        expected.sort(function(a, b) {
          if (a.description < b.description) {
            return -1;
          } else if (a.description > b.description) {
            return 1;
          } else {
            return 0;
          }
        });

        while (i < expected.length) {
          if (expected[i - 1] === expected[i]) {
            expected.splice(i, 1);
          } else {
            i++;
          }
        }
      }

      function buildMessage(expected, found) {
        function stringEscape(s) {
          function hex(ch) { return ch.charCodeAt(0).toString(16).toUpperCase(); }

          return s
            .replace(/\\/g,   '\\\\')
            .replace(/"/g,    '\\"')
            .replace(/\x08/g, '\\b')
            .replace(/\t/g,   '\\t')
            .replace(/\n/g,   '\\n')
            .replace(/\f/g,   '\\f')
            .replace(/\r/g,   '\\r')
            .replace(/[\x00-\x07\x0B\x0E\x0F]/g, function(ch) { return '\\x0' + hex(ch); })
            .replace(/[\x10-\x1F\x80-\xFF]/g,    function(ch) { return '\\x'  + hex(ch); })
            .replace(/[\u0180-\u0FFF]/g,         function(ch) { return '\\u0' + hex(ch); })
            .replace(/[\u1080-\uFFFF]/g,         function(ch) { return '\\u'  + hex(ch); });
        }

        var expectedDescs = new Array(expected.length),
            expectedDesc, foundDesc, i;

        for (i = 0; i < expected.length; i++) {
          expectedDescs[i] = expected[i].description;
        }

        expectedDesc = expected.length > 1
          ? expectedDescs.slice(0, -1).join(", ")
              + " or "
              + expectedDescs[expected.length - 1]
          : expectedDescs[0];

        foundDesc = found ? "\"" + stringEscape(found) + "\"" : "end of input";

        return "Expected " + expectedDesc + " but " + foundDesc + " found.";
      }

      var posDetails = peg$computePosDetails(pos),
          found      = pos < input.length ? input.charAt(pos) : null;

      if (expected !== null) {
        cleanupExpected(expected);
      }

      return new SyntaxError(
        message !== null ? message : buildMessage(expected, found),
        expected,
        found,
        pos,
        posDetails.line,
        posDetails.column
      );
    }

    function peg$decode(s) {
      var bc = new Array(s.length), i;

      for (i = 0; i < s.length; i++) {
        bc[i] = s.charCodeAt(i) - 32;
      }

      return bc;
    }

    function peg$parseRule(index) {
      var bc    = peg$bytecode[index],
          ip    = 0,
          ips   = [],
          end   = bc.length,
          ends  = [],
          stack = [],
          params, i;

      function protect(object) {
        return Object.prototype.toString.apply(object) === "[object Array]" ? [] : object;
      }

      while (true) {
        while (ip < end) {
          switch (bc[ip]) {
            case 0:
              stack.push(protect(peg$consts[bc[ip + 1]]));
              ip += 2;
              break;

            case 1:
              stack.push(peg$currPos);
              ip++;
              break;

            case 2:
              stack.pop();
              ip++;
              break;

            case 3:
              peg$currPos = stack.pop();
              ip++;
              break;

            case 4:
              stack.length -= bc[ip + 1];
              ip += 2;
              break;

            case 5:
              stack.splice(-2, 1);
              ip++;
              break;

            case 6:
              stack[stack.length - 2].push(stack.pop());
              ip++;
              break;

            case 7:
              stack.push(stack.splice(stack.length - bc[ip + 1], bc[ip + 1]));
              ip += 2;
              break;

            case 8:
              stack.pop();
              stack.push(input.substring(stack[stack.length - 1], peg$currPos));
              ip++;
              break;

            case 9:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1]) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 10:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] === peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 11:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (stack[stack.length - 1] !== peg$FAILED) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 12:
              if (stack[stack.length - 1] !== peg$FAILED) {
                ends.push(end);
                ips.push(ip);

                end = ip + 2 + bc[ip + 1];
                ip += 2;
              } else {
                ip += 2 + bc[ip + 1];
              }

              break;

            case 13:
              ends.push(end);
              ips.push(ip + 3 + bc[ip + 1] + bc[ip + 2]);

              if (input.length > peg$currPos) {
                end = ip + 3 + bc[ip + 1];
                ip += 3;
              } else {
                end = ip + 3 + bc[ip + 1] + bc[ip + 2];
                ip += 3 + bc[ip + 1];
              }

              break;

            case 14:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length) === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 15:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (input.substr(peg$currPos, peg$consts[bc[ip + 1]].length).toLowerCase() === peg$consts[bc[ip + 1]]) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 16:
              ends.push(end);
              ips.push(ip + 4 + bc[ip + 2] + bc[ip + 3]);

              if (peg$consts[bc[ip + 1]].test(input.charAt(peg$currPos))) {
                end = ip + 4 + bc[ip + 2];
                ip += 4;
              } else {
                end = ip + 4 + bc[ip + 2] + bc[ip + 3];
                ip += 4 + bc[ip + 2];
              }

              break;

            case 17:
              stack.push(input.substr(peg$currPos, bc[ip + 1]));
              peg$currPos += bc[ip + 1];
              ip += 2;
              break;

            case 18:
              stack.push(peg$consts[bc[ip + 1]]);
              peg$currPos += peg$consts[bc[ip + 1]].length;
              ip += 2;
              break;

            case 19:
              stack.push(peg$FAILED);
              if (peg$silentFails === 0) {
                peg$fail(peg$consts[bc[ip + 1]]);
              }
              ip += 2;
              break;

            case 20:
              peg$reportedPos = stack[stack.length - 1 - bc[ip + 1]];
              ip += 2;
              break;

            case 21:
              peg$reportedPos = peg$currPos;
              ip++;
              break;

            case 22:
              params = bc.slice(ip + 4, ip + 4 + bc[ip + 3]);
              for (i = 0; i < bc[ip + 3]; i++) {
                params[i] = stack[stack.length - 1 - params[i]];
              }

              stack.splice(
                stack.length - bc[ip + 2],
                bc[ip + 2],
                peg$consts[bc[ip + 1]].apply(null, params)
              );

              ip += 4 + bc[ip + 3];
              break;

            case 23:
              stack.push(peg$parseRule(bc[ip + 1]));
              ip += 2;
              break;

            case 24:
              peg$silentFails++;
              ip++;
              break;

            case 25:
              peg$silentFails--;
              ip++;
              break;

            default:
              throw new Error("Invalid opcode: " + bc[ip] + ".");
          }
        }

        if (ends.length > 0) {
          end = ends.pop();
          ip = ips.pop();
        } else {
          break;
        }
      }

      return stack[0];
    }


      options.data = {}; // Object to which header attributes will be assigned during parsing

      function list (first, rest) {
        return [first].concat(rest);
      }


    peg$result = peg$parseRule(peg$startRuleIndex);

    if (peg$result !== peg$FAILED && peg$currPos === input.length) {
      return peg$result;
    } else {
      if (peg$result !== peg$FAILED && peg$currPos < input.length) {
        peg$fail({ type: "end", description: "end of input" });
      }

      throw peg$buildException(null, peg$maxFailExpected, peg$maxFailPos);
    }
  }

  return {
    SyntaxError: SyntaxError,
    parse:       parse
  };
})();
},{}],99:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Hacks - This file contains all of the things we
 * wish we didn't have to do, just for interop.  It is similar to
 * Utils, which provides actually useful and relevant functions for
 * a SIP library. Methods in this file are grouped by vendor, so
 * as to most easily track when particular hacks may not be necessary anymore.
 */

module.exports = function (SIP) {

//keep to quiet jshint, and remain consistent with other files
SIP = SIP;

var Hacks = {
  AllBrowsers: {
    maskDtls: function (sdp) {
      if (sdp) {
        sdp = sdp.replace(/ UDP\/TLS\/RTP\/SAVP/gmi, " RTP/SAVP");
      }
      return sdp;
    },
    unmaskDtls: function (sdp) {
      /**
       * Chrome does not handle DTLS correctly (Canaray does, but not production)
       * keeping Chrome as SDES until DTLS is fixed (comment out 'is_opera' condition)
       *
       * UPDATE: May 21, 2014
       * Chrome 35 now properly defaults to DTLS.  Only Opera remains using SDES
       *
       * UPDATE: 2014-09-24
       * Opera now supports DTLS by default as well.
       *
       **/
      return sdp.replace(/ RTP\/SAVP/gmi, " UDP/TLS/RTP/SAVP");
    }
  },
  Firefox: {
    /* Condition to detect if hacks are applicable */
    isFirefox: function () {
      return typeof mozRTCPeerConnection !== 'undefined';
    },

    cannotHandleExtraWhitespace: function (sdp) {
      if (this.isFirefox() && sdp) {
        sdp = sdp.replace(/ \r\n/g, "\r\n");
      }
      return sdp;
    },

    hasMissingCLineInSDP: function (sdp) {
      /*
       * This is a Firefox hack to insert valid sdp when getDescription is
       * called with the constraint offerToReceiveVideo = false.
       * We search for either a c-line at the top of the sdp above all
       * m-lines. If that does not exist then we search for a c-line
       * beneath each m-line. If it is missing a c-line, we insert
       * a fake c-line with the ip address 0.0.0.0. This is then valid
       * sdp and no media will be sent for that m-line.
       *
       * Valid SDP is:
       * m=
       * i=
       * c=
       */
      var insertAt, mlines;
      if (sdp.indexOf('c=') > sdp.indexOf('m=')) {

        // Find all m= lines
        mlines = sdp.match(/m=.*\r\n.*/g);
        for (var i=0; i<mlines.length; i++) {

          // If it has an i= line, check if the next line is the c= line
          if (mlines[i].toString().search(/i=.*/) >= 0) {
            insertAt = sdp.indexOf(mlines[i].toString())+mlines[i].toString().length;
            if (sdp.substr(insertAt,2)!=='c=') {
              sdp = sdp.substr(0,insertAt) + '\r\nc=IN IP4 0.0.0.0' + sdp.substr(insertAt);
            }

          // else add the C line if it's missing
          } else if (mlines[i].toString().search(/c=.*/) < 0) {
            insertAt = sdp.indexOf(mlines[i].toString().match(/.*/))+mlines[i].toString().match(/.*/).toString().length;
            sdp = sdp.substr(0,insertAt) + '\r\nc=IN IP4 0.0.0.0' + sdp.substr(insertAt);
          }
        }
      }
      return sdp;
    },
  },

  Chrome: {
    needsExplicitlyInactiveSDP: function (sdp) {
      var sub, index;

      if (Hacks.Firefox.isFirefox()) { // Fix this in Firefox before sending
        index = sdp.indexOf('m=video 0');
        if (index !== -1) {
          sub = sdp.substr(index);
          sub = sub.replace(/\r\nc=IN IP4.*\r\n$/,
                            '\r\nc=IN IP4 0.0.0.0\r\na=inactive\r\n');
          return sdp.substr(0, index) + sub;
        }
      }
      return sdp;
    },

    getsConfusedAboutGUM: function (session) {
      if (session.mediaHandler) {
        session.mediaHandler.close();
      }
    }
  }
};
return Hacks;
};

},{}],100:[function(require,module,exports){
"use strict";
var levels = {
  'error': 0,
  'warn': 1,
  'log': 2,
  'debug': 3
};

module.exports = function (console) {

var LoggerFactory = function () {
  var logger,
    level = 2,
    builtinEnabled = true,
    connector = null;

    this.loggers = {};

    logger = this.getLogger('sip.loggerfactory');


  Object.defineProperties(this, {
    builtinEnabled: {
      get: function(){ return builtinEnabled; },
      set: function(value){
        if (typeof value === 'boolean') {
          builtinEnabled = value;
        } else {
          logger.error('invalid "builtinEnabled" parameter value: '+ JSON.stringify(value));
        }
      }
    },

    level: {
      get: function() {return level; },
      set: function(value) {
        if (value >= 0 && value <=3) {
          level = value;
        } else if (value > 3) {
          level = 3;
        } else if (levels.hasOwnProperty(value)) {
          level = levels[value];
        } else {
          logger.error('invalid "level" parameter value: '+ JSON.stringify(value));
        }
      }
    },

    connector: {
      get: function() {return connector; },
      set: function(value){
        if(value === null || value === "" || value === undefined) {
          connector = null;
        } else if (typeof value === 'function') {
          connector = value;
        } else {
          logger.error('invalid "connector" parameter value: '+ JSON.stringify(value));
        }
      }
    }
  });
};

LoggerFactory.prototype.print = function(target, category, label, content) {
  if (typeof content === 'string') {
    var prefix = [new Date(), category];
    if (label) {
      prefix.push(label);
    }
    content = prefix.concat(content).join(' | ');
  }
  target.call(console, content);
};

function Logger (logger, category, label) {
  this.logger = logger;
  this.category = category;
  this.label = label;
}

Object.keys(levels).forEach(function (targetName) {
  Logger.prototype[targetName] = function (content) {
    this.logger[targetName](this.category, this.label, content);
  };

  LoggerFactory.prototype[targetName] = function (category, label, content) {
    if (this.level >= levels[targetName]) {
      if (this.builtinEnabled) {
        this.print(console[targetName], category, label, content);
      }

      if (this.connector) {
        this.connector(targetName, category, label, content);
      }
    }
  };
});

LoggerFactory.prototype.getLogger = function(category, label) {
  var logger;

  if (label && this.level === 3) {
    return new Logger(this, category, label);
  } else if (this.loggers[category]) {
    return this.loggers[category];
  } else {
    logger = new Logger(this, category);
    this.loggers[category] = logger;
    return logger;
  }
};

return LoggerFactory;
};

},{}],101:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaHandler
 */

/* MediaHandler
 * @class PeerConnection helper Class.
 * @param {SIP.Session} session
 * @param {Object} [options]
 */
module.exports = function (EventEmitter) {
var MediaHandler = function(session, options) {
  // keep jshint happy
  session = session;
  options = options;
};

MediaHandler.prototype = Object.create(EventEmitter.prototype, {
  isReady: {value: function isReady () {}},

  close: {value: function close () {}},

  /**
   * @param {Object} [mediaHint] A custom object describing the media to be used during this session.
   */
  getDescription: {value: function getDescription (mediaHint) {
    // keep jshint happy
    mediaHint = mediaHint;
  }},

  /**
   * Check if a SIP message contains a session description.
   * @param {SIP.SIPMessage} message
   * @returns {boolean}
   */
  hasDescription: {value: function hasDescription (message) {
    // keep jshint happy
    message = message;
  }},

  /**
   * Set the session description contained in a SIP message.
   * @param {SIP.SIPMessage} message
   * @returns {Promise}
   */
  setDescription: {value: function setDescription (message) {
    // keep jshint happy
    message = message;
  }}
});

return MediaHandler;
};

},{}],102:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP NameAddrHeader
 */

/**
 * @augments SIP
 * @class Class creating a Name Address SIP header.
 *
 * @param {SIP.URI} uri
 * @param {String} [displayName]
 * @param {Object} [parameters]
 *
 */
module.exports = function (SIP) {
var NameAddrHeader;

NameAddrHeader = function(uri, displayName, parameters) {
  var param;

  // Checks
  if(!uri || !(uri instanceof SIP.URI)) {
    throw new TypeError('missing or invalid "uri" parameter');
  }

  // Initialize parameters
  this.uri = uri;
  this.parameters = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  Object.defineProperties(this, {
    friendlyName: {
      get: function() { return this.displayName || uri.aor; }
    },

    displayName: {
      get: function() { return displayName; },
      set: function(value) {
        displayName = (value === 0) ? '0' : value;
      }
    }
  });
};
NameAddrHeader.prototype = {
  setParam: function (key, value) {
    if(key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString();
    }
  },
  getParam: SIP.URI.prototype.getParam,
  hasParam: SIP.URI.prototype.hasParam,
  deleteParam: SIP.URI.prototype.deleteParam,
  clearParams: SIP.URI.prototype.clearParams,

  clone: function() {
    return new NameAddrHeader(
      this.uri.clone(),
      this.displayName,
      JSON.parse(JSON.stringify(this.parameters)));
  },

  toString: function() {
    var body, parameter;

    body  = (this.displayName || this.displayName === 0) ? '"' + this.displayName + '" ' : '';
    body += '<' + this.uri.toString() + '>';

    for (parameter in this.parameters) {
      body += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        body += '='+ this.parameters[parameter];
      }
    }

    return body;
  }
};


/**
  * Parse the given string and returns a SIP.NameAddrHeader instance or undefined if
  * it is an invalid NameAddrHeader.
  * @public
  * @param {String} name_addr_header
  */
NameAddrHeader.parse = function(name_addr_header) {
  name_addr_header = SIP.Grammar.parse(name_addr_header,'Name_Addr_Header');

  if (name_addr_header !== -1) {
    return name_addr_header;
  } else {
    return undefined;
  }
};

SIP.NameAddrHeader = NameAddrHeader;
};

},{}],103:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Message Parser
 */

/**
 * Extract and parse every header of a SIP message.
 * @augments SIP
 * @namespace
 */
module.exports = function (SIP) {
var Parser;

function getHeader(data, headerStart) {
  var
    // 'start' position of the header.
    start = headerStart,
    // 'end' position of the header.
    end = 0,
    // 'partial end' position of the header.
    partialEnd = 0;

  //End of message.
  if (data.substring(start, start + 2).match(/(^\r\n)/)) {
    return -2;
  }

  while(end === 0) {
    // Partial End of Header.
    partialEnd = data.indexOf('\r\n', start);

    // 'indexOf' returns -1 if the value to be found never occurs.
    if (partialEnd === -1) {
      return partialEnd;
    }

    if(!data.substring(partialEnd + 2, partialEnd + 4).match(/(^\r\n)/) && data.charAt(partialEnd + 2).match(/(^\s+)/)) {
      // Not the end of the message. Continue from the next position.
      start = partialEnd + 2;
    } else {
      end = partialEnd;
    }
  }

  return end;
}

function parseHeader(message, data, headerStart, headerEnd) {
  var header, idx, length, parsed,
    hcolonIndex = data.indexOf(':', headerStart),
    headerName = data.substring(headerStart, hcolonIndex).trim(),
    headerValue = data.substring(hcolonIndex + 1, headerEnd).trim();

  // If header-field is well-known, parse it.
  switch(headerName.toLowerCase()) {
    case 'via':
    case 'v':
      message.addHeader('via', headerValue);
      if(message.getHeaders('via').length === 1) {
        parsed = message.parseHeader('Via');
        if(parsed) {
          message.via = parsed;
          message.via_branch = parsed.branch;
        }
      } else {
        parsed = 0;
      }
      break;
    case 'from':
    case 'f':
      message.setHeader('from', headerValue);
      parsed = message.parseHeader('from');
      if(parsed) {
        message.from = parsed;
        message.from_tag = parsed.getParam('tag');
      }
      break;
    case 'to':
    case 't':
      message.setHeader('to', headerValue);
      parsed = message.parseHeader('to');
      if(parsed) {
        message.to = parsed;
        message.to_tag = parsed.getParam('tag');
      }
      break;
    case 'record-route':
      parsed = SIP.Grammar.parse(headerValue, 'Record_Route');

      if (parsed === -1) {
        parsed = undefined;
        break;
      }

      length = parsed.length;
      for (idx = 0; idx < length; idx++) {
        header = parsed[idx];
        message.addHeader('record-route', headerValue.substring(header.position, header.offset));
        message.headers['Record-Route'][message.getHeaders('record-route').length - 1].parsed = header.parsed;
      }
      break;
    case 'call-id':
    case 'i':
      message.setHeader('call-id', headerValue);
      parsed = message.parseHeader('call-id');
      if(parsed) {
        message.call_id = headerValue;
      }
      break;
    case 'contact':
    case 'm':
      parsed = SIP.Grammar.parse(headerValue, 'Contact');

      if (parsed === -1) {
        parsed = undefined;
        break;
      }

      length = parsed.length;
      for (idx = 0; idx < length; idx++) {
        header = parsed[idx];
        message.addHeader('contact', headerValue.substring(header.position, header.offset));
        message.headers['Contact'][message.getHeaders('contact').length - 1].parsed = header.parsed;
      }
      break;
    case 'content-length':
    case 'l':
      message.setHeader('content-length', headerValue);
      parsed = message.parseHeader('content-length');
      break;
    case 'content-type':
    case 'c':
      message.setHeader('content-type', headerValue);
      parsed = message.parseHeader('content-type');
      break;
    case 'cseq':
      message.setHeader('cseq', headerValue);
      parsed = message.parseHeader('cseq');
      if(parsed) {
        message.cseq = parsed.value;
      }
      if(message instanceof SIP.IncomingResponse) {
        message.method = parsed.method;
      }
      break;
    case 'max-forwards':
      message.setHeader('max-forwards', headerValue);
      parsed = message.parseHeader('max-forwards');
      break;
    case 'www-authenticate':
      message.setHeader('www-authenticate', headerValue);
      parsed = message.parseHeader('www-authenticate');
      break;
    case 'proxy-authenticate':
      message.setHeader('proxy-authenticate', headerValue);
      parsed = message.parseHeader('proxy-authenticate');
      break;
    case 'refer-to':
    case 'r':
      message.setHeader('refer-to', headerValue);
      parsed = message.parseHeader('refer-to');
      if (parsed) {
        message.refer_to = parsed;
      }
      break;
    default:
      // Do not parse this header.
      message.setHeader(headerName, headerValue);
      parsed = 0;
  }

  if (parsed === undefined) {
    return {
      error: 'error parsing header "'+ headerName +'"'
    };
  } else {
    return true;
  }
}

/** Parse SIP Message
 * @function
 * @param {String} message SIP message.
 * @param {Object} logger object.
 * @returns {SIP.IncomingRequest|SIP.IncomingResponse|undefined}
 */
Parser = {};
Parser.parseMessage = function(data, ua) {
  var message, firstLine, contentLength, bodyStart, parsed,
    headerStart = 0,
    headerEnd = data.indexOf('\r\n'),
    logger = ua.getLogger('sip.parser');

  if(headerEnd === -1) {
    logger.warn('no CRLF found, not a SIP message, discarded');
    return;
  }

  // Parse first line. Check if it is a Request or a Reply.
  firstLine = data.substring(0, headerEnd);
  parsed = SIP.Grammar.parse(firstLine, 'Request_Response');

  if(parsed === -1) {
    logger.warn('error parsing first line of SIP message: "' + firstLine + '"');
    return;
  } else if(!parsed.status_code) {
    message = new SIP.IncomingRequest(ua);
    message.method = parsed.method;
    message.ruri = parsed.uri;
  } else {
    message = new SIP.IncomingResponse(ua);
    message.status_code = parsed.status_code;
    message.reason_phrase = parsed.reason_phrase;
  }

  message.data = data;
  headerStart = headerEnd + 2;

  /* Loop over every line in data. Detect the end of each header and parse
  * it or simply add to the headers collection.
  */
  while(true) {
    headerEnd = getHeader(data, headerStart);

    // The SIP message has normally finished.
    if(headerEnd === -2) {
      bodyStart = headerStart + 2;
      break;
    }
    // data.indexOf returned -1 due to a malformed message.
    else if(headerEnd === -1) {
      logger.error('malformed message');
      return;
    }

    parsed = parseHeader(message, data, headerStart, headerEnd);

    if(parsed !== true) {
      logger.error(parsed.error);
      return;
    }

    headerStart = headerEnd + 2;
  }

  /* RFC3261 18.3.
   * If there are additional bytes in the transport packet
   * beyond the end of the body, they MUST be discarded.
   */
  if(message.hasHeader('content-length')) {
    contentLength = message.getHeader('content-length');
    message.body = data.substr(bodyStart, contentLength);
  } else {
    message.body = data.substring(bodyStart);
  }

  return message;
};

SIP.Parser = Parser;
};

},{}],104:[function(require,module,exports){
var localMinSE = 90;

module.exports = function (Timers) {

// http://tools.ietf.org/html/rfc4028#section-9
function hasSmallMinSE (message) {
  var supportedOptions = message.parseHeader('Supported') || [];
  var sessionExpires = message.parseHeader('Session-Expires') || {};
  return supportedOptions.indexOf('timer') >= 0 && sessionExpires.deltaSeconds < localMinSE;
}

// `response` is an IncomingResponse or a String (outgoing response)
function updateState (dialog, response, parseMessage, ua) {
  dialog.sessionTimerState = dialog.sessionTimerState || {};
  Timers.clearTimeout(dialog.sessionTimerState.timeout);

  var isUAS = typeof response === 'string';
  if (isUAS) {
    response = parseMessage(response, ua);
  }

  var sessionExpires = response.parseHeader('Session-Expires');
  // If the most recent 2xx response had no Session-Expires header field, there
  // is no session expiration, and no refreshes have to be performed
  if (!sessionExpires) {
    dialog.sessionTimerState = null;
    return;
  }

  var interval = sessionExpires.deltaSeconds;
  var isRefresher = isUAS === (sessionExpires.refresher === 'uas');

  dialog.sessionTimerState = {
    interval: interval,
    isRefresher: isRefresher
  };

  var intervalMilliseconds = interval * 1000;
  var self = this;
  if (isRefresher) {
    dialog.sessionTimerState.timeout = Timers.setInterval(function sendRefresh () {
      var exists = dialog.owner.ua.dialogs[dialog.id.toString()] || false;
      if (exists) {
        dialog.sendRequest(self, "UPDATE", { extraHeaders: ["Session-Expires: " + interval]});
      } else {
        Timers.clearInterval(dialog.sessionTimerState.timeout);
      }
    }, intervalMilliseconds / 2);
  } else {
    var before = Math.min(32 * 1000, intervalMilliseconds / 3);
    dialog.sessionTimerState.timeout = Timers.setTimeout(function sendBye () {
      // TODO
    }, intervalMilliseconds - before);
  }
}

function receiveResponse(response) {
  /* jshint unused: false */
}

function onDialogError(response) {
  /* jshint unused: false */
}

function onRequestTimeout() {
  /* jshint unused: false */
}

function onTransportError() {
  /* jshint unused: false */
}

return {
  localMinSE: localMinSE,
  hasSmallMinSE: hasSmallMinSE,
  updateState: updateState,
  receiveResponse: receiveResponse,
  onDialogError: onDialogError,
  onRequestTimeout: onRequestTimeout,
  onTransportError: onTransportError
};

};

},{}],105:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {

var RegisterContext;

RegisterContext = function (ua) {
  var params = {},
      regId = 1;

  this.registrar = ua.configuration.registrarServer;
  this.expires = ua.configuration.registerExpires;


  // Contact header
  this.contact = ua.contact.toString();

  if(regId) {
    this.contact += ';reg-id='+ regId;
    this.contact += ';+sip.instance="<urn:uuid:'+ ua.configuration.instanceId+'>"';
  }

  // Call-ID and CSeq values RFC3261 10.2
  this.call_id = SIP.Utils.createRandomToken(22);
  this.cseq = 80;

  this.to_uri = ua.configuration.uri;

  params.to_uri = this.to_uri;
  params.to_displayName = ua.configuration.displayName;
  params.call_id = this.call_id;
  params.cseq = this.cseq;

  // Extends ClientContext
  SIP.Utils.augment(this, SIP.ClientContext, [ua, 'REGISTER', this.registrar, {params: params}]);

  this.registrationTimer = null;
  this.registrationExpiredTimer = null;

  // Set status
  this.registered = false;

  this.logger = ua.getLogger('sip.registercontext');
};

RegisterContext.prototype = {
  register: function (options) {
    var self = this, extraHeaders;

    // Handle Options
    this.options = options || {};
    extraHeaders = (this.options.extraHeaders || []).slice();
    extraHeaders.push('Contact: ' + this.contact + ';expires=' + this.expires);
    extraHeaders.push('Allow: ' + SIP.UA.C.ALLOWED_METHODS.toString());

    // Save original extraHeaders to be used in .close
    this.closeHeaders = this.options.closeWithHeaders ?
      (this.options.extraHeaders || []).slice() : [];

    this.receiveResponse = function(response) {
      var contact, expires,
        contacts = response.getHeaders('contact').length,
        cause;

      // Discard responses to older REGISTER/un-REGISTER requests.
      if(response.cseq !== this.cseq) {
        return;
      }

      // Clear registration timer
      if (this.registrationTimer !== null) {
        SIP.Timers.clearTimeout(this.registrationTimer);
        this.registrationTimer = null;
      }

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          this.emit('progress', response);
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          this.emit('accepted', response);

          if(response.hasHeader('expires')) {
            expires = response.getHeader('expires');
          }

          if (this.registrationExpiredTimer !== null) {
            SIP.Timers.clearTimeout(this.registrationExpiredTimer);
            this.registrationExpiredTimer = null;
          }

          // Search the Contact pointing to us and update the expires value accordingly.
          if (!contacts) {
            this.logger.warn('no Contact header in response to REGISTER, response ignored');
            break;
          }

          while(contacts--) {
            contact = response.parseHeader('contact', contacts);
            if(contact.uri.user === this.ua.contact.uri.user) {
              expires = contact.getParam('expires');
              break;
            } else {
              contact = null;
            }
          }

          if (!contact) {
            this.logger.warn('no Contact header pointing to us, response ignored');
            break;
          }

          if(!expires) {
            expires = this.expires;
          }

          // Re-Register before the expiration interval has elapsed.
          // For that, decrease the expires value. ie: 3 seconds
          this.registrationTimer = SIP.Timers.setTimeout(function() {
            self.registrationTimer = null;
            self.register(self.options);
          }, (expires * 1000) - 3000);
          this.registrationExpiredTimer = SIP.Timers.setTimeout(function () {
            self.logger.warn('registration expired');
            if (self.registered) {
              self.unregistered(null, SIP.C.causes.EXPIRES);
            }
          }, expires * 1000);

          //Save gruu values
          if (contact.hasParam('temp-gruu')) {
            this.ua.contact.temp_gruu = SIP.URI.parse(contact.getParam('temp-gruu').replace(/"/g,''));
          }
          if (contact.hasParam('pub-gruu')) {
            this.ua.contact.pub_gruu = SIP.URI.parse(contact.getParam('pub-gruu').replace(/"/g,''));
          }

          this.registered = true;
          this.emit('registered', response || null);
          break;
        // Interval too brief RFC3261 10.2.8
        case /^423$/.test(response.status_code):
          if(response.hasHeader('min-expires')) {
            // Increase our registration interval to the suggested minimum
            this.expires = response.getHeader('min-expires');
            // Attempt the registration again immediately
            this.register(this.options);
          } else { //This response MUST contain a Min-Expires header field
            this.logger.warn('423 response received for REGISTER without Min-Expires');
            this.registrationFailure(response, SIP.C.causes.SIP_FAILURE_CODE);
          }
          break;
        default:
          cause = SIP.Utils.sipErrorCause(response.status_code);
          this.registrationFailure(response, cause);
      }
    };

    this.onRequestTimeout = function() {
      this.registrationFailure(null, SIP.C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      this.registrationFailure(null, SIP.C.causes.CONNECTION_ERROR);
    };

    this.cseq++;
    this.request.cseq = this.cseq;
    this.request.setHeader('cseq', this.cseq + ' REGISTER');
    this.request.extraHeaders = extraHeaders;
    this.send();
  },

  registrationFailure: function (response, cause) {
    this.emit('failed', response || null, cause || null);
  },

  onTransportClosed: function() {
    this.registered_before = this.registered;
    if (this.registrationTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if (this.registrationExpiredTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationExpiredTimer);
      this.registrationExpiredTimer = null;
    }

    if(this.registered) {
      this.unregistered(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onTransportConnected: function() {
    this.register(this.options);
  },

  close: function() {
    var options = {
      all: false,
      extraHeaders: this.closeHeaders
    };

    this.registered_before = this.registered;
    this.unregister(options);
  },

  unregister: function(options) {
    var extraHeaders;

    options = options || {};

    if(!this.registered && !options.all) {
      this.logger.warn('already unregistered');
      return;
    }

    extraHeaders = (options.extraHeaders || []).slice();

    this.registered = false;

    // Clear the registration timer.
    if (this.registrationTimer !== null) {
      SIP.Timers.clearTimeout(this.registrationTimer);
      this.registrationTimer = null;
    }

    if(options.all) {
      extraHeaders.push('Contact: *');
      extraHeaders.push('Expires: 0');
    } else {
      extraHeaders.push('Contact: '+ this.contact + ';expires=0');
    }


    this.receiveResponse = function(response) {
      var cause;

      switch(true) {
        case /^1[0-9]{2}$/.test(response.status_code):
          this.emit('progress', response);
          break;
        case /^2[0-9]{2}$/.test(response.status_code):
          this.emit('accepted', response);
          if (this.registrationExpiredTimer !== null) {
            SIP.Timers.clearTimeout(this.registrationExpiredTimer);
            this.registrationExpiredTimer = null;
          }
          this.unregistered(response);
          break;
        default:
          cause = SIP.Utils.sipErrorCause(response.status_code);
          this.unregistered(response,cause);
      }
    };

    this.onRequestTimeout = function() {
      // Not actually unregistered...
      //this.unregistered(null, SIP.C.causes.REQUEST_TIMEOUT);
    };

    this.onTransportError = function() {
      // Not actually unregistered...
      //this.unregistered(null, SIP.C.causes.CONNECTION_ERROR);
    };

    this.cseq++;
    this.request.cseq = this.cseq;
    this.request.setHeader('cseq', this.cseq + ' REGISTER');
    this.request.extraHeaders = extraHeaders;

    this.send();
  },

  unregistered: function(response, cause) {
    this.registered = false;
    this.emit('unregistered', response || null, cause || null);
  }

};


SIP.RegisterContext = RegisterContext;
};

},{}],106:[function(require,module,exports){
"use strict";

/**
 * @fileoverview Request Sender
 */

/**
 * @augments SIP
 * @class Class creating a request sender.
 * @param {Object} applicant
 * @param {SIP.UA} ua
 */
module.exports = function (SIP) {
var RequestSender;

RequestSender = function(applicant, ua) {
  this.logger = ua.getLogger('sip.requestsender');
  this.ua = ua;
  this.applicant = applicant;
  this.method = applicant.request.method;
  this.request = applicant.request;
  this.credentials = null;
  this.challenged = false;
  this.staled = false;

  // If ua is in closing process or even closed just allow sending Bye and ACK
  if (ua.status === SIP.UA.C.STATUS_USER_CLOSED && (this.method !== SIP.C.BYE || this.method !== SIP.C.ACK)) {
    this.onTransportError();
  }
};

/**
* Create the client transaction and send the message.
*/
RequestSender.prototype = {
  send: function() {
    switch(this.method) {
      case "INVITE":
        this.clientTransaction = new SIP.Transactions.InviteClientTransaction(this, this.request, this.ua.transport);
        break;
      case "ACK":
        this.clientTransaction = new SIP.Transactions.AckClientTransaction(this, this.request, this.ua.transport);
        break;
      default:
        this.clientTransaction = new SIP.Transactions.NonInviteClientTransaction(this, this.request, this.ua.transport);
    }
    this.clientTransaction.send();

    return this.clientTransaction;
  },

  /**
  * Callback fired when receiving a request timeout error from the client transaction.
  * To be re-defined by the applicant.
  * @event
  */
  onRequestTimeout: function() {
    this.applicant.onRequestTimeout();
  },

  /**
  * Callback fired when receiving a transport error from the client transaction.
  * To be re-defined by the applicant.
  * @event
  */
  onTransportError: function() {
    this.applicant.onTransportError();
  },

  /**
  * Called from client transaction when receiving a correct response to the request.
  * Authenticate request if needed or pass the response back to the applicant.
  * @param {SIP.IncomingResponse} response
  */
  receiveResponse: function(response) {
    var cseq, challenge, authorization_header_name,
      status_code = response.status_code;

    /*
    * Authentication
    * Authenticate once. _challenged_ flag used to avoid infinite authentications.
    */
    if (status_code === 401 || status_code === 407) {

      // Get and parse the appropriate WWW-Authenticate or Proxy-Authenticate header.
      if (response.status_code === 401) {
        challenge = response.parseHeader('www-authenticate');
        authorization_header_name = 'authorization';
      } else {
        challenge = response.parseHeader('proxy-authenticate');
        authorization_header_name = 'proxy-authorization';
      }

      // Verify it seems a valid challenge.
      if (! challenge) {
        this.logger.warn(response.status_code + ' with wrong or missing challenge, cannot authenticate');
        this.applicant.receiveResponse(response);
        return;
      }

      if (!this.challenged || (!this.staled && challenge.stale === true)) {
        if (!this.credentials) {
          this.credentials = this.ua.configuration.authenticationFactory(this.ua);
        }

        // Verify that the challenge is really valid.
        if (!this.credentials.authenticate(this.request, challenge)) {
          this.applicant.receiveResponse(response);
          return;
        }
        this.challenged = true;

        if (challenge.stale) {
          this.staled = true;
        }

        if (response.method === SIP.C.REGISTER) {
          cseq = this.applicant.cseq += 1;
        } else if (this.request.dialog){
          cseq = this.request.dialog.local_seqnum += 1;
        } else {
          cseq = this.request.cseq + 1;
          this.request.cseq = cseq;
        }
        this.request.setHeader('cseq', cseq +' '+ this.method);

        this.request.setHeader(authorization_header_name, this.credentials.toString());
        this.send();
      } else {
        this.applicant.receiveResponse(response);
      }
    } else {
      this.applicant.receiveResponse(response);
    }
  }
};

SIP.RequestSender = RequestSender;
};

},{}],107:[function(require,module,exports){
/**
 * @name SIP
 * @namespace
 */
"use strict";

module.exports = function (environment) {

var pkg = require('../package.json');

var SIP = Object.defineProperties({}, {
  version: {
    get: function(){ return pkg.version; }
  },
  name: {
    get: function(){ return pkg.title; }
  }
});

require('./Utils')(SIP, environment);
SIP.LoggerFactory = require('./LoggerFactory')(environment.console);
SIP.EventEmitter = require('./EventEmitter')(environment.console);
SIP.C = require('./Constants')(SIP.name, SIP.version);
SIP.Exceptions = require('./Exceptions');
SIP.Timers = require('./Timers')(environment.timers);
SIP.Transport = environment.Transport(SIP, environment.WebSocket);
require('./Parser')(SIP);
require('./SIPMessage')(SIP);
require('./URI')(SIP);
require('./NameAddrHeader')(SIP);
require('./Transactions')(SIP);
require('./Dialogs')(SIP);
require('./RequestSender')(SIP);
require('./RegisterContext')(SIP);
SIP.MediaHandler = require('./MediaHandler')(SIP.EventEmitter);
require('./ClientContext')(SIP);
require('./ServerContext')(SIP);
require('./Session')(SIP, environment);
require('./Subscription')(SIP);
SIP.WebRTC = require('./WebRTC')(SIP, environment);
require('./UA')(SIP, environment);
SIP.Hacks = require('./Hacks')(SIP);
require('./SanityCheck')(SIP);
SIP.DigestAuthentication = require('./DigestAuthentication')(SIP.Utils);
SIP.Grammar = require('./Grammar')(SIP);

return SIP;
};

},{"../package.json":89,"./ClientContext":90,"./Constants":91,"./Dialogs":93,"./DigestAuthentication":94,"./EventEmitter":95,"./Exceptions":96,"./Grammar":97,"./Hacks":99,"./LoggerFactory":100,"./MediaHandler":101,"./NameAddrHeader":102,"./Parser":103,"./RegisterContext":105,"./RequestSender":106,"./SIPMessage":108,"./SanityCheck":109,"./ServerContext":110,"./Session":111,"./Subscription":113,"./Timers":114,"./Transactions":115,"./UA":117,"./URI":118,"./Utils":119,"./WebRTC":120}],108:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Message
 */

module.exports = function (SIP) {
var
  OutgoingRequest,
  IncomingMessage,
  IncomingRequest,
  IncomingResponse;

function getSupportedHeader (request) {
  var allowUnregistered = request.ua.configuration.hackAllowUnregisteredOptionTags;
  var optionTags = [];
  var optionTagSet = {};

  if (request.method === SIP.C.REGISTER) {
    optionTags.push('path', 'gruu');
  } else if (request.method === SIP.C.INVITE &&
             (request.ua.contact.pub_gruu || request.ua.contact.temp_gruu)) {
    optionTags.push('gruu');
  }

  if (request.ua.configuration.rel100 === SIP.C.supported.SUPPORTED) {
    optionTags.push('100rel');
  }
  if (request.ua.configuration.replaces === SIP.C.supported.SUPPORTED) {
    optionTags.push('replaces');
  }

  optionTags.push('outbound');

  optionTags = optionTags.concat(request.ua.configuration.extraSupported);

  optionTags = optionTags.filter(function(optionTag) {
    var registered = SIP.C.OPTION_TAGS[optionTag];
    var unique = !optionTagSet[optionTag];
    optionTagSet[optionTag] = true;
    return (registered || allowUnregistered) && unique;
  });

  return 'Supported: ' + optionTags.join(', ') + '\r\n';
}

/**
 * @augments SIP
 * @class Class for outgoing SIP request.
 * @param {String} method request method
 * @param {String} ruri request uri
 * @param {SIP.UA} ua
 * @param {Object} params parameters that will have priority over ua.configuration parameters:
 * <br>
 *  - cseq, call_id, from_tag, from_uri, from_displayName, to_uri, to_tag, route_set
 * @param {Object} [headers] extra headers
 * @param {String} [body]
 */
OutgoingRequest = function(method, ruri, ua, params, extraHeaders, body) {
  var
    to,
    from,
    call_id,
    cseq,
    to_uri,
    from_uri;

  params = params || {};

  // Mandatory parameters check
  if(!method || !ruri || !ua) {
    return null;
  }

  this.logger = ua.getLogger('sip.sipmessage');
  this.ua = ua;
  this.headers = {};
  this.method = method;
  this.ruri = ruri;
  this.body = body;
  this.extraHeaders = (extraHeaders || []).slice();
  this.statusCode = params.status_code;
  this.reasonPhrase = params.reason_phrase;

  // Fill the Common SIP Request Headers

  // Route
  if (params.route_set) {
    this.setHeader('route', params.route_set);
  } else if (ua.configuration.usePreloadedRoute){
    this.setHeader('route', ua.transport.server.sip_uri);
  }

  // Via
  // Empty Via header. Will be filled by the client transaction.
  this.setHeader('via', '');

  // Max-Forwards
  this.setHeader('max-forwards', SIP.UA.C.MAX_FORWARDS);

  // To
  to_uri = params.to_uri || ruri;
  to = (params.to_displayName || params.to_displayName === 0) ? '"' + params.to_displayName + '" ' : '';
  to += '<' + (to_uri && to_uri.toRaw ? to_uri.toRaw() : to_uri) + '>';
  to += params.to_tag ? ';tag=' + params.to_tag : '';
  this.to = new SIP.NameAddrHeader.parse(to);
  this.setHeader('to', to);

  // From
  from_uri = params.from_uri || ua.configuration.uri;
  if (params.from_displayName || params.from_displayName === 0) {
    from = '"' + params.from_displayName + '" ';
  } else if (ua.configuration.displayName) {
    from = '"' + ua.configuration.displayName + '" ';
  } else {
    from = '';
  }
  from += '<' + (from_uri && from_uri.toRaw ? from_uri.toRaw() : from_uri) + '>;tag=';
  from += params.from_tag || SIP.Utils.newTag();
  this.from = new SIP.NameAddrHeader.parse(from);
  this.setHeader('from', from);

  // Call-ID
  call_id = params.call_id || (ua.configuration.sipjsId + SIP.Utils.createRandomToken(15));
  this.call_id = call_id;
  this.setHeader('call-id', call_id);

  // CSeq
  cseq = params.cseq || Math.floor(Math.random() * 10000);
  this.cseq = cseq;
  this.setHeader('cseq', cseq + ' ' + method);
};

OutgoingRequest.prototype = {
  /**
   * Replace the the given header by the given value.
   * @param {String} name header name
   * @param {String | Array} value header value
   */
  setHeader: function(name, value) {
    this.headers[SIP.Utils.headerize(name)] = (value instanceof Array) ? value : [value];
  },

  /**
   * Get the value of the given header name at the given position.
   * @param {String} name header name
   * @returns {String|undefined} Returns the specified header, undefined if header doesn't exist.
   */
  getHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length,
      header = this.headers[SIP.Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0];
      }
    } else {
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          return header.substring(header.indexOf(':')+1).trim();
        }
      }
    }

    return;
  },

  /**
   * Get the header/s of the given name.
   * @param {String} name header name
   * @returns {Array} Array with all the headers of the specified name.
   */
  getHeaders: function(name) {
    var idx, length, regexp,
      header = this.headers[SIP.Utils.headerize(name)],
      result = [];

    if(header) {
      length = header.length;
      for (idx = 0; idx < length; idx++) {
        result.push(header[idx]);
      }
      return result;
    } else {
      length = this.extraHeaders.length;
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        header = this.extraHeaders[idx];
        if (regexp.test(header)) {
          result.push(header.substring(header.indexOf(':')+1).trim());
        }
      }
      return result;
    }
  },

  /**
   * Verify the existence of the given header.
   * @param {String} name header name
   * @returns {boolean} true if header with given name exists, false otherwise
   */
  hasHeader: function(name) {
    var regexp, idx,
      length = this.extraHeaders.length;

    if (this.headers[SIP.Utils.headerize(name)]) {
      return true;
    } else {
      regexp = new RegExp('^\\s*' + name + '\\s*:','i');
      for (idx = 0; idx < length; idx++) {
        if (regexp.test(this.extraHeaders[idx])) {
          return true;
        }
      }
    }

    return false;
  },

  toString: function() {
    var msg = '', header, length, idx;

    msg += this.method + ' ' + (this.ruri.toRaw ? this.ruri.toRaw() : this.ruri) + ' SIP/2.0\r\n';

    for (header in this.headers) {
      length = this.headers[header].length;
      for (idx = 0; idx < length; idx++) {
        msg += header + ': ' + this.headers[header][idx] + '\r\n';
      }
    }

    length = this.extraHeaders.length;
    for (idx = 0; idx < length; idx++) {
      msg += this.extraHeaders[idx].trim() +'\r\n';
    }

    msg += getSupportedHeader(this);
    msg += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';

    if (this.body) {
      if (typeof this.body === 'string') {
        length = SIP.Utils.str_utf8_length(this.body);
        msg += 'Content-Length: ' + length + '\r\n\r\n';
        msg += this.body;
      } else {
        if (this.body.body && this.body.contentType) {
          length = SIP.Utils.str_utf8_length(this.body.body);
          msg += 'Content-Type: ' + this.body.contentType + '\r\n';
          msg += 'Content-Length: ' + length + '\r\n\r\n';
          msg += this.body.body;
        } else {
          msg += 'Content-Length: ' + 0 + '\r\n\r\n';
        }
      }
    } else {
      msg += 'Content-Length: ' + 0 + '\r\n\r\n';
    }

    return msg;
  }
};

/**
 * @augments SIP
 * @class Class for incoming SIP message.
 */
IncomingMessage = function(){
  this.data = null;
  this.headers = null;
  this.method =  null;
  this.via = null;
  this.via_branch = null;
  this.call_id = null;
  this.cseq = null;
  this.from = null;
  this.from_tag = null;
  this.to = null;
  this.to_tag = null;
  this.body = null;
};

IncomingMessage.prototype = {
  /**
  * Insert a header of the given name and value into the last position of the
  * header array.
  * @param {String} name header name
  * @param {String} value header value
  */
  addHeader: function(name, value) {
    var header = { raw: value };

    name = SIP.Utils.headerize(name);

    if(this.headers[name]) {
      this.headers[name].push(header);
    } else {
      this.headers[name] = [header];
    }
  },

  /**
   * Get the value of the given header name at the given position.
   * @param {String} name header name
   * @returns {String|undefined} Returns the specified header, null if header doesn't exist.
   */
  getHeader: function(name) {
    var header = this.headers[SIP.Utils.headerize(name)];

    if(header) {
      if(header[0]) {
        return header[0].raw;
      }
    } else {
      return;
    }
  },

  /**
   * Get the header/s of the given name.
   * @param {String} name header name
   * @returns {Array} Array with all the headers of the specified name.
   */
  getHeaders: function(name) {
    var idx, length,
      header = this.headers[SIP.Utils.headerize(name)],
      result = [];

    if(!header) {
      return [];
    }

    length = header.length;
    for (idx = 0; idx < length; idx++) {
      result.push(header[idx].raw);
    }

    return result;
  },

  /**
   * Verify the existence of the given header.
   * @param {String} name header name
   * @returns {boolean} true if header with given name exists, false otherwise
   */
  hasHeader: function(name) {
    return(this.headers[SIP.Utils.headerize(name)]) ? true : false;
  },

  /**
  * Parse the given header on the given index.
  * @param {String} name header name
  * @param {Number} [idx=0] header index
  * @returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
  */
  parseHeader: function(name, idx) {
    var header, value, parsed;

    name = SIP.Utils.headerize(name);

    idx = idx || 0;

    if(!this.headers[name]) {
      this.logger.log('header "' + name + '" not present');
      return;
    } else if(idx >= this.headers[name].length) {
      this.logger.log('not so many "' + name + '" headers present');
      return;
    }

    header = this.headers[name][idx];
    value = header.raw;

    if(header.parsed) {
      return header.parsed;
    }

    //substitute '-' by '_' for grammar rule matching.
    parsed = SIP.Grammar.parse(value, name.replace(/-/g, '_'));

    if(parsed === -1) {
      this.headers[name].splice(idx, 1); //delete from headers
      this.logger.warn('error parsing "' + name + '" header field with value "' + value + '"');
      return;
    } else {
      header.parsed = parsed;
      return parsed;
    }
  },

  /**
   * Message Header attribute selector. Alias of parseHeader.
   * @param {String} name header name
   * @param {Number} [idx=0] header index
   * @returns {Object|undefined} Parsed header object, undefined if the header is not present or in case of a parsing error.
   *
   * @example
   * message.s('via',3).port
   */
  s: function(name, idx) {
    return this.parseHeader(name, idx);
  },

  /**
  * Replace the value of the given header by the value.
  * @param {String} name header name
  * @param {String} value header value
  */
  setHeader: function(name, value) {
    var header = { raw: value };
    this.headers[SIP.Utils.headerize(name)] = [header];
  },

  toString: function() {
    return this.data;
  }
};

/**
 * @augments IncomingMessage
 * @class Class for incoming SIP request.
 */
IncomingRequest = function(ua) {
  this.logger = ua.getLogger('sip.sipmessage');
  this.ua = ua;
  this.headers = {};
  this.ruri = null;
  this.transport = null;
  this.server_transaction = null;
};
IncomingRequest.prototype = new IncomingMessage();

/**
* Stateful reply.
* @param {Number} code status code
* @param {String} reason reason phrase
* @param {Object} headers extra headers
* @param {String} body body
* @param {Function} [onSuccess] onSuccess callback
* @param {Function} [onFailure] onFailure callback
*/
IncomingRequest.prototype.reply = function(code, reason, extraHeaders, body, onSuccess, onFailure) {
  var rr, vias, length, idx, response,
    to = this.getHeader('To'),
    r = 0,
    v = 0;

  response = SIP.Utils.buildStatusLine(code, reason);
  extraHeaders = (extraHeaders || []).slice();

  if(this.method === SIP.C.INVITE && code > 100 && code <= 200) {
    rr = this.getHeaders('record-route');
    length = rr.length;

    for(r; r < length; r++) {
      response += 'Record-Route: ' + rr[r] + '\r\n';
    }
  }

  vias = this.getHeaders('via');
  length = vias.length;

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  if(!this.to_tag && code > 100) {
    to += ';tag=' + SIP.Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';

  length = extraHeaders.length;
  for (idx = 0; idx < length; idx++) {
    response += extraHeaders[idx].trim() +'\r\n';
  }

  response += getSupportedHeader(this);
  response += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';

  if (body) {
    if (typeof body === 'string') {
      length = SIP.Utils.str_utf8_length(body);
      response += 'Content-Type: application/sdp\r\n';
      response += 'Content-Length: ' + length + '\r\n\r\n';
      response += body;
    } else {
      if (body.body && body.contentType) {
        length = SIP.Utils.str_utf8_length(body.body);
        response += 'Content-Type: ' + body.contentType + '\r\n';
        response += 'Content-Length: ' + length + '\r\n\r\n';
        response += body.body;
      } else {
        response += 'Content-Length: ' + 0 + '\r\n\r\n';
      }
    }
  } else {
    response += 'Content-Length: ' + 0 + '\r\n\r\n';
  }

  this.server_transaction.receiveResponse(code, response).then(onSuccess, onFailure);

  return response;
};

/**
* Stateless reply.
* @param {Number} code status code
* @param {String} reason reason phrase
*/
IncomingRequest.prototype.reply_sl = function(code, reason) {
  var to, response,
    v = 0,
    vias = this.getHeaders('via'),
    length = vias.length;

  response = SIP.Utils.buildStatusLine(code, reason);

  for(v; v < length; v++) {
    response += 'Via: ' + vias[v] + '\r\n';
  }

  to = this.getHeader('To');

  if(!this.to_tag && code > 100) {
    to += ';tag=' + SIP.Utils.newTag();
  } else if(this.to_tag && !this.s('to').hasParam('tag')) {
    to += ';tag=' + this.to_tag;
  }

  response += 'To: ' + to + '\r\n';
  response += 'From: ' + this.getHeader('From') + '\r\n';
  response += 'Call-ID: ' + this.call_id + '\r\n';
  response += 'CSeq: ' + this.cseq + ' ' + this.method + '\r\n';
  response += 'User-Agent: ' + this.ua.configuration.userAgentString +'\r\n';
  response += 'Content-Length: ' + 0 + '\r\n\r\n';

  this.transport.send(response);
};


/**
 * @augments IncomingMessage
 * @class Class for incoming SIP response.
 */
IncomingResponse = function(ua) {
  this.logger = ua.getLogger('sip.sipmessage');
  this.headers = {};
  this.status_code = null;
  this.reason_phrase = null;
};
IncomingResponse.prototype = new IncomingMessage();

SIP.OutgoingRequest = OutgoingRequest;
SIP.IncomingRequest = IncomingRequest;
SIP.IncomingResponse = IncomingResponse;
};

},{}],109:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Incoming SIP Message Sanity Check
 */

/**
 * SIP message sanity check.
 * @augments SIP
 * @function
 * @param {SIP.IncomingMessage} message
 * @param {SIP.UA} ua
 * @param {SIP.Transport} transport
 * @returns {Boolean}
 */
module.exports = function (SIP) {
var sanityCheck,
 requests = [],
 responses = [],
 all = [];

// Reply
function reply(status_code, message, transport) {
  var to,
    response = SIP.Utils.buildStatusLine(status_code),
    vias = message.getHeaders('via'),
    length = vias.length,
    idx = 0;

  for(idx; idx < length; idx++) {
    response += "Via: " + vias[idx] + "\r\n";
  }

  to = message.getHeader('To');

  if(!message.to_tag) {
    to += ';tag=' + SIP.Utils.newTag();
  }

  response += "To: " + to + "\r\n";
  response += "From: " + message.getHeader('From') + "\r\n";
  response += "Call-ID: " + message.call_id + "\r\n";
  response += "CSeq: " + message.cseq + " " + message.method + "\r\n";
  response += "\r\n";

  transport.send(response);
}

/*
 * Sanity Check for incoming Messages
 *
 * Requests:
 *  - _rfc3261_8_2_2_1_ Receive a Request with a non supported URI scheme
 *  - _rfc3261_16_3_4_ Receive a Request already sent by us
 *   Does not look at via sent-by but at sipjsId, which is inserted as
 *   a prefix in all initial requests generated by the ua
 *  - _rfc3261_18_3_request_ Body Content-Length
 *  - _rfc3261_8_2_2_2_ Merged Requests
 *
 * Responses:
 *  - _rfc3261_8_1_3_3_ Multiple Via headers
 *  - _rfc3261_18_1_2_ sent-by mismatch
 *  - _rfc3261_18_3_response_ Body Content-Length
 *
 * All:
 *  - Minimum headers in a SIP message
 */

// Sanity Check functions for requests
function rfc3261_8_2_2_1(message, ua, transport) {
  if(!message.ruri || message.ruri.scheme !== 'sip') {
    reply(416, message, transport);
    return false;
  }
}

function rfc3261_16_3_4(message, ua, transport) {
  if(!message.to_tag) {
    if(message.call_id.substr(0, 5) === ua.configuration.sipjsId) {
      reply(482, message, transport);
      return false;
    }
  }
}

function rfc3261_18_3_request(message, ua, transport) {
  var len = SIP.Utils.str_utf8_length(message.body),
  contentLength = message.getHeader('content-length');

  if(len < contentLength) {
    reply(400, message, transport);
    return false;
  }
}

function rfc3261_8_2_2_2(message, ua, transport) {
  var tr, idx,
    fromTag = message.from_tag,
    call_id = message.call_id,
    cseq = message.cseq;

  if(!message.to_tag) {
    if(message.method === SIP.C.INVITE) {
      tr = ua.transactions.ist[message.via_branch];
      if(tr) {
        return;
      } else {
        for(idx in ua.transactions.ist) {
          tr = ua.transactions.ist[idx];
          if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
            reply(482, message, transport);
            return false;
          }
        }
      }
    } else {
      tr = ua.transactions.nist[message.via_branch];
      if(tr) {
        return;
      } else {
        for(idx in ua.transactions.nist) {
          tr = ua.transactions.nist[idx];
          if(tr.request.from_tag === fromTag && tr.request.call_id === call_id && tr.request.cseq === cseq) {
            reply(482, message, transport);
            return false;
          }
        }
      }
    }
  }
}

// Sanity Check functions for responses
function rfc3261_8_1_3_3(message, ua) {
  if(message.getHeaders('via').length > 1) {
    ua.getLogger('sip.sanitycheck').warn('More than one Via header field present in the response. Dropping the response');
    return false;
  }
}

function rfc3261_18_3_response(message, ua) {
  var
    len = SIP.Utils.str_utf8_length(message.body),
    contentLength = message.getHeader('content-length');

    if(len < contentLength) {
      ua.getLogger('sip.sanitycheck').warn('Message body length is lower than the value in Content-Length header field. Dropping the response');
      return false;
    }
}

// Sanity Check functions for requests and responses
function minimumHeaders(message, ua) {
  var
    mandatoryHeaders = ['from', 'to', 'call_id', 'cseq', 'via'],
    idx = mandatoryHeaders.length;

  while(idx--) {
    if(!message.hasHeader(mandatoryHeaders[idx])) {
      ua.getLogger('sip.sanitycheck').warn('Missing mandatory header field : '+ mandatoryHeaders[idx] +'. Dropping the response');
      return false;
    }
  }
}

requests.push(rfc3261_8_2_2_1);
requests.push(rfc3261_16_3_4);
requests.push(rfc3261_18_3_request);
requests.push(rfc3261_8_2_2_2);

responses.push(rfc3261_8_1_3_3);
// responses.push(rfc3261_18_1_2);
responses.push(rfc3261_18_3_response);

all.push(minimumHeaders);

sanityCheck = function(message, ua, transport) {
  var len, pass;

  len = all.length;
  while(len--) {
    pass = all[len](message, ua, transport);
    if(pass === false) {
      return false;
    }
  }

  if(message instanceof SIP.IncomingRequest) {
    len = requests.length;
    while(len--) {
      pass = requests[len](message, ua, transport);
      if(pass === false) {
        return false;
      }
    }
  }

  else if(message instanceof SIP.IncomingResponse) {
    len = responses.length;
    while(len--) {
      pass = responses[len](message, ua, transport);
      if(pass === false) {
        return false;
      }
    }
  }

  //Everything is OK
  return true;
};

SIP.sanityCheck = sanityCheck;
};

},{}],110:[function(require,module,exports){
"use strict";
module.exports = function (SIP) {
var ServerContext;

ServerContext = function (ua, request) {
  this.ua = ua;
  this.logger = ua.getLogger('sip.servercontext');
  this.request = request;
  if (request.method === SIP.C.INVITE) {
    this.transaction = new SIP.Transactions.InviteServerTransaction(request, ua);
  } else {
    this.transaction = new SIP.Transactions.NonInviteServerTransaction(request, ua);
  }

  if (request.body) {
    this.body = request.body;
  }
  if (request.hasHeader('Content-Type')) {
    this.contentType = request.getHeader('Content-Type');
  }
  this.method = request.method;

  this.data = {};

  this.localIdentity = request.to;
  this.remoteIdentity = request.from;
};

ServerContext.prototype = Object.create(SIP.EventEmitter.prototype);

ServerContext.prototype.progress = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 180);
  options.minCode = 100;
  options.maxCode = 199;
  options.events = ['progress'];
  return this.reply(options);
};

ServerContext.prototype.accept = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 200);
  options.minCode = 200;
  options.maxCode = 299;
  options.events = ['accepted'];
  return this.reply(options);
};

ServerContext.prototype.reject = function (options) {
  options = Object.create(options || Object.prototype);
  options.statusCode || (options.statusCode = 480);
  options.minCode = 300;
  options.maxCode = 699;
  options.events = ['rejected', 'failed'];
  return this.reply(options);
};

ServerContext.prototype.reply = function (options) {
  options = options || {}; // This is okay, so long as we treat options as read-only in this method
  var
    statusCode = options.statusCode || 100,
    minCode = options.minCode || 100,
    maxCode = options.maxCode || 699,
    reasonPhrase = SIP.Utils.getReasonPhrase(statusCode, options.reasonPhrase),
    extraHeaders = options.extraHeaders || [],
    body = options.body,
    events = options.events || [],
    response;

  if (statusCode < minCode || statusCode > maxCode) {
    throw new TypeError('Invalid statusCode: ' + statusCode);
  }
  response = this.request.reply(statusCode, reasonPhrase, extraHeaders, body);
  events.forEach(function (event) {
    this.emit(event, response, reasonPhrase);
  }, this);

  return this;
};

ServerContext.prototype.onRequestTimeout = function () {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
};

ServerContext.prototype.onTransportError = function () {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
};

SIP.ServerContext = ServerContext;
};

},{}],111:[function(require,module,exports){
"use strict";
module.exports = function (SIP, environment) {

var DTMF = require('./Session/DTMF')(SIP);
var RFC4028 = require('./RFC4028')(SIP.Timers);

var Session, InviteServerContext, InviteClientContext,
 C = {
    //Session states
    STATUS_NULL:                        0,
    STATUS_INVITE_SENT:                 1,
    STATUS_1XX_RECEIVED:                2,
    STATUS_INVITE_RECEIVED:             3,
    STATUS_WAITING_FOR_ANSWER:          4,
    STATUS_ANSWERED:                    5,
    STATUS_WAITING_FOR_PRACK:           6,
    STATUS_WAITING_FOR_ACK:             7,
    STATUS_CANCELED:                    8,
    STATUS_TERMINATED:                  9,
    STATUS_ANSWERED_WAITING_FOR_PRACK: 10,
    STATUS_EARLY_MEDIA:                11,
    STATUS_CONFIRMED:                  12
  };

/*
 * @param {function returning SIP.MediaHandler} [mediaHandlerFactory]
 *        (See the documentation for the mediaHandlerFactory argument of the UA constructor.)
 */
Session = function (mediaHandlerFactory) {
  this.status = C.STATUS_NULL;
  this.dialog = null;
  this.earlyDialogs = {};
  this.mediaHandlerFactory = mediaHandlerFactory || SIP.WebRTC.MediaHandler.defaultFactory;
  // this.mediaHandler gets set by ICC/ISC constructors
  this.hasOffer = false;
  this.hasAnswer = false;

  // Session Timers
  this.timers = {
    ackTimer: null,
    expiresTimer: null,
    invite2xxTimer: null,
    userNoAnswerTimer: null,
    rel1xxTimer: null,
    prackTimer: null
  };

  // Session info
  this.startTime = null;
  this.endTime = null;
  this.tones = null;

  // Mute/Hold state
  this.local_hold = false;
  this.remote_hold = false;

  this.pending_actions = {
    actions: [],

    length: function() {
      return this.actions.length;
    },

    isPending: function(name){
      var
      idx = 0,
      length = this.actions.length;

      for (idx; idx<length; idx++) {
        if (this.actions[idx].name === name) {
          return true;
        }
      }
      return false;
    },

    shift: function() {
      return this.actions.shift();
    },

    push: function(name) {
      this.actions.push({
        name: name
      });
    },

    pop: function(name) {
      var
      idx = 0,
      length = this.actions.length;

      for (idx; idx<length; idx++) {
        if (this.actions[idx].name === name) {
          this.actions.splice(idx,1);
          length --;
          idx--;
        }
      }
    }
   };

  this.early_sdp = null;
  this.rel100 = SIP.C.supported.UNSUPPORTED;
};

Session.prototype = {
  dtmf: function(tones, options) {
    var tone, dtmfs = [],
        self = this;

    options = options || {};

    if (tones === undefined) {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_WAITING_FOR_ACK) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    // Check tones
    if ((typeof tones !== 'string' && typeof tones !== 'number') || !tones.toString().match(/^[0-9A-D#*,]+$/i)) {
      throw new TypeError('Invalid tones: '+ tones);
    }

    tones = tones.toString().split('');

    while (tones.length > 0) { dtmfs.push(new DTMF(this, tones.shift(), options)); }

    if (this.tones) {
      // Tones are already queued, just add to the queue
      this.tones =  this.tones.concat(dtmfs);
      return this;
    }

    var sendDTMF = function () {
      var dtmf, timeout;

      if (self.status === C.STATUS_TERMINATED || !self.tones || self.tones.length === 0) {
        // Stop sending DTMF
        self.tones = null;
        return this;
      }

      dtmf = self.tones.shift();

      if (tone === ',') {
        timeout = 2000;
      } else {
        dtmf.on('failed', function(){self.tones = null;});
        dtmf.send(options);
        timeout = dtmf.duration + dtmf.interToneGap;
      }

      // Set timeout for the next tone
      SIP.Timers.setTimeout(sendDTMF, timeout);
    };

    this.tones = dtmfs;
    sendDTMF();
    return this;
  },

  bye: function(options) {
    options = Object.create(options || Object.prototype);
    var statusCode = options.statusCode;

    // Check Session Status
    if (this.status === C.STATUS_TERMINATED) {
      this.logger.error('Error: Attempted to send BYE in a terminated session.');
      return this;
    }

    this.logger.log('terminating Session');

    if (statusCode && (statusCode < 200 || statusCode >= 700)) {
      throw new TypeError('Invalid statusCode: '+ statusCode);
    }

    options.receiveResponse = function () {};

    return this.
      sendRequest(SIP.C.BYE, options).
      terminated();
  },

  refer: function(target, options) {
    options = options || {};
    var extraHeaders = (options.extraHeaders || []).slice(),
        withReplaces =
          target instanceof SIP.InviteServerContext ||
          target instanceof SIP.InviteClientContext,
        originalTarget = target;

    if (target === undefined) {
      throw new TypeError('Not enough arguments');
    }

    // Check Session Status
    if (this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    // transform `target` so that it can be a Refer-To header value
    if (withReplaces) {
      //Attended Transfer
      // B.transfer(C)
      target = '"' + target.remoteIdentity.friendlyName + '" ' +
        '<' + target.dialog.remote_target.toString() +
        '?Replaces=' + target.dialog.id.call_id +
        '%3Bto-tag%3D' + target.dialog.id.remote_tag +
        '%3Bfrom-tag%3D' + target.dialog.id.local_tag + '>';
    } else {
      //Blind Transfer
      // normalizeTarget allows instances of SIP.URI to pass through unaltered,
      // so try to make one ahead of time
      try {
        target = SIP.Grammar.parse(target, 'Refer_To').uri || target;
      } catch (e) {
        this.logger.debug(".refer() cannot parse Refer_To from", target);
        this.logger.debug("...falling through to normalizeTarget()");
      }

      // Check target validity
      target = this.ua.normalizeTarget(target);
      if (!target) {
        throw new TypeError('Invalid target: ' + originalTarget);
      }
    }

    extraHeaders.push('Contact: '+ this.contact);
    extraHeaders.push('Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString());
    extraHeaders.push('Refer-To: '+ target);

    // Send the request
    this.sendRequest(SIP.C.REFER, {
      extraHeaders: extraHeaders,
      body: options.body,
      receiveResponse: function (response) {
        if ( ! /^2[0-9]{2}$/.test(response.status_code) ) {
          return;
        }
        // hang up only if we transferred to a SIP address
        if (withReplaces || (target.scheme && target.scheme.match("^sips?$"))) {
          this.terminate();
        }
      }.bind(this)
    });
    return this;
  },

  followRefer: function followRefer (callback) {
    return function referListener (callback, request) {
      // open non-SIP URIs if possible and keep session open
      var referTo = request.parseHeader('refer-to');
      var target = referTo.uri;
      if (!target.scheme.match("^sips?$")) {
        var targetString = target.toString();
        if (typeof environment.open === "function") {
          environment.open(targetString);
        } else {
          this.logger.warn("referred to non-SIP URI but `open` isn't in the environment: " + targetString);
        }
        return;
      }

      var extraHeaders = [];

      /* Copy the Replaces query into a Replaces header */
      /* TODO - make sure we don't copy a poorly formatted header? */
      var replaces = target.getHeader('Replaces');
      if (replaces !== undefined) {
        extraHeaders.push('Replaces: ' + decodeURIComponent(replaces));
      }

      // don't embed headers into Request-URI of INVITE
      target.clearHeaders();

      /*
        Harmless race condition.  Both sides of REFER
        may send a BYE, but in the end the dialogs are destroyed.
      */
      var getReferMedia = this.mediaHandler.getReferMedia;
      var mediaHint = getReferMedia ? getReferMedia.call(this.mediaHandler) : this.mediaHint;

      SIP.Hacks.Chrome.getsConfusedAboutGUM(this);

      var referSession = this.ua.invite(target, {
        media: mediaHint,
        params: {
          to_displayName: referTo.friendlyName
        },
        extraHeaders: extraHeaders
      });

      callback.call(this, request, referSession);

      this.terminate();
    }.bind(this, callback);
  },

  sendRequest: function(method,options) {
    options = options || {};
    var self = this;

    var request = new SIP.OutgoingRequest(
      method,
      this.dialog.remote_target,
      this.ua,
      {
        cseq: options.cseq || (this.dialog.local_seqnum += 1),
        call_id: this.dialog.id.call_id,
        from_uri: this.dialog.local_uri,
        from_tag: this.dialog.id.local_tag,
        to_uri: this.dialog.remote_uri,
        to_tag: this.dialog.id.remote_tag,
        route_set: this.dialog.route_set,
        statusCode: options.statusCode,
        reasonPhrase: options.reasonPhrase
      },
      options.extraHeaders || [],
      options.body
    );

    new SIP.RequestSender({
      request: request,
      onRequestTimeout: function() {
        self.onRequestTimeout();
      },
      onTransportError: function() {
        self.onTransportError();
      },
      receiveResponse: options.receiveResponse || function(response) {
        self.receiveNonInviteResponse(response);
      }
    }, this.ua).send();

    // Emit the request event
    this.emit(method.toLowerCase(), request);

    return this;
  },

  close: function() {
    var idx;

    if(this.status === C.STATUS_TERMINATED) {
      return this;
    }

    this.logger.log('closing INVITE session ' + this.id);

    // 1st Step. Terminate media.
    if (this.mediaHandler){
      this.mediaHandler.close();
    }

    // 2nd Step. Terminate signaling.

    // Clear session timers
    for(idx in this.timers) {
      SIP.Timers.clearTimeout(this.timers[idx]);
    }

    // Terminate dialogs

    // Terminate confirmed dialog
    if(this.dialog) {
      this.dialog.terminate();
      delete this.dialog;
    }

    // Terminate early dialogs
    for(idx in this.earlyDialogs) {
      this.earlyDialogs[idx].terminate();
      delete this.earlyDialogs[idx];
    }

    this.status = C.STATUS_TERMINATED;

    delete this.ua.sessions[this.id];
    return this;
  },

  createDialog: function(message, type, early) {
    var dialog, early_dialog,
      local_tag = message[(type === 'UAS') ? 'to_tag' : 'from_tag'],
      remote_tag = message[(type === 'UAS') ? 'from_tag' : 'to_tag'],
      id = message.call_id + local_tag + remote_tag;

    early_dialog = this.earlyDialogs[id];

    // Early Dialog
    if (early) {
      if (early_dialog) {
        return true;
      } else {
        early_dialog = new SIP.Dialog(this, message, type, SIP.Dialog.C.STATUS_EARLY);

        // Dialog has been successfully created.
        if(early_dialog.error) {
          this.logger.error(early_dialog.error);
          this.failed(message, SIP.C.causes.INTERNAL_ERROR);
          return false;
        } else {
          this.earlyDialogs[id] = early_dialog;
          return true;
        }
      }
    }
    // Confirmed Dialog
    else {
      // In case the dialog is in _early_ state, update it
      if (early_dialog) {
        early_dialog.update(message, type);
        this.dialog = early_dialog;
        delete this.earlyDialogs[id];
        for (var dia in this.earlyDialogs) {
          this.earlyDialogs[dia].terminate();
          delete this.earlyDialogs[dia];
        }
        return true;
      }

      // Otherwise, create a _confirmed_ dialog
      dialog = new SIP.Dialog(this, message, type);

      if(dialog.error) {
        this.logger.error(dialog.error);
        this.failed(message, SIP.C.causes.INTERNAL_ERROR);
        return false;
      } else {
        this.to_tag = message.to_tag;
        this.dialog = dialog;
        return true;
      }
    }
  },

  /**
  * Check if Session is ready for a re-INVITE
  *
  * @returns {Boolean}
  */
  isReadyToReinvite: function() {
    return this.mediaHandler.isReady() &&
      !this.dialog.uac_pending_reply &&
      !this.dialog.uas_pending_reply;
  },

  /**
   * Mute
   */
  mute: function(options) {
    var ret = this.mediaHandler.mute(options);
    if (ret) {
      this.onmute(ret);
    }
  },

  /**
   * Unmute
   */
  unmute: function(options) {
    var ret = this.mediaHandler.unmute(options);
    if (ret) {
      this.onunmute(ret);
    }
  },

  /**
   * Hold
   */
  hold: function() {

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.mediaHandler.hold();

    // Check if RTCSession is ready to send a reINVITE
    if (!this.isReadyToReinvite()) {
      /* If there is a pending 'unhold' action, cancel it and don't queue this one
       * Else, if there isn't any 'hold' action, add this one to the queue
       * Else, if there is already a 'hold' action, skip
       */
      if (this.pending_actions.isPending('unhold')) {
        this.pending_actions.pop('unhold');
      } else if (!this.pending_actions.isPending('hold')) {
        this.pending_actions.push('hold');
      }
      return;
    } else if (this.local_hold === true) {
        return;
    }

    this.onhold('local');

    this.sendReinvite();
  },

  /**
   * Unhold
   */
  unhold: function(options) {

    if (this.status !== C.STATUS_WAITING_FOR_ACK && this.status !== C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.mediaHandler.unhold();

    if (!this.isReadyToReinvite()) {
      /* If there is a pending 'hold' action, cancel it and don't queue this one
       * Else, if there isn't any 'unhold' action, add this one to the queue
       * Else, if there is already a 'unhold' action, skip
       */
      if (this.pending_actions.isPending('hold')) {
        this.pending_actions.pop('hold');
      } else if (!this.pending_actions.isPending('unhold')) {
        this.pending_actions.push('unhold');
      }
      return;
    } else if (this.local_hold === false) {
      return;
    }

    this.onunhold('local');

    this.sendReinvite(options);
  },

  /**
   * isOnHold
   */
  isOnHold: function() {
    return {
      local: this.local_hold,
      remote: this.remote_hold
    };
  },

  /**
   * In dialog INVITE Reception
   * @private
   */
  receiveReinvite: function(request) {
    var self = this;

    if (!this.mediaHandler.hasDescription(request)) {
      this.logger.warn('invalid Content-Type');
      request.reply(415);
      return;
    }

    this.mediaHandler.setDescription(request)
    .then(this.mediaHandler.getDescription.bind(this.mediaHandler, this.mediaHint))
    .then(function(description) {
      var extraHeaders = ['Contact: ' + self.contact];
      request.reply(200, null, extraHeaders, description,
        function() {
          self.status = C.STATUS_WAITING_FOR_ACK;
          self.setInvite2xxTimer(request, description);
          self.setACKTimer();

          if (self.remote_hold && !self.mediaHandler.remote_hold) {
            self.onunhold('remote');
          } else if (!self.remote_hold && self.mediaHandler.remote_hold) {
            self.onhold('remote');
          }
        });
    })
    .catch(function onFailure (e) {
      var statusCode;
      if (e instanceof SIP.Exceptions.GetDescriptionError) {
        statusCode = 500;
      } else {
        self.logger.error(e);
        statusCode = 488;
      }
      request.reply(statusCode);
    });
  },

  sendReinvite: function(options) {
    options = options || {};

    var
      self = this,
       extraHeaders = (options.extraHeaders || []).slice(),
       eventHandlers = options.eventHandlers || {},
       succeeded;

    if (eventHandlers.succeeded) {
      succeeded = eventHandlers.succeeded;
    }
    this.reinviteSucceeded = function(){
      SIP.Timers.clearTimeout(self.timers.ackTimer);
      SIP.Timers.clearTimeout(self.timers.invite2xxTimer);
      self.status = C.STATUS_CONFIRMED;
      succeeded && succeeded.apply(this, arguments);
    };
    if (eventHandlers.failed) {
      this.reinviteFailed = eventHandlers.failed;
    } else {
      this.reinviteFailed = function(){};
    }

    extraHeaders.push('Contact: ' + this.contact);
    extraHeaders.push('Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString());

    this.receiveResponse = this.receiveReinviteResponse;
    //REVISIT
    this.mediaHandler.getDescription(self.mediaHint)
    .then(
      function(description){
        self.dialog.sendRequest(self, SIP.C.INVITE, {
          extraHeaders: extraHeaders,
          body: description
        });
      },
      function() {
        if (self.isReadyToReinvite()) {
          self.onReadyToReinvite();
        }
        self.reinviteFailed();
      }
    );
  },

  receiveRequest: function (request) {
    switch (request.method) {
      case SIP.C.BYE:
        request.reply(200);
        if(this.status === C.STATUS_CONFIRMED) {
          this.emit('bye', request);
          this.terminated(request, SIP.C.causes.BYE);
        }
        break;
      case SIP.C.INVITE:
        if(this.status === C.STATUS_CONFIRMED) {
          this.logger.log('re-INVITE received');
          this.receiveReinvite(request);
        }
        break;
      case SIP.C.INFO:
        if (this.status === C.STATUS_1XX_RECEIVED ||
            this.status === C.STATUS_WAITING_FOR_PRACK ||
            this.status === C.STATUS_WAITING_FOR_ACK ||
            this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK ||
            this.status === C.STATUS_EARLY_MEDIA ||
            this.status === C.STATUS_CONFIRMED ||
            this.dialog) {
          if (this.onInfo) {
            return this.onInfo(request);
          }

          var body, tone, duration,
              contentType = request.getHeader('content-type'),
              reg_tone = /^(Signal\s*?=\s*?)([0-9A-D#*]{1})(\s)?.*/,
              reg_duration = /^(Duration\s?=\s?)([0-9]{1,4})(\s)?.*/;

          if (contentType) {
            if (contentType.match(/^application\/dtmf-relay/i)) {
              if (request.body) {
                body = request.body.split('\r\n', 2);
                if (body.length === 2) {
                  if (reg_tone.test(body[0])) {
                    tone = body[0].replace(reg_tone,"$2");
                  }
                  if (reg_duration.test(body[1])) {
                    duration = parseInt(body[1].replace(reg_duration,"$2"), 10);
                  }
                }
              }

              new DTMF(this, tone, {duration: duration}).init_incoming(request);
            } else {
              request.reply(415, null, ["Accept: application/dtmf-relay"]);
            }
          }
        }
        break;
      case SIP.C.REFER:
        if(this.status ===  C.STATUS_CONFIRMED) {
          this.logger.log('REFER received');
          var hasReferListener = this.listeners('refer').length,
              notifyBody;

          if (hasReferListener) {
            request.reply(202, 'Accepted');
            notifyBody = 'SIP/2.0 100 Trying';

            this.sendRequest(SIP.C.NOTIFY, {
              extraHeaders:[
                'Event: refer',
                'Subscription-State: terminated',
                'Content-Type: message/sipfrag'
              ],
              body: notifyBody,
              receiveResponse: function() {}
            });

            this.emit('refer', request);
          } else {
            // RFC 3515.2.4.2: 'the UA MAY decline the request.'
            request.reply(603, 'Declined');
          }
        }
        break;
      case SIP.C.NOTIFY:
        request.reply(200, 'OK');
        this.emit('notify', request);
        break;
    }
  },

  /**
   * Reception of Response for in-dialog INVITE
   * @private
   */
  receiveReinviteResponse: function(response) {
    var self = this;

    if (this.status === C.STATUS_TERMINATED) {
      return;
    }

    switch(true) {
      case /^1[0-9]{2}$/.test(response.status_code):
        break;
      case /^2[0-9]{2}$/.test(response.status_code):
        this.status = C.STATUS_CONFIRMED;

        this.sendRequest(SIP.C.ACK,{cseq:response.cseq});

        if (!this.mediaHandler.hasDescription(response)) {
          this.reinviteFailed();
          break;
        }

        //REVISIT
        this.mediaHandler.setDescription(response)
        .then(
          function onSuccess () {
            self.reinviteSucceeded();
          },
          function onFailure () {
            self.reinviteFailed();
          }
        );
        break;
      default:
        this.reinviteFailed();
    }
  },

  acceptAndTerminate: function(response, status_code, reason_phrase) {
    var extraHeaders = [];

    if (status_code) {
      extraHeaders.push('Reason: ' + SIP.Utils.getReasonHeaderValue(status_code, reason_phrase));
    }

    // An error on dialog creation will fire 'failed' event
    if (this.dialog || this.createDialog(response, 'UAC')) {
      this.sendRequest(SIP.C.ACK,{cseq: response.cseq});
      this.sendRequest(SIP.C.BYE, {
        extraHeaders: extraHeaders
      });
    }

    return this;
  },

  /**
   * RFC3261 13.3.1.4
   * Response retransmissions cannot be accomplished by transaction layer
   *  since it is destroyed when receiving the first 2xx answer
   */
  setInvite2xxTimer: function(request, description) {
    var self = this,
        timeout = SIP.Timers.T1;

    this.timers.invite2xxTimer = SIP.Timers.setTimeout(function invite2xxRetransmission() {
      if (self.status !== C.STATUS_WAITING_FOR_ACK) {
        return;
      }

      self.logger.log('no ACK received, attempting to retransmit OK');

      var extraHeaders = ['Contact: ' + self.contact];

      request.reply(200, null, extraHeaders, description);

      timeout = Math.min(timeout * 2, SIP.Timers.T2);

      self.timers.invite2xxTimer = SIP.Timers.setTimeout(invite2xxRetransmission, timeout);
    }, timeout);
  },

  /**
   * RFC3261 14.2
   * If a UAS generates a 2xx response and never receives an ACK,
   *  it SHOULD generate a BYE to terminate the dialog.
   */
  setACKTimer: function() {
    var self = this;

    this.timers.ackTimer = SIP.Timers.setTimeout(function() {
      if(self.status === C.STATUS_WAITING_FOR_ACK) {
        self.logger.log('no ACK received for an extended period of time, terminating the call');
        SIP.Timers.clearTimeout(self.timers.invite2xxTimer);
        self.sendRequest(SIP.C.BYE);
        self.terminated(null, SIP.C.causes.NO_ACK);
      }
    }, SIP.Timers.TIMER_H);
  },

  /*
   * @private
   */
  onReadyToReinvite: function() {
    var action = this.pending_actions.shift();

    if (!action || !this[action.name]) {
      return;
    }

    this[action.name]();
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  },

  onDialogError: function(response) {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(response, SIP.C.causes.DIALOG_ERROR);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(response, SIP.C.causes.DIALOG_ERROR);
      this.terminated(response, SIP.C.causes.DIALOG_ERROR);
    }
  },

  /**
   * @private
   */
  onhold: function(originator) {
    this[originator === 'local' ? 'local_hold' : 'remote_hold'] = true;
    this.emit('hold', { originator: originator });
  },

  /**
   * @private
   */
  onunhold: function(originator) {
    this[originator === 'local' ? 'local_hold' : 'remote_hold'] = false;
    this.emit('unhold', { originator: originator });
  },

  /*
   * @private
   */
  onmute: function(options) {
    this.emit('muted', {
      audio: options.audio,
      video: options.video
    });
  },

  /*
   * @private
   */
  onunmute: function(options) {
    this.emit('unmuted', {
      audio: options.audio,
      video: options.video
    });
  },

  failed: function(response, cause) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }
    this.emit('failed', response || null, cause || null);
    return this;
  },

  rejected: function(response, cause) {
    this.emit('rejected',
      response || null,
      cause || null
    );
    return this;
  },

  canceled: function() {
    this.emit('cancel');
    return this;
  },

  accepted: function(response, cause) {
    cause = SIP.Utils.getReasonPhrase(response && response.status_code, cause);

    this.startTime = new Date();

    if (this.replacee) {
      this.replacee.emit('replaced', this);
      this.replacee.terminate();
    }
    if (response) {
      RFC4028.updateState(this.dialog, response, SIP.Parser.parseMessage, this.ua);
    }
    this.emit('accepted', response, cause);
    return this;
  },

  terminated: function(message, cause) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }

    this.endTime = new Date();

    this.close();
    this.emit('terminated',
      message || null,
      cause || null
    );
    return this;
  },

  connecting: function(request) {
    this.emit('connecting', { request: request });
    return this;
  }
};

Session.desugar = function desugar(options) {
  if (environment.HTMLMediaElement && options instanceof environment.HTMLMediaElement) {
    options = {
      media: {
        constraints: {
          audio: true,
          video: options.tagName === 'VIDEO'
        },
        render: {
          remote: options
        }
      }
    };
  }
  return options || {};
};


Session.C = C;
SIP.Session = Session;


InviteServerContext = function(ua, request) {
  var expires,
    self = this,
    contentType = request.getHeader('Content-Type'),
    contentDisp = request.parseHeader('Content-Disposition');

  SIP.Utils.augment(this, SIP.ServerContext, [ua, request]);
  SIP.Utils.augment(this, SIP.Session, [ua.configuration.mediaHandlerFactory]);

  //Initialize Media Session
  this.mediaHandler = this.mediaHandlerFactory(this, {
    RTCConstraints: {"optional": [{'DtlsSrtpKeyAgreement': 'true'}]}
  });

  // Check body and content type
  if ((!contentDisp && !this.mediaHandler.hasDescription(request)) || (contentDisp && contentDisp.type === 'render')) {
    this.renderbody = request.body;
    this.rendertype = contentType;
  } else if (!this.mediaHandler.hasDescription(request) && (contentDisp && contentDisp.type === 'session')) {
    request.reply(415);
    //TODO: instead of 415, pass off to the media handler, who can then decide if we can use it
    return;
  }

  // TODO test
  // http://tools.ietf.org/html/rfc4028#section-9
  if (RFC4028.hasSmallMinSE(request)) {
    request.reply(422, null, ['Min-SE: ' + RFC4028.localMinSE]);
    return;
  }

  this.status = C.STATUS_INVITE_RECEIVED;
  this.from_tag = request.from_tag;
  this.id = request.call_id + this.from_tag;
  this.request = request;
  this.contact = this.ua.contact.toString();

  this.receiveNonInviteResponse = function () {}; // intentional no-op

  this.logger = ua.getLogger('sip.inviteservercontext', this.id);

  //Save the session into the ua sessions collection.
  this.ua.sessions[this.id] = this;

  //Get the Expires header value if exists
  if(request.hasHeader('expires')) {
    expires = request.getHeader('expires') * 1000;
  }

  //Set 100rel if necessary
  function set100rel(h,c) {
    if (request.hasHeader(h) && request.getHeader(h).toLowerCase().indexOf('100rel') >= 0) {
      self.rel100 = c;
    }
  }
  set100rel('require', SIP.C.supported.REQUIRED);
  set100rel('supported', SIP.C.supported.SUPPORTED);

  /* Set the to_tag before
   * replying a response code that will create a dialog.
   */
  request.to_tag = SIP.Utils.newTag();

  // An error on dialog creation will fire 'failed' event
  if(!this.createDialog(request, 'UAS', true)) {
    request.reply(500, 'Missing Contact header field');
    return;
  }

  if (this.mediaHandler && this.mediaHandler.getRemoteStreams) {
    this.getRemoteStreams = this.mediaHandler.getRemoteStreams.bind(this.mediaHandler);
    this.getLocalStreams = this.mediaHandler.getLocalStreams.bind(this.mediaHandler);
  }

  function fireNewSession() {
    var options = {extraHeaders: ['Contact: ' + self.contact]};

    if (self.rel100 !== SIP.C.supported.REQUIRED) {
      self.progress(options);
    }
    self.status = C.STATUS_WAITING_FOR_ANSWER;

    // Set userNoAnswerTimer
    self.timers.userNoAnswerTimer = SIP.Timers.setTimeout(function() {
      request.reply(408);
      self.failed(request, SIP.C.causes.NO_ANSWER);
      self.terminated(request, SIP.C.causes.NO_ANSWER);
    }, self.ua.configuration.noAnswerTimeout);

    /* Set expiresTimer
     * RFC3261 13.3.1
     */
    if (expires) {
      self.timers.expiresTimer = SIP.Timers.setTimeout(function() {
        if(self.status === C.STATUS_WAITING_FOR_ANSWER) {
          request.reply(487);
          self.failed(request, SIP.C.causes.EXPIRES);
          self.terminated(request, SIP.C.causes.EXPIRES);
        }
      }, expires);
    }

    self.emit('invite',request);
  }

  if (!this.mediaHandler.hasDescription(request) || this.renderbody) {
    SIP.Timers.setTimeout(fireNewSession, 0);
  } else {
    this.hasOffer = true;
    this.mediaHandler.setDescription(request)
    .then(
      fireNewSession,
      function onFailure (e) {
        self.logger.warn('invalid description');
        self.logger.warn(e);
        request.reply(488);
      }
    );
  }
};

InviteServerContext.prototype = {
  reject: function(options) {
    // Check Session Status
    if (this.status === C.STATUS_TERMINATED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.logger.log('rejecting RTCSession');

    SIP.ServerContext.prototype.reject.call(this, options);
    return this.terminated();
  },

  terminate: function(options) {
    options = options || {};

    var
    extraHeaders = (options.extraHeaders || []).slice(),
    body = options.body,
    dialog,
    self = this;

    if (this.status === C.STATUS_WAITING_FOR_ACK &&
       this.request.server_transaction.state !== SIP.Transactions.C.STATUS_TERMINATED) {
      dialog = this.dialog;

      this.receiveRequest = function(request) {
        if (request.method === SIP.C.ACK) {
          this.sendRequest(SIP.C.BYE, {
            extraHeaders: extraHeaders,
            body: body
          });
          dialog.terminate();
        }
      };

      this.request.server_transaction.on('stateChanged', function(){
        if (this.state === SIP.Transactions.C.STATUS_TERMINATED && this.dialog) {
          this.request = new SIP.OutgoingRequest(
            SIP.C.BYE,
            this.dialog.remote_target,
            this.ua,
            {
              'cseq': this.dialog.local_seqnum+=1,
              'call_id': this.dialog.id.call_id,
              'from_uri': this.dialog.local_uri,
              'from_tag': this.dialog.id.local_tag,
              'to_uri': this.dialog.remote_uri,
              'to_tag': this.dialog.id.remote_tag,
              'route_set': this.dialog.route_set
            },
            extraHeaders,
            body
          );

          new SIP.RequestSender(
            {
              request: this.request,
              onRequestTimeout: function() {
                self.onRequestTimeout();
              },
              onTransportError: function() {
                self.onTransportError();
              },
              receiveResponse: function() {
                return;
              }
            },
            this.ua
          ).send();
          dialog.terminate();
        }
      });

      this.emit('bye', this.request);
      this.terminated();

      // Restore the dialog into 'this' in order to be able to send the in-dialog BYE :-)
      this.dialog = dialog;

      // Restore the dialog into 'ua' so the ACK can reach 'this' session
      this.ua.dialogs[dialog.id.toString()] = dialog;

    } else if (this.status === C.STATUS_CONFIRMED) {
      this.bye(options);
    } else {
      this.reject(options);
    }

    return this;
  },

  /*
   * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
   */
  progress: function (options) {
    options = options || {};
    var
      statusCode = options.statusCode || 180,
      reasonPhrase = options.reasonPhrase,
      extraHeaders = (options.extraHeaders || []).slice(),
      iceServers,
      stunServers = options.stunServers || null,
      turnServers = options.turnServers || null,
      body = options.body,
      response;

    if (statusCode < 100 || statusCode > 199) {
      throw new TypeError('Invalid statusCode: ' + statusCode);
    }

    if (this.isCanceled || this.status === C.STATUS_TERMINATED) {
      return this;
    }

    if (stunServers || turnServers) {
      if (stunServers) {
        iceServers = SIP.UA.configuration_check.optional['stunServers'](stunServers);
        if (!iceServers) {
          throw new TypeError('Invalid stunServers: '+ stunServers);
        } else {
          this.stunServers = iceServers;
        }
      }

      if (turnServers) {
        iceServers = SIP.UA.configuration_check.optional['turnServers'](turnServers);
        if (!iceServers) {
          throw new TypeError('Invalid turnServers: '+ turnServers);
        } else {
          this.turnServers = iceServers;
        }
      }

      this.mediaHandler.updateIceServers({
        stunServers: this.stunServers,
        turnServers: this.turnServers
      });
    }

    function do100rel() {
      /* jshint validthis: true */
      statusCode = options.statusCode || 183;

      // Set status and add extra headers
      this.status = C.STATUS_WAITING_FOR_PRACK;
      extraHeaders.push('Contact: '+ this.contact);
      extraHeaders.push('Require: 100rel');
      extraHeaders.push('RSeq: ' + Math.floor(Math.random() * 10000));

      // Save media hint for later (referred sessions)
      this.mediaHint = options.media;

      // Get the session description to add to preaccept with
      this.mediaHandler.getDescription(options.media)
      .then(
        function onSuccess (description) {
          if (this.isCanceled || this.status === C.STATUS_TERMINATED) {
            return;
          }

          this.early_sdp = description.body;
          this[this.hasOffer ? 'hasAnswer' : 'hasOffer'] = true;

          // Retransmit until we get a response or we time out (see prackTimer below)
          var timeout = SIP.Timers.T1;
          this.timers.rel1xxTimer = SIP.Timers.setTimeout(function rel1xxRetransmission() {
            this.request.reply(statusCode, null, extraHeaders, description);
            timeout *= 2;
            this.timers.rel1xxTimer = SIP.Timers.setTimeout(rel1xxRetransmission.bind(this), timeout);
          }.bind(this), timeout);

          // Timeout and reject INVITE if no response
          this.timers.prackTimer = SIP.Timers.setTimeout(function () {
            if (this.status !== C.STATUS_WAITING_FOR_PRACK) {
              return;
            }

            this.logger.log('no PRACK received, rejecting the call');
            SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
            this.request.reply(504);
            this.terminated(null, SIP.C.causes.NO_PRACK);
          }.bind(this), SIP.Timers.T1 * 64);

          // Send the initial response
          response = this.request.reply(statusCode, reasonPhrase, extraHeaders, description);
          this.emit('progress', response, reasonPhrase);
        }.bind(this),

        function onFailure () {
          this.request.reply(480);
          this.failed(null, SIP.C.causes.WEBRTC_ERROR);
          this.terminated(null, SIP.C.causes.WEBRTC_ERROR);
        }.bind(this)
      );
    } // end do100rel

    function normalReply() {
      /* jshint validthis:true */
      response = this.request.reply(statusCode, reasonPhrase, extraHeaders, body);
      this.emit('progress', response, reasonPhrase);
    }

    if (options.statusCode !== 100 &&
        (this.rel100 === SIP.C.supported.REQUIRED ||
         (this.rel100 === SIP.C.supported.SUPPORTED && options.rel100) ||
         (this.rel100 === SIP.C.supported.SUPPORTED && (this.ua.configuration.rel100 === SIP.C.supported.REQUIRED)))) {
      do100rel.apply(this);
    } else {
      normalReply.apply(this);
    }
    return this;
  },

  /*
   * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
   */
  accept: function(options) {
    options = Object.create(Session.desugar(options));
    SIP.Utils.optionsOverride(options, 'media', 'mediaConstraints', true, this.logger, this.ua.configuration.media);
    this.mediaHint = options.media;

    this.onInfo = options.onInfo;

    // commented out now-unused hold-related variables for jshint. See below. JMF 2014-1-21
    var
      //idx, length, hasAudio, hasVideo,
      self = this,
      request = this.request,
      extraHeaders = (options.extraHeaders || []).slice(),
    //mediaStream = options.mediaStream || null,
      iceServers,
      stunServers = options.stunServers || null,
      turnServers = options.turnServers || null,
      descriptionCreationSucceeded = function(description) {
        var
          response,
          // run for reply success callback
          replySucceeded = function() {
            self.status = C.STATUS_WAITING_FOR_ACK;

            self.setInvite2xxTimer(request, description);
            self.setACKTimer();
          },

          // run for reply failure callback
          replyFailed = function() {
            self.failed(null, SIP.C.causes.CONNECTION_ERROR);
            self.terminated(null, SIP.C.causes.CONNECTION_ERROR);
          };

        // Chrome might call onaddstream before accept() is called, which means
        // mediaHandler.render() was called without a renderHint, so we need to
        // re-render now that mediaHint.render has been set.
        //
        // Chrome seems to be in the right regarding this, see
        // http://dev.w3.org/2011/webrtc/editor/webrtc.html#widl-RTCPeerConnection-onaddstream
        self.mediaHandler.render();

        extraHeaders.push('Contact: ' + self.contact);
        extraHeaders.push('Allow: ' + SIP.UA.C.ALLOWED_METHODS.toString());

        // TODO test
        // http://tools.ietf.org/html/rfc4028#section-9
        var supportedOptions = request.parseHeader('Supported') || [];
        var sessionExpires = request.parseHeader('Session-Expires') || {};
        var interval = sessionExpires.deltaSeconds;
        if (interval) {
          var refresher = sessionExpires.refresher || 'uas';
          extraHeaders.push('Session-Expires: ' + interval + ';' + refresher);
          if (refresher === 'uac' || supportedOptions.indexOf('timer') >= 0) {
            extraHeaders.push('Require: timer');
          }
        }

        if(!self.hasOffer) {
          self.hasOffer = true;
        } else {
          self.hasAnswer = true;
        }
        response = request.reply(200, null, extraHeaders,
                      description,
                      replySucceeded,
                      replyFailed
                     );
        if (self.status !== C.STATUS_TERMINATED) { // Didn't fail
          self.accepted(response, SIP.Utils.getReasonPhrase(200));
        }
      },

      descriptionCreationFailed = function() {
        if (self.status === C.STATUS_TERMINATED) {
          return;
        }
        // TODO - fail out on error
        self.request.reply(480);
        //self.failed(response, SIP.C.causes.USER_DENIED_MEDIA_ACCESS);
        self.failed(null, SIP.C.causes.WEBRTC_ERROR);
        self.terminated(null, SIP.C.causes.WEBRTC_ERROR);
      };

    // Check Session Status
    if (this.status === C.STATUS_WAITING_FOR_PRACK) {
      this.status = C.STATUS_ANSWERED_WAITING_FOR_PRACK;
      return this;
    } else if (this.status === C.STATUS_WAITING_FOR_ANSWER) {
      this.status = C.STATUS_ANSWERED;
    } else if (this.status !== C.STATUS_EARLY_MEDIA) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    if ((stunServers || turnServers) &&
        (this.status !== C.STATUS_EARLY_MEDIA && this.status !== C.STATUS_ANSWERED_WAITING_FOR_PRACK)) {
      if (stunServers) {
        iceServers = SIP.UA.configuration_check.optional['stunServers'](stunServers);
        if (!iceServers) {
          throw new TypeError('Invalid stunServers: '+ stunServers);
        } else {
          this.stunServers = iceServers;
        }
      }

      if (turnServers) {
        iceServers = SIP.UA.configuration_check.optional['turnServers'](turnServers);
        if (!iceServers) {
          throw new TypeError('Invalid turnServers: '+ turnServers);
        } else {
          this.turnServers = iceServers;
        }
      }

      this.mediaHandler.updateIceServers({
        stunServers: this.stunServers,
        turnServers: this.turnServers
      });
    }

    // An error on dialog creation will fire 'failed' event
    if(!this.createDialog(request, 'UAS')) {
      request.reply(500, 'Missing Contact header field');
      return this;
    }

    SIP.Timers.clearTimeout(this.timers.userNoAnswerTimer);

    // this hold-related code breaks FF accepting new calls - JMF 2014-1-21
    /*
    length = this.getRemoteStreams().length;

    for (idx = 0; idx < length; idx++) {
      if (this.mediaHandler.getRemoteStreams()[idx].getVideoTracks().length > 0) {
        hasVideo = true;
      }
      if (this.mediaHandler.getRemoteStreams()[idx].getAudioTracks().length > 0) {
        hasAudio = true;
      }
    }

    if (!hasAudio && this.mediaConstraints.audio === true) {
      this.mediaConstraints.audio = false;
      if (mediaStream) {
        length = mediaStream.getAudioTracks().length;
        for (idx = 0; idx < length; idx++) {
          mediaStream.removeTrack(mediaStream.getAudioTracks()[idx]);
        }
      }
    }

    if (!hasVideo && this.mediaConstraints.video === true) {
      this.mediaConstraints.video = false;
      if (mediaStream) {
        length = mediaStream.getVideoTracks().length;
        for (idx = 0; idx < length; idx++) {
          mediaStream.removeTrack(mediaStream.getVideoTracks()[idx]);
        }
      }
    }
    */

    if (this.status === C.STATUS_EARLY_MEDIA) {
      descriptionCreationSucceeded({});
    } else {
      this.mediaHandler.getDescription(self.mediaHint)
      .then(
        descriptionCreationSucceeded,
        descriptionCreationFailed
      );
    }

    return this;
  },

  receiveRequest: function(request) {

    // ISC RECEIVE REQUEST

    function confirmSession() {
      /* jshint validthis:true */
      var contentType;

      SIP.Timers.clearTimeout(this.timers.ackTimer);
      SIP.Timers.clearTimeout(this.timers.invite2xxTimer);
      this.status = C.STATUS_CONFIRMED;
      this.unmute();

      // TODO - this logic assumes Content-Disposition defaults
      contentType = request.getHeader('Content-Type');
      if (!this.mediaHandler.hasDescription(request)) {
        this.renderbody = request.body;
        this.rendertype = contentType;
      }

      this.emit('confirmed', request);
    }

    switch(request.method) {
    case SIP.C.CANCEL:
      /* RFC3261 15 States that a UAS may have accepted an invitation while a CANCEL
       * was in progress and that the UAC MAY continue with the session established by
       * any 2xx response, or MAY terminate with BYE. SIP does continue with the
       * established session. So the CANCEL is processed only if the session is not yet
       * established.
       */

      /*
       * Terminate the whole session in case the user didn't accept (or yet to send the answer) nor reject the
       *request opening the session.
       */
      if(this.status === C.STATUS_WAITING_FOR_ANSWER ||
         this.status === C.STATUS_WAITING_FOR_PRACK ||
         this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK ||
         this.status === C.STATUS_EARLY_MEDIA ||
         this.status === C.STATUS_ANSWERED) {

        this.status = C.STATUS_CANCELED;
        this.request.reply(487);
        this.canceled(request);
        this.rejected(request, SIP.C.causes.CANCELED);
        this.failed(request, SIP.C.causes.CANCELED);
        this.terminated(request, SIP.C.causes.CANCELED);
      }
      break;
    case SIP.C.ACK:
      if(this.status === C.STATUS_WAITING_FOR_ACK) {
        if (!this.hasAnswer) {
          if(this.mediaHandler.hasDescription(request)) {
            // ACK contains answer to an INVITE w/o SDP negotiation
            this.hasAnswer = true;
            this.mediaHandler.setDescription(request)
            .then(
              confirmSession.bind(this),
              function onFailure (e) {
                this.logger.warn(e);
                this.terminate({
                  statusCode: '488',
                  reasonPhrase: 'Bad Media Description'
                });
                this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
                this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }.bind(this)
            );
          } else if (this.early_sdp) {
            confirmSession.apply(this);
          } else {
            //TODO: Pass to mediahandler
            this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
          }
        } else {
          confirmSession.apply(this);
        }
      }
      break;
    case SIP.C.PRACK:
      if (this.status === C.STATUS_WAITING_FOR_PRACK || this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
        //localMedia = session.mediaHandler.localMedia;
        if(!this.hasAnswer) {
          if(this.mediaHandler.hasDescription(request)) {
            this.hasAnswer = true;
            this.mediaHandler.setDescription(request)
            .then(
              function onSuccess () {
                SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
                SIP.Timers.clearTimeout(this.timers.prackTimer);
                request.reply(200);
                if (this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
                  this.status = C.STATUS_EARLY_MEDIA;
                  this.accept();
                }
                this.status = C.STATUS_EARLY_MEDIA;
                //REVISIT
                this.mute();
              }.bind(this),
              function onFailure (e) {
                //TODO: Send to media handler
                this.logger.warn(e);
                this.terminate({
                  statusCode: '488',
                  reasonPhrase: 'Bad Media Description'
                });
                this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
                this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }.bind(this)
            );
          } else {
            this.terminate({
              statusCode: '488',
              reasonPhrase: 'Bad Media Description'
            });
            this.failed(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            this.terminated(request, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
          }
        } else {
          SIP.Timers.clearTimeout(this.timers.rel1xxTimer);
          SIP.Timers.clearTimeout(this.timers.prackTimer);
          request.reply(200);

          if (this.status === C.STATUS_ANSWERED_WAITING_FOR_PRACK) {
            this.status = C.STATUS_EARLY_MEDIA;
            this.accept();
          }
          this.status = C.STATUS_EARLY_MEDIA;
          //REVISIT
          this.mute();
        }
      } else if(this.status === C.STATUS_EARLY_MEDIA) {
        request.reply(200);
      }
      break;
    default:
      Session.prototype.receiveRequest.apply(this, [request]);
      break;
    }
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  }

};

SIP.InviteServerContext = InviteServerContext;

InviteClientContext = function(ua, target, options) {
  options = Object.create(Session.desugar(options));
  options.params = Object.create(options.params || Object.prototype);

  var iceServers,
    extraHeaders = (options.extraHeaders || []).slice(),
    stunServers = options.stunServers || null,
    turnServers = options.turnServers || null,
    mediaHandlerFactory = options.mediaHandlerFactory || ua.configuration.mediaHandlerFactory,
    isMediaSupported = mediaHandlerFactory.isSupported;

  // Check WebRTC support
  if (isMediaSupported && !isMediaSupported()) {
    throw new SIP.Exceptions.NotSupportedError('Media not supported');
  }

  this.RTCConstraints = options.RTCConstraints || {};
  this.inviteWithoutSdp = options.inviteWithoutSdp || false;

  // Set anonymous property
  this.anonymous = options.anonymous || false;

  // Custom data to be sent either in INVITE or in ACK
  this.renderbody = options.renderbody || null;
  this.rendertype = options.rendertype || 'text/plain';

  options.params.from_tag = this.from_tag;

  /* Do not add ;ob in initial forming dialog requests if the registration over
   *  the current connection got a GRUU URI.
   */
  this.contact = ua.contact.toString({
    anonymous: this.anonymous,
    outbound: this.anonymous ? !ua.contact.temp_gruu : !ua.contact.pub_gruu
  });

  if (this.anonymous) {
    options.params.from_displayName = 'Anonymous';
    options.params.from_uri = 'sip:anonymous@anonymous.invalid';

    extraHeaders.push('P-Preferred-Identity: '+ ua.configuration.uri.toString());
    extraHeaders.push('Privacy: id');
  }
  extraHeaders.push('Contact: '+ this.contact);
  extraHeaders.push('Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString());
  if (this.inviteWithoutSdp && this.renderbody) {
    extraHeaders.push('Content-Type: ' + this.rendertype);
    extraHeaders.push('Content-Disposition: render;handling=optional');
  }

  if (ua.configuration.rel100 === SIP.C.supported.REQUIRED) {
    extraHeaders.push('Require: 100rel');
  }
  if (ua.configuration.replaces === SIP.C.supported.REQUIRED) {
    extraHeaders.push('Require: replaces');
  }

  options.extraHeaders = extraHeaders;

  SIP.Utils.augment(this, SIP.ClientContext, [ua, SIP.C.INVITE, target, options]);
  SIP.Utils.augment(this, SIP.Session, [mediaHandlerFactory]);

  // Check Session Status
  if (this.status !== C.STATUS_NULL) {
    throw new SIP.Exceptions.InvalidStateError(this.status);
  }

  // Session parameter initialization
  this.from_tag = SIP.Utils.newTag();

  // OutgoingSession specific parameters
  this.isCanceled = false;
  this.received_100 = false;

  this.method = SIP.C.INVITE;

  this.receiveNonInviteResponse = this.receiveResponse;
  this.receiveResponse = this.receiveInviteResponse;

  this.logger = ua.getLogger('sip.inviteclientcontext');

  if (stunServers) {
    iceServers = SIP.UA.configuration_check.optional['stunServers'](stunServers);
    if (!iceServers) {
      throw new TypeError('Invalid stunServers: '+ stunServers);
    } else {
      this.stunServers = iceServers;
    }
  }

  if (turnServers) {
    iceServers = SIP.UA.configuration_check.optional['turnServers'](turnServers);
    if (!iceServers) {
      throw new TypeError('Invalid turnServers: '+ turnServers);
    } else {
      this.turnServers = iceServers;
    }
  }

  ua.applicants[this] = this;

  this.id = this.request.call_id + this.from_tag;

  //Initialize Media Session
  this.mediaHandler = this.mediaHandlerFactory(this, {
    RTCConstraints: this.RTCConstraints,
    stunServers: this.stunServers,
    turnServers: this.turnServers
  });

  if (this.mediaHandler && this.mediaHandler.getRemoteStreams) {
    this.getRemoteStreams = this.mediaHandler.getRemoteStreams.bind(this.mediaHandler);
    this.getLocalStreams = this.mediaHandler.getLocalStreams.bind(this.mediaHandler);
  }

  SIP.Utils.optionsOverride(options, 'media', 'mediaConstraints', true, this.logger, this.ua.configuration.media);
  this.mediaHint = options.media;

  this.onInfo = options.onInfo;
};

InviteClientContext.prototype = {
  invite: function () {
    var self = this;

    //Save the session into the ua sessions collection.
    //Note: placing in constructor breaks call to request.cancel on close... User does not need this anyway
    this.ua.sessions[this.id] = this;

    //Note: due to the way Firefox handles gUM calls, it is recommended to make the gUM call at the app level
    // and hand sip.js a stream as the mediaHint
    if (this.inviteWithoutSdp) {
      //just send an invite with no sdp...
      this.request.body = self.renderbody;
      this.status = C.STATUS_INVITE_SENT;
      this.send();
    } else {
      this.mediaHandler.getDescription(self.mediaHint)
      .then(
        function onSuccess(description) {
          if (self.isCanceled || self.status === C.STATUS_TERMINATED) {
            return;
          }
          self.hasOffer = true;
          self.request.body = description;
          self.status = C.STATUS_INVITE_SENT;
          self.send();
        },
        function onFailure() {
          if (self.status === C.STATUS_TERMINATED) {
            return;
          }
          // TODO...fail out
          //self.failed(null, SIP.C.causes.USER_DENIED_MEDIA_ACCESS);
          //self.failed(null, SIP.C.causes.WEBRTC_ERROR);
          self.failed(null, SIP.C.causes.WEBRTC_ERROR);
          self.terminated(null, SIP.C.causes.WEBRTC_ERROR);
        }
      );
    }

    return this;
  },

  receiveInviteResponse: function(response) {
    var cause, //localMedia,
      session = this,
      id = response.call_id + response.from_tag + response.to_tag,
      extraHeaders = [],
      options = {};

    if (this.status === C.STATUS_TERMINATED || response.method !== SIP.C.INVITE) {
      return;
    }

    if (this.dialog && (response.status_code >= 200 && response.status_code <= 299)) {
      if (id !== this.dialog.id.toString() ) {
        if (!this.createDialog(response, 'UAC', true)) {
          return;
        }
        this.earlyDialogs[id].sendRequest(this, SIP.C.ACK,
                                          {
                                            body: SIP.Utils.generateFakeSDP(response.body)
                                          });
        this.earlyDialogs[id].sendRequest(this, SIP.C.BYE);

        /* NOTE: This fails because the forking proxy does not recognize that an unanswerable
         * leg (due to peerConnection limitations) has been answered first. If your forking
         * proxy does not hang up all unanswered branches on the first branch answered, remove this.
         */
        if(this.status !== C.STATUS_CONFIRMED) {
          this.failed(response, SIP.C.causes.WEBRTC_ERROR);
          this.terminated(response, SIP.C.causes.WEBRTC_ERROR);
        }
        return;
      } else if (this.status === C.STATUS_CONFIRMED) {
        this.sendRequest(SIP.C.ACK,{cseq: response.cseq});
        return;
      } else if (!this.hasAnswer) {
        // invite w/o sdp is waiting for callback
        //an invite with sdp must go on, and hasAnswer is true
        return;
      }
    }

    if (this.dialog && response.status_code < 200) {
      /*
        Early media has been set up with at least one other different branch,
        but a final 2xx response hasn't been received
      */
      if (this.dialog.pracked.indexOf(response.getHeader('rseq')) !== -1 ||
          (this.dialog.pracked[this.dialog.pracked.length-1] >= response.getHeader('rseq') && this.dialog.pracked.length > 0)) {
        return;
      }

      if (!this.earlyDialogs[id] && !this.createDialog(response, 'UAC', true)) {
        return;
      }

      if (this.earlyDialogs[id].pracked.indexOf(response.getHeader('rseq')) !== -1 ||
          (this.earlyDialogs[id].pracked[this.earlyDialogs[id].pracked.length-1] >= response.getHeader('rseq') && this.earlyDialogs[id].pracked.length > 0)) {
        return;
      }

      extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
      this.earlyDialogs[id].pracked.push(response.getHeader('rseq'));

      this.earlyDialogs[id].sendRequest(this, SIP.C.PRACK, {
        extraHeaders: extraHeaders,
        body: SIP.Utils.generateFakeSDP(response.body)
      });
      return;
    }

    // Proceed to cancellation if the user requested.
    if(this.isCanceled) {
      if(response.status_code >= 100 && response.status_code < 200) {
        this.request.cancel(this.cancelReason, extraHeaders);
        this.canceled(null);
      } else if(response.status_code >= 200 && response.status_code < 299) {
        this.acceptAndTerminate(response);
        this.emit('bye', this.request);
      } else if (response.status_code >= 300) {
        cause = SIP.C.REASON_PHRASE[response.status_code] || SIP.C.causes.CANCELED;
        this.rejected(response, cause);
        this.failed(response, cause);
        this.terminated(response, cause);
      }
      return;
    }

    switch(true) {
      case /^100$/.test(response.status_code):
        this.received_100 = true;
        this.emit('progress', response);
        break;
      case (/^1[0-9]{2}$/.test(response.status_code)):
        // Do nothing with 1xx responses without To tag.
        if(!response.to_tag) {
          this.logger.warn('1xx response received without to tag');
          break;
        }

        // Create Early Dialog if 1XX comes with contact
        if(response.hasHeader('contact')) {
          // An error on dialog creation will fire 'failed' event
          if (!this.createDialog(response, 'UAC', true)) {
            break;
          }
        }

        this.status = C.STATUS_1XX_RECEIVED;

        if(response.hasHeader('require') &&
           response.getHeader('require').indexOf('100rel') !== -1) {

          // Do nothing if this.dialog is already confirmed
          if (this.dialog || !this.earlyDialogs[id]) {
            break;
          }

          if (this.earlyDialogs[id].pracked.indexOf(response.getHeader('rseq')) !== -1 ||
              (this.earlyDialogs[id].pracked[this.earlyDialogs[id].pracked.length-1] >= response.getHeader('rseq') && this.earlyDialogs[id].pracked.length > 0)) {
            return;
          }

          if (!this.mediaHandler.hasDescription(response)) {
            extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
            this.earlyDialogs[id].pracked.push(response.getHeader('rseq'));
            this.earlyDialogs[id].sendRequest(this, SIP.C.PRACK, {
              extraHeaders: extraHeaders
            });
            this.emit('progress', response);

          } else if (this.hasOffer) {
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.hasAnswer = true;
            this.dialog.pracked.push(response.getHeader('rseq'));

            this.mediaHandler.setDescription(response)
            .then(
              function onSuccess () {
                extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));

                session.sendRequest(SIP.C.PRACK, {
                  extraHeaders: extraHeaders,
                  receiveResponse: function() {}
                });
                session.status = C.STATUS_EARLY_MEDIA;
                session.mute();
                session.emit('progress', response);
                /*
                if (session.status === C.STATUS_EARLY_MEDIA) {
                  localMedia = session.mediaHandler.localMedia;
                  if (localMedia.getAudioTracks().length > 0) {
                    localMedia.getAudioTracks()[0].enabled = false;
                  }
                  if (localMedia.getVideoTracks().length > 0) {
                    localMedia.getVideoTracks()[0].enabled = false;
                  }
                }*/
              },
              function onFailure (e) {
                session.logger.warn(e);
                session.acceptAndTerminate(response, 488, 'Not Acceptable Here');
                session.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              }
            );
          } else {
            var earlyDialog = this.earlyDialogs[id];
            var earlyMedia = earlyDialog.mediaHandler;

            earlyDialog.pracked.push(response.getHeader('rseq'));

            earlyMedia.setDescription(response)
            .then(earlyMedia.getDescription.bind(earlyMedia, session.mediaHint))
            .then(function onSuccess(description) {
              extraHeaders.push('RAck: ' + response.getHeader('rseq') + ' ' + response.getHeader('cseq'));
              earlyDialog.sendRequest(session, SIP.C.PRACK, {
                extraHeaders: extraHeaders,
                body: description
              });
              session.status = C.STATUS_EARLY_MEDIA;
              session.emit('progress', response);
            })
            .catch(function onFailure(e) {
              if (e instanceof SIP.Exceptions.GetDescriptionError) {
                earlyDialog.pracked.push(response.getHeader('rseq'));
                if (session.status === C.STATUS_TERMINATED) {
                  return;
                }
                // TODO - fail out on error
                // session.failed(gum error);
                session.failed(null, SIP.C.causes.WEBRTC_ERROR);
                session.terminated(null, SIP.C.causes.WEBRTC_ERROR);
              } else {
                earlyDialog.pracked.splice(earlyDialog.pracked.indexOf(response.getHeader('rseq')), 1);
                // Could not set remote description
                session.logger.warn('invalid description');
                session.logger.warn(e);
              }
            });
          }
        } else {
          this.emit('progress', response);
        }
        break;
      case /^2[0-9]{2}$/.test(response.status_code):
        var cseq = this.request.cseq + ' ' + this.request.method;
        if (cseq !== response.getHeader('cseq')) {
          break;
        }

        if (this.status === C.STATUS_EARLY_MEDIA && this.dialog) {
          this.status = C.STATUS_CONFIRMED;
          this.unmute();
          /*localMedia = this.mediaHandler.localMedia;
          if (localMedia.getAudioTracks().length > 0) {
            localMedia.getAudioTracks()[0].enabled = true;
          }
          if (localMedia.getVideoTracks().length > 0) {
            localMedia.getVideoTracks()[0].enabled = true;
          }*/
          options = {};
          if (this.renderbody) {
            extraHeaders.push('Content-Type: ' + this.rendertype);
            options.extraHeaders = extraHeaders;
            options.body = this.renderbody;
          }
          options.cseq = response.cseq;
          this.sendRequest(SIP.C.ACK, options);
          this.accepted(response);
          break;
        }
        // Do nothing if this.dialog is already confirmed
        if (this.dialog) {
          break;
        }

        // This is an invite without sdp
        if (!this.hasOffer) {
          if (this.earlyDialogs[id] && this.earlyDialogs[id].mediaHandler.localMedia) {
            //REVISIT
            this.hasOffer = true;
            this.hasAnswer = true;
            this.mediaHandler = this.earlyDialogs[id].mediaHandler;
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.status = C.STATUS_CONFIRMED;
            this.sendRequest(SIP.C.ACK, {cseq:response.cseq});

            this.unmute();
            /*
            localMedia = session.mediaHandler.localMedia;
            if (localMedia.getAudioTracks().length > 0) {
              localMedia.getAudioTracks()[0].enabled = true;
            }
            if (localMedia.getVideoTracks().length > 0) {
              localMedia.getVideoTracks()[0].enabled = true;
            }*/
            this.accepted(response);
          } else {
            if(!this.mediaHandler.hasDescription(response)) {
              this.acceptAndTerminate(response, 400, 'Missing session description');
              this.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
              break;
            }
            if (!this.createDialog(response, 'UAC')) {
              break;
            }
            this.hasOffer = true;
            this.mediaHandler.setDescription(response)
            .then(this.mediaHandler.getDescription.bind(this.mediaHandler, this.mediaHint))
            .then(function onSuccess(description) {
              //var localMedia;
              if(session.isCanceled || session.status === C.STATUS_TERMINATED) {
                return;
              }

              session.status = C.STATUS_CONFIRMED;
              session.hasAnswer = true;

              session.unmute();
              /*localMedia = session.mediaHandler.localMedia;
              if (localMedia.getAudioTracks().length > 0) {
                localMedia.getAudioTracks()[0].enabled = true;
              }
              if (localMedia.getVideoTracks().length > 0) {
                localMedia.getVideoTracks()[0].enabled = true;
              }*/
              session.sendRequest(SIP.C.ACK,{
                body: description,
                cseq:response.cseq
              });
              session.accepted(response);
            })
            .catch(function onFailure(e) {
              if (e instanceof SIP.Exceptions.GetDescriptionError) {
                // TODO do something here
                session.logger.warn("there was a problem");
              } else {
                session.logger.warn('invalid description');
                session.logger.warn(e);
                response.reply(488);
              }
            });
          }
        } else if (this.hasAnswer){
          if (this.renderbody) {
            extraHeaders.push('Content-Type: ' + session.rendertype);
            options.extraHeaders = extraHeaders;
            options.body = this.renderbody;
          }
          this.sendRequest(SIP.C.ACK, options);
        } else {
          if(!this.mediaHandler.hasDescription(response)) {
            this.acceptAndTerminate(response, 400, 'Missing session description');
            this.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            break;
          }
          if (!this.createDialog(response, 'UAC')) {
            break;
          }
          this.hasAnswer = true;
          this.mediaHandler.setDescription(response)
          .then(
            function onSuccess () {
              var options = {};//,localMedia;
              session.status = C.STATUS_CONFIRMED;
              session.unmute();
              /*localMedia = session.mediaHandler.localMedia;
              if (localMedia.getAudioTracks().length > 0) {
                localMedia.getAudioTracks()[0].enabled = true;
              }
              if (localMedia.getVideoTracks().length > 0) {
                localMedia.getVideoTracks()[0].enabled = true;
              }*/
              if (session.renderbody) {
                extraHeaders.push('Content-Type: ' + session.rendertype);
                options.extraHeaders = extraHeaders;
                options.body = session.renderbody;
              }
              options.cseq = response.cseq;
              session.sendRequest(SIP.C.ACK, options);
              session.accepted(response);
            },
            function onFailure (e) {
              session.logger.warn(e);
              session.acceptAndTerminate(response, 488, 'Not Acceptable Here');
              session.failed(response, SIP.C.causes.BAD_MEDIA_DESCRIPTION);
            }
          );
        }
        break;
      default:
        cause = SIP.Utils.sipErrorCause(response.status_code);
        this.rejected(response, cause);
        this.failed(response, cause);
        this.terminated(response, cause);
    }
  },

  cancel: function(options) {
    options = options || {};

    options.extraHeaders = (options.extraHeaders || []).slice();

    // Check Session Status
    if (this.status === C.STATUS_TERMINATED || this.status === C.STATUS_CONFIRMED) {
      throw new SIP.Exceptions.InvalidStateError(this.status);
    }

    this.logger.log('canceling RTCSession');

    var cancel_reason = SIP.Utils.getCancelReason(options.status_code, options.reason_phrase);

    // Check Session Status
    if (this.status === C.STATUS_NULL ||
        (this.status === C.STATUS_INVITE_SENT && !this.received_100)) {
      this.isCanceled = true;
      this.cancelReason = cancel_reason;
    } else if (this.status === C.STATUS_INVITE_SENT ||
               this.status === C.STATUS_1XX_RECEIVED ||
               this.status === C.STATUS_EARLY_MEDIA) {
      this.request.cancel(cancel_reason, options.extraHeaders);
    }

    return this.canceled();
  },

  terminate: function(options) {
    if (this.status === C.STATUS_TERMINATED) {
      return this;
    }

    if (this.status === C.STATUS_WAITING_FOR_ACK || this.status === C.STATUS_CONFIRMED) {
      this.bye(options);
    } else {
      this.cancel(options);
    }

    return this;
  },

  receiveRequest: function(request) {
    // ICC RECEIVE REQUEST

    // Reject CANCELs
    if (request.method === SIP.C.CANCEL) {
      // TODO; make this a switch when it gets added
    }

    if (request.method === SIP.C.ACK && this.status === C.STATUS_WAITING_FOR_ACK) {
      SIP.Timers.clearTimeout(this.timers.ackTimer);
      SIP.Timers.clearTimeout(this.timers.invite2xxTimer);
      this.status = C.STATUS_CONFIRMED;
      this.unmute();

      this.accepted();
    }

    return Session.prototype.receiveRequest.apply(this, [request]);
  },

  onTransportError: function() {
    if (this.status !== C.STATUS_CONFIRMED && this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.CONNECTION_ERROR);
    }
  },

  onRequestTimeout: function() {
    if (this.status === C.STATUS_CONFIRMED) {
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    } else if (this.status !== C.STATUS_TERMINATED) {
      this.failed(null, SIP.C.causes.REQUEST_TIMEOUT);
      this.terminated(null, SIP.C.causes.REQUEST_TIMEOUT);
    }
  }

};

SIP.InviteClientContext = InviteClientContext;

};

},{"./RFC4028":104,"./Session/DTMF":112}],112:[function(require,module,exports){
"use strict";
/**
 * @fileoverview DTMF
 */

/**
 * @class DTMF
 * @param {SIP.Session} session
 */
module.exports = function (SIP) {

var DTMF,
  C = {
    MIN_DURATION:            70,
    MAX_DURATION:            6000,
    DEFAULT_DURATION:        100,
    MIN_INTER_TONE_GAP:      50,
    DEFAULT_INTER_TONE_GAP:  500
  };

DTMF = function(session, tone, options) {
  var duration, interToneGap;

  if (tone === undefined) {
    throw new TypeError('Not enough arguments');
  }

  this.logger = session.ua.getLogger('sip.invitecontext.dtmf', session.id);
  this.owner = session;
  this.direction = null;

  options = options || {};
  duration = options.duration || null;
  interToneGap = options.interToneGap || null;

  // Check tone type
  if (typeof tone === 'string' ) {
    tone = tone.toUpperCase();
  } else if (typeof tone === 'number') {
    tone = tone.toString();
  } else {
    throw new TypeError('Invalid tone: '+ tone);
  }

  // Check tone value
  if (!tone.match(/^[0-9A-D#*]$/)) {
    throw new TypeError('Invalid tone: '+ tone);
  } else {
    this.tone = tone;
  }

  // Check duration
  if (duration && !SIP.Utils.isDecimal(duration)) {
    throw new TypeError('Invalid tone duration: '+ duration);
  } else if (!duration) {
    duration = DTMF.C.DEFAULT_DURATION;
  } else if (duration < DTMF.C.MIN_DURATION) {
    this.logger.warn('"duration" value is lower than the minimum allowed, setting it to '+ DTMF.C.MIN_DURATION+ ' milliseconds');
    duration = DTMF.C.MIN_DURATION;
  } else if (duration > DTMF.C.MAX_DURATION) {
    this.logger.warn('"duration" value is greater than the maximum allowed, setting it to '+ DTMF.C.MAX_DURATION +' milliseconds');
    duration = DTMF.C.MAX_DURATION;
  } else {
    duration = Math.abs(duration);
  }
  this.duration = duration;

  // Check interToneGap
  if (interToneGap && !SIP.Utils.isDecimal(interToneGap)) {
    throw new TypeError('Invalid interToneGap: '+ interToneGap);
  } else if (!interToneGap) {
    interToneGap = DTMF.C.DEFAULT_INTER_TONE_GAP;
  } else if (interToneGap < DTMF.C.MIN_INTER_TONE_GAP) {
    this.logger.warn('"interToneGap" value is lower than the minimum allowed, setting it to '+ DTMF.C.MIN_INTER_TONE_GAP +' milliseconds');
    interToneGap = DTMF.C.MIN_INTER_TONE_GAP;
  } else {
    interToneGap = Math.abs(interToneGap);
  }
  this.interToneGap = interToneGap;
};
DTMF.prototype = Object.create(SIP.EventEmitter.prototype);


DTMF.prototype.send = function(options) {
  var extraHeaders,
    body = {};

  this.direction = 'outgoing';

  // Check RTCSession Status
  if (this.owner.status !== SIP.Session.C.STATUS_CONFIRMED &&
    this.owner.status !== SIP.Session.C.STATUS_WAITING_FOR_ACK) {
    throw new SIP.Exceptions.InvalidStateError(this.owner.status);
  }

  // Get DTMF options
  options = options || {};
  extraHeaders = options.extraHeaders ? options.extraHeaders.slice() : [];

  body.contentType = 'application/dtmf-relay';

  body.body = "Signal= " + this.tone + "\r\n";
  body.body += "Duration= " + this.duration;

  this.request = this.owner.dialog.sendRequest(this, SIP.C.INFO, {
    extraHeaders: extraHeaders,
    body: body
  });

  this.owner.emit('dtmf', this.request, this);
};

/**
 * @private
 */
DTMF.prototype.receiveResponse = function(response) {
  var cause;

  switch(true) {
    case /^1[0-9]{2}$/.test(response.status_code):
      // Ignore provisional responses.
      break;

    case /^2[0-9]{2}$/.test(response.status_code):
      this.emit('succeeded', {
        originator: 'remote',
        response: response
      });
      break;

    default:
      cause = SIP.Utils.sipErrorCause(response.status_code);
      this.emit('failed', response, cause);
      break;
  }
};

/**
 * @private
 */
DTMF.prototype.onRequestTimeout = function() {
  this.emit('failed', null, SIP.C.causes.REQUEST_TIMEOUT);
  this.owner.onRequestTimeout();
};

/**
 * @private
 */
DTMF.prototype.onTransportError = function() {
  this.emit('failed', null, SIP.C.causes.CONNECTION_ERROR);
  this.owner.onTransportError();
};

/**
 * @private
 */
DTMF.prototype.onDialogError = function(response) {
  this.emit('failed', response, SIP.C.causes.DIALOG_ERROR);
  this.owner.onDialogError(response);
};

/**
 * @private
 */
DTMF.prototype.init_incoming = function(request) {
  this.direction = 'incoming';
  this.request = request;

  request.reply(200);

  if (!this.tone || !this.duration) {
    this.logger.warn('invalid INFO DTMF received, discarded');
  } else {
    this.owner.emit('dtmf', request, this);
  }
};

DTMF.C = C;
return DTMF;
};

},{}],113:[function(require,module,exports){
"use strict";

/**
 * @fileoverview SIP Subscriber (SIP-Specific Event Notifications RFC6665)
 */

/**
 * @augments SIP
 * @class Class creating a SIP Subscription.
 */
module.exports = function (SIP) {
SIP.Subscription = function (ua, target, event, options) {
  options = Object.create(options || Object.prototype);
  this.extraHeaders = options.extraHeaders = (options.extraHeaders || []).slice();

  this.id = null;
  this.state = 'init';

  if (!event) {
    throw new TypeError('Event necessary to create a subscription.');
  } else {
    //TODO: check for valid events here probably make a list in SIP.C; or leave it up to app to check?
    //The check may need to/should probably occur on the other side,
    this.event = event;
  }

  if(typeof options.expires !== 'number'){
    ua.logger.warn('expires must be a number. Using default of 3600.');
    this.expires = 3600;
  } else {
    this.expires = options.expires;
  }

  options.extraHeaders.push('Event: ' + this.event);
  options.extraHeaders.push('Expires: ' + this.expires);

  if (options.body) {
    this.body = options.body;
  }

  this.contact = ua.contact.toString();

  options.extraHeaders.push('Contact: '+ this.contact);
  options.extraHeaders.push('Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString());

  SIP.Utils.augment(this, SIP.ClientContext, [ua, SIP.C.SUBSCRIBE, target, options]);

  this.logger = ua.getLogger('sip.subscription');

  this.dialog = null;
  this.timers = {N: null, sub_duration: null};
  this.errorCodes  = [404,405,410,416,480,481,482,483,484,485,489,501,604];
};

SIP.Subscription.prototype = {
  subscribe: function() {
    var sub = this;

     //these states point to an existing subscription, no subscribe is necessary
    if (this.state === 'active') {
      this.refresh();
      return this;
    } else if (this.state === 'notify_wait') {
      return this;
    }

    SIP.Timers.clearTimeout(this.timers.sub_duration);
    SIP.Timers.clearTimeout(this.timers.N);
    this.timers.N = SIP.Timers.setTimeout(sub.timer_fire.bind(sub), SIP.Timers.TIMER_N);

    this.send();

    this.state = 'notify_wait';

    return this;
  },

  refresh: function () {
    if (this.state === 'terminated' || this.state === 'pending' || this.state === 'notify_wait') {
      return;
    }

    this.dialog.sendRequest(this, SIP.C.SUBSCRIBE, {
      extraHeaders: this.extraHeaders,
      body: this.body
    });
  },

  receiveResponse: function(response) {
    var expires, sub = this,
        cause = SIP.Utils.getReasonPhrase(response.status_code);

    if ((this.state === 'notify_wait' && response.status_code >= 300) ||
        (this.state !== 'notify_wait' && this.errorCodes.indexOf(response.status_code) !== -1)) {
      this.failed(response, null);
    } else if (/^2[0-9]{2}$/.test(response.status_code)){
      expires = response.getHeader('Expires');
      SIP.Timers.clearTimeout(this.timers.N);

      if (this.createConfirmedDialog(response,'UAC')) {
        this.id = this.dialog.id.toString();
        this.ua.subscriptions[this.id] = this;
        this.emit('accepted', response, cause);
        // UPDATE ROUTE SET TO BE BACKWARDS COMPATIBLE?
      }

      if (expires && expires <= this.expires) {
        // Preserve new expires value for subsequent requests
        this.expires = expires;
        this.timers.sub_duration = SIP.Timers.setTimeout(sub.refresh.bind(sub), expires * 900);
      } else {
        if (!expires) {
          this.logger.warn('Expires header missing in a 200-class response to SUBSCRIBE');
          this.failed(response, SIP.C.EXPIRES_HEADER_MISSING);
        } else {
          this.logger.warn('Expires header in a 200-class response to SUBSCRIBE with a higher value than the one in the request');
          this.failed(response, SIP.C.INVALID_EXPIRES_HEADER);
        }
      }
    } //Used to just ignore provisional responses; now ignores everything except errorCodes and 2xx
  },

  unsubscribe: function() {
    var extraHeaders = [], sub = this;

    this.state = 'terminated';

    extraHeaders.push('Event: ' + this.event);
    extraHeaders.push('Expires: 0');

    extraHeaders.push('Contact: '+ this.contact);
    extraHeaders.push('Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString());

    //makes sure expires isn't set, and other typical resubscribe behavior
    this.receiveResponse = function(){};

    this.dialog.sendRequest(this, this.method, {
      extraHeaders: extraHeaders,
      body: this.body
    });

    SIP.Timers.clearTimeout(this.timers.sub_duration);
    SIP.Timers.clearTimeout(this.timers.N);
    this.timers.N = SIP.Timers.setTimeout(sub.timer_fire.bind(sub), SIP.Timers.TIMER_N);
  },

  /**
  * @private
  */
  timer_fire: function(){
    if (this.state === 'terminated') {
      this.terminateDialog();
      SIP.Timers.clearTimeout(this.timers.N);
      SIP.Timers.clearTimeout(this.timers.sub_duration);

      delete this.ua.subscriptions[this.id];
    } else if (this.state === 'pending' || this.state === 'notify_wait') {
      this.close();
    } else {
      this.refresh();
    }
  },

  /**
  * @private
  */
  close: function() {
    if(this.state !== 'notify_wait' && this.state !== 'terminated') {
      this.unsubscribe();
    }
  },

  /**
  * @private
  */
  createConfirmedDialog: function(message, type) {
    var dialog;

    this.terminateDialog();
    dialog = new SIP.Dialog(this, message, type);

    if(!dialog.error) {
      this.dialog = dialog;
      return true;
    }
    // Dialog not created due to an error
    else {
      return false;
    }
  },

  /**
  * @private
  */
  terminateDialog: function() {
    if(this.dialog) {
      delete this.ua.subscriptions[this.id];
      this.dialog.terminate();
      delete this.dialog;
    }
  },

  /**
  * @private
  */
  receiveRequest: function(request) {
    var sub_state, sub = this;

    function setExpiresTimeout() {
      if (sub_state.expires) {
        SIP.Timers.clearTimeout(sub.timers.sub_duration);
        sub_state.expires = Math.min(sub.expires,
                                     Math.max(sub_state.expires, 0));
        sub.timers.sub_duration = SIP.Timers.setTimeout(sub.refresh.bind(sub),
                                                    sub_state.expires * 900);
      }
    }

    if (!this.matchEvent(request)) { //checks event and subscription_state headers
      request.reply(489);
      return;
    }

    sub_state = request.parseHeader('Subscription-State');

    request.reply(200, SIP.C.REASON_200);

    SIP.Timers.clearTimeout(this.timers.N);

    this.emit('notify', {request: request});

    // if we've set state to terminated, no further processing should take place
    // and we are only interested in cleaning up after the appropriate NOTIFY
    if (this.state === 'terminated') {
      if (sub_state.state === 'terminated') {
        this.terminateDialog();
        SIP.Timers.clearTimeout(this.timers.N);
        SIP.Timers.clearTimeout(this.timers.sub_duration);

        delete this.ua.subscriptions[this.id];
      }
      return;
    }

    switch (sub_state.state) {
      case 'active':
        this.state = 'active';
        setExpiresTimeout();
        break;
      case 'pending':
        if (this.state === 'notify_wait') {
          setExpiresTimeout();
        }
        this.state = 'pending';
        break;
      case 'terminated':
        SIP.Timers.clearTimeout(this.timers.sub_duration);
        if (sub_state.reason) {
          this.logger.log('terminating subscription with reason '+ sub_state.reason);
          switch (sub_state.reason) {
            case 'deactivated':
            case 'timeout':
              this.subscribe();
              return;
            case 'probation':
            case 'giveup':
              if(sub_state.params && sub_state.params['retry-after']) {
                this.timers.sub_duration = SIP.Timers.setTimeout(sub.subscribe.bind(sub), sub_state.params['retry-after']);
              } else {
                this.subscribe();
              }
              return;
            case 'rejected':
            case 'noresource':
            case 'invariant':
              break;
          }
        }
        this.close();
        break;
    }
  },

  failed: function(response, cause) {
    this.close();
    this.emit('failed', response, cause);
    return this;
  },

  onDialogError: function(response) {
    this.failed(response, SIP.C.causes.DIALOG_ERROR);
  },

  /**
  * @private
  */
  matchEvent: function(request) {
    var event;

    // Check mandatory header Event
    if (!request.hasHeader('Event')) {
      this.logger.warn('missing Event header');
      return false;
    }
    // Check mandatory header Subscription-State
    if (!request.hasHeader('Subscription-State')) {
      this.logger.warn('missing Subscription-State header');
      return false;
    }

    // Check whether the event in NOTIFY matches the event in SUBSCRIBE
    event = request.parseHeader('event').event;

    if (this.event !== event) {
      this.logger.warn('event match failed');
      request.reply(481, 'Event Match Failed');
      return false;
    } else {
      return true;
    }
  }
};
};

},{}],114:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP TIMERS
 */

/**
 * @augments SIP
 */
var
  T1 = 500,
  T2 = 4000,
  T4 = 5000;
module.exports = function (timers) {
  var Timers = {
    T1: T1,
    T2: T2,
    T4: T4,
    TIMER_B: 64 * T1,
    TIMER_D: 0  * T1,
    TIMER_F: 64 * T1,
    TIMER_H: 64 * T1,
    TIMER_I: 0  * T1,
    TIMER_J: 0  * T1,
    TIMER_K: 0  * T4,
    TIMER_L: 64 * T1,
    TIMER_M: 64 * T1,
    TIMER_N: 64 * T1,
    PROVISIONAL_RESPONSE_INTERVAL: 60000  // See RFC 3261 Section 13.3.1.1
  };

  ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval']
  .forEach(function (name) {
    // can't just use timers[name].bind(timers) since it bypasses jasmine's
    // clock-mocking
    Timers[name] = function () {
      return timers[name].apply(timers, arguments);
    };
  });

  return Timers;
};

},{}],115:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP Transactions
 */

/**
 * SIP Transactions module.
 * @augments SIP
 */
module.exports = function (SIP) {
var
  C = {
    // Transaction states
    STATUS_TRYING:     1,
    STATUS_PROCEEDING: 2,
    STATUS_CALLING:    3,
    STATUS_ACCEPTED:   4,
    STATUS_COMPLETED:  5,
    STATUS_TERMINATED: 6,
    STATUS_CONFIRMED:  7,

    // Transaction types
    NON_INVITE_CLIENT: 'nict',
    NON_INVITE_SERVER: 'nist',
    INVITE_CLIENT: 'ict',
    INVITE_SERVER: 'ist'
  };

function buildViaHeader (request_sender, transport, id) {
  var via;
  via = 'SIP/2.0/' + (request_sender.ua.configuration.hackViaTcp ? 'TCP' : transport.server.scheme);
  via += ' ' + request_sender.ua.configuration.viaHost + ';branch=' + id;
  if (request_sender.ua.configuration.forceRport) {
    via += ';rport';
  }
  return via;
}

/**
* @augments SIP.Transactions
* @class Non Invite Client Transaction
* @param {SIP.RequestSender} request_sender
* @param {SIP.OutgoingRequest} request
* @param {SIP.Transport} transport
*/
var NonInviteClientTransaction = function(request_sender, request, transport) {
  var via;

  this.type = C.NON_INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.nict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);
};
NonInviteClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

NonInviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteClientTransaction.prototype.send = function() {
  var tr = this;

  this.stateChanged(C.STATUS_TRYING);
  this.F = SIP.Timers.setTimeout(tr.timer_F.bind(tr), SIP.Timers.TIMER_F);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

NonInviteClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, deleting non-INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.F);
  SIP.Timers.clearTimeout(this.K);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onTransportError();
};

NonInviteClientTransaction.prototype.timer_F = function() {
  this.logger.log('Timer F expired for non-INVITE client transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
  this.request_sender.onRequestTimeout();
};

NonInviteClientTransaction.prototype.timer_K = function() {
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

NonInviteClientTransaction.prototype.receiveResponse = function(response) {
  var
    tr = this,
    status_code = response.status_code;

  if(status_code < 200) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        break;
    }
  } else {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        SIP.Timers.clearTimeout(this.F);

        if(status_code === 408) {
          this.request_sender.onRequestTimeout();
        } else {
          this.request_sender.receiveResponse(response);
        }

        this.K = SIP.Timers.setTimeout(tr.timer_K.bind(tr), SIP.Timers.TIMER_K);
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }
};



/**
* @augments SIP.Transactions
* @class Invite Client Transaction
* @param {SIP.RequestSender} request_sender
* @param {SIP.OutgoingRequest} request
* @param {SIP.Transport} transport
*/
var InviteClientTransaction = function(request_sender, request, transport) {
  var via,
    tr = this;

  this.type = C.INVITE_CLIENT;
  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.ict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);

  this.request_sender.ua.newTransaction(this);

  // Add the cancel property to the request.
  //Will be called from the request instance, not the transaction itself.
  this.request.cancel = function(reason, extraHeaders) {
    extraHeaders = (extraHeaders || []).slice();
    var length = extraHeaders.length;
    var extraHeadersString = null;
    for (var idx = 0; idx < length; idx++) {
      extraHeadersString = (extraHeadersString || '') + extraHeaders[idx].trim() + '\r\n';
    }

    tr.cancel_request(tr, reason, extraHeadersString);
  };
};
InviteClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

InviteClientTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteClientTransaction.prototype.send = function() {
  var tr = this;
  this.stateChanged(C.STATUS_CALLING);
  this.B = SIP.Timers.setTimeout(tr.timer_B.bind(tr), SIP.Timers.TIMER_B);

  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

InviteClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, deleting INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.B);
  SIP.Timers.clearTimeout(this.D);
  SIP.Timers.clearTimeout(this.M);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);

  if (this.state !== C.STATUS_ACCEPTED) {
    this.request_sender.onTransportError();
  }
};

// RFC 6026 7.2
InviteClientTransaction.prototype.timer_M = function() {
  this.logger.log('Timer M expired for INVITE client transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    SIP.Timers.clearTimeout(this.B);
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
  }
};

// RFC 3261 17.1.1
InviteClientTransaction.prototype.timer_B = function() {
  this.logger.log('Timer B expired for INVITE client transaction ' + this.id);
  if(this.state === C.STATUS_CALLING) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.request_sender.ua.destroyTransaction(this);
    this.request_sender.onRequestTimeout();
  }
};

InviteClientTransaction.prototype.timer_D = function() {
  this.logger.log('Timer D expired for INVITE client transaction ' + this.id);
  SIP.Timers.clearTimeout(this.B);
  this.stateChanged(C.STATUS_TERMINATED);
  this.request_sender.ua.destroyTransaction(this);
};

InviteClientTransaction.prototype.sendACK = function(response) {
  var tr = this;

  this.ack = 'ACK ' + this.request.ruri + ' SIP/2.0\r\n';
  this.ack += 'Via: ' + this.request.headers['Via'].toString() + '\r\n';

  if(this.request.headers['Route']) {
    this.ack += 'Route: ' + this.request.headers['Route'].toString() + '\r\n';
  }

  this.ack += 'To: ' + response.getHeader('to') + '\r\n';
  this.ack += 'From: ' + this.request.headers['From'].toString() + '\r\n';
  this.ack += 'Call-ID: ' + this.request.headers['Call-ID'].toString() + '\r\n';
  this.ack += 'Content-Length: 0\r\n';
  this.ack += 'CSeq: ' + this.request.headers['CSeq'].toString().split(' ')[0];
  this.ack += ' ACK\r\n\r\n';

  this.D = SIP.Timers.setTimeout(tr.timer_D.bind(tr), SIP.Timers.TIMER_D);

  this.transport.send(this.ack);
};

InviteClientTransaction.prototype.cancel_request = function(tr, reason, extraHeaders) {
  var request = tr.request;

  this.cancel = SIP.C.CANCEL + ' ' + request.ruri + ' SIP/2.0\r\n';
  this.cancel += 'Via: ' + request.headers['Via'].toString() + '\r\n';

  if(this.request.headers['Route']) {
    this.cancel += 'Route: ' + request.headers['Route'].toString() + '\r\n';
  }

  this.cancel += 'To: ' + request.headers['To'].toString() + '\r\n';
  this.cancel += 'From: ' + request.headers['From'].toString() + '\r\n';
  this.cancel += 'Call-ID: ' + request.headers['Call-ID'].toString() + '\r\n';
  this.cancel += 'CSeq: ' + request.headers['CSeq'].toString().split(' ')[0] +
  ' CANCEL\r\n';

  if(reason) {
    this.cancel += 'Reason: ' + reason + '\r\n';
  }

  if (extraHeaders) {
    this.cancel += extraHeaders;
  }

  this.cancel += 'Content-Length: 0\r\n\r\n';

  // Send only if a provisional response (>100) has been received.
  if(this.state === C.STATUS_PROCEEDING) {
    this.transport.send(this.cancel);
  }
};

InviteClientTransaction.prototype.receiveResponse = function(response) {
  var
  tr = this,
  status_code = response.status_code;

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_CALLING:
        this.stateChanged(C.STATUS_PROCEEDING);
        this.request_sender.receiveResponse(response);
        if(this.cancel) {
          this.transport.send(this.cancel);
        }
        break;
      case C.STATUS_PROCEEDING:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.M = SIP.Timers.setTimeout(tr.timer_M.bind(tr), SIP.Timers.TIMER_M);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_ACCEPTED:
        this.request_sender.receiveResponse(response);
        break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_CALLING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.sendACK(response);
        this.request_sender.receiveResponse(response);
        break;
      case C.STATUS_COMPLETED:
        this.sendACK(response);
        break;
    }
  }
};


/**
 * @augments SIP.Transactions
 * @class ACK Client Transaction
 * @param {SIP.RequestSender} request_sender
 * @param {SIP.OutgoingRequest} request
 * @param {SIP.Transport} transport
 */
var AckClientTransaction = function(request_sender, request, transport) {
  var via;

  this.transport = transport;
  this.id = 'z9hG4bK' + Math.floor(Math.random() * 10000000);
  this.request_sender = request_sender;
  this.request = request;

  this.logger = request_sender.ua.getLogger('sip.transaction.nict', this.id);

  via = buildViaHeader(request_sender, transport, this.id);
  this.request.setHeader('via', via);
};
AckClientTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

AckClientTransaction.prototype.send = function() {
  if(!this.transport.send(this.request)) {
    this.onTransportError();
  }
};

AckClientTransaction.prototype.onTransportError = function() {
  this.logger.log('transport error occurred, for an ACK client transaction ' + this.id);
  this.request_sender.onTransportError();
};


/**
* @augments SIP.Transactions
* @class Non Invite Server Transaction
* @param {SIP.IncomingRequest} request
* @param {SIP.UA} ua
*/
var NonInviteServerTransaction = function(request, ua) {
  this.type = C.NON_INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.logger = ua.getLogger('sip.transaction.nist', this.id);

  this.state = C.STATUS_TRYING;

  ua.newTransaction(this);
};
NonInviteServerTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

NonInviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

NonInviteServerTransaction.prototype.timer_J = function() {
  this.logger.log('Timer J expired for non-INVITE server transaction ' + this.id);
  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

NonInviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    this.logger.log('transport error occurred, deleting non-INVITE server transaction ' + this.id);

    SIP.Timers.clearTimeout(this.J);
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

NonInviteServerTransaction.prototype.receiveResponse = function(status_code, response) {
  var tr = this;
  var deferred = SIP.Utils.defer();

  if(status_code === 100) {
    /* RFC 4320 4.1
     * 'A SIP element MUST NOT
     * send any provisional response with a
     * Status-Code other than 100 to a non-INVITE request.'
     */
    switch(this.state) {
      case C.STATUS_TRYING:
        this.stateChanged(C.STATUS_PROCEEDING);
        if(!this.transport.send(response))  {
          this.onTransportError();
        }
        break;
      case C.STATUS_PROCEEDING:
        this.last_response = response;
        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          deferred.resolve();
        }
        break;
    }
  } else if(status_code >= 200 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_TRYING:
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_COMPLETED);
        this.last_response = response;
        this.J = SIP.Timers.setTimeout(tr.timer_J.bind(tr), SIP.Timers.TIMER_J);
        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          deferred.resolve();
        }
        break;
      case C.STATUS_COMPLETED:
        break;
    }
  }

  return deferred.promise;
};

/**
* @augments SIP.Transactions
* @class Invite Server Transaction
* @param {SIP.IncomingRequest} request
* @param {SIP.UA} ua
*/
var InviteServerTransaction = function(request, ua) {
  this.type = C.INVITE_SERVER;
  this.id = request.via_branch;
  this.request = request;
  this.transport = request.transport;
  this.ua = ua;
  this.last_response = '';
  request.server_transaction = this;

  this.logger = ua.getLogger('sip.transaction.ist', this.id);

  this.state = C.STATUS_PROCEEDING;

  ua.newTransaction(this);

  this.resendProvisionalTimer = null;

  request.reply(100);
};
InviteServerTransaction.prototype = Object.create(SIP.EventEmitter.prototype);

InviteServerTransaction.prototype.stateChanged = function(state) {
  this.state = state;
  this.emit('stateChanged');
};

InviteServerTransaction.prototype.timer_H = function() {
  this.logger.log('Timer H expired for INVITE server transaction ' + this.id);

  if(this.state === C.STATUS_COMPLETED) {
    this.logger.warn('transactions', 'ACK for INVITE server transaction was never received, call will be terminated');
  }

  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

InviteServerTransaction.prototype.timer_I = function() {
  this.stateChanged(C.STATUS_TERMINATED);
  this.ua.destroyTransaction(this);
};

// RFC 6026 7.1
InviteServerTransaction.prototype.timer_L = function() {
  this.logger.log('Timer L expired for INVITE server transaction ' + this.id);

  if(this.state === C.STATUS_ACCEPTED) {
    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.onTransportError = function() {
  if (!this.transportError) {
    this.transportError = true;

    this.logger.log('transport error occurred, deleting INVITE server transaction ' + this.id);

    if (this.resendProvisionalTimer !== null) {
      SIP.Timers.clearInterval(this.resendProvisionalTimer);
      this.resendProvisionalTimer = null;
    }

    SIP.Timers.clearTimeout(this.L);
    SIP.Timers.clearTimeout(this.H);
    SIP.Timers.clearTimeout(this.I);

    this.stateChanged(C.STATUS_TERMINATED);
    this.ua.destroyTransaction(this);
  }
};

InviteServerTransaction.prototype.resend_provisional = function() {
  if(!this.transport.send(this.last_response)) {
    this.onTransportError();
  }
};

// INVITE Server Transaction RFC 3261 17.2.1
InviteServerTransaction.prototype.receiveResponse = function(status_code, response) {
  var tr = this;
  var deferred = SIP.Utils.defer();

  if(status_code >= 100 && status_code <= 199) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if(!this.transport.send(response)) {
          this.onTransportError();
        }
        this.last_response = response;
        break;
    }
  }

  if(status_code > 100 && status_code <= 199 && this.state === C.STATUS_PROCEEDING) {
    // Trigger the resendProvisionalTimer only for the first non 100 provisional response.
    if(this.resendProvisionalTimer === null) {
      this.resendProvisionalTimer = SIP.Timers.setInterval(tr.resend_provisional.bind(tr),
        SIP.Timers.PROVISIONAL_RESPONSE_INTERVAL);
    }
  } else if(status_code >= 200 && status_code <= 299) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        this.stateChanged(C.STATUS_ACCEPTED);
        this.last_response = response;
        this.L = SIP.Timers.setTimeout(tr.timer_L.bind(tr), SIP.Timers.TIMER_L);

        if (this.resendProvisionalTimer !== null) {
          SIP.Timers.clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }
        /* falls through */
        case C.STATUS_ACCEPTED:
          // Note that this point will be reached for proceeding tr.state also.
          if(!this.transport.send(response)) {
            this.onTransportError();
            deferred.reject();
          } else {
            deferred.resolve();
          }
          break;
    }
  } else if(status_code >= 300 && status_code <= 699) {
    switch(this.state) {
      case C.STATUS_PROCEEDING:
        if (this.resendProvisionalTimer !== null) {
          SIP.Timers.clearInterval(this.resendProvisionalTimer);
          this.resendProvisionalTimer = null;
        }

        if(!this.transport.send(response)) {
          this.onTransportError();
          deferred.reject();
        } else {
          this.stateChanged(C.STATUS_COMPLETED);
          this.H = SIP.Timers.setTimeout(tr.timer_H.bind(tr), SIP.Timers.TIMER_H);
          deferred.resolve();
        }
        break;
    }
  }

  return deferred.promise;
};

/**
 * @function
 * @param {SIP.UA} ua
 * @param {SIP.IncomingRequest} request
 *
 * @return {boolean}
 * INVITE:
 *  _true_ if retransmission
 *  _false_ new request
 *
 * ACK:
 *  _true_  ACK to non2xx response
 *  _false_ ACK must be passed to TU (accepted state)
 *          ACK to 2xx response
 *
 * CANCEL:
 *  _true_  no matching invite transaction
 *  _false_ matching invite transaction and no final response sent
 *
 * OTHER:
 *  _true_  retransmission
 *  _false_ new request
 */
var checkTransaction = function(ua, request) {
  var tr;

  switch(request.method) {
    case SIP.C.INVITE:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_PROCEEDING:
            tr.transport.send(tr.last_response);
            break;

            // RFC 6026 7.1 Invite retransmission
            //received while in C.STATUS_ACCEPTED state. Absorb it.
          case C.STATUS_ACCEPTED:
            break;
        }
        return true;
      }
      break;
    case SIP.C.ACK:
      tr = ua.transactions.ist[request.via_branch];

      // RFC 6026 7.1
      if(tr) {
        if(tr.state === C.STATUS_ACCEPTED) {
          return false;
        } else if(tr.state === C.STATUS_COMPLETED) {
          tr.stateChanged(C.STATUS_CONFIRMED);
          tr.I = SIP.Timers.setTimeout(tr.timer_I.bind(tr), SIP.Timers.TIMER_I);
          return true;
        }
      }

      // ACK to 2XX Response.
      else {
        return false;
      }
      break;
    case SIP.C.CANCEL:
      tr = ua.transactions.ist[request.via_branch];
      if(tr) {
        request.reply_sl(200);
        if(tr.state === C.STATUS_PROCEEDING) {
          return false;
        } else {
          return true;
        }
      } else {
        request.reply_sl(481);
        return true;
      }
      break;
    default:

      // Non-INVITE Server Transaction RFC 3261 17.2.2
      tr = ua.transactions.nist[request.via_branch];
      if(tr) {
        switch(tr.state) {
          case C.STATUS_TRYING:
            break;
          case C.STATUS_PROCEEDING:
          case C.STATUS_COMPLETED:
            tr.transport.send(tr.last_response);
            break;
        }
        return true;
      }
      break;
  }
};

SIP.Transactions = {
  C: C,
  checkTransaction: checkTransaction,
  NonInviteClientTransaction: NonInviteClientTransaction,
  InviteClientTransaction: InviteClientTransaction,
  AckClientTransaction: AckClientTransaction,
  NonInviteServerTransaction: NonInviteServerTransaction,
  InviteServerTransaction: InviteServerTransaction
};

};

},{}],116:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Transport
 */

/**
 * @augments SIP
 * @class Transport
 * @param {SIP.UA} ua
 * @param {Object} server ws_server Object
 */
module.exports = function (SIP, WebSocket) {
var Transport,
  C = {
    // Transport status codes
    STATUS_READY:        0,
    STATUS_DISCONNECTED: 1,
    STATUS_ERROR:        2
  };

/**
 * Compute an amount of time in seconds to wait before sending another
 * keep-alive.
 * @returns {Number}
 */
function computeKeepAliveTimeout(upperBound) {
  var lowerBound = upperBound * 0.8;
  return 1000 * (Math.random() * (upperBound - lowerBound) + lowerBound);
}

Transport = function(ua, server) {

  this.logger = ua.getLogger('sip.transport');
  this.ua = ua;
  this.ws = null;
  this.server = server;
  this.reconnection_attempts = 0;
  this.closed = false;
  this.connected = false;
  this.reconnectTimer = null;
  this.lastTransportError = {};

  this.keepAliveInterval = ua.configuration.keepAliveInterval;
  this.keepAliveTimeout = null;
  this.keepAliveTimer = null;

  this.ua.transport = this;

  // Connect
  this.connect();
};

Transport.prototype = {
  /**
   * Send a message.
   * @param {SIP.OutgoingRequest|String} msg
   * @returns {Boolean}
   */
  send: function(msg) {
    var message = msg.toString();

    if(this.ws && this.ws.readyState === WebSocket.OPEN) {
      if (this.ua.configuration.traceSip === true) {
        this.logger.log('sending WebSocket message:\n\n' + message + '\n');
      }
      this.ws.send(message);
      return true;
    } else {
      this.logger.warn('unable to send message, WebSocket is not open');
      return false;
    }
  },

  /**
   * Send a keep-alive (a double-CRLF sequence).
   * @private
   * @returns {Boolean}
   */
  sendKeepAlive: function() {
    if(this.keepAliveTimeout) { return; }

    this.keepAliveTimeout = SIP.Timers.setTimeout(function() {
      this.ua.emit('keepAliveTimeout');
    }.bind(this), 10000);

    return this.send('\r\n\r\n');
  },

  /**
   * Start sending keep-alives.
   * @private
   */
  startSendingKeepAlives: function() {
    if (this.keepAliveInterval && !this.keepAliveTimer) {
      this.keepAliveTimer = SIP.Timers.setTimeout(function() {
        this.sendKeepAlive();
        this.keepAliveTimer = null;
        this.startSendingKeepAlives();
      }.bind(this), computeKeepAliveTimeout(this.keepAliveInterval));
    }
  },

  /**
   * Stop sending keep-alives.
   * @private
   */
  stopSendingKeepAlives: function() {
    SIP.Timers.clearTimeout(this.keepAliveTimer);
    SIP.Timers.clearTimeout(this.keepAliveTimeout);
    this.keepAliveTimer = null;
    this.keepAliveTimeout = null;
  },

  /**
  * Disconnect socket.
  */
  disconnect: function() {
    if(this.ws) {
      // Clear reconnectTimer
      SIP.Timers.clearTimeout(this.reconnectTimer);

      this.stopSendingKeepAlives();

      this.closed = true;
      this.logger.log('closing WebSocket ' + this.server.ws_uri);
      this.ws.close();
    }

    if (this.reconnectTimer !== null) {
      SIP.Timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      this.ua.emit('disconnected', {
        transport: this,
        code: this.lastTransportError.code,
        reason: this.lastTransportError.reason
      });
    }
  },

  /**
  * Connect socket.
  */
  connect: function() {
    var transport = this;

    if(this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.logger.log('WebSocket ' + this.server.ws_uri + ' is already connected');
      return false;
    }

    if(this.ws) {
      this.ws.close();
    }

    this.logger.log('connecting to WebSocket ' + this.server.ws_uri);
    this.ua.onTransportConnecting(this,
      (this.reconnection_attempts === 0)?1:this.reconnection_attempts);

    try {
      this.ws = new WebSocket(this.server.ws_uri, 'sip');
    } catch(e) {
      this.logger.warn('error connecting to WebSocket ' + this.server.ws_uri + ': ' + e);
    }

    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = function() {
      transport.onOpen();
    };

    this.ws.onclose = function(e) {
      transport.onClose(e);
    };

    this.ws.onmessage = function(e) {
      transport.onMessage(e);
    };

    this.ws.onerror = function(e) {
      transport.onError(e);
    };
  },

  // Transport Event Handlers

  /**
  * @event
  * @param {event} e
  */
  onOpen: function() {
    this.connected = true;

    this.logger.log('WebSocket ' + this.server.ws_uri + ' connected');
    // Clear reconnectTimer since we are not disconnected
    if (this.reconnectTimer !== null) {
      SIP.Timers.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Reset reconnection_attempts
    this.reconnection_attempts = 0;
    // Disable closed
    this.closed = false;
    // Trigger onTransportConnected callback
    this.ua.onTransportConnected(this);
    // Start sending keep-alives
    this.startSendingKeepAlives();
  },

  /**
  * @event
  * @param {event} e
  */
  onClose: function(e) {
    var connected_before = this.connected;

    this.lastTransportError.code = e.code;
    this.lastTransportError.reason = e.reason;

    this.stopSendingKeepAlives();

    if (this.reconnection_attempts > 0) {
      this.logger.log('Reconnection attempt ' + this.reconnection_attempts + ' failed (code: ' + e.code + (e.reason? '| reason: ' + e.reason : '') +')');
      this.reconnect();
    } else {
      this.connected = false;
      this.logger.log('WebSocket disconnected (code: ' + e.code + (e.reason? '| reason: ' + e.reason : '') +')');

      if(e.wasClean === false) {
        this.logger.warn('WebSocket abrupt disconnection');
      }
      // Transport was connected
      if(connected_before === true) {
        this.ua.onTransportClosed(this);
        // Check whether the user requested to close.
        if(!this.closed) {
          this.reconnect();
        } else {
          this.ua.emit('disconnected', {
            transport: this,
            code: this.lastTransportError.code,
            reason: this.lastTransportError.reason
          });

        }
      } else {
        // This is the first connection attempt
        //Network error
        this.ua.onTransportError(this);
      }
    }
  },

  /**
  * @event
  * @param {event} e
  */
  onMessage: function(e) {
    var message, transaction,
      data = e.data;

    // CRLF Keep Alive response from server. Ignore it.
    if(data === '\r\n') {
      SIP.Timers.clearTimeout(this.keepAliveTimeout);
      this.keepAliveTimeout = null;

      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket message with CRLF Keep Alive response');
      }

      return;
    }

    // WebSocket binary message.
    else if (typeof data !== 'string') {
      try {
        data = String.fromCharCode.apply(null, new Uint8Array(data));
      } catch(evt) {
        this.logger.warn('received WebSocket binary message failed to be converted into string, message discarded');
        return;
      }

      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket binary message:\n\n' + data + '\n');
      }
    }

    // WebSocket text message.
    else {
      if (this.ua.configuration.traceSip === true) {
        this.logger.log('received WebSocket text message:\n\n' + data + '\n');
      }
    }

    message = SIP.Parser.parseMessage(data, this.ua);

    if (!message) {
      return;
    }

    if(this.ua.status === SIP.UA.C.STATUS_USER_CLOSED && message instanceof SIP.IncomingRequest) {
      return;
    }

    // Do some sanity check
    if(SIP.sanityCheck(message, this.ua, this)) {
      if(message instanceof SIP.IncomingRequest) {
        message.transport = this;
        this.ua.receiveRequest(message);
      } else if(message instanceof SIP.IncomingResponse) {
        /* Unike stated in 18.1.2, if a response does not match
        * any transaction, it is discarded here and no passed to the core
        * in order to be discarded there.
        */
        switch(message.method) {
          case SIP.C.INVITE:
            transaction = this.ua.transactions.ict[message.via_branch];
            if(transaction) {
              transaction.receiveResponse(message);
            }
            break;
          case SIP.C.ACK:
            // Just in case ;-)
            break;
          default:
            transaction = this.ua.transactions.nict[message.via_branch];
            if(transaction) {
              transaction.receiveResponse(message);
            }
            break;
        }
      }
    }
  },

  /**
  * @event
  * @param {event} e
  */
  onError: function(e) {
    this.logger.warn('WebSocket connection error: ' + JSON.stringify(e));
  },

  /**
  * Reconnection attempt logic.
  * @private
  */
  reconnect: function() {
    var transport = this;

    this.reconnection_attempts += 1;

    if(this.reconnection_attempts > this.ua.configuration.wsServerMaxReconnection) {
      this.logger.warn('maximum reconnection attempts for WebSocket ' + this.server.ws_uri);
      this.ua.onTransportError(this);
    } else if (this.reconnection_attempts === 1) {
      this.logger.log('Connection to WebSocket ' + this.server.ws_uri + ' severed, attempting first reconnect');
      transport.connect();
    } else {
      this.logger.log('trying to reconnect to WebSocket ' + this.server.ws_uri + ' (reconnection attempt ' + this.reconnection_attempts + ')');

      this.reconnectTimer = SIP.Timers.setTimeout(function() {
        transport.connect();
        transport.reconnectTimer = null;
      }, this.ua.configuration.wsServerReconnectionTimeout * 1000);
    }
  }
};

Transport.C = C;
return Transport;
};

},{}],117:[function(require,module,exports){
(function (global){
"use strict";
/**
 * @augments SIP
 * @class Class creating a SIP User Agent.
 * @param {function returning SIP.MediaHandler} [configuration.mediaHandlerFactory]
 *        A function will be invoked by each of the UA's Sessions to build the MediaHandler for that Session.
 *        If no (or a falsy) value is provided, each Session will use a default (WebRTC) MediaHandler.
 *
 * @param {Object} [configuration.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
 */
module.exports = function (SIP, environment) {
var UA,
  C = {
    // UA status codes
    STATUS_INIT:                0,
    STATUS_STARTING:            1,
    STATUS_READY:               2,
    STATUS_USER_CLOSED:         3,
    STATUS_NOT_READY:           4,

    // UA error codes
    CONFIGURATION_ERROR:  1,
    NETWORK_ERROR:        2,

    ALLOWED_METHODS: [
      'ACK',
      'CANCEL',
      'INVITE',
      'MESSAGE',
      'BYE',
      'OPTIONS',
      'INFO',
      'NOTIFY',
      'REFER'
    ],

    ACCEPTED_BODY_TYPES: [
      'application/sdp',
      'application/dtmf-relay'
    ],

    MAX_FORWARDS: 70,
    TAG_LENGTH: 10
  };

UA = function(configuration) {
  var self = this;

  // Helper function for forwarding events
  function selfEmit(type) {
    //registrationFailed handler is invoked with two arguments. Allow event handlers to be invoked with a variable no. of arguments
    return self.emit.bind(self, type);
  }

  // Set Accepted Body Types
  C.ACCEPTED_BODY_TYPES = C.ACCEPTED_BODY_TYPES.toString();

  this.log = new SIP.LoggerFactory();
  this.logger = this.getLogger('sip.ua');

  this.cache = {
    credentials: {}
  };

  this.configuration = {};
  this.dialogs = {};

  //User actions outside any session/dialog (MESSAGE)
  this.applicants = {};

  this.data = {};
  this.sessions = {};
  this.subscriptions = {};
  this.transport = null;
  this.contact = null;
  this.status = C.STATUS_INIT;
  this.error = null;
  this.transactions = {
    nist: {},
    nict: {},
    ist: {},
    ict: {}
  };

  this.transportRecoverAttempts = 0;
  this.transportRecoveryTimer = null;

  Object.defineProperties(this, {
    transactionsCount: {
      get: function() {
        var type,
          transactions = ['nist','nict','ist','ict'],
          count = 0;

        for (type in transactions) {
          count += Object.keys(this.transactions[transactions[type]]).length;
        }

        return count;
      }
    },

    nictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['nict']).length;
      }
    },

    nistTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['nist']).length;
      }
    },

    ictTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['ict']).length;
      }
    },

    istTransactionsCount: {
      get: function() {
        return Object.keys(this.transactions['ist']).length;
      }
    }
  });

  /**
   * Load configuration
   *
   * @throws {SIP.Exceptions.ConfigurationError}
   * @throws {TypeError}
   */

  if(configuration === undefined) {
    configuration = {};
  } else if (typeof configuration === 'string' || configuration instanceof String) {
    configuration = {
      uri: configuration
    };
  }

  // Apply log configuration if present
  if (configuration.log) {
    if (configuration.log.hasOwnProperty('builtinEnabled')) {
      this.log.builtinEnabled = configuration.log.builtinEnabled;
    }

    if (configuration.log.hasOwnProperty('level')) {
      this.log.level = configuration.log.level;
    }

    if (configuration.log.hasOwnProperty('connector')) {
      this.log.connector = configuration.log.connector;
    }
  }

  try {
    this.loadConfig(configuration);
  } catch(e) {
    this.status = C.STATUS_NOT_READY;
    this.error = C.CONFIGURATION_ERROR;
    throw e;
  }

  // Initialize registerContext
  this.registerContext = new SIP.RegisterContext(this);
  this.registerContext.on('failed', selfEmit('registrationFailed'));
  this.registerContext.on('registered', selfEmit('registered'));
  this.registerContext.on('unregistered', selfEmit('unregistered'));

  if(this.configuration.autostart) {
    this.start();
  }

  if (typeof environment.addEventListener === 'function') {
    // Google Chrome Packaged Apps don't allow 'unload' listeners:
    // unload is not available in packaged apps
    if (!(global.chrome && global.chrome.app && global.chrome.app.runtime)) {
      environment.addEventListener('unload', this.stop.bind(this));
    }
  }
};
UA.prototype = Object.create(SIP.EventEmitter.prototype);

//=================
//  High Level API
//=================

UA.prototype.register = function(options) {
  this.configuration.register = true;
  this.registerContext.register(options);

  return this;
};

/**
 * Unregister.
 *
 * @param {Boolean} [all] unregister all user bindings.
 *
 */
UA.prototype.unregister = function(options) {
  this.configuration.register = false;

  var context = this.registerContext;
  this.afterConnected(context.unregister.bind(context, options));

  return this;
};

UA.prototype.isRegistered = function() {
  return this.registerContext.registered;
};

/**
 * Connection state.
 * @param {Boolean}
 */
UA.prototype.isConnected = function() {
  return this.transport ? this.transport.connected : false;
};

UA.prototype.afterConnected = function afterConnected (callback) {
  if (this.isConnected()) {
    callback();
  } else {
    this.once('connected', callback);
  }
};

/**
 * Make an outgoing call.
 *
 * @param {String} target
 * @param {Object} views
 * @param {Object} [options.media] gets passed to SIP.MediaHandler.getDescription as mediaHint
 *
 * @throws {TypeError}
 *
 */
UA.prototype.invite = function(target, options) {
  var context = new SIP.InviteClientContext(this, target, options);

  this.afterConnected(context.invite.bind(context));
  return context;
};

UA.prototype.subscribe = function(target, event, options) {
  var sub = new SIP.Subscription(this, target, event, options);

  this.afterConnected(sub.subscribe.bind(sub));
  return sub;
};

/**
 * Send a message.
 *
 * @param {String} target
 * @param {String} body
 * @param {Object} [options]
 *
 * @throws {TypeError}
 *
 */
UA.prototype.message = function(target, body, options) {
  if (body === undefined) {
    throw new TypeError('Not enough arguments');
  }

  // There is no Message module, so it is okay that the UA handles defaults here.
  options = Object.create(options || Object.prototype);
  options.contentType || (options.contentType = 'text/plain');
  options.body = body;

  return this.request(SIP.C.MESSAGE, target, options);
};

UA.prototype.request = function (method, target, options) {
  var req = new SIP.ClientContext(this, method, target, options);

  this.afterConnected(req.send.bind(req));
  return req;
};

/**
 * Gracefully close.
 *
 */
UA.prototype.stop = function() {
  var session, subscription, applicant,
    ua = this;

  function transactionsListener() {
    if (ua.nistTransactionsCount === 0 && ua.nictTransactionsCount === 0) {
        ua.removeListener('transactionDestroyed', transactionsListener);
        ua.transport.disconnect();
    }
  }

  this.logger.log('user requested closure...');

  if(this.status === C.STATUS_USER_CLOSED) {
    this.logger.warn('UA already closed');
    return this;
  }

  // Clear transportRecoveryTimer
  SIP.Timers.clearTimeout(this.transportRecoveryTimer);

  // Close registerContext
  this.logger.log('closing registerContext');
  this.registerContext.close();

  // Run  _terminate_ on every Session
  for(session in this.sessions) {
    this.logger.log('closing session ' + session);
    this.sessions[session].terminate();
  }

  //Run _close_ on every Subscription
  for(subscription in this.subscriptions) {
    this.logger.log('unsubscribing from subscription ' + subscription);
    this.subscriptions[subscription].close();
  }

  // Run  _close_ on every applicant
  for(applicant in this.applicants) {
    this.applicants[applicant].close();
  }

  this.status = C.STATUS_USER_CLOSED;

  /*
   * If the remaining transactions are all INVITE transactions, there is no need to
   * wait anymore because every session has already been closed by this method.
   * - locally originated sessions where terminated (CANCEL or BYE)
   * - remotely originated sessions where rejected (4XX) or terminated (BYE)
   * Remaining INVITE transactions belong tho sessions that where answered. This are in
   * 'accepted' state due to timers 'L' and 'M' defined in [RFC 6026]
   */
  if (this.nistTransactionsCount === 0 && this.nictTransactionsCount === 0) {
    if (this.transport) {
      this.transport.disconnect();
    }
  } else {
    this.on('transactionDestroyed', transactionsListener);
  }

  return this;
};

/**
 * Connect to the WS server if status = STATUS_INIT.
 * Resume UA after being closed.
 *
 */
UA.prototype.start = function() {
  var server;

  this.logger.log('user requested startup...');
  if (this.status === C.STATUS_INIT) {
    server = this.getNextWsServer();
    this.status = C.STATUS_STARTING;
    new SIP.Transport(this, server);
  } else if(this.status === C.STATUS_USER_CLOSED) {
    this.logger.log('resuming');
    this.status = C.STATUS_READY;
    this.transport.connect();
  } else if (this.status === C.STATUS_STARTING) {
    this.logger.log('UA is in STARTING status, not opening new connection');
  } else if (this.status === C.STATUS_READY) {
    this.logger.log('UA is in READY status, not resuming');
  } else {
    this.logger.error('Connection is down. Auto-Recovery system is trying to connect');
  }

  return this;
};

/**
 * Normalize a string into a valid SIP request URI
 *
 * @param {String} target
 *
 * @returns {SIP.URI|undefined}
 */
UA.prototype.normalizeTarget = function(target) {
  return SIP.Utils.normalizeTarget(target, this.configuration.hostportParams);
};


//===============================
//  Private (For internal use)
//===============================

UA.prototype.saveCredentials = function(credentials) {
  this.cache.credentials[credentials.realm] = this.cache.credentials[credentials.realm] || {};
  this.cache.credentials[credentials.realm][credentials.uri] = credentials;

  return this;
};

UA.prototype.getCredentials = function(request) {
  var realm, credentials;

  realm = request.ruri.host;

  if (this.cache.credentials[realm] && this.cache.credentials[realm][request.ruri]) {
    credentials = this.cache.credentials[realm][request.ruri];
    credentials.method = request.method;
  }

  return credentials;
};

UA.prototype.getLogger = function(category, label) {
  return this.log.getLogger(category, label);
};


//==============================
// Event Handlers
//==============================

/**
 * Transport Close event
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportClosed = function(transport) {
  // Run _onTransportError_ callback on every client transaction using _transport_
  var type, idx, length,
    client_transactions = ['nict', 'ict', 'nist', 'ist'];

  transport.server.status = SIP.Transport.C.STATUS_DISCONNECTED;
  this.logger.log('connection state set to '+ SIP.Transport.C.STATUS_DISCONNECTED);

  length = client_transactions.length;
  for (type = 0; type < length; type++) {
    for(idx in this.transactions[client_transactions[type]]) {
      this.transactions[client_transactions[type]][idx].onTransportError();
    }
  }

  // Close sessions if GRUU is not being used
  if (!this.contact.pub_gruu) {
    this.closeSessionsOnTransportError();
  }

};

/**
 * Unrecoverable transport event.
 * Connection reattempt logic has been done and didn't success.
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportError = function(transport) {
  var server;

  this.logger.log('transport ' + transport.server.ws_uri + ' failed | connection state set to '+ SIP.Transport.C.STATUS_ERROR);

  // Close sessions.
  //Mark this transport as 'down'
  transport.server.status = SIP.Transport.C.STATUS_ERROR;

  this.emit('disconnected', {
    transport: transport
  });

  // try the next transport if the UA isn't closed
  if(this.status === C.STATUS_USER_CLOSED) {
    return;
  }

  server = this.getNextWsServer();

  if(server) {
    new SIP.Transport(this, server);
  }else {
    this.closeSessionsOnTransportError();
    if (!this.error || this.error !== C.NETWORK_ERROR) {
      this.status = C.STATUS_NOT_READY;
      this.error = C.NETWORK_ERROR;
    }
    // Transport Recovery process
    this.recoverTransport();
  }
};

/**
 * Transport connection event.
 * @private
 * @event
 * @param {SIP.Transport} transport.
 */
UA.prototype.onTransportConnected = function(transport) {
  this.transport = transport;

  // Reset transport recovery counter
  this.transportRecoverAttempts = 0;

  transport.server.status = SIP.Transport.C.STATUS_READY;
  this.logger.log('connection state set to '+ SIP.Transport.C.STATUS_READY);

  if(this.status === C.STATUS_USER_CLOSED) {
    return;
  }

  this.status = C.STATUS_READY;
  this.error = null;

  if(this.configuration.register) {
    this.configuration.authenticationFactory.initialize().then(function () {
      this.registerContext.onTransportConnected();
    }.bind(this));
  }

  this.emit('connected', {
    transport: transport
  });
};


/**
 * Transport connecting event
 * @private
 * @param {SIP.Transport} transport.
 * #param {Integer} attempts.
 */
  UA.prototype.onTransportConnecting = function(transport, attempts) {
    this.emit('connecting', {
      transport: transport,
      attempts: attempts
    });
  };


/**
 * new Transaction
 * @private
 * @param {SIP.Transaction} transaction.
 */
UA.prototype.newTransaction = function(transaction) {
  this.transactions[transaction.type][transaction.id] = transaction;
  this.emit('newTransaction', {transaction: transaction});
};


/**
 * destroy Transaction
 * @private
 * @param {SIP.Transaction} transaction.
 */
UA.prototype.destroyTransaction = function(transaction) {
  delete this.transactions[transaction.type][transaction.id];
  this.emit('transactionDestroyed', {
    transaction: transaction
  });
};


//=========================
// receiveRequest
//=========================

/**
 * Request reception
 * @private
 * @param {SIP.IncomingRequest} request.
 */
UA.prototype.receiveRequest = function(request) {
  var dialog, session, message,
    method = request.method,
    transaction,
    replaces,
    replacedDialog,
    self = this;

  function ruriMatches (uri) {
    return uri && uri.user === request.ruri.user;
  }

  // Check that request URI points to us
  if(!(ruriMatches(this.configuration.uri) ||
       ruriMatches(this.contact.uri) ||
       ruriMatches(this.contact.pub_gruu) ||
       ruriMatches(this.contact.temp_gruu))) {
    this.logger.warn('Request-URI does not point to us');
    if (request.method !== SIP.C.ACK) {
      request.reply_sl(404);
    }
    return;
  }

  // Check request URI scheme
  if(request.ruri.scheme === SIP.C.SIPS) {
    request.reply_sl(416);
    return;
  }

  // Check transaction
  if(SIP.Transactions.checkTransaction(this, request)) {
    return;
  }

  /* RFC3261 12.2.2
   * Requests that do not change in any way the state of a dialog may be
   * received within a dialog (for example, an OPTIONS request).
   * They are processed as if they had been received outside the dialog.
   */
  if(method === SIP.C.OPTIONS) {
    new SIP.Transactions.NonInviteServerTransaction(request, this);
    request.reply(200, null, [
      'Allow: '+ SIP.UA.C.ALLOWED_METHODS.toString(),
      'Accept: '+ C.ACCEPTED_BODY_TYPES
    ]);
  } else if (method === SIP.C.MESSAGE) {
    message = new SIP.ServerContext(this, request);
    message.body = request.body;
    message.content_type = request.getHeader('Content-Type') || 'text/plain';

    request.reply(200, null);
    this.emit('message', message);
  } else if (method !== SIP.C.INVITE &&
             method !== SIP.C.ACK) {
    // Let those methods pass through to normal processing for now.
    transaction = new SIP.ServerContext(this, request);
  }

  // Initial Request
  if(!request.to_tag) {
    switch(method) {
      case SIP.C.INVITE:
        replaces =
          this.configuration.replaces !== SIP.C.supported.UNSUPPORTED &&
          request.parseHeader('replaces');

        if (replaces) {
          replacedDialog = this.dialogs[replaces.call_id + replaces.replaces_to_tag + replaces.replaces_from_tag];

          if (!replacedDialog) {
            //Replaced header without a matching dialog, reject
            request.reply_sl(481, null);
            return;
          } else if (replacedDialog.owner.status === SIP.Session.C.STATUS_TERMINATED) {
            request.reply_sl(603, null);
            return;
          } else if (replacedDialog.state === SIP.Dialog.C.STATUS_CONFIRMED && replaces.early_only) {
            request.reply_sl(486, null);
            return;
          }
        }

        var isMediaSupported = this.configuration.mediaHandlerFactory.isSupported;
        if(!isMediaSupported || isMediaSupported()) {
          session = new SIP.InviteServerContext(this, request);
          session.replacee = replacedDialog && replacedDialog.owner;
          session.on('invite', function() {
            self.emit('invite', this);
          });
        } else {
          this.logger.warn('INVITE received but WebRTC is not supported');
          request.reply(488);
        }
        break;
      case SIP.C.BYE:
        // Out of dialog BYE received
        request.reply(481);
        break;
      case SIP.C.CANCEL:
        session = this.findSession(request);
        if(session) {
          session.receiveRequest(request);
        } else {
          this.logger.warn('received CANCEL request for a non existent session');
        }
        break;
      case SIP.C.ACK:
        /* Absorb it.
         * ACK request without a corresponding Invite Transaction
         * and without To tag.
         */
        break;
      case SIP.C.NOTIFY:
        if (this.configuration.allowLegacyNotifications && this.listeners('notify').length > 0) {
          request.reply(200, null);
          self.emit('notify', {request: request});
        } else {
          request.reply(481, 'Subscription does not exist');
        }
        break;
      default:
        request.reply(405);
        break;
    }
  }
  // In-dialog request
  else {
    dialog = this.findDialog(request);

    if(dialog) {
      if (method === SIP.C.INVITE) {
        new SIP.Transactions.InviteServerTransaction(request, this);
      }
      dialog.receiveRequest(request);
    } else if (method === SIP.C.NOTIFY) {
      session = this.findSession(request);
      if(session) {
        session.receiveRequest(request);
      } else {
        this.logger.warn('received NOTIFY request for a non existent session');
        request.reply(481, 'Subscription does not exist');
      }
    }
    /* RFC3261 12.2.2
     * Request with to tag, but no matching dialog found.
     * Exception: ACK for an Invite request for which a dialog has not
     * been created.
     */
    else {
      if(method !== SIP.C.ACK) {
        request.reply(481);
      }
    }
  }
};

//=================
// Utils
//=================

/**
 * Get the session to which the request belongs to, if any.
 * @private
 * @param {SIP.IncomingRequest} request.
 * @returns {SIP.OutgoingSession|SIP.IncomingSession|null}
 */
UA.prototype.findSession = function(request) {
  return this.sessions[request.call_id + request.from_tag] ||
          this.sessions[request.call_id + request.to_tag] ||
          null;
};

/**
 * Get the dialog to which the request belongs to, if any.
 * @private
 * @param {SIP.IncomingRequest}
 * @returns {SIP.Dialog|null}
 */
UA.prototype.findDialog = function(request) {
  return this.dialogs[request.call_id + request.from_tag + request.to_tag] ||
          this.dialogs[request.call_id + request.to_tag + request.from_tag] ||
          null;
};

/**
 * Retrieve the next server to which connect.
 * @private
 * @returns {Object} ws_server
 */
UA.prototype.getNextWsServer = function() {
  // Order servers by weight
  var idx, length, ws_server,
    candidates = [];

  length = this.configuration.wsServers.length;
  for (idx = 0; idx < length; idx++) {
    ws_server = this.configuration.wsServers[idx];

    if (ws_server.status === SIP.Transport.C.STATUS_ERROR) {
      continue;
    } else if (candidates.length === 0) {
      candidates.push(ws_server);
    } else if (ws_server.weight > candidates[0].weight) {
      candidates = [ws_server];
    } else if (ws_server.weight === candidates[0].weight) {
      candidates.push(ws_server);
    }
  }

  idx = Math.floor(Math.random() * candidates.length);

  return candidates[idx];
};

/**
 * Close all sessions on transport error.
 * @private
 */
UA.prototype.closeSessionsOnTransportError = function() {
  var idx;

  // Run _transportError_ for every Session
  for(idx in this.sessions) {
    this.sessions[idx].onTransportError();
  }
  // Call registerContext _onTransportClosed_
  this.registerContext.onTransportClosed();
};

UA.prototype.recoverTransport = function(ua) {
  var idx, length, k, nextRetry, count, server;

  ua = ua || this;
  count = ua.transportRecoverAttempts;

  length = ua.configuration.wsServers.length;
  for (idx = 0; idx < length; idx++) {
    ua.configuration.wsServers[idx].status = 0;
  }

  server = ua.getNextWsServer();

  k = Math.floor((Math.random() * Math.pow(2,count)) +1);
  nextRetry = k * ua.configuration.connectionRecoveryMinInterval;

  if (nextRetry > ua.configuration.connectionRecoveryMaxInterval) {
    this.logger.log('time for next connection attempt exceeds connectionRecoveryMaxInterval, resetting counter');
    nextRetry = ua.configuration.connectionRecoveryMinInterval;
    count = 0;
  }

  this.logger.log('next connection attempt in '+ nextRetry +' seconds');

  this.transportRecoveryTimer = SIP.Timers.setTimeout(
    function(){
      ua.transportRecoverAttempts = count + 1;
      new SIP.Transport(ua, server);
    }, nextRetry * 1000);
};

function checkAuthenticationFactory (authenticationFactory) {
  if (!(authenticationFactory instanceof Function)) {
    return;
  }
  if (!authenticationFactory.initialize) {
    authenticationFactory.initialize = function initialize () {
      return SIP.Utils.Promise.resolve();
    };
  }
  return authenticationFactory;
}

/**
 * Configuration load.
 * @private
 * returns {Boolean}
 */
UA.prototype.loadConfig = function(configuration) {
  // Settings and default values
  var parameter, value, checked_value, hostportParams, registrarServer,
    settings = {
      /* Host address
      * Value to be set in Via sent_by and host part of Contact FQDN
      */
      viaHost: SIP.Utils.createRandomToken(12) + '.invalid',

      uri: new SIP.URI('sip', 'anonymous.' + SIP.Utils.createRandomToken(6), 'anonymous.invalid', null, null),
      wsServers: [{
        scheme: 'WSS',
        sip_uri: '<sip:edge.sip.onsip.com;transport=ws;lr>',
        status: 0,
        weight: 0,
        ws_uri: 'wss://edge.sip.onsip.com'
      }],

      // Password
      password: null,

      // Registration parameters
      registerExpires: 600,
      register: true,
      registrarServer: null,

      // Transport related parameters
      wsServerMaxReconnection: 3,
      wsServerReconnectionTimeout: 4,

      connectionRecoveryMinInterval: 2,
      connectionRecoveryMaxInterval: 30,

      keepAliveInterval: 0,

      extraSupported: [],

      usePreloadedRoute: false,

      //string to be inserted into User-Agent request header
      userAgentString: SIP.C.USER_AGENT,

      // Session parameters
      iceCheckingTimeout: 5000,
      noAnswerTimeout: 60,
      stunServers: ['stun:stun.l.google.com:19302'],
      turnServers: [],

      // Logging parameters
      traceSip: false,

      // Hacks
      hackViaTcp: false,
      hackIpInContact: false,
      hackWssInTransport: false,
      hackAllowUnregisteredOptionTags: false,
      hackCleanJitsiSdpImageattr: false,
      hackStripTcp: false,

      contactTransport: 'ws',
      forceRport: false,

      //autostarting
      autostart: true,

      //Reliable Provisional Responses
      rel100: SIP.C.supported.UNSUPPORTED,

      // Replaces header (RFC 3891)
      // http://tools.ietf.org/html/rfc3891
      replaces: SIP.C.supported.UNSUPPORTED,

      mediaHandlerFactory: SIP.WebRTC.MediaHandler.defaultFactory,

      authenticationFactory: checkAuthenticationFactory(function authenticationFactory (ua) {
        return new SIP.DigestAuthentication(ua);
      }),

      allowLegacyNotifications: false
    };

  // Pre-Configuration
  function aliasUnderscored (parameter, logger) {
    var underscored = parameter.replace(/([a-z][A-Z])/g, function (m) {
      return m[0] + '_' + m[1].toLowerCase();
    });

    if (parameter === underscored) {
      return;
    }

    var hasParameter = configuration.hasOwnProperty(parameter);
    if (configuration.hasOwnProperty(underscored)) {
      logger.warn(underscored + ' is deprecated, please use ' + parameter);
      if (hasParameter) {
        logger.warn(parameter + ' overriding ' + underscored);
      }
    }

    configuration[parameter] = hasParameter ? configuration[parameter] : configuration[underscored];
  }

  // Check Mandatory parameters
  for(parameter in UA.configuration_check.mandatory) {
    aliasUnderscored(parameter, this.logger);
    if(!configuration.hasOwnProperty(parameter)) {
      throw new SIP.Exceptions.ConfigurationError(parameter);
    } else {
      value = configuration[parameter];
      checked_value = UA.configuration_check.mandatory[parameter](value);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new SIP.Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  SIP.Utils.optionsOverride(configuration, 'rel100', 'reliable', true, this.logger, SIP.C.supported.UNSUPPORTED);

  var emptyArraysAllowed = ['stunServers', 'turnServers'];

  // Check Optional parameters
  for(parameter in UA.configuration_check.optional) {
    aliasUnderscored(parameter, this.logger);
    if(configuration.hasOwnProperty(parameter)) {
      value = configuration[parameter];

      // If the parameter value is an empty array, but shouldn't be, apply its default value.
      if (value instanceof Array && value.length === 0 && emptyArraysAllowed.indexOf(parameter) < 0) { continue; }

      // If the parameter value is null, empty string, or undefined then apply its default value.
      if(value === null || value === "" || value === undefined) { continue; }
      // If it's a number with NaN value then also apply its default value.
      // NOTE: JS does not allow "value === NaN", the following does the work:
      else if(typeof(value) === 'number' && isNaN(value)) { continue; }

      checked_value = UA.configuration_check.optional[parameter](value);
      if (checked_value !== undefined) {
        settings[parameter] = checked_value;
      } else {
        throw new SIP.Exceptions.ConfigurationError(parameter, value);
      }
    }
  }

  // Sanity Checks

  // Connection recovery intervals
  if(settings.connectionRecoveryMaxInterval < settings.connectionRecoveryMinInterval) {
    throw new SIP.Exceptions.ConfigurationError('connectionRecoveryMaxInterval', settings.connectionRecoveryMaxInterval);
  }

  // Post Configuration Process

  // Allow passing 0 number as displayName.
  if (settings.displayName === 0) {
    settings.displayName = '0';
  }

  // Instance-id for GRUU
  if (!settings.instanceId) {
    settings.instanceId = SIP.Utils.newUUID();
  }

  // sipjsId instance parameter. Static random tag of length 5
  settings.sipjsId = SIP.Utils.createRandomToken(5);

  // String containing settings.uri without scheme and user.
  hostportParams = settings.uri.clone();
  hostportParams.user = null;
  settings.hostportParams = hostportParams.toRaw().replace(/^sip:/i, '');

  /* Check whether authorizationUser is explicitly defined.
   * Take 'settings.uri.user' value if not.
   */
  if (!settings.authorizationUser) {
    settings.authorizationUser = settings.uri.user;
  }

  /* If no 'registrarServer' is set use the 'uri' value without user portion. */
  if (!settings.registrarServer) {
    registrarServer = settings.uri.clone();
    registrarServer.user = null;
    settings.registrarServer = registrarServer;
  }

  // User noAnswerTimeout
  settings.noAnswerTimeout = settings.noAnswerTimeout * 1000;

  // Via Host
  if (settings.hackIpInContact) {
    if (typeof settings.hackIpInContact === 'boolean') {
      settings.viaHost = SIP.Utils.getRandomTestNetIP();
    }
    else if (typeof settings.hackIpInContact === 'string') {
      settings.viaHost = settings.hackIpInContact;
    }
  }

  // Contact transport parameter
  if (settings.hackWssInTransport) {
    settings.contactTransport = 'wss';
  }

  this.contact = {
    pub_gruu: null,
    temp_gruu: null,
    uri: new SIP.URI('sip', SIP.Utils.createRandomToken(8), settings.viaHost, null, {transport: settings.contactTransport}),
    toString: function(options){
      options = options || {};

      var
        anonymous = options.anonymous || null,
        outbound = options.outbound || null,
        contact = '<';

      if (anonymous) {
        contact += (this.temp_gruu || ('sip:anonymous@anonymous.invalid;transport='+settings.contactTransport)).toString();
      } else {
        contact += (this.pub_gruu || this.uri).toString();
      }

      if (outbound) {
        contact += ';ob';
      }

      contact += '>';

      return contact;
    }
  };

  // media overrides mediaConstraints
  SIP.Utils.optionsOverride(settings, 'media', 'mediaConstraints', true, this.logger);

  // Fill the value of the configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = settings[parameter];
  }

  Object.defineProperties(this.configuration, UA.configuration_skeleton);

  // Clean UA.configuration_skeleton
  for(parameter in settings) {
    UA.configuration_skeleton[parameter].value = '';
  }

  this.logger.log('configuration parameters after validation:');
  for(parameter in settings) {
    switch(parameter) {
      case 'uri':
      case 'registrarServer':
      case 'mediaHandlerFactory':
        this.logger.log('· ' + parameter + ': ' + settings[parameter]);
        break;
      case 'password':
        this.logger.log('· ' + parameter + ': ' + 'NOT SHOWN');
        break;
      default:
        this.logger.log('· ' + parameter + ': ' + JSON.stringify(settings[parameter]));
    }
  }

  return;
};

/**
 * Configuration Object skeleton.
 * @private
 */
UA.configuration_skeleton = (function() {
  var idx,  parameter,
    skeleton = {},
    parameters = [
      // Internal parameters
      "sipjsId",
      "hostportParams",

      // Optional user configurable parameters
      "uri",
      "wsServers",
      "authorizationUser",
      "connectionRecoveryMaxInterval",
      "connectionRecoveryMinInterval",
      "keepAliveInterval",
      "extraSupported",
      "displayName",
      "hackViaTcp", // false.
      "hackIpInContact", //false
      "hackWssInTransport", //false
      "hackAllowUnregisteredOptionTags", //false
      "hackCleanJitsiSdpImageattr", //false
      "hackStripTcp", //false
      "contactTransport", // 'ws'
      "forceRport", // false
      "iceCheckingTimeout",
      "instanceId",
      "noAnswerTimeout", // 30 seconds.
      "password",
      "registerExpires", // 600 seconds.
      "registrarServer",
      "reliable",
      "rel100",
      "replaces",
      "userAgentString", //SIP.C.USER_AGENT
      "autostart",
      "stunServers",
      "traceSip",
      "turnServers",
      "usePreloadedRoute",
      "wsServerMaxReconnection",
      "wsServerReconnectionTimeout",
      "mediaHandlerFactory",
      "media",
      "mediaConstraints",
      "authenticationFactory",
      "allowLegacyNotifications",

      // Post-configuration generated parameters
      "via_core_value",
      "viaHost"
    ];

  for(idx in parameters) {
    parameter = parameters[idx];
    skeleton[parameter] = {
      value: '',
      writable: false,
      configurable: false
    };
  }

  skeleton['register'] = {
    value: '',
    writable: true,
    configurable: false
  };

  return skeleton;
}());

/**
 * Configuration checker.
 * @private
 * @return {Boolean}
 */
UA.configuration_check = {
  mandatory: {
  },

  optional: {

    uri: function(uri) {
      var parsed;

      if (!(/^sip:/i).test(uri)) {
        uri = SIP.C.SIP + ':' + uri;
      }
      parsed = SIP.URI.parse(uri);

      if(!parsed) {
        return;
      } else if(!parsed.user) {
        return;
      } else {
        return parsed;
      }
    },

    //Note: this function used to call 'this.logger.error' but calling 'this' with anything here is invalid
    wsServers: function(wsServers) {
      var idx, length, url;

      /* Allow defining wsServers parameter as:
       *  String: "host"
       *  Array of Strings: ["host1", "host2"]
       *  Array of Objects: [{ws_uri:"host1", weight:1}, {ws_uri:"host2", weight:0}]
       *  Array of Objects and Strings: [{ws_uri:"host1"}, "host2"]
       */
      if (typeof wsServers === 'string') {
        wsServers = [{ws_uri: wsServers}];
      } else if (wsServers instanceof Array) {
        length = wsServers.length;
        for (idx = 0; idx < length; idx++) {
          if (typeof wsServers[idx] === 'string'){
            wsServers[idx] = {ws_uri: wsServers[idx]};
          }
        }
      } else {
        return;
      }

      if (wsServers.length === 0) {
        return false;
      }

      length = wsServers.length;
      for (idx = 0; idx < length; idx++) {
        if (!wsServers[idx].ws_uri) {
          return;
        }
        if (wsServers[idx].weight && !Number(wsServers[idx].weight)) {
          return;
        }

        url = SIP.Grammar.parse(wsServers[idx].ws_uri, 'absoluteURI');

        if(url === -1) {
          return;
        } else if(['wss', 'ws', 'udp'].indexOf(url.scheme) < 0) {
          return;
        } else {
          wsServers[idx].sip_uri = '<sip:' + url.host + (url.port ? ':' + url.port : '') + ';transport=' + url.scheme.replace(/^wss$/i, 'ws') + ';lr>';

          if (!wsServers[idx].weight) {
            wsServers[idx].weight = 0;
          }

          wsServers[idx].status = 0;
          wsServers[idx].scheme = url.scheme.toUpperCase();
        }
      }
      return wsServers;
    },

    authorizationUser: function(authorizationUser) {
      if(SIP.Grammar.parse('"'+ authorizationUser +'"', 'quoted_string') === -1) {
        return;
      } else {
        return authorizationUser;
      }
    },

    connectionRecoveryMaxInterval: function(connectionRecoveryMaxInterval) {
      var value;
      if(SIP.Utils.isDecimal(connectionRecoveryMaxInterval)) {
        value = Number(connectionRecoveryMaxInterval);
        if(value > 0) {
          return value;
        }
      }
    },

    connectionRecoveryMinInterval: function(connectionRecoveryMinInterval) {
      var value;
      if(SIP.Utils.isDecimal(connectionRecoveryMinInterval)) {
        value = Number(connectionRecoveryMinInterval);
        if(value > 0) {
          return value;
        }
      }
    },

    displayName: function(displayName) {
      if(SIP.Grammar.parse('"' + displayName + '"', 'displayName') === -1) {
        return;
      } else {
        return displayName;
      }
    },

    hackViaTcp: function(hackViaTcp) {
      if (typeof hackViaTcp === 'boolean') {
        return hackViaTcp;
      }
    },

    hackIpInContact: function(hackIpInContact) {
      if (typeof hackIpInContact === 'boolean') {
        return hackIpInContact;
      }
      else if (typeof hackIpInContact === 'string' && SIP.Grammar.parse(hackIpInContact, 'host') !== -1) {
        return hackIpInContact;
      }
    },

    iceCheckingTimeout: function(iceCheckingTimeout) {
      if(SIP.Utils.isDecimal(iceCheckingTimeout)) {
        return Math.max(500, iceCheckingTimeout);
      }
    },

    hackWssInTransport: function(hackWssInTransport) {
      if (typeof hackWssInTransport === 'boolean') {
        return hackWssInTransport;
      }
    },

    hackAllowUnregisteredOptionTags: function(hackAllowUnregisteredOptionTags) {
      if (typeof hackAllowUnregisteredOptionTags === 'boolean') {
        return hackAllowUnregisteredOptionTags;
      }
    },

    hackCleanJitsiSdpImageattr: function(hackCleanJitsiSdpImageattr) {
      if (typeof hackCleanJitsiSdpImageattr === 'boolean') {
        return hackCleanJitsiSdpImageattr;
      }
    },

    hackStripTcp: function(hackStripTcp) {
      if (typeof hackStripTcp === 'boolean') {
        return hackStripTcp;
      }
    },

    contactTransport: function(contactTransport) {
      if (typeof contactTransport === 'string') {
        return contactTransport;
      }
    },

    forceRport: function(forceRport) {
      if (typeof forceRport === 'boolean') {
        return forceRport;
      }
    },

    instanceId: function(instanceId) {
      if(typeof instanceId !== 'string') {
        return;
      }

      if ((/^uuid:/i.test(instanceId))) {
        instanceId = instanceId.substr(5);
      }

      if(SIP.Grammar.parse(instanceId, 'uuid') === -1) {
        return;
      } else {
        return instanceId;
      }
    },

    keepAliveInterval: function(keepAliveInterval) {
      var value;
      if (SIP.Utils.isDecimal(keepAliveInterval)) {
        value = Number(keepAliveInterval);
        if (value > 0) {
          return value;
        }
      }
    },

    extraSupported: function(optionTags) {
      var idx, length;

      if (!(optionTags instanceof Array)) {
        return;
      }

      length = optionTags.length;
      for (idx = 0; idx < length; idx++) {
        if (typeof optionTags[idx] !== 'string') {
          return;
        }
      }

      return optionTags;
    },

    noAnswerTimeout: function(noAnswerTimeout) {
      var value;
      if (SIP.Utils.isDecimal(noAnswerTimeout)) {
        value = Number(noAnswerTimeout);
        if (value > 0) {
          return value;
        }
      }
    },

    password: function(password) {
      return String(password);
    },

    rel100: function(rel100) {
      if(rel100 === SIP.C.supported.REQUIRED) {
        return SIP.C.supported.REQUIRED;
      } else if (rel100 === SIP.C.supported.SUPPORTED) {
        return SIP.C.supported.SUPPORTED;
      } else  {
        return SIP.C.supported.UNSUPPORTED;
      }
    },

    replaces: function(replaces) {
      if(replaces === SIP.C.supported.REQUIRED) {
        return SIP.C.supported.REQUIRED;
      } else if (replaces === SIP.C.supported.SUPPORTED) {
        return SIP.C.supported.SUPPORTED;
      } else  {
        return SIP.C.supported.UNSUPPORTED;
      }
    },

    register: function(register) {
      if (typeof register === 'boolean') {
        return register;
      }
    },

    registerExpires: function(registerExpires) {
      var value;
      if (SIP.Utils.isDecimal(registerExpires)) {
        value = Number(registerExpires);
        if (value > 0) {
          return value;
        }
      }
    },

    registrarServer: function(registrarServer) {
      var parsed;

      if(typeof registrarServer !== 'string') {
        return;
      }

      if (!/^sip:/i.test(registrarServer)) {
        registrarServer = SIP.C.SIP + ':' + registrarServer;
      }
      parsed = SIP.URI.parse(registrarServer);

      if(!parsed) {
        return;
      } else if(parsed.user) {
        return;
      } else {
        return parsed;
      }
    },

    stunServers: function(stunServers) {
      var idx, length, stun_server;

      if (typeof stunServers === 'string') {
        stunServers = [stunServers];
      } else if (!(stunServers instanceof Array)) {
        return;
      }

      length = stunServers.length;
      for (idx = 0; idx < length; idx++) {
        stun_server = stunServers[idx];
        if (!(/^stuns?:/.test(stun_server))) {
          stun_server = 'stun:' + stun_server;
        }

        if(SIP.Grammar.parse(stun_server, 'stun_URI') === -1) {
          return;
        } else {
          stunServers[idx] = stun_server;
        }
      }
      return stunServers;
    },

    traceSip: function(traceSip) {
      if (typeof traceSip === 'boolean') {
        return traceSip;
      }
    },

    turnServers: function(turnServers) {
      var idx, jdx, length, turn_server, num_turn_server_urls, url;

      if (turnServers instanceof Array) {
        // Do nothing
      } else {
        turnServers = [turnServers];
      }

      length = turnServers.length;
      for (idx = 0; idx < length; idx++) {
        turn_server = turnServers[idx];
        //Backwards compatibility: Allow defining the turn_server url with the 'server' property.
        if (turn_server.server) {
          turn_server.urls = [turn_server.server];
        }

        if (!turn_server.urls || !turn_server.username || !turn_server.password) {
          return;
        }

        if (turn_server.urls instanceof Array) {
          num_turn_server_urls = turn_server.urls.length;
        } else {
          turn_server.urls = [turn_server.urls];
          num_turn_server_urls = 1;
        }

        for (jdx = 0; jdx < num_turn_server_urls; jdx++) {
          url = turn_server.urls[jdx];

          if (!(/^turns?:/.test(url))) {
            url = 'turn:' + url;
          }

          if(SIP.Grammar.parse(url, 'turn_URI') === -1) {
            return;
          }
        }
      }
      return turnServers;
    },

    userAgentString: function(userAgentString) {
      if (typeof userAgentString === 'string') {
        return userAgentString;
      }
    },

    usePreloadedRoute: function(usePreloadedRoute) {
      if (typeof usePreloadedRoute === 'boolean') {
        return usePreloadedRoute;
      }
    },

    wsServerMaxReconnection: function(wsServerMaxReconnection) {
      var value;
      if (SIP.Utils.isDecimal(wsServerMaxReconnection)) {
        value = Number(wsServerMaxReconnection);
        if (value > 0) {
          return value;
        }
      }
    },

    wsServerReconnectionTimeout: function(wsServerReconnectionTimeout) {
      var value;
      if (SIP.Utils.isDecimal(wsServerReconnectionTimeout)) {
        value = Number(wsServerReconnectionTimeout);
        if (value > 0) {
          return value;
        }
      }
    },

    autostart: function(autostart) {
      if (typeof autostart === 'boolean') {
        return autostart;
      }
    },

    mediaHandlerFactory: function(mediaHandlerFactory) {
      if (mediaHandlerFactory instanceof Function) {
        var promisifiedFactory = function promisifiedFactory () {
          var mediaHandler = mediaHandlerFactory.apply(this, arguments);

          function patchMethod (methodName) {
            var method = mediaHandler[methodName];
            if (method.length > 1) {
              var callbacksFirst = methodName === 'getDescription';
              mediaHandler[methodName] = SIP.Utils.promisify(mediaHandler, methodName, callbacksFirst);
            }
          }

          patchMethod('getDescription');
          patchMethod('setDescription');

          return mediaHandler;
        };

        promisifiedFactory.isSupported = mediaHandlerFactory.isSupported;
        return promisifiedFactory;
      }
    },

    authenticationFactory: checkAuthenticationFactory,

    allowLegacyNotifications: function(allowLegacyNotifications) {
      if (typeof allowLegacyNotifications === 'boolean') {
        return allowLegacyNotifications;
      }
    }
  }
};

UA.C = C;
SIP.UA = UA;
};

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],118:[function(require,module,exports){
"use strict";
/**
 * @fileoverview SIP URI
 */

/**
 * @augments SIP
 * @class Class creating a SIP URI.
 *
 * @param {String} [scheme]
 * @param {String} [user]
 * @param {String} host
 * @param {String} [port]
 * @param {Object} [parameters]
 * @param {Object} [headers]
 *
 */
module.exports = function (SIP) {
var URI;

URI = function(scheme, user, host, port, parameters, headers) {
  var param, header, raw, normal;

  // Checks
  if(!host) {
    throw new TypeError('missing or invalid "host" parameter');
  }

  // Initialize parameters
  scheme = scheme || SIP.C.SIP;
  this.parameters = {};
  this.headers = {};

  for (param in parameters) {
    this.setParam(param, parameters[param]);
  }

  for (header in headers) {
    this.setHeader(header, headers[header]);
  }

  // Raw URI
  raw = {
    scheme: scheme,
    user: user,
    host: host,
    port: port
  };

  // Normalized URI
  normal = {
    scheme: scheme.toLowerCase(),
    user: user,
    host: host.toLowerCase(),
    port: port
  };

  Object.defineProperties(this, {
    _normal: {
      get: function() { return normal; }
    },

    _raw: {
      get: function() { return raw; }
    },

    scheme: {
      get: function() { return normal.scheme; },
      set: function(value) {
        raw.scheme = value;
        normal.scheme = value.toLowerCase();
      }
    },

    user: {
      get: function() { return normal.user; },
      set: function(value) {
        normal.user = raw.user = value;
      }
    },

    host: {
      get: function() { return normal.host; },
      set: function(value) {
        raw.host = value;
        normal.host = value.toLowerCase();
      }
    },

    aor: {
      get: function() { return normal.user + '@' + normal.host; }
    },

    port: {
      get: function() { return normal.port; },
      set: function(value) {
        normal.port = raw.port = value === 0 ? value : (parseInt(value,10) || null);
      }
    }
  });
};

URI.prototype = {
  setParam: function(key, value) {
    if(key) {
      this.parameters[key.toLowerCase()] = (typeof value === 'undefined' || value === null) ? null : value.toString().toLowerCase();
    }
  },

  getParam: function(key) {
    if(key) {
      return this.parameters[key.toLowerCase()];
    }
  },

  hasParam: function(key) {
    if(key) {
      return (this.parameters.hasOwnProperty(key.toLowerCase()) && true) || false;
    }
  },

  deleteParam: function(parameter) {
    var value;
    parameter = parameter.toLowerCase();
    if (this.parameters.hasOwnProperty(parameter)) {
      value = this.parameters[parameter];
      delete this.parameters[parameter];
      return value;
    }
  },

  clearParams: function() {
    this.parameters = {};
  },

  setHeader: function(name, value) {
    this.headers[SIP.Utils.headerize(name)] = (value instanceof Array) ? value : [value];
  },

  getHeader: function(name) {
    if(name) {
      return this.headers[SIP.Utils.headerize(name)];
    }
  },

  hasHeader: function(name) {
    if(name) {
      return (this.headers.hasOwnProperty(SIP.Utils.headerize(name)) && true) || false;
    }
  },

  deleteHeader: function(header) {
    var value;
    header = SIP.Utils.headerize(header);
    if(this.headers.hasOwnProperty(header)) {
      value = this.headers[header];
      delete this.headers[header];
      return value;
    }
  },

  clearHeaders: function() {
    this.headers = {};
  },

  clone: function() {
    return new URI(
      this._raw.scheme,
      this._raw.user,
      this._raw.host,
      this._raw.port,
      JSON.parse(JSON.stringify(this.parameters)),
      JSON.parse(JSON.stringify(this.headers)));
  },

  toRaw: function() {
    return this._toString(this._raw);
  },

  toString: function() {
    return this._toString(this._normal);
  },

  _toString: function(uri) {
    var header, parameter, idx, uriString, headers = [];

    uriString  = uri.scheme + ':';
    // add slashes if it's not a sip(s) URI
    if (!uri.scheme.toLowerCase().match("^sips?$")) {
      uriString += "//";
    }
    if (uri.user) {
      uriString += SIP.Utils.escapeUser(uri.user) + '@';
    }
    uriString += uri.host;
    if (uri.port || uri.port === 0) {
      uriString += ':' + uri.port;
    }

    for (parameter in this.parameters) {
      uriString += ';' + parameter;

      if (this.parameters[parameter] !== null) {
        uriString += '='+ this.parameters[parameter];
      }
    }

    for(header in this.headers) {
      for(idx in this.headers[header]) {
        headers.push(header + '=' + this.headers[header][idx]);
      }
    }

    if (headers.length > 0) {
      uriString += '?' + headers.join('&');
    }

    return uriString;
  }
};


/**
  * Parse the given string and returns a SIP.URI instance or undefined if
  * it is an invalid URI.
  * @public
  * @param {String} uri
  */
URI.parse = function(uri) {
  uri = SIP.Grammar.parse(uri,'SIP_URI');

  if (uri !== -1) {
    return uri;
  } else {
    return undefined;
  }
};

SIP.URI = URI;
};

},{}],119:[function(require,module,exports){
"use strict";
/**
 * @fileoverview Utils
 */

module.exports = function (SIP, environment) {
var Utils;

Utils= {

  Promise: environment.Promise,

  defer: function defer () {
    var deferred = {};
    deferred.promise = new Utils.Promise(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  },

  promisify: function promisify (object, methodName, callbacksFirst) {
    var oldMethod = object[methodName];
    return function promisifiedMethod (arg, onSuccess, onFailure) {
      return new Utils.Promise(function (resolve, reject) {
        var oldArgs = [arg, resolve, reject];
        if (callbacksFirst) {
          oldArgs = [resolve, reject, arg];
        }
        oldMethod.apply(object, oldArgs);
      }).then(onSuccess, onFailure);
    };
  },

  augment: function (object, constructor, args, override) {
    var idx, proto;

    // Add public properties from constructor's prototype onto object
    proto = constructor.prototype;
    for (idx in proto) {
      if (override || object[idx] === undefined) {
        object[idx] = proto[idx];
      }
    }

    // Construct the object as though it were just created by constructor
    constructor.apply(object, args);
  },

  optionsOverride: function (options, winner, loser, isDeprecated, logger, defaultValue) {
    if (isDeprecated && options[loser]) {
      logger.warn(loser + ' is deprecated, please use ' + winner + ' instead');
    }

    if (options[winner] && options[loser]) {
      logger.warn(winner + ' overriding ' + loser);
    }

    options[winner] = options[winner] || options[loser] || defaultValue;
  },

  str_utf8_length: function(string) {
    return encodeURIComponent(string).replace(/%[A-F\d]{2}/g, 'U').length;
  },

  generateFakeSDP: function(body) {
    if (!body) {
      return;
    }

    var start = body.indexOf('o=');
    var end = body.indexOf('\r\n', start);

    return 'v=0\r\n' + body.slice(start, end) + '\r\ns=-\r\nt=0 0\r\nc=IN IP4 0.0.0.0';
  },

  isFunction: function(fn) {
    if (fn !== undefined) {
      return Object.prototype.toString.call(fn) === '[object Function]';
    } else {
      return false;
    }
  },

  isDecimal: function (num) {
    return !isNaN(num) && (parseFloat(num) === parseInt(num,10));
  },

  createRandomToken: function(size, base) {
    var i, r,
      token = '';

    base = base || 32;

    for( i=0; i < size; i++ ) {
      r = Math.random() * base|0;
      token += r.toString(base);
    }

    return token;
  },

  newTag: function() {
    return SIP.Utils.createRandomToken(SIP.UA.C.TAG_LENGTH);
  },

  // http://stackoverflow.com/users/109538/broofa
  newUUID: function() {
    var UUID =  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    });

    return UUID;
  },

  hostType: function(host) {
    if (!host) {
      return;
    } else {
      host = SIP.Grammar.parse(host,'host');
      if (host !== -1) {
        return host.host_type;
      }
    }
  },

  /**
  * Normalize SIP URI.
  * NOTE: It does not allow a SIP URI without username.
  * Accepts 'sip', 'sips' and 'tel' URIs and convert them into 'sip'.
  * Detects the domain part (if given) and properly hex-escapes the user portion.
  * If the user portion has only 'tel' number symbols the user portion is clean of 'tel' visual separators.
  * @private
  * @param {String} target
  * @param {String} [domain]
  */
  normalizeTarget: function(target, domain) {
    var uri, target_array, target_user, target_domain;

    // If no target is given then raise an error.
    if (!target) {
      return;
    // If a SIP.URI instance is given then return it.
    } else if (target instanceof SIP.URI) {
      return target;

    // If a string is given split it by '@':
    // - Last fragment is the desired domain.
    // - Otherwise append the given domain argument.
    } else if (typeof target === 'string') {
      target_array = target.split('@');

      switch(target_array.length) {
        case 1:
          if (!domain) {
            return;
          }
          target_user = target;
          target_domain = domain;
          break;
        case 2:
          target_user = target_array[0];
          target_domain = target_array[1];
          break;
        default:
          target_user = target_array.slice(0, target_array.length-1).join('@');
          target_domain = target_array[target_array.length-1];
      }

      // Remove the URI scheme (if present).
      target_user = target_user.replace(/^(sips?|tel):/i, '');

      // Remove 'tel' visual separators if the user portion just contains 'tel' number symbols.
      if (/^[\-\.\(\)]*\+?[0-9\-\.\(\)]+$/.test(target_user)) {
        target_user = target_user.replace(/[\-\.\(\)]/g, '');
      }

      // Build the complete SIP URI.
      target = SIP.C.SIP + ':' + SIP.Utils.escapeUser(target_user) + '@' + target_domain;

      // Finally parse the resulting URI.
      if (uri = SIP.URI.parse(target)) {
        return uri;
      } else {
        return;
      }
    } else {
      return;
    }
  },

  /**
  * Hex-escape a SIP URI user.
  * @private
  * @param {String} user
  */
  escapeUser: function(user) {
    // Don't hex-escape ':' (%3A), '+' (%2B), '?' (%3F"), '/' (%2F).
    return encodeURIComponent(decodeURIComponent(user)).replace(/%3A/ig, ':').replace(/%2B/ig, '+').replace(/%3F/ig, '?').replace(/%2F/ig, '/');
  },

  headerize: function(string) {
    var exceptions = {
      'Call-Id': 'Call-ID',
      'Cseq': 'CSeq',
      'Min-Se': 'Min-SE',
      'Rack': 'RAck',
      'Rseq': 'RSeq',
      'Www-Authenticate': 'WWW-Authenticate'
      },
      name = string.toLowerCase().replace(/_/g,'-').split('-'),
      hname = '',
      parts = name.length, part;

    for (part = 0; part < parts; part++) {
      if (part !== 0) {
        hname +='-';
      }
      hname += name[part].charAt(0).toUpperCase()+name[part].substring(1);
    }
    if (exceptions[hname]) {
      hname = exceptions[hname];
    }
    return hname;
  },

  sipErrorCause: function(status_code) {
    var cause;

    for (cause in SIP.C.SIP_ERROR_CAUSES) {
      if (SIP.C.SIP_ERROR_CAUSES[cause].indexOf(status_code) !== -1) {
        return SIP.C.causes[cause];
      }
    }

    return SIP.C.causes.SIP_FAILURE_CODE;
  },

  getReasonPhrase: function getReasonPhrase (code, specific) {
    return specific || SIP.C.REASON_PHRASE[code] || '';
  },

  getReasonHeaderValue: function getReasonHeaderValue (code, reason) {
    reason = SIP.Utils.getReasonPhrase(code, reason);
    return 'SIP ;cause=' + code + ' ;text="' + reason + '"';
  },

  getCancelReason: function getCancelReason (code, reason) {
    if (code && code < 200 || code > 699) {
      throw new TypeError('Invalid status_code: ' + code);
    } else if (code) {
      return SIP.Utils.getReasonHeaderValue(code, reason);
    }
  },

  buildStatusLine: function buildStatusLine (code, reason) {
    code = code || null;
    reason = reason || null;

    // Validate code and reason values
    if (!code || (code < 100 || code > 699)) {
      throw new TypeError('Invalid status_code: '+ code);
    } else if (reason && typeof reason !== 'string' && !(reason instanceof String)) {
      throw new TypeError('Invalid reason_phrase: '+ reason);
    }

    reason = Utils.getReasonPhrase(code, reason);

    return 'SIP/2.0 ' + code + ' ' + reason + '\r\n';
  },

  /**
  * Generate a random Test-Net IP (http://tools.ietf.org/html/rfc5735)
  * @private
  */
  getRandomTestNetIP: function() {
    function getOctet(from,to) {
      return Math.floor(Math.random()*(to-from+1)+from);
    }
    return '192.0.2.' + getOctet(1, 254);
  },

  // MD5 (Message-Digest Algorithm) http://www.webtoolkit.info
  calculateMD5: function(string) {
    function RotateLeft(lValue, iShiftBits) {
      return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }

    function AddUnsigned(lX,lY) {
      var lX4,lY4,lX8,lY8,lResult;
      lX8 = (lX & 0x80000000);
      lY8 = (lY & 0x80000000);
      lX4 = (lX & 0x40000000);
      lY4 = (lY & 0x40000000);
      lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
      if (lX4 & lY4) {
        return (lResult ^ 0x80000000 ^ lX8 ^ lY8);
      }
      if (lX4 | lY4) {
        if (lResult & 0x40000000) {
          return (lResult ^ 0xC0000000 ^ lX8 ^ lY8);
        } else {
          return (lResult ^ 0x40000000 ^ lX8 ^ lY8);
        }
      } else {
        return (lResult ^ lX8 ^ lY8);
      }
    }

    function F(x,y,z) {
      return (x & y) | ((~x) & z);
    }

    function G(x,y,z) {
      return (x & z) | (y & (~z));
    }

    function H(x,y,z) {
      return (x ^ y ^ z);
    }

    function I(x,y,z) {
      return (y ^ (x | (~z)));
    }

    function FF(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function GG(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function HH(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function II(a,b,c,d,x,s,ac) {
      a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
      return AddUnsigned(RotateLeft(a, s), b);
    }

    function ConvertToWordArray(string) {
      var lWordCount;
      var lMessageLength = string.length;
      var lNumberOfWords_temp1=lMessageLength + 8;
      var lNumberOfWords_temp2=(lNumberOfWords_temp1-(lNumberOfWords_temp1 % 64))/64;
      var lNumberOfWords = (lNumberOfWords_temp2+1)*16;
      var lWordArray=Array(lNumberOfWords-1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while ( lByteCount < lMessageLength ) {
        lWordCount = (lByteCount-(lByteCount % 4))/4;
        lBytePosition = (lByteCount % 4)*8;
        lWordArray[lWordCount] = (lWordArray[lWordCount] | (string.charCodeAt(lByteCount)<<lBytePosition));
        lByteCount++;
      }
      lWordCount = (lByteCount-(lByteCount % 4))/4;
      lBytePosition = (lByteCount % 4)*8;
      lWordArray[lWordCount] = lWordArray[lWordCount] | (0x80<<lBytePosition);
      lWordArray[lNumberOfWords-2] = lMessageLength<<3;
      lWordArray[lNumberOfWords-1] = lMessageLength>>>29;
      return lWordArray;
    }

    function WordToHex(lValue) {
      var WordToHexValue="",WordToHexValue_temp="",lByte,lCount;
      for (lCount = 0;lCount<=3;lCount++) {
        lByte = (lValue>>>(lCount*8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length-2,2);
      }
      return WordToHexValue;
    }

    function Utf8Encode(string) {
      string = string.replace(/\r\n/g,"\n");
      var utftext = "";

      for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);

        if (c < 128) {
          utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    }

    var x=[];
    var k,AA,BB,CC,DD,a,b,c,d;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;

    string = Utf8Encode(string);

    x = ConvertToWordArray(string);

    a = 0x67452301; b = 0xEFCDAB89; c = 0x98BADCFE; d = 0x10325476;

    for (k=0;k<x.length;k+=16) {
      AA=a; BB=b; CC=c; DD=d;
      a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
      d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
      c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
      b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
      a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
      d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
      c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
      b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
      a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
      d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
      c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
      b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
      a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
      d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
      c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
      b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
      a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
      d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
      c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
      b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
      a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
      d=GG(d,a,b,c,x[k+10],S22,0x2441453);
      c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
      b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
      a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
      d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
      c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
      b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
      a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
      d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
      c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
      b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
      a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
      d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
      c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
      b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
      a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
      d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
      c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
      b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
      a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
      d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
      c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
      b=HH(b,c,d,a,x[k+6], S34,0x4881D05);
      a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
      d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
      c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
      b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
      a=II(a,b,c,d,x[k+0], S41,0xF4292244);
      d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
      c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
      b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
      a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
      d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
      c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
      b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
      a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
      d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
      c=II(c,d,a,b,x[k+6], S43,0xA3014314);
      b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
      a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
      d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
      c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
      b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
      a=AddUnsigned(a,AA);
      b=AddUnsigned(b,BB);
      c=AddUnsigned(c,CC);
      d=AddUnsigned(d,DD);
    }

    var temp = WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d);

    return temp.toLowerCase();
  }
};

SIP.Utils = Utils;
};

},{}],120:[function(require,module,exports){
"use strict";
/**
 * @fileoverview WebRTC
 */

module.exports = function (SIP, environment) {
var WebRTC;

WebRTC = {};

WebRTC.MediaHandler = require('./WebRTC/MediaHandler')(SIP);
WebRTC.MediaStreamManager = require('./WebRTC/MediaStreamManager')(SIP, environment);

var _isSupported;

WebRTC.isSupported = function () {
  if (_isSupported !== undefined) {
    return _isSupported;
  }

  WebRTC.MediaStream = environment.MediaStream;
  WebRTC.getUserMedia = environment.getUserMedia;
  WebRTC.RTCPeerConnection = environment.RTCPeerConnection;
  WebRTC.RTCSessionDescription = environment.RTCSessionDescription;

  if (WebRTC.RTCPeerConnection && WebRTC.RTCSessionDescription) {
    if (WebRTC.getUserMedia) {
      WebRTC.getUserMedia = SIP.Utils.promisify(environment, 'getUserMedia');
    }
    _isSupported = true;
  }
  else {
    _isSupported = false;
  }
  return _isSupported;
};

return WebRTC;
};

},{"./WebRTC/MediaHandler":121,"./WebRTC/MediaStreamManager":122}],121:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaHandler
 */

/* MediaHandler
 * @class PeerConnection helper Class.
 * @param {SIP.Session} session
 * @param {Object} [options]
 * @param {SIP.WebRTC.MediaStreamManager} [options.mediaStreamManager]
 *        The MediaStreamManager to acquire/release streams from/to.
 *        If not provided, a default MediaStreamManager will be used.
 */
module.exports = function (SIP) {

var MediaHandler = function(session, options) {
  options = options || {};

  this.logger = session.ua.getLogger('sip.invitecontext.mediahandler', session.id);
  this.session = session;
  this.localMedia = null;
  this.ready = true;
  this.mediaStreamManager = options.mediaStreamManager || new SIP.WebRTC.MediaStreamManager(this.logger);
  this.audioMuted = false;
  this.videoMuted = false;
  this.local_hold = false;
  this.remote_hold = false;

  // old init() from here on
  var servers = this.prepareIceServers(options.stunServers, options.turnServers);
  this.RTCConstraints = options.RTCConstraints || {};

  this.initPeerConnection(servers);

  function selfEmit(mh, event) {
    if (mh.mediaStreamManager.on) {
      mh.mediaStreamManager.on(event, function () {
        mh.emit.apply(mh, [event].concat(Array.prototype.slice.call(arguments)));
      });
    }
  }

  selfEmit(this, 'userMediaRequest');
  selfEmit(this, 'userMedia');
  selfEmit(this, 'userMediaFailed');
};

MediaHandler.defaultFactory = function defaultFactory (session, options) {
  return new MediaHandler(session, options);
};
MediaHandler.defaultFactory.isSupported = function () {
  return SIP.WebRTC.isSupported();
};

MediaHandler.prototype = Object.create(SIP.MediaHandler.prototype, {
// Functions the session can use
  isReady: {writable: true, value: function isReady () {
    return this.ready;
  }},

  close: {writable: true, value: function close () {
    this.logger.log('closing PeerConnection');
    this._remoteStreams = [];
    // have to check signalingState since this.close() gets called multiple times
    // TODO figure out why that happens
    if(this.peerConnection && this.peerConnection.signalingState !== 'closed') {
      this.peerConnection.close();

      if(this.localMedia) {
        this.mediaStreamManager.release(this.localMedia);
      }
    }
  }},

  /**
   * @param {SIP.WebRTC.MediaStream | (getUserMedia constraints)} [mediaHint]
   *        the MediaStream (or the constraints describing it) to be used for the session
   */
  getDescription: {writable: true, value: function getDescription (mediaHint) {
    var self = this;
    var acquire = self.mediaStreamManager.acquire;
    if (acquire.length > 1) {
      acquire = SIP.Utils.promisify(this.mediaStreamManager, 'acquire', true);
    }
    mediaHint = mediaHint || {};
    if (mediaHint.dataChannel === true) {
      mediaHint.dataChannel = {};
    }
    this.mediaHint = mediaHint;

    /*
     * 1. acquire streams (skip if MediaStreams passed in)
     * 2. addStreams
     * 3. createOffer/createAnswer
     */

    var streamPromise;
    if (self.localMedia) {
      self.logger.log('already have local media');
      streamPromise = SIP.Utils.Promise.resolve(self.localMedia);
    }
    else {
      self.logger.log('acquiring local media');
      streamPromise = acquire.call(self.mediaStreamManager, mediaHint)
        .then(function acquireSucceeded(streams) {
          self.logger.log('acquired local media streams');
          self.localMedia = streams;
          self.session.connecting();
          return streams;
        }, function acquireFailed(err) {
          self.logger.error('unable to acquire streams');
          self.logger.error(err);
          self.session.connecting();
          throw err;
        })
        .then(this.addStreams.bind(this))
      ;
    }

    return streamPromise
      .then(function streamAdditionSucceeded() {
        if (self.hasOffer('remote')) {
          self.peerConnection.ondatachannel = function (evt) {
            self.dataChannel = evt.channel;
            self.emit('dataChannel', self.dataChannel);
          };
        } else if (mediaHint.dataChannel &&
                   self.peerConnection.createDataChannel) {
          self.dataChannel = self.peerConnection.createDataChannel(
            'sipjs',
            mediaHint.dataChannel
          );
          self.emit('dataChannel', self.dataChannel);
        }

        self.render();
        return self.createOfferOrAnswer(self.RTCConstraints);
      })
      .then(function(sdp) {
        sdp = SIP.Hacks.Firefox.hasMissingCLineInSDP(sdp);

        if (self.local_hold) {
          // Don't receive media
          // TODO - This will break for media streams with different directions.
          if (!(/a=(sendrecv|sendonly|recvonly|inactive)/).test(sdp)) {
            sdp = sdp.replace(/(m=[^\r]*\r\n)/g, '$1a=sendonly\r\n');
          } else {
            sdp = sdp.replace(/a=sendrecv\r\n/g, 'a=sendonly\r\n');
            sdp = sdp.replace(/a=recvonly\r\n/g, 'a=inactive\r\n');
          }
        }

        return {
          body: sdp,
          contentType: 'application/sdp'
        };
      })
    ;
  }},

  /**
   * Check if a SIP message contains a session description.
   * @param {SIP.SIPMessage} message
   * @returns {boolean}
   */
  hasDescription: {writeable: true, value: function hasDescription (message) {
    return message.getHeader('Content-Type') === 'application/sdp' && !!message.body;
  }},

  /**
   * Set the session description contained in a SIP message.
   * @param {SIP.SIPMessage} message
   * @returns {Promise}
   */
  setDescription: {writable: true, value: function setDescription (message) {
    var sdp = message.body;

    this.remote_hold = /a=(sendonly|inactive)/.test(sdp);

    sdp = SIP.Hacks.Firefox.cannotHandleExtraWhitespace(sdp);
    sdp = SIP.Hacks.AllBrowsers.maskDtls(sdp);

    var rawDescription = {
      type: this.hasOffer('local') ? 'answer' : 'offer',
      sdp: sdp
    };

    this.emit('setDescription', rawDescription);

    var description = new SIP.WebRTC.RTCSessionDescription(rawDescription);
    return SIP.Utils.promisify(this.peerConnection, 'setRemoteDescription')(description);
  }},

  /**
   * If the Session associated with this MediaHandler were to be referred,
   * what mediaHint should be provided to the UA's invite method?
   */
  getReferMedia: {writable: true, value: function getReferMedia () {
    function hasTracks (trackGetter, stream) {
      return stream[trackGetter]().length > 0;
    }

    function bothHaveTracks (trackGetter) {
      /* jshint validthis:true */
      return this.getLocalStreams().some(hasTracks.bind(null, trackGetter)) &&
             this.getRemoteStreams().some(hasTracks.bind(null, trackGetter));
    }

    return {
      constraints: {
        audio: bothHaveTracks.call(this, 'getAudioTracks'),
        video: bothHaveTracks.call(this, 'getVideoTracks')
      }
    };
  }},

  updateIceServers: {writeable:true, value: function (options) {
    var servers = this.prepareIceServers(options.stunServers, options.turnServers);
    this.RTCConstraints = options.RTCConstraints || this.RTCConstraints;

    this.initPeerConnection(servers);

    /* once updateIce is implemented correctly, this is better than above
    //no op if browser does not support this
    if (!this.peerConnection.updateIce) {
      return;
    }

    this.peerConnection.updateIce({'iceServers': servers}, this.RTCConstraints);
    */
  }},

// Functions the session can use, but only because it's convenient for the application
  isMuted: {writable: true, value: function isMuted () {
    return {
      audio: this.audioMuted,
      video: this.videoMuted
    };
  }},

  mute: {writable: true, value: function mute (options) {
    if (this.getLocalStreams().length === 0) {
      return;
    }

    options = options || {
      audio: this.getLocalStreams()[0].getAudioTracks().length > 0,
      video: this.getLocalStreams()[0].getVideoTracks().length > 0
    };

    var audioMuted = false,
        videoMuted = false;

    if (options.audio && !this.audioMuted) {
      audioMuted = true;
      this.audioMuted = true;
      this.toggleMuteAudio(true);
    }

    if (options.video && !this.videoMuted) {
      videoMuted = true;
      this.videoMuted = true;
      this.toggleMuteVideo(true);
    }

    //REVISIT
    if (audioMuted || videoMuted) {
      return {
        audio: audioMuted,
        video: videoMuted
      };
      /*this.session.onmute({
        audio: audioMuted,
        video: videoMuted
      });*/
    }
  }},

  unmute: {writable: true, value: function unmute (options) {
    if (this.getLocalStreams().length === 0) {
      return;
    }

    options = options || {
      audio: this.getLocalStreams()[0].getAudioTracks().length > 0,
      video: this.getLocalStreams()[0].getVideoTracks().length > 0
    };

    var audioUnMuted = false,
        videoUnMuted = false;

    if (options.audio && this.audioMuted) {
      audioUnMuted = true;
      this.audioMuted = false;
      this.toggleMuteAudio(false);
    }

    if (options.video && this.videoMuted) {
      videoUnMuted = true;
      this.videoMuted = false;
      this.toggleMuteVideo(false);
    }

    //REVISIT
    if (audioUnMuted || videoUnMuted) {
      return {
        audio: audioUnMuted,
        video: videoUnMuted
      };
      /*this.session.onunmute({
        audio: audioUnMuted,
        video: videoUnMuted
      });*/
    }
  }},

  hold: {writable: true, value: function hold () {
    this.local_hold = true;
    this.toggleMuteAudio(true);
    this.toggleMuteVideo(true);
  }},

  unhold: {writable: true, value: function unhold () {
    this.local_hold = false;

    if (!this.audioMuted) {
      this.toggleMuteAudio(false);
    }

    if (!this.videoMuted) {
      this.toggleMuteVideo(false);
    }
  }},

// Functions the application can use, but not the session
  getLocalStreams: {writable: true, value: function getLocalStreams () {
    var pc = this.peerConnection;
    if (pc && pc.signalingState === 'closed') {
      this.logger.warn('peerConnection is closed, getLocalStreams returning []');
      return [];
    }
    return (pc.getLocalStreams && pc.getLocalStreams()) ||
      pc.localStreams || [];
  }},

  getRemoteStreams: {writable: true, value: function getRemoteStreams () {
    var pc = this.peerConnection;
    if (pc && pc.signalingState === 'closed') {
      this.logger.warn('peerConnection is closed, getRemoteStreams returning this._remoteStreams');
      return this._remoteStreams;
    }
    return(pc.getRemoteStreams && pc.getRemoteStreams()) ||
      pc.remoteStreams || [];
  }},

  render: {writable: true, value: function render (renderHint) {
    renderHint = renderHint || (this.mediaHint && this.mediaHint.render);
    if (!renderHint) {
      return false;
    }
    var streamGetters = {
      local: 'getLocalStreams',
      remote: 'getRemoteStreams'
    };
    Object.keys(streamGetters).forEach(function (loc) {
      var streamGetter = streamGetters[loc];
      var streams = this[streamGetter]();
      SIP.WebRTC.MediaStreamManager.render(streams, renderHint[loc]);
    }.bind(this));
  }},

// Internal functions
  hasOffer: {writable: true, value: function hasOffer (where) {
    var offerState = 'have-' + where + '-offer';
    return this.peerConnection.signalingState === offerState;
    // TODO consider signalingStates with 'pranswer'?
  }},

  prepareIceServers: {writable: true, value: function prepareIceServers (stunServers, turnServers) {
    var servers = [],
      config = this.session.ua.configuration;

    stunServers = stunServers || config.stunServers;
    turnServers = turnServers || config.turnServers;

    [].concat(stunServers).forEach(function (server) {
      servers.push({'urls': server});
    });

    [].concat(turnServers).forEach(function (server) {
      servers.push({
        'urls': server.urls,
        'username': server.username,
        'credential': server.password
      });
    });

    return servers;
  }},

  initPeerConnection: {writable: true, value: function initPeerConnection(servers) {
    var self = this,
      config = this.session.ua.configuration;

    this.onIceCompleted = SIP.Utils.defer();
    this.onIceCompleted.promise.then(function(pc) {
      self.emit('iceGatheringComplete', pc);
      if (self.iceCheckingTimer) {
        SIP.Timers.clearTimeout(self.iceCheckingTimer);
        self.iceCheckingTimer = null;
      }
    });

    if (this.peerConnection) {
      this.peerConnection.close();
    }

    this.peerConnection = new SIP.WebRTC.RTCPeerConnection({'iceServers': servers});

    // Firefox (35.0.1) sometimes throws on calls to peerConnection.getRemoteStreams
    // even if peerConnection.onaddstream was just called. In order to make
    // MediaHandler.prototype.getRemoteStreams work, keep track of them manually
    this._remoteStreams = [];

    this.peerConnection.onaddstream = function(e) {
      self.logger.log('stream added: '+ e.stream.id);
      self._remoteStreams.push(e.stream);
      self.render();
      self.emit('addStream', e);
    };

    this.peerConnection.onremovestream = function(e) {
      self.logger.log('stream removed: '+ e.stream.id);
    };

    this.startIceCheckingTimer = function () {
      if (!self.iceCheckingTimer) {
        self.iceCheckingTimer = SIP.Timers.setTimeout(function() {
          self.logger.log('RTCIceChecking Timeout Triggered after '+config.iceCheckingTimeout+' milliseconds');
          self.onIceCompleted.resolve(this);
        }.bind(this.peerConnection), config.iceCheckingTimeout);
      }
    };

    this.peerConnection.onicecandidate = function(e) {
      self.emit('iceCandidate', e);
      if (e.candidate) {
        self.logger.log('ICE candidate received: '+ (e.candidate.candidate === null ? null : e.candidate.candidate.trim()));
        self.startIceCheckingTimer();
      } else {
        self.onIceCompleted.resolve(this);
      }
    };

    this.peerConnection.onicegatheringstatechange = function () {
      self.logger.log('RTCIceGatheringState changed: ' + this.iceGatheringState);
      if (this.iceGatheringState === 'gathering') {
        self.emit('iceGathering', this);
      }
      if (this.iceGatheringState === 'complete') {
        self.onIceCompleted.resolve(this);
      }
    };

    this.peerConnection.oniceconnectionstatechange = function() {  //need e for commented out case
      var stateEvent;

      if (this.iceConnectionState === 'checking') {
        self.startIceCheckingTimer();
      }

      switch (this.iceConnectionState) {
      case 'new':
        stateEvent = 'iceConnection';
        break;
      case 'checking':
        stateEvent = 'iceConnectionChecking';
        break;
      case 'connected':
        stateEvent = 'iceConnectionConnected';
        break;
      case 'completed':
        stateEvent = 'iceConnectionCompleted';
        break;
      case 'failed':
        stateEvent = 'iceConnectionFailed';
        break;
      case 'disconnected':
        stateEvent = 'iceConnectionDisconnected';
        break;
      case 'closed':
        stateEvent = 'iceConnectionClosed';
        break;
      default:
        self.logger.warn('Unknown iceConnection state:', this.iceConnectionState);
        return;
      }
      self.emit(stateEvent, this);

      //Bria state changes are always connected -> disconnected -> connected on accept, so session gets terminated
      //normal calls switch from failed to connected in some cases, so checking for failed and terminated
      /*if (this.iceConnectionState === 'failed') {
        self.session.terminate({
        cause: SIP.C.causes.RTP_TIMEOUT,
        status_code: 200,
        reason_phrase: SIP.C.causes.RTP_TIMEOUT
      });
      } else if (e.currentTarget.iceGatheringState === 'complete' && this.iceConnectionState !== 'closed') {
      self.onIceCompleted(this);
      }*/
    };

    this.peerConnection.onstatechange = function() {
      self.logger.log('PeerConnection state changed to "'+ this.readyState +'"');
    };
  }},

  createOfferOrAnswer: {writable: true, value: function createOfferOrAnswer (constraints) {
    var self = this;
    var methodName;
    var pc = self.peerConnection;

    self.ready = false;
    methodName = self.hasOffer('remote') ? 'createAnswer' : 'createOffer';

    return SIP.Utils.promisify(pc, methodName, true)(constraints)
      .then(SIP.Utils.promisify(pc, 'setLocalDescription'))
      .then(function onSetLocalDescriptionSuccess() {
        var deferred = SIP.Utils.defer();
        if (pc.iceConnectionState === 'complete' || pc.iceConnectionState === 'completed') {
          deferred.resolve();
        } else {
          self.onIceCompleted.promise.then(deferred.resolve);
        }
        return deferred.promise;
      })
      .then(function readySuccess () {
        var sdp = pc.localDescription.sdp;

        sdp = SIP.Hacks.Chrome.needsExplicitlyInactiveSDP(sdp);
        sdp = SIP.Hacks.AllBrowsers.unmaskDtls(sdp);

        var sdpWrapper = {
          type: methodName === 'createOffer' ? 'offer' : 'answer',
          sdp: sdp
        };

        self.emit('getDescription', sdpWrapper);

        if (self.session.ua.configuration.hackStripTcp) {
          sdpWrapper.sdp = sdpWrapper.sdp.replace(/^a=candidate:\d+ \d+ tcp .*?\r\n/img, "");
        }

        self.ready = true;
        return sdpWrapper.sdp;
      })
      .catch(function methodFailed (e) {
        self.logger.error(e);
        self.ready = true;
        throw new SIP.Exceptions.GetDescriptionError(e);
      })
    ;
  }},

  addStreams: {writable: true, value: function addStreams (streams) {
    try {
      streams = [].concat(streams);
      streams.forEach(function (stream) {
        this.peerConnection.addStream(stream);
      }, this);
    } catch(e) {
      this.logger.error('error adding stream');
      this.logger.error(e);
      return SIP.Utils.Promise.reject(e);
    }

    return SIP.Utils.Promise.resolve();
  }},

  toggleMuteHelper: {writable: true, value: function toggleMuteHelper (trackGetter, mute) {
    this.getLocalStreams().forEach(function (stream) {
      stream[trackGetter]().forEach(function (track) {
        track.enabled = !mute;
      });
    });
  }},

  toggleMuteAudio: {writable: true, value: function toggleMuteAudio (mute) {
    this.toggleMuteHelper('getAudioTracks', mute);
  }},

  toggleMuteVideo: {writable: true, value: function toggleMuteVideo (mute) {
    this.toggleMuteHelper('getVideoTracks', mute);
  }}
});

// Return since it will be assigned to a variable.
return MediaHandler;
};

},{}],122:[function(require,module,exports){
"use strict";
/**
 * @fileoverview MediaStreamManager
 */

/* MediaStreamManager
 * @class Manages the acquisition and release of MediaStreams.
 * @param {mediaHint} [defaultMediaHint] The mediaHint to use if none is provided to acquire()
 */
module.exports = function (SIP, environment) {

// Default MediaStreamManager provides single-use streams created with getUserMedia
var MediaStreamManager = function MediaStreamManager (logger, defaultMediaHint) {
  if (!SIP.WebRTC.isSupported()) {
    throw new SIP.Exceptions.NotSupportedError('Media not supported');
  }

  this.mediaHint = defaultMediaHint || {
    constraints: {audio: true, video: true}
  };

  // map of streams to acquisition manner:
  // true -> passed in as mediaHint.stream
  // false -> getUserMedia
  this.acquisitions = {};
};
MediaStreamManager.streamId = function (stream) {
  return stream.getAudioTracks().concat(stream.getVideoTracks())
    .map(function trackId (track) {
      return track.id;
    })
    .join('');
};

/**
 * @param {(Array of) MediaStream} streams - The streams to render
 *
 * @param {(Array of) HTMLMediaElement} elements
 *        - The <audio>/<video> element(s) that should render the streams
 *
 * Each stream in streams renders to the corresponding element in elements,
 * wrapping around elements if needed.
 */
MediaStreamManager.render = function render (streams, elements) {
  if (!elements) {
    return false;
  }
  if (Array.isArray(elements) && !elements.length) {
    throw new TypeError('elements must not be empty');
  }

  function attachMediaStream(element, stream) {
    element.srcObject = stream;
  }

  function ensureMediaPlaying (mediaElement) {
    var interval = 100;
    mediaElement.ensurePlayingIntervalId = SIP.Timers.setInterval(function () {
      if (mediaElement.paused && mediaElement.srcObject) {
        mediaElement.play();
      }
      else {
        SIP.Timers.clearInterval(mediaElement.ensurePlayingIntervalId);
      }
    }, interval);
  }

  function attachAndPlay (elements, stream, index) {
    var element = elements[index % elements.length];
    if (typeof element === 'function') {
      element = element();
    }
    (environment.attachMediaStream || attachMediaStream)(element, stream);
    ensureMediaPlaying(element);
  }

  // [].concat "casts" `elements` into an array
  // so forEach works even if `elements` was a single element
  elements = [].concat(elements);
  [].concat(streams).forEach(attachAndPlay.bind(null, elements));
};

MediaStreamManager.prototype = Object.create(SIP.EventEmitter.prototype, {
  'acquire': {writable: true, value: function acquire (mediaHint) {
    mediaHint = Object.keys(mediaHint || {}).length ? mediaHint : this.mediaHint;

    var saveSuccess = function (isHintStream, streams) {
      streams = [].concat(streams);
      streams.forEach(function (stream) {
        var streamId = MediaStreamManager.streamId(stream);
        this.acquisitions[streamId] = !!isHintStream;
      }, this);
      return SIP.Utils.Promise.resolve(streams);
    }.bind(this);

    if (mediaHint.stream) {
      return saveSuccess(true, mediaHint.stream);
    } else {
      // Fallback to audio/video enabled if no mediaHint can be found.
      var constraints = mediaHint.constraints ||
        (this.mediaHint && this.mediaHint.constraints) ||
        {audio: true, video: true};

      var deferred = SIP.Utils.defer();

      /*
       * Make the call asynchronous, so that ICCs have a chance
       * to define callbacks to `userMediaRequest`
       */
      SIP.Timers.setTimeout(function () {
        this.emit('userMediaRequest', constraints);

        var emitThenCall = function (eventName, callback) {
          var callbackArgs = Array.prototype.slice.call(arguments, 2);
          // Emit with all of the arguments from the real callback.
          var newArgs = [eventName].concat(callbackArgs);

          this.emit.apply(this, newArgs);

          return callback.apply(null, callbackArgs);
        }.bind(this);

        if (constraints.audio || constraints.video) {
          deferred.resolve(
            SIP.WebRTC.getUserMedia(constraints)
            .then(
              emitThenCall.bind(this, 'userMedia', saveSuccess.bind(null, false)),
              emitThenCall.bind(this, 'userMediaFailed', function(e){throw e;})
            )
          );
        } else {
          // Local streams were explicitly excluded.
          deferred.resolve([]);
        }
      }.bind(this), 0);

      return deferred.promise;
    }
  }},

  'release': {writable: true, value: function release (streams) {
    streams = [].concat(streams);
    streams.forEach(function (stream) {
      var streamId = MediaStreamManager.streamId(stream);
      if (this.acquisitions[streamId] === false) {
        stream.getTracks().forEach(function (track) {
          track.stop();
        });
      }
      delete this.acquisitions[streamId];
    }, this);
  }},
});

// Return since it will be assigned to a variable.
return MediaStreamManager;
};

},{}],123:[function(require,module,exports){
/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var flatMap = require('./util').flatMap;

/**
 * Get the standardized {@link RTCPeerConnection} statistics.
 * @param {RTCPeerConnection} peerConnection
 * @param {object} [options] - Used for testing
 * @returns {Promise.<StandardizedStatsResponse>}
 */
function getStats(peerConnection, options) {
  if (!(peerConnection && typeof peerConnection.getStats === 'function')) {
    return Promise.reject(new Error('Given PeerConnection does not support getStats'));
  }
  return _getStats(peerConnection, options);
}

/**
 * getStats() implementation.
 * @param {RTCPeerConnection} peerConnection
 * @param {object} [options] - Used for testing
 * @returns {Promise.<StandardizedStatsResponse>}
 */
function _getStats(peerConnection, options) {
  var localAudioTracks = getTracks(peerConnection, 'audio', 'local');
  var localVideoTracks = getTracks(peerConnection, 'video', 'local');
  var remoteAudioTracks = getTracks(peerConnection, 'audio');
  var remoteVideoTracks = getTracks(peerConnection, 'video');

  var statsResponse = {
    localAudioTrackStats: [],
    localVideoTrackStats: [],
    remoteAudioTrackStats: [],
    remoteVideoTrackStats: []
  };

  var trackStatsPromises = flatMap([
    [localAudioTracks, 'localAudioTrackStats'],
    [localVideoTracks, 'localVideoTrackStats'],
    [remoteAudioTracks, 'remoteAudioTrackStats'],
    [remoteVideoTracks, 'remoteVideoTrackStats']
  ], function(pair) {
    var tracks = pair[0];
    var statsArrayName = pair[1];
    return tracks.map(function(track) {
      return getTrackStats(peerConnection, track, options).then(function(stats) {
        stats.trackId = track.id;
        statsResponse[statsArrayName].push(stats);
      });
    });
  });

  return Promise.all(trackStatsPromises).then(function() {
    return statsResponse;
  });
}

/**
 * Get local/remote audio/video MediaStreamTracks.
 * @param {RTCPeerConnection} peerConnection - The RTCPeerConnection
 * @param {string} kind - 'audio' or 'video'
 * @param {string} [localOrRemote] - 'local' or 'remote'
 * @returns {Array<MediaStreamTrack>}
 */
function getTracks(peerConnection, kind, localOrRemote) {
  var getSendersOrReceivers = localOrRemote === 'local' ? 'getSenders' : 'getReceivers';
  if (peerConnection[getSendersOrReceivers]) {
    return peerConnection[getSendersOrReceivers]().map(function(senderOrReceiver) {
      return senderOrReceiver.track;
    }).filter(function(track) {
      return track && track.kind === kind;
    });
  }
  var getStreams = localOrRemote === 'local' ? 'getLocalStreams' : 'getRemoteStreams';
  return flatMap(peerConnection[getStreams](), function(stream) {
    var getTracks = kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';
    return stream[getTracks]();
  });
}

/**
 * Get the standardized statistics for a particular MediaStreamTrack.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @param {object} [options] - Used for testing
 * @returns {Promise.<StandardizedTrackStatsReport>}
 */
function getTrackStats(peerConnection, track, options) {
  options = options || {};

  if (typeof options.testForChrome !== 'undefined' ||
    typeof webkitRTCPeerConnection !== 'undefined') {
    return chromeGetTrackStats(peerConnection, track);
  }
  if (typeof options.testForFirefox  !== 'undefined' ||
    typeof mozRTCPeerConnection !== 'undefined') {
    return firefoxGetTrackStats(peerConnection, track);
  }
  return Promise.reject(new Error('RTCPeerConnection#getStats() not supported'));
}

/**
 * Get the standardized statistics for a particular MediaStreamTrack in Chrome.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @returns {Promise.<StandardizedTrackStatsReport>}
 */
function chromeGetTrackStats(peerConnection, track) {
  return new Promise(function(resolve, reject) {
    peerConnection.getStats(function(response) {
      resolve(standardizeChromeStats(response, track));
    }, null, reject);
  });
}

/**
 * Get the standardized statistics for a particular MediaStreamTrack in Firefox.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @returns {Promise.<StandardizedTrackStatsReport>}
 */
function firefoxGetTrackStats(peerConnection, track) {
  return new Promise(function(resolve, reject) {
    peerConnection.getStats(track, function(response) {
      resolve(standardizeFirefoxStats(response));
    }, reject);
  });
}

/**
 * Standardize the MediaStreamTrack's statistics in Chrome.
 * @param {RTCStatsResponse} response
 * @param {MediaStreamTrack} track
 * @returns {StandardizedTrackStatsReport}
 */
function standardizeChromeStats(response, track) {
  var ssrcReport = response.result().find(function(report) {
    return report.type === 'ssrc' && report.stat('googTrackId') === track.id;
  });

  var standardizedStats = {};

  if (ssrcReport) {
    standardizedStats.timestamp = Math.round(Number(ssrcReport.timestamp));
    standardizedStats = ssrcReport.names().reduce(function(stats, name) {
      switch (name) {
        case 'googCodecName':
          stats.codecName = ssrcReport.stat(name);
          break;
        case 'googRtt':
          stats.roundTripTime = Number(ssrcReport.stat(name));
          break;
        case 'googJitterReceived':
          stats.jitter = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthInput':
          stats.frameWidthInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightInput':
          stats.frameHeightInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthSent':
          stats.frameWidthSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightSent':
          stats.frameHeightSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthReceived':
          stats.frameWidthReceived = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightReceived':
          stats.frameHeightReceived = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateInput':
          stats.frameRateInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateSent':
          stats.frameRateSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateReceived':
          stats.frameRateReceived = Number(ssrcReport.stat(name));
          break;
        case 'ssrc':
          stats[name] = ssrcReport.stat(name);
          break;
        case 'bytesReceived':
        case 'bytesSent':
        case 'packetsLost':
        case 'packetsReceived':
        case 'packetsSent':
        case 'audioInputLevel':
        case 'audioOutputLevel':
          stats[name] = Number(ssrcReport.stat(name));
          break;
      }

      return stats;
    }, standardizedStats);
  }

  return standardizedStats;
}

/**
 * Standardize the MediaStreamTrack's statistics in Firefox.
 * @param {RTCStatsReport} response
 * @returns {StandardizedTrackStatsReport}
 */
function standardizeFirefoxStats(response) {
  // NOTE(mroberts): If getStats is called on a closed RTCPeerConnection,
  // Firefox returns undefined instead of an RTCStatsReport. We workaround this
  // here. See the following bug for more details:
  //
  //   https://bugzilla.mozilla.org/show_bug.cgi?id=1377225
  //
  response = response || {};

  var inbound = Object.keys(response).reduce(function(report, id) {
    return response[id].type === 'inboundrtp' ? response[id] : report;
  }, null);

  var outbound = Object.keys(response).reduce(function(report, id) {
    return response[id].type === 'outboundrtp' ? response[id] : report;
  }, null);

  var standardizedStats = {};

  function getStatValue(name) {
    var first = outbound;
    var second = inbound;

    if (outbound && outbound.isRemote) {
      first = inbound;
      second = outbound;
    }

    if (first && typeof first[name] !== 'undefined') {
      return first[name];
    }

    if (second && typeof second[name] !== 'undefined') {
      return second[name];
    }

    return null;
  }

  var timestamp = getStatValue('timestamp');
  standardizedStats.timestamp = Math.round(timestamp);

  var ssrc = getStatValue('ssrc');
  if (typeof ssrc === 'string') {
    standardizedStats.ssrc = ssrc;
  }

  var bytesSent = getStatValue('bytesSent');
  if (typeof bytesSent === 'number') {
    standardizedStats.bytesSent = bytesSent;
  }

  var packetsLost = getStatValue('packetsLost');
  if (typeof packetsLost === 'number') {
    standardizedStats.packetsLost = packetsLost;
  }

  var packetsSent = getStatValue('packetsSent');
  if (typeof packetsSent === 'number') {
    standardizedStats.packetsSent = packetsSent;
  }

  var roundTripTime = getStatValue('mozRtt');
  if (typeof roundTripTime === 'number') {
    standardizedStats.roundTripTime = roundTripTime;
  }

  var jitter = getStatValue('jitter');
  if (typeof jitter === 'number') {
    standardizedStats.jitter = Math.round(jitter * 1000);
  }

  var frameRateSent = getStatValue('framerateMean');
  if (typeof frameRateSent === 'number') {
    standardizedStats.frameRateSent = Math.round(frameRateSent);
  }

  var bytesReceived = getStatValue('bytesReceived');
  if (typeof bytesReceived === 'number') {
    standardizedStats.bytesReceived = bytesReceived;
  }

  var packetsReceived = getStatValue('packetsReceived');
  if (typeof packetsReceived === 'number') {
    standardizedStats.packetsReceived = packetsReceived;
  }

  var frameRateReceived = getStatValue('framerateMean');
  if (typeof frameRateReceived === 'number') {
    standardizedStats.frameRateReceived = Math.round(frameRateReceived);
  }

  return standardizedStats;
}

/**
 * Standardized {@link RTCPeerConnection} statistics.
 * @typedef {Object} StandardizedStatsResponse
 * @property Array<StandardizedTrackStatsReport> localAudioTracks - Stats for local audio MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> localVideoTracks - Stats for local video MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> remoteAudioTracks - Stats for remote audio MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> remoteVideoTracks - Stats for remote video MediaStreamTracks
 */

/**
 * Standardized MediaStreamTrack statistics.
 * @typedef {Object} StandardizedTrackStatsReport
 * @property {string} trackId - MediaStreamTrack ID
 * @property {string} ssrc - SSRC of the MediaStreamTrack
 * @property {number} timestamp - The Unix timestamp in milliseconds
 * @property {string} [codecName] - Name of the codec used to encode the MediaStreamTrack's media
 * @property {number} [roundTripTime] - Round trip time in milliseconds
 * @property {number} [jitter] - Jitter in milliseconds
 * @property {number} [frameWidthInput] - Width in pixels of the local video MediaStreamTrack's captured frame
 * @property {number} [frameHeightInput] - Height in pixels of the local video MediaStreamTrack's captured frame
 * @property {number} [frameWidthSent] - Width in pixels of the local video MediaStreamTrack's encoded frame
 * @property {number} [frameHeightSent] - Height in pixels of the local video MediaStreamTrack's encoded frame
 * @property {number} [frameWidthReceived] - Width in pixels of the remote video MediaStreamTrack's received frame
 * @property {number} [frameHeightReceived] - Height in pixels of the remote video MediaStreamTrack's received frame
 * @property {number} [frameRateInput] - Captured frames per second of the local video MediaStreamTrack
 * @property {number} [frameRateSent] - Frames per second of the local video MediaStreamTrack's encoded video
 * @property {number} [frameRateReceived] - Frames per second of the remote video MediaStreamTrack's received video
 * @property {number} [bytesReceived] - Number of bytes of the remote MediaStreamTrack's media received
 * @property {number} [bytesSent] - Number of bytes of the local MediaStreamTrack's media sent
 * @property {number} [packetsLost] - Number of packets of the MediaStreamTrack's media lost
 * @property {number} [packetsReceived] - Number of packets of the remote MediaStreamTrack's media received
 * @property {number} [packetsSent] - Number of packets of the local MediaStreamTrack's media sent
 * @property {AudioLevel} [audioInputLevel] - The {@link AudioLevel} of the local audio MediaStreamTrack
 * @property {AudioLevel} [audioOutputLevel] - The {@link AudioLevel} of the remote video MediaStreamTrack
 */

module.exports = getStats;

},{"./util":138}],124:[function(require,module,exports){
'use strict';

/**
 * This function is very similar to <code>navigator.getUserMedia</code> except
 * that it does not use callbacks and returns a Promise for a MediaStream
 * @function getUserMedia
 * @param {MediaStreamConstraints} [constraints={audio:true,video:true}] - the
 *   MediaStreamConstraints object specifying what kind of LocalMediaStream to
 *   request from the browser (by default both audio and video)
 * @returns Promise<MediaStream>
 */
function getUserMedia(constraints) {
  return new Promise(function getUserMediaPromise(resolve, reject) {
    _getUserMedia(constraints || { audio: true, video: true }, resolve, reject);
  });
}

function _getUserMedia(constraints, onSuccess, onFailure) {
  if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
    if (typeof navigator.mediaDevices === 'object' &&
        typeof navigator.mediaDevices.getUserMedia === 'function') {
      navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onFailure);
      return;
    } else if (typeof navigator.webkitGetUserMedia === 'function') {
      navigator.webkitGetUserMedia(constraints, onSuccess, onFailure);
      return;
    } else if (typeof navigator.mozGetUserMedia === 'function') {
      navigator.mozGetUserMedia(constraints, onSuccess, onFailure);
      return;
    }
  }
  onFailure(new Error('getUserMedia is not supported'));
}

module.exports = getUserMedia;

},{}],125:[function(require,module,exports){
'use strict';

var WebRTC = {};

Object.defineProperties(WebRTC, {
  getStats: {
    enumerable: true,
    value: require('./getstats')
  },
  getUserMedia: {
    enumerable: true,
    value: require('./getusermedia')
  },
  MediaStream: {
    enumerable: true,
    value: require('./mediastream')
  },
  MediaStreamTrack: {
    enumerable: true,
    value: require('./mediastreamtrack')
  },
  RTCIceCandidate: {
    enumerable: true,
    value: require('./rtcicecandidate')
  },
  RTCPeerConnection: {
    enumerable: true,
    value: require('./rtcpeerconnection')
  },
  RTCSessionDescription: {
    enumerable: true,
    value: require('./rtcsessiondescription')
  },
  version: {
    enumerable: true,
    value: require('../package.json').version
  }
});

module.exports = WebRTC;

},{"../package.json":141,"./getstats":123,"./getusermedia":124,"./mediastream":126,"./mediastreamtrack":127,"./rtcicecandidate":128,"./rtcpeerconnection":131,"./rtcsessiondescription":136}],126:[function(require,module,exports){
/* globals webkitMediaStream, MediaStream */
'use strict';

if (typeof webkitMediaStream !== 'undefined') {
  module.exports = webkitMediaStream;
} else if (typeof MediaStream !== 'undefined') {
  module.exports = MediaStream;
} else {
  module.exports = function MediaStream() {
    throw new Error('WebRTC is not supported in this browser');
  };
}

},{}],127:[function(require,module,exports){
/* global MediaStreamTrack */
'use strict';

if (typeof MediaStreamTrack !== 'undefined') {
  module.exports = MediaStreamTrack;
} else {
  module.exports = function MediaStreamTrack() {
    throw new Error('WebRTC is not supported in this browser');
  };
}

},{}],128:[function(require,module,exports){
/* global mozRTCIceCandidate, RTCIceCandidate */
'use strict';

if (typeof RTCIceCandidate !== 'undefined') {
  module.exports = RTCIceCandidate;
} else if (typeof mozRTCIceCandidate !== 'undefined') {
  module.exports = mozRTCIceCandidate;
} else {
  module.exports = function RTCIceCandidate() {
    throw new Error('WebRTC is unsupported');
  };
}

},{}],129:[function(require,module,exports){
/* globals RTCDataChannel, RTCSessionDescription, webkitRTCPeerConnection */
'use strict';

var ChromeRTCSessionDescription = require('../rtcsessiondescription/chrome');
var EventTarget = require('../util/eventtarget');
var inherits = require('util').inherits;
var Latch = require('../util/latch');
var MediaStream = require('../mediastream');
var RTCRtpSenderShim = require('../rtcrtpsender');
var updateTracksToSSRCs = require('../util/sdp').updatePlanBTrackIdsToSSRCs;
var util = require('../util');

var PeerConnection = typeof RTCPeerConnection !== 'undefined'
  ? RTCPeerConnection
  : webkitRTCPeerConnection;

// NOTE(mroberts): This class wraps Chrome's RTCPeerConnection implementation.
// It provides some functionality not currently present in Chrome, namely the
// abilities to
//
//   1. Rollback, per the workaround suggested here:
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=5738#c3
//
//   2. Listen for track events, per the adapter.js workaround.
//
//   3. Set iceTransportPolicy.
//
function ChromeRTCPeerConnection(configuration) {
  if (!(this instanceof ChromeRTCPeerConnection)) {
    return new ChromeRTCPeerConnection(configuration);
  }

  EventTarget.call(this);

  var newConfiguration = Object.assign({}, configuration);
  if (newConfiguration.iceTransportPolicy) {
    newConfiguration.iceTransports = newConfiguration.iceTransportPolicy;
  }

  util.interceptEvent(this, 'datachannel');
  util.interceptEvent(this, 'signalingstatechange');

  // NOTE(mmalavalli): Because of a bug related to "ontrack", we prevent it
  // from being delegated to ChromeRTCPeerConnection. For now, this bug
  // manifests when we run Chrome with the flag: --enable-blink-features=RTCRtpSender
  // Existing bug: https://bugs.chromium.org/p/chromium/issues/detail?id=774303
  // Bug filed by us: https://bugs.chromium.org/p/chromium/issues/detail?id=783433
  util.interceptEvent(this, 'track');

  /* eslint new-cap:0 */
  var peerConnection = new PeerConnection(newConfiguration);

  Object.defineProperties(this, {
    _localStream: {
      value: new MediaStream()
    },
    _peerConnection: {
      value: peerConnection
    },
    _pendingLocalOffer: {
      value: null,
      writable: true
    },
    _pendingRemoteOffer: {
      value: null,
      writable: true
    },
    _senders: {
      value: new Map()
    },
    _signalingStateLatch: {
      value: new Latch()
    },
    _tracksToSSRCs: {
      value: new Map()
    },
    localDescription: {
      enumerable: true,
      get: function() {
        return this._pendingLocalOffer ? this._pendingLocalOffer : peerConnection.localDescription;
      }
    },
    remoteDescription: {
      enumerable: true,
      get: function() {
        return this._pendingRemoteOffer ? this._pendingRemoteOffer : peerConnection.remoteDescription;
      }
    },
    signalingState: {
      enumerable: true,
      get: function() {
        if (this._pendingLocalOffer) {
          return 'have-local-offer';
        } else if (this._pendingRemoteOffer) {
          return 'have-remote-offer';
        }
        return peerConnection.signalingState;
      }
    }
  });

  var self = this;

  peerConnection.addEventListener('datachannel', function ondatachannel(event) {
    shimDataChannel(event.channel);
    self.dispatchEvent(event);
  });

  peerConnection.addEventListener('signalingstatechange', function onsignalingstatechange() {
    if (!self._pendingLocalOffer && !self._pendingRemoteOffer) {
      self.dispatchEvent.apply(self, arguments);
    }
  });

  peerConnection.ontrack = function ontrack() {
    // NOTE(mroberts): adapter.js's "track" event shim only kicks off if we set
    // the ontrack property of the RTCPeerConnection.
  };

  peerConnection.addStream(this._localStream);
  util.proxyProperties(PeerConnection.prototype, this, peerConnection);
}

inherits(ChromeRTCPeerConnection, EventTarget);

// NOTE(mmalavalli): This shim supports our limited case of adding
// all MediaStreamTracks to one MediaStream. It has been implemented this
// keeping in mind that this is to be maintained only until "addTrack" is
// supported natively in Chrome.
ChromeRTCPeerConnection.prototype.addTrack = function addTrack() {
  var args = [].slice.call(arguments);
  if (this._peerConnection.addTrack) {
    return this._peerConnection.addTrack.apply(this._peerConnection, args);
  }

  var track = args[0];
  if (this._peerConnection.signalingState === 'closed') {
    throw new Error('Cannot add MediaStreamTrack [' + track.id + ', '
      + track.kind + ']: RTCPeerConnection is closed');
  }

  var sender = this._senders.get(track);
  if (sender && sender.track) {
    throw new Error('Cannot add MediaStreamTrack [' + track.id + ', '
      + track.kind + ']: RTCPeerConnection already has it');
  }
  this._peerConnection.removeStream(this._localStream);
  this._localStream.addTrack(track);
  this._peerConnection.addStream(this._localStream);

  sender = new RTCRtpSenderShim(track);
  this._senders.set(track, sender);
  return sender;
};

// NOTE(mmalavalli): This shim supports our limited case of removing
// MediaStreamTracks from one MediaStream. It has been implemented this
// keeping in mind that this is to be maintained only until "removeTrack" is
// supported natively in Chrome.
ChromeRTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
  if (this._peerConnection.removeTrack) {
    this._peerConnection.removeTrack(sender);
    return;
  }
  if (this._peerConnection.signalingState === 'closed') {
    throw new Error('Cannot remove MediaStreamTrack: RTCPeerConnection is closed');
  }

  var track = sender.track;
  if (!track) {
    return;
  }
  sender = this._senders.get(track);
  if (sender && sender.track) {
    sender.track = null;
    this._peerConnection.removeStream(this._localStream);
    this._localStream.removeTrack(track);
    this._peerConnection.addStream(this._localStream);
  }
};

ChromeRTCPeerConnection.prototype.getSenders = function getSenders() {
  if (this._peerConnection.getSenders) {
    return this._peerConnection.getSenders();
  }
  return Array.from(this._senders.values());
};

ChromeRTCPeerConnection.prototype.addIceCandidate = function addIceCandidate(candidate) {
  var args = [].slice.call(arguments);
  var promise;
  var self = this;

  if (this.signalingState === 'have-remote-offer') {
    // NOTE(mroberts): Because the ChromeRTCPeerConnection simulates the
    // "have-remote-offer" signalingStates, we only want to invoke the true
    // addIceCandidates method when the remote description has been applied.
    promise = this._signalingStateLatch.when('low').then(function signalingStatesResolved() {
      return self._peerConnection.addIceCandidate(candidate);
    });
  } else {
    promise = this._peerConnection.addIceCandidate(candidate);
  }

  return args.length > 1
    ? util.legacyPromise(promise, args[1], args[2])
    : promise;
};

// NOTE(mroberts): The WebRTC spec does not specify that close should throw an
// Error; however, in Chrome it does. We workaround this by checking the
// signalingState manually.
ChromeRTCPeerConnection.prototype.close = function close() {
  if (this.signalingState !== 'closed') {
    this._pendingLocalOffer = null;
    this._pendingRemoteOffer = null;
    this._peerConnection.close();
  }
};

// NOTE(mroberts): Because we workaround Chrome's lack of rollback support by
// "faking" setRemoteDescription, we cannot create an answer until we actually
// apply the remote description. This means, once you call createAnswer, you
// can no longer rollback. This is acceptable for our use case because we will
// apply the newly-created answer almost immediately; however, this may be
// unacceptable for other use cases.
ChromeRTCPeerConnection.prototype.createAnswer = function createAnswer() {
  var args = [].slice.call(arguments);
  var promise;
  var self = this;

  if (this._pendingRemoteOffer) {
    var mediaStreamTracks = util.flatMap(this.getRemoteStreams(), function(mediaStream) {
      return mediaStream.getTracks();
    });

    promise = this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(function setRemoteDescriptionSucceeded() {
      maybeDispatchTrackEvents(self, mediaStreamTracks);
      // NOTE(mroberts): The signalingStates between the ChromeRTCPeerConnection
      // and the underlying RTCPeerConnection implementation have converged. We
      // can unblock any pending calls to addIceCandidate now.
      self._signalingStateLatch.lower();
      return self._peerConnection.createAnswer();
    }).then(function createAnswerSucceeded(answer) {
      self._pendingRemoteOffer = null;
      return answer;
    }, function setRemoteDescriptionOrCreateAnswerFailed(error) {
      self._pendingRemoteOffer = null;
      throw error;
    });
  }

  if (promise) {
    return args.length > 1
      ? util.legacyPromise(promise, args[0], args[1])
      : promise;
  }

  return this._peerConnection.createAnswer.apply(this._peerConnection, args);
};

ChromeRTCPeerConnection.prototype.createOffer = function createOffer() {
  var args = [].slice.call(arguments);
  var options = (args.length > 1 ? args[2] : args[0]) || {};
  var self = this;

  var promise = this._peerConnection.createOffer(options).then(function(offer) {
    return new ChromeRTCSessionDescription({
      type: offer.type,
      sdp: updateTracksToSSRCs(self._tracksToSSRCs, offer.sdp)
    });
  });

  return args.length > 1
    ? util.legacyPromise(promise, args[0], args[1])
    : promise;
};

ChromeRTCPeerConnection.prototype.createDataChannel = function createDataChannel(label, dataChannelDict) {
  dataChannelDict = shimDataChannelInit(dataChannelDict);
  var dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
  shimDataChannel(dataChannel);
  return dataChannel;
};

ChromeRTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise = setDescription(this, true, description);
  return args.length > 1
    ? util.legacyPromise(promise, args[1], args[2])
    : promise;
};

ChromeRTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise = setDescription(this, false, description);
  return args.length > 1
    ? util.legacyPromise(promise, args[1], args[2])
    : promise;
};

util.delegateMethods(
  PeerConnection.prototype,
  ChromeRTCPeerConnection.prototype,
  '_peerConnection');

// Dispatch 'track' events to ChromeRTCPeerConnection if new
// MediaStreamTracks have been added. This is a temporary workaround
// for the unreliable MediaStreamTrack#addtrack event. Do this only if
// the native RTCPeerConnection has not implemented 'ontrack'.
function maybeDispatchTrackEvents(peerConnection, mediaStreamTracks) {
  var currentMediaStreamTracks = util.flatMap(peerConnection.getRemoteStreams(), function(mediaStream) {
    return mediaStream.getTracks();
  });
  var mediaStreamTracksAdded = util.difference(currentMediaStreamTracks, mediaStreamTracks);

  mediaStreamTracksAdded.forEach(function(mediaStreamTrack) {
    var newEvent = new Event('track');
    newEvent.track = mediaStreamTrack;
    peerConnection.dispatchEvent(newEvent);
  });
}

// NOTE(mroberts): We workaround Chrome's lack of rollback support, per the
// workaround suggested here: https://bugs.chromium.org/p/webrtc/issues/detail?id=5738#c3
// Namely, we "fake" setting the local or remote description and instead buffer
// it. If we receive or create an answer, then we will actually apply the
// description. Until we receive or create an answer, we will be able to
// "rollback" by simply discarding the buffer description.
function setDescription(peerConnection, local, description) {
  function setPendingLocalOffer(offer) {
    if (local) {
      peerConnection._pendingLocalOffer = offer;
    } else {
      peerConnection._pendingRemoteOffer = offer;
    }
  }

  function clearPendingLocalOffer() {
    if (local) {
      peerConnection._pendingLocalOffer = null;
    } else {
      peerConnection._pendingRemoteOffer = null;
    }
  }

  var mediaStreamTracks = util.flatMap(peerConnection.getRemoteStreams(), function(mediaStream) {
    return mediaStream.getTracks();
  });

  var pendingLocalOffer = local ? peerConnection._pendingLocalOffer : peerConnection._pendingRemoteOffer;
  var pendingRemoteOffer = local ? peerConnection._pendingRemoteOffer : peerConnection._pendingLocalOffer;
  var intermediateState = local ? 'have-local-offer' : 'have-remote-offer';
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
  var promise;

  if (!local && pendingRemoteOffer && description.type === 'answer') {
    promise = setRemoteAnswer(peerConnection, description);

  } else if (description.type === 'offer') {
    if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
      // NOTE(mroberts): Error message copied from Firefox.
      return Promise.reject(new Error('Cannot set ' + (local ? 'local' : 'remote') +
        ' offer in state ' + peerConnection.signalingState));
    }

    // We need to save this local offer in case of a rollback. We also need to
    // check to see if the signalingState between the ChromeRTCPeerConnection
    // and the underlying RTCPeerConnection implementation are about to diverge.
    // If so, we need to ensure subsequent calls to addIceCandidate will block.
    if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
      peerConnection._signalingStateLatch.raise();
    }
    var previousSignalingState = peerConnection.signalingState;
    setPendingLocalOffer(unwrap(description));
    promise = Promise.resolve();

    // Only dispatch a signalingstatechange event if we transitioned.
    if (peerConnection.signalingState !== previousSignalingState) {
      promise.then(function dispatchSignalingStateChangeEvent() {
        peerConnection.dispatchEvent(new Event('signalingstatechange'));
      });
    }

  } else if (description.type === 'rollback') {
    if (peerConnection.signalingState !== intermediateState) {
      // NOTE(mroberts): Error message copied from Firefox.
      promise = Promise.reject(new Error('Cannot rollback ' +
        (local ? 'local' : 'remote') + ' description in ' + peerConnection.signalingState));
    } else {
      // Reset the pending offer.
      clearPendingLocalOffer();
      promise = Promise.resolve();
      promise.then(function dispatchSignalingStateChangeEvent() {
        peerConnection.dispatchEvent(new Event('signalingstatechange'));
      });
    }
  }

  return promise || peerConnection._peerConnection[setLocalDescription](unwrap(description)).then(function() {
    if (!local) {
      maybeDispatchTrackEvents(peerConnection, mediaStreamTracks);
    }
  });
}

function setRemoteAnswer(peerConnection, answer) {
  var mediaStreamTracks = util.flatMap(peerConnection.getRemoteStreams(), function(mediaStream) {
    return mediaStream.getTracks();
  });

  // Apply the pending local offer.
  var pendingLocalOffer = peerConnection._pendingLocalOffer;
  return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(function setLocalOfferSucceeded() {
    peerConnection._pendingLocalOffer = null;
    return peerConnection.setRemoteDescription(answer);
  }).then(function setRemoteAnswerSucceeded() {
    maybeDispatchTrackEvents(peerConnection, mediaStreamTracks);
    // NOTE(mroberts): The signalingStates between the ChromeRTCPeerConnection
    // and the underlying RTCPeerConnection implementation have converged. We
    // can unblock any pending calls to addIceCandidate now.
    peerConnection._signalingStateLatch.lower();
  });
}

function unwrap(description) {
  if (description instanceof ChromeRTCSessionDescription) {
    if (description._description) {
      return description._description;
    }
  }
  return new RTCSessionDescription(description);
}

/**
 * Check whether or not we need to apply our maxPacketLifeTime shim. We are
 * pretty conservative: we'll only apply it if the legacy maxRetransmitTime
 * property is available _and_ the standard maxPacketLifeTime property is _not_
 * available (the thinking being that Chrome will land the standards-compliant
 * property).
 * @returns {boolean}
 */
function needsMaxPacketLifeTimeShim() {
  return 'maxRetransmitTime' in RTCDataChannel.prototype
    && !('maxPacketLifeTime' in RTCDataChannel.prototype);
}

/**
 * Shim an RTCDataChannelInit dictionary (if necessary). This function returns
 * a copy of the original RTCDataChannelInit.
 * @param {RTCDataChannelInit} dataChannelDict
 * @returns {RTCDataChannelInit}
 */
function shimDataChannelInit(dataChannelDict) {
  dataChannelDict = Object.assign({}, dataChannelDict);
  if (needsMaxPacketLifeTimeShim() && 'maxPacketLifeTime' in dataChannelDict) {
    dataChannelDict.maxRetransmitTime = dataChannelDict.maxPacketLifeTime;
  }
  return dataChannelDict;
}

/**
 * Shim an RTCDataChannel (if necessary). This function mutates the
 * RTCDataChannel.
 * @param {RTCDataChannel} dataChannel
 * @returns {RTCDataChannel}
 */
function shimDataChannel(dataChannel) {
  Object.defineProperty(dataChannel, 'maxRetransmits', {
    value: dataChannel.maxRetransmits === 65535
      ? null
      : dataChannel.maxRetransmits
  });
  if (needsMaxPacketLifeTimeShim()) {
    // NOTE(mroberts): We can rename `maxRetransmitTime` to `maxPacketLifeTime`.
    //
    //   https://bugs.chromium.org/p/chromium/issues/detail?id=696681
    //
    Object.defineProperty(dataChannel, 'maxPacketLifeTime', {
      value: dataChannel.maxRetransmitTime === 65535
        ? null
        : dataChannel.maxRetransmitTime
    });
  }
  return dataChannel;
}

module.exports = ChromeRTCPeerConnection;

},{"../mediastream":126,"../rtcrtpsender":133,"../rtcsessiondescription/chrome":134,"../util":138,"../util/eventtarget":137,"../util/latch":139,"../util/sdp":140,"util":146}],130:[function(require,module,exports){
/* globals mozRTCPeerConnection, RTCPeerConnection */
'use strict';

var EventTarget = require('../util/eventtarget');
var FirefoxRTCSessionDescription = require('../rtcsessiondescription/firefox');
var RTCRtpSenderShim = require('../rtcrtpsender');
var inherits = require('util').inherits;
var updateTracksToSSRCs = require('../util/sdp').updateUnifiedPlanTrackIdsToSSRCs;
var util = require('../util');

var PeerConnection = typeof RTCPeerConnection !== 'undefined'
  ? RTCPeerConnection
  : mozRTCPeerConnection;

// NOTE(mroberts): This class wraps Firefox's RTCPeerConnection implementation.
// It provides some functionality not currently present in Firefox, namely the
// abilities to
//
//   1. Call setLocalDescription and setRemoteDescription with new offers in
//      signalingStates "have-local-offer" and "have-remote-offer",
//      respectively.
//
//   2. The ability to call createOffer in signalingState "have-local-offer".
//
// Both of these are implemented using rollbacks to workaround the following
// bug:
//
//   https://bugzilla.mozilla.org/show_bug.cgi?id=1072388
//
// We also provide a workaround for a bug where Firefox may change the
// previously-negotiated DTLS role in an answer, which breaks Chrome:
//
//     https://bugzilla.mozilla.org/show_bug.cgi?id=1240897
//
function FirefoxRTCPeerConnection(configuration) {
  if (!(this instanceof FirefoxRTCPeerConnection)) {
    return new FirefoxRTCPeerConnection(configuration);
  }

  EventTarget.call(this);

  util.interceptEvent(this, 'signalingstatechange');

  /* eslint new-cap:0 */
  var peerConnection = new PeerConnection(configuration);

  Object.defineProperties(this, {
    _initiallyNegotiatedDtlsRole: {
      value: null,
      writable: true
    },
    _isClosed: {
      value: false,
      writable: true
    },
    _peerConnection: {
      value: peerConnection
    },
    _rollingBack: {
      value: false,
      writable: true
    },
    _senders: {
      value: new Map()
    },
    _tracksToSSRCs: {
      value: new Map()
    },
    iceGatheringState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
      }
    },
    localDescription: {
      enumerable: true,
      get: function() {
        return overwriteWithInitiallyNegotiatedDtlsRole(this._peerConnection.localDescription, this._initiallyNegotiatedDtlsRole);
      }
    },
    signalingState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'closed' : this._peerConnection.signalingState;
      }
    }
  });

  var self = this;
  var previousSignalingState;

  peerConnection.addEventListener('signalingstatechange', function onsignalingstatechange() {
    if (!self._rollingBack && self.signalingState !== previousSignalingState) {
      previousSignalingState = self.signalingState;

      // NOTE(mmalavalli): In Firefox, 'signalingstatechange' event is
      // triggered synchronously in the same tick after
      // RTCPeerConnection#close() is called. So we mimic Chrome's behavior
      // by triggering 'signalingstatechange' on the next tick.
      var dispatchEventToSelf = self.dispatchEvent.apply.bind(self.dispatchEvent, self, arguments);
      if (self._isClosed) {
        setTimeout(dispatchEventToSelf);
      } else {
        dispatchEventToSelf();
      }
    }
  });

  util.proxyProperties(PeerConnection.prototype, this, peerConnection);
}

inherits(FirefoxRTCPeerConnection, EventTarget);

// NOTE(mmalavalli): Firefox throws a TypeError when the PeerConnection's
// prototype's "peerIdentity" property is accessed. In order to overcome
// this, we ignore this property while delegating methods.
// Reference: https://bugzilla.mozilla.org/show_bug.cgi?id=1363815
Object.defineProperty(FirefoxRTCPeerConnection.prototype, 'peerIdentity', {
  enumerable: true,
  value: Promise.resolve({
    idp: '',
    name: ''
  })
});

// NOTE(mmalavalli): Because we are not delegating to the native
// RTCPeerConnection#removeTrack(), we have to manually maintain a list of added
// tracks. So we disable the delegation to the native RTCPeerConnection#addTrack()
// for now.
FirefoxRTCPeerConnection.prototype.addTrack = function addTrack() {
  var args = [].slice.call(arguments);
  var track = args[0];
  var sender = this._senders.get(track);
  if (sender && sender.track) {
    throw new Error('Cannot add MediaStreamTrack [' + track.id + ', '
      + track.kind + ']: RTCPeerConnection already has it');
  }
  sender = getActiveSenders(this._peerConnection).get(track)
    || this._peerConnection.addTrack.apply(this._peerConnection, args);

  this._senders.set(track, sender);
  return sender;
};

// NOTE(mmalavalli): RTCPeerConnection#removeTrack() has a bug in the
// Firefox <--> Chrome interop case, which is mentioned below. So we disable
// its delegation for now. Also, we maintain only one RTCRtpSender per
// MediaStreamTrack for our use case, and not worry about multiple RTCRtpSenders
// due to replaceTrack().
// Bugzilla: https://bugzilla.mozilla.org/show_bug.cgi?id=1133874
FirefoxRTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
  if (this._isClosed) {
    throw new Error('Cannot remove MediaStreamTrack: RTCPeerConnection is closed');
  }
  var track = sender.track;
  if (!track) {
    return;
  }
  sender = this._senders.get(track);
  if (sender && sender.track) {
    this._senders.set(track, new RTCRtpSenderShim(null));
  }
};

// NOTE(mmalavalli): Because we are not delegating to the native
// RTCPeerConnection#removeTrack(), we have to manually maintain a list of added
// tracks. So we disable the delegation to the native RTCPeerConnection#getSenders()
// for now.
FirefoxRTCPeerConnection.prototype.getSenders = function getSenders() {
  return Array.from(this._senders.values());
};

FirefoxRTCPeerConnection.prototype.createAnswer = function createAnswer() {
  var args = [].slice.call(arguments);
  var promise;
  var self = this;

  promise = this._peerConnection.createAnswer().then(function createAnswerSucceeded(answer) {
    saveInitiallyNegotiatedDtlsRole(self, answer);
    return overwriteWithInitiallyNegotiatedDtlsRole(answer, self._initiallyNegotiatedDtlsRole);
  });

  return typeof args[0] === 'function'
    ? util.legacyPromise(promise, args[0], args[1])
    : promise;
};

// NOTE(mroberts): The WebRTC spec allows you to call createOffer from any
// signalingState other than "closed"; however, Firefox has not yet implemented
// this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388). We workaround
// this by rolling back if we are in state "have-local-offer" or
// "have-remote-offer". This is acceptable for our use case because we will
// apply the newly-created offer almost immediately; however, this may be
// unacceptable for other use cases.
FirefoxRTCPeerConnection.prototype.createOffer = function createOffer() {
  var args = [].slice.call(arguments);
  var options = (args.length > 1 ? args[2] : args[0]) || {};
  var promise;
  var self = this;

  if (this.signalingState === 'have-local-offer' ||
      this.signalingState === 'have-remote-offer') {
    var local = this.signalingState === 'have-local-offer';
    promise = rollback(this, local, function rollbackSucceeded() {
      return self.createOffer(options);
    });
  } else {
    promise = self._peerConnection.createOffer(options);
  }

  promise = promise.then(function(offer) {
    return new FirefoxRTCSessionDescription({
      type: offer.type,
      sdp: updateTracksToSSRCs(self._tracksToSSRCs, offer.sdp)
    });
  });

  return args.length > 1
    ? util.legacyPromise(promise, args[0], args[1])
    : promise;
};

// NOTE(mroberts): While Firefox will reject the Promise returned by
// setLocalDescription when called from signalingState "have-local-offer" with
// an answer, it still updates the .localDescription property. We workaround
// this by explicitly handling this case.
FirefoxRTCPeerConnection.prototype.setLocalDescription = function setLocalDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise;

  if (description && description.type === 'answer' && this.signalingState === 'have-local-offer') {
    promise = Promise.reject(new Error('Cannot set local answer in state have-local-offer'));
  }

  if (promise) {
    return args.length > 1
      ? util.legacyPromise(promise, args[1], args[2])
      : promise;
  }

  return this._peerConnection.setLocalDescription.apply(this._peerConnection, args);
};

// NOTE(mroberts): The WebRTC spec allows you to call setRemoteDescription with
// an offer multiple times in signalingState "have-remote-offer"; however,
// Firefox has not yet implemented this (https://bugzilla.mozilla.org/show_bug.cgi?id=1072388).
// We workaround this by rolling back if we are in state "have-remote-offer".
// This is acceptable for our use case; however, this may be unacceptable for
// other use cases.
//
// While Firefox will reject the Promise returned by setRemoteDescription when
// called from signalingState "have-remote-offer" with an answer, it sill
// updates the .remoteDescription property. We workaround this by explicitly
// handling this case.
FirefoxRTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription() {
  var args = [].slice.call(arguments);
  var description = args[0];
  var promise;
  var self = this;

  if (description && this.signalingState === 'have-remote-offer') {
    if (description.type === 'answer') {
      promise = Promise.reject(new Error('Cannot set remote answer in state have-remote-offer'));
    } else if (description.type === 'offer') {
      promise = rollback(this, false, function rollbackSucceeded() {
        return self._peerConnection.setRemoteDescription(description);
      });
    }
  }

  if (!promise) {
    promise = this._peerConnection.setRemoteDescription(description);
  }

  promise = promise.then(function setRemoteDescriptionSucceeded() {
    saveInitiallyNegotiatedDtlsRole(self, description, true);
  });

  return args.length > 1
    ? util.legacyPromise(promise, args[1], args[2])
    : promise;
};

// NOTE(mroberts): The WebRTC spec specifies that the PeerConnection's internal
// isClosed slot should immediately be set to true; however, in Firefox it
// occurs in the next tick. We workaround this by tracking isClosed manually.
FirefoxRTCPeerConnection.prototype.close = function close() {
  if (this.signalingState !== 'closed') {
    this._isClosed = true;
    this._peerConnection.close();
  }
};

util.delegateMethods(
  PeerConnection.prototype,
  FirefoxRTCPeerConnection.prototype,
  '_peerConnection');

function rollback(peerConnection, local, onceRolledBack) {
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';
  peerConnection._rollingBack = true;
  return peerConnection._peerConnection[setLocalDescription](new FirefoxRTCSessionDescription({
    type: 'rollback'
  })).then(onceRolledBack).then(function onceRolledBackSucceeded(result) {
    peerConnection._rollingBack = false;
    return result;
  }, function rollbackOrOnceRolledBackFailed(error) {
    peerConnection._rollingBack = false;
    throw error;
  });
}

/**
 * Extract the initially negotiated DTLS role out of an RTCSessionDescription's
 * sdp property and save it on the FirefoxRTCPeerConnection if and only if
 *
 *   1. A DTLS role was not already saved on the FirefoxRTCPeerConnection, and
 *   2. The description is an answer.
 *
 * @private
 * @param {FirefoxRTCPeerConnection} peerConnection
 * @param {RTCSessionDescription} description
 * @param {boolean} [remote=false] - if true, save the inverse of the DTLS role,
 *   e.g. "active" instead of "passive" and vice versa
 * @returns {undefined}
 */
function saveInitiallyNegotiatedDtlsRole(peerConnection, description, remote) {
  // NOTE(mroberts): JSEP specifies that offers always offer "actpass" as the
  // DTLS role. We need to inspect answers to figure out the negotiated DTLS
  // role.
  if (peerConnection._initiallyNegotiatedDtlsRole || description.type === 'offer') {
    return;
  }

  var match = description.sdp.match(/a=setup:([a-z]+)/);
  if (!match) {
    return;
  }

  var dtlsRole = match[1];
  peerConnection._initiallyNegotiatedDtlsRole = remote ? {
    active: 'passive',
    passive: 'active'
  }[dtlsRole] : dtlsRole;
}

/**
 * Overwrite the DTLS role in the sdp property of an RTCSessionDescription if
 * and only if
 *
 *   1. The description is an answer, and
 *   2. A DTLS role is provided.
 *
 * @private
 * @param {RTCSessionDescription} [description]
 * @param {string} [dtlsRole] - one of "active" or "passive"
 * @returns {?RTCSessionDescription} description
 */
function overwriteWithInitiallyNegotiatedDtlsRole(description, dtlsRole) {
  if (description && description.type === 'answer' && dtlsRole) {
    return new FirefoxRTCSessionDescription({
      type: description.type,
      sdp: description.sdp.replace(/a=setup:[a-z]+/g, 'a=setup:' + dtlsRole)
    });
  }
  return description;
}

/**
 * Gets the active RTCRtpSenders of the RTCPeerConnection.
 * @param peerConnection
 * @returns {Map<MediaStreamTrack, RTCRtpSender>}
 */
function getActiveSenders(peerConnection) {
  return new Map(peerConnection.getSenders().filter(function(sender) {
    return sender.track;
  }).map(function(sender) {
    return [sender.track, sender];
  }));
}

module.exports = FirefoxRTCPeerConnection;

},{"../rtcrtpsender":133,"../rtcsessiondescription/firefox":135,"../util":138,"../util/eventtarget":137,"../util/sdp":140,"util":146}],131:[function(require,module,exports){
'use strict';

var guessBrowser = require('../util').guessBrowser;

switch (guessBrowser()) {
  case 'chrome':
    module.exports = require('./chrome');
    break;
  case 'firefox':
    module.exports = require('./firefox');
    break;
  case 'safari':
    module.exports = require('./safari');
    break;
  default:
    if (typeof RTCPeerConnection === 'undefined') {
      break;
    }
    module.exports = RTCPeerConnection;
}

},{"../util":138,"./chrome":129,"./firefox":130,"./safari":132}],132:[function(require,module,exports){
/* globals RTCPeerConnection, RTCSessionDescription */
'use strict';

var EventTarget = require('../util/eventtarget');
var inherits = require('util').inherits;
var Latch = require('../util/latch');
var RTCRtpSenderShim = require('../rtcrtpsender');
var updateTracksToSSRCs = require('../util/sdp').updatePlanBTrackIdsToSSRCs;
var util = require('../util');

function SafariRTCPeerConnection(configuration) {
  if (!(this instanceof SafariRTCPeerConnection)) {
    return new SafariRTCPeerConnection(configuration);
  }

  EventTarget.call(this);

  util.interceptEvent(this, 'datachannel');
  util.interceptEvent(this, 'iceconnectionstatechange');
  util.interceptEvent(this, 'signalingstatechange');

  var peerConnection = new RTCPeerConnection(configuration);

  Object.defineProperties(this, {
    _audioTransceiver: {
      value: null,
      writable: true
    },
    _isClosed: {
      value: false,
      writable: true
    },
    _peerConnection: {
      value: peerConnection
    },
    _pendingLocalOffer: {
      value: null,
      writable: true
    },
    _pendingRemoteOffer: {
      value: null,
      writable: true
    },
    _senders: {
      value: new Map()
    },
    _signalingStateLatch: {
      value: new Latch()
    },
    _tracksToSSRCs: {
      value: new Map()
    },
    _videoTransceiver: {
      value: null,
      writable: true
    },
    // NOTE(mroberts): Keep this here until the following is fixed.
    //
    //   https://bugs.webkit.org/show_bug.cgi?id=174323
    //
    localDescription: {
      enumerable: true,
      get: function() {
        return this._isClosed
          ? null
          : this._pendingLocalOffer || this._peerConnection.localDescription;
      }
    },
    iceConnectionState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'closed' : this._peerConnection.iceConnectionState;
      }
    },
    iceGatheringState: {
      enumerable: true,
      get: function() {
        return this._isClosed ? 'complete' : this._peerConnection.iceGatheringState;
      }
    },
    // NOTE(mroberts): Keep this here until the following is fixed.
    //
    //   https://bugs.webkit.org/show_bug.cgi?id=174323
    //
    remoteDescription: {
      enumerable: true,
      get: function() {
        return this._isClosed
          ? null
          : this._pendingRemoteOffer || this._peerConnection.remoteDescription;
      }
    },
    signalingState: {
      enumerable: true,
      get: function() {
        if (this._isClosed) {
          return 'closed';
        } else if (this._pendingLocalOffer) {
          return 'have-local-offer';
        } else if (this._pendingRemoteOffer) {
          return 'have-remote-offer';
        }
        return this._peerConnection.signalingState;
      }
    }
  });

  var self = this;

  peerConnection.addEventListener('datachannel', function ondatachannel(event) {
    shimDataChannel(event.channel);
    self.dispatchEvent(event);
  });

  peerConnection.addEventListener('iceconnectionstatechange', function oniceconnectionstatechange() {
    if (self._isClosed) {
      return;
    }
    self.dispatchEvent.apply(self, arguments);
  });

  peerConnection.addEventListener('signalingstatechange', function onsignalingstatechange() {
    if (self._isClosed) {
      return;
    }
    if (!self._pendingLocalOffer && !self._pendingRemoteOffer) {
      self.dispatchEvent.apply(self, arguments);
    }
  });

  util.proxyProperties(RTCPeerConnection.prototype, this, peerConnection);
}

inherits(SafariRTCPeerConnection, EventTarget);

SafariRTCPeerConnection.prototype.addIceCandidate = function addIceCandidate(candidate) {
  var self = this;
  if (this.signalingState === 'have-remote-offer') {
    return this._signalingStateLatch.when('low').then(function signalingStatesResolved() {
      return self._peerConnection.addIceCandidate(candidate);
    });
  }
  return this._peerConnection.addIceCandidate(candidate);
};

SafariRTCPeerConnection.prototype.createOffer = function createOffer(options) {
  options = Object.assign({}, options);
  var self = this;

  // NOTE(mroberts): In general, this is not the way to do this; however, it's
  // good enough for our application.
  if (options.offerToReceiveAudio && !this._audioTransceiver) {
    delete options.offerToReceiveAudio;
    this._audioTransceiver = this.addTransceiver('audio');
  }

  if (options.offerToReceiveVideo && !this._videoTransceiver) {
    delete options.offerToReceiveVideo;
    this._videoTransceiver = this.addTransceiver('video');
  }

  return this._peerConnection.createOffer(options).then(function(offer) {
    return new RTCSessionDescription({
      type: offer.type,
      sdp: updateTracksToSSRCs(self._tracksToSSRCs, offer.sdp)
    });
  });
};

SafariRTCPeerConnection.prototype.createAnswer = function createAnswer(options) {
  var self = this;

  if (this._pendingRemoteOffer) {
    return this._peerConnection.setRemoteDescription(this._pendingRemoteOffer).then(function setRemoteDescriptionSucceeded() {
      self._signalingStateLatch.lower();
      return self._peerConnection.createAnswer();
    }).then(function createAnswerSucceeded(answer) {
      self._pendingRemoteOffer = null;
      return answer;
    }, function setRemoteDescriptionOrCreateAnswerFailed(error) {
      self._pendingRemoteOffer = null;
      throw error;
    });
  }

  return this._peerConnection.createAnswer(options);
};

SafariRTCPeerConnection.prototype.createDataChannel = function createDataChannel(label, dataChannelDict) {
  var dataChannel = this._peerConnection.createDataChannel(label, dataChannelDict);
  shimDataChannel(dataChannel);
  return dataChannel;
};

SafariRTCPeerConnection.prototype.setLocalDescription = function setLocalDescription(description) {
  return setDescription(this, true, description);
};

SafariRTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(description) {
  return setDescription(this, false, description);
};

SafariRTCPeerConnection.prototype.close = function close() {
  if (this._isClosed) {
    return;
  }
  this._isClosed = true;
  this._peerConnection.close();
  var self = this;
  setTimeout(function() {
    self.dispatchEvent(new Event('iceconnectionstatechange'));
    self.dispatchEvent(new Event('signalingstatechange'));
  });
};

// NOTE(mmalavalli): Because we are not delegating to the native
// RTCPeerConnection#removeTrack(), we have to manually maintain a list of added
// tracks. So we disable the delegation to the native RTCPeerConnection#addTrack()
// for now. Also, we maintain only one RTCRtpSender per MediaStreamTrack for our
// use case, and not worry about multiple RTCRtpSenders due to replaceTrack().
SafariRTCPeerConnection.prototype.addTrack = function addTrack() {
  var args = [].slice.call(arguments);
  var track = args[0];
  var sender = this._senders.get(track);
  if (sender && sender.track) {
    throw new Error('Cannot add MediaStreamTrack [' + track.id + ', '
      + track.kind + ']: RTCPeerConnection already has it');
  }
  sender = getActiveSenders(this._peerConnection).get(track)
    || this._peerConnection.addTrack.apply(this._peerConnection, args);

  // NOTE(mmalavalli): webrtc-adapter has a bug where the "addTrack" shim
  // does not return an RTCRtpSender and returns undefined instead. An issue
  // [https://github.com/webrtc/adapter/issues/714] has been filed. For now,
  // we manually get the RTCRtpSender associated with the added track and
  // return it.
  sender = sender || getActiveSenders(this._peerConnection).get(track);
  this._senders.set(track, sender);
  return sender;
};

// NOTE(mroberts): We can't really remove tracks right now, at least if we
// ever want to add them back...
//
//     https://bugs.webkit.org/show_bug.cgi?id=174327
//
SafariRTCPeerConnection.prototype.removeTrack = function removeTrack(sender) {
  if (this._isClosed) {
    throw new Error('Cannot remove MediaStreamTrack: RTCPeerConnection is closed');
  }
  var track = sender.track;
  if (!track) {
    return;
  }
  sender = this._senders.get(track);
  if (sender && sender.track) {
    this._senders.set(track, new RTCRtpSenderShim(null));
  }
};

// NOTE(mmalavalli): Because we are not delegating to the native
// RTCPeerConnection#removeTrack(), we have to manually maintain a list of added
// tracks. So we disable the delegation to the native RTCPeerConnection#getSenders()
// for now.
SafariRTCPeerConnection.prototype.getSenders = function getSenders() {
  return Array.from(this._senders.values());
};

util.delegateMethods(
  RTCPeerConnection.prototype,
  SafariRTCPeerConnection.prototype,
  '_peerConnection');

function setDescription(peerConnection, local, description) {
  function setPendingLocalOffer(offer) {
    if (local) {
      peerConnection._pendingLocalOffer = offer;
    } else {
      peerConnection._pendingRemoteOffer = offer;
    }
  }

  function clearPendingLocalOffer() {
    if (local) {
      peerConnection._pendingLocalOffer = null;
    } else {
      peerConnection._pendingRemoteOffer = null;
    }
  }

  var pendingLocalOffer = local ? peerConnection._pendingLocalOffer : peerConnection._pendingRemoteOffer;
  var pendingRemoteOffer = local ? peerConnection._pendingRemoteOffer : peerConnection._pendingLocalOffer;
  var intermediateState = local ? 'have-local-offer' : 'have-remote-offer';
  var setLocalDescription = local ? 'setLocalDescription' : 'setRemoteDescription';

  if (!local && pendingRemoteOffer && description.type === 'answer') {
    return setRemoteAnswer(peerConnection, description);
  } else if (description.type === 'offer') {
    if (peerConnection.signalingState !== intermediateState && peerConnection.signalingState !== 'stable') {
      return Promise.reject(new Error('Cannot set ' + (local ? 'local' : 'remote') +
        ' offer in state ' + peerConnection.signalingState));
    }

    if (!pendingLocalOffer && peerConnection._signalingStateLatch.state === 'low') {
      peerConnection._signalingStateLatch.raise();
    }
    var previousSignalingState = peerConnection.signalingState;
    setPendingLocalOffer(description);

    // Only dispatch a signalingstatechange event if we transitioned.
    if (peerConnection.signalingState !== previousSignalingState) {
      return Promise.resolve().then(function dispatchSignalingStateChangeEvent() {
        peerConnection.dispatchEvent(new Event('signalingstatechange'));
      });
    }

    return Promise.resolve();
  } else if (description.type === 'rollback') {
    if (peerConnection.signalingState !== intermediateState) {
      return Promise.reject(new Error('Cannot rollback ' +
        (local ? 'local' : 'remote') + ' description in ' + peerConnection.signalingState));
    }
    clearPendingLocalOffer();
    return Promise.resolve().then(function dispatchSignalingStateChangeEvent() {
      peerConnection.dispatchEvent(new Event('signalingstatechange'));
    });
  }

  return peerConnection._peerConnection[setLocalDescription](description);
}

function setRemoteAnswer(peerConnection, answer) {
  var pendingLocalOffer = peerConnection._pendingLocalOffer;
  return peerConnection._peerConnection.setLocalDescription(pendingLocalOffer).then(function setLocalOfferSucceeded() {
    peerConnection._pendingLocalOffer = null;
    return peerConnection.setRemoteDescription(answer);
  }).then(function setRemoteAnswerSucceeded() {
    peerConnection._signalingStateLatch.lower();
  });
}

/**
 * Shim an RTCDataChannel. This function mutates the RTCDataChannel.
 * @param {RTCDataChannel} dataChannel
 * @returns {RTCDataChannel}
 */
function shimDataChannel(dataChannel) {
  return Object.defineProperties(dataChannel, {
    maxPacketLifeTime: {
      value: dataChannel.maxPacketLifeTime === 65535
        ? null
        : dataChannel.maxPacketLifeTime
    },
    maxRetransmits: {
      value: dataChannel.maxRetransmits === 65535
        ? null
        : dataChannel.maxRetransmits
    }
  });
}

/**
 * Gets the active RTCRtpSenders of the RTCPeerConnection.
 * @param peerConnection
 * @returns {Map<MediaStreamTrack, RTCRtpSender>}
 */
function getActiveSenders(peerConnection) {
  return new Map(peerConnection.getSenders().filter(function(sender) {
    return sender.track;
  }).map(function(sender) {
    return [sender.track, sender];
  }));
}

module.exports = SafariRTCPeerConnection;

},{"../rtcrtpsender":133,"../util":138,"../util/eventtarget":137,"../util/latch":139,"../util/sdp":140,"util":146}],133:[function(require,module,exports){
'use strict';

/**
 * RTCRtpSender shim.
 * @param {MediaStreamTrack} track
 * @property {MediaStreamTrack} track
 */
function RTCRtpSenderShim(track) {
  Object.defineProperties(this, {
    track: {
      enumerable: true,
      value: track,
      writable: true
    }
  });
}

// NOTE(mmalavalli): Because of the way we will be using this shim, there
// are a couple of use cases that will not be covered:
//
// /* Case 1 */
// const sender = pc.addTrack(track);
// assert.equal(sender.track, track);
// pc.removeTrack(sender);
// assert.equal(sender.track, null); /* Error */
//
// /* Case 2 */
// const sender = pc.addTrack(track);
// const senders1 = new Set(pc.getSenders());
// assert(senders1.has(sender));
// pc.removeTrack(track);
// const senders2 = new Set(pc.getSenders());
// assert(senders2.has(sender)); /* Error */
//
// For now, since we only use senders for passing them to RTCPeerConnection#removeTrack(),
// we will omit handling these use cases for now, and revisit them when we start
// using the RTCRtpSender APIs.

module.exports = RTCRtpSenderShim;

},{}],134:[function(require,module,exports){
/* globals RTCSessionDescription */
'use strict';

// This class wraps Chrome's RTCSessionDescription implementation. It provides
// one piece of functionality not currently present in Chrome, namely
//
//   1. Rollback support
//      https://bugs.chromium.org/p/webrtc/issues/detail?id=4676
//
function ChromeRTCSessionDescription(descriptionInitDict) {
  if (!(this instanceof ChromeRTCSessionDescription)) {
    return new ChromeRTCSessionDescription(descriptionInitDict);
  }

  // If this constructor is called with an object with a .type property set to
  // "rollback", we should not call Chrome's RTCSessionDescription constructor,
  // because this would throw an RTCSdpType error.
  var description = descriptionInitDict && descriptionInitDict.type === 'rollback'
    ? null
    : new RTCSessionDescription(descriptionInitDict);

  Object.defineProperties(this, {
    _description: {
      get: function() {
        return description;
      }
    },
    sdp: {
      enumerable: true,
      value: description ? description.sdp : descriptionInitDict.sdp
    },
    type: {
      enumerable: true,
      value: description ? description.type : descriptionInitDict.type
    }
  });
}

module.exports = ChromeRTCSessionDescription;

},{}],135:[function(require,module,exports){
/* globals mozRTCSessionDescription, RTCSessionDescription */
'use strict';

module.exports = typeof RTCSessionDescription !== 'undefined'
  ? RTCSessionDescription
  : mozRTCSessionDescription;

},{}],136:[function(require,module,exports){
'use strict';

var guessBrowser = require('../util').guessBrowser;

switch (guessBrowser()) {
  case 'chrome':
    module.exports = require('./chrome');
    break;
  case 'firefox':
    module.exports = require('./firefox');
    break;
  default:
    if (typeof RTCSessionDescription === 'undefined') {
      break;
    }
    module.exports = RTCSessionDescription;
}

},{"../util":138,"./chrome":134,"./firefox":135}],137:[function(require,module,exports){
'use strict';

var EventEmitter = require('events').EventEmitter;

/**
 * Event target.
 * @class
 */
function EventTarget() {
  Object.defineProperties(this, {
    _eventEmitter: {
      value: new EventEmitter()
    }
  });
}

/**
 * Dispatch an Event to the {@link EventTarget}.
 * @param {Event} event
 */
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
  return this._eventEmitter.emit(event.type, event);
};

/**
 * Add an Event listener to the {@link EventTarget}.
 */
EventTarget.prototype.addEventListener = function addEventListener() {
  return this._eventEmitter.addListener.apply(this._eventEmitter, arguments);
};

/**
 * Remove an Event listener to the {@link EventTarget}.
 */
EventTarget.prototype.removeEventListener = function removeEventListener() {
  return this._eventEmitter.removeListener.apply(this._eventEmitter, arguments);
};

module.exports = EventTarget;

},{"events":142}],138:[function(require,module,exports){
'use strict';

/**
 * Create a {@link Deferred}.
 * @returns {Deferred}
 */
function defer() {
  var deferred = {};
  deferred.promise = new Promise(function(resolve, reject) {
    deferred.resolve = resolve;
    deferred.reject = reject;
  });
  return deferred;
}

/**
 * Copy a method from a `source` prototype onto a `wrapper` prototype. Invoking
 * the method on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} methodName
 * @returns {undefined}
 */
function delegateMethod(source, wrapper, target, methodName) {
  if (methodName in wrapper) {
    // Skip any methods already set.
    return;
  } else if (methodName.match(/^on[a-z]+$/)) {
    // Skip EventHandlers (these are handled in the constructor).
    return;
  }

  var type;
  try {
    type = typeof source[methodName];
  } catch (error) {
    // NOTE(mroberts): Attempting to check the type of non-function members
    // on the prototype throws an error for some types.
  }

  if (type !== 'function') {
    // Skip non-function members.
    return;
  }

  /* eslint no-loop-func:0 */
  wrapper[methodName] = function() {
    return this[target][methodName].apply(this[target], arguments);
  };
}

/**
 * Copy methods from a `source` prototype onto a `wrapper` prototype. Invoking
 * the methods on the `wrapper` prototype will invoke the corresponding method
 * on an instance accessed by `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function delegateMethods(source, wrapper, target) {
  for (var methodName in source) {
    delegateMethod(source, wrapper, target, methodName);
  }
}

/**
 * Finds the items in list1 that are not in list2.
 * @param {Array<*>|Map<*>|Set<*>} list1
 * @param {Array<*>|Map<*>|Set<*>} list2
 * @returns {Set}
 */
function difference(list1, list2) {
  list1 = Array.isArray(list1) ? new Set(list1) : new Set(list1.values());
  list2 = Array.isArray(list2) ? new Set(list2) : new Set(list2.values());

  var difference = new Set();

  list1.forEach(function(item) {
    if (!list2.has(item)) {
      difference.add(item);
    }
  });

  return difference;
}

/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} mapFn
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
  var listArray = list instanceof Map || list instanceof Set
    ? Array.from(list.values())
    : list;

  return listArray.reduce(function(flattened, item) {
    var mapped = mapFn(item);
    return flattened.concat(mapped);
  }, []);
}

/**
 * Guess the browser.
 * @returns {?string} browser - "chrome", "firefox", "safari", or null
 */
function guessBrowser() {
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    return 'chrome';
  } else if (typeof mozRTCPeerConnection !== 'undefined') {
    return 'firefox';
  } else if (typeof RTCPeerConnection !== 'undefined') {
    if (typeof navigator !== 'undefined' && navigator.userAgent.match(/AppleWebKit\/(\d+)\./)) {
      return 'safari';
    }
    // NOTE(mroberts): Could be Edge.
  }
  return null;
}

/**
 * Intercept an event that might otherwise be proxied on an EventTarget.
 * @param {EventTarget} target
 * @param {string} type
 * @returns {void}
 */
function interceptEvent(target, type) {
  var currentListener = null;
  Object.defineProperty(target, 'on' + type, {
    get: function() {
      return currentListener;
    },
    set: function(newListener) {
      if (currentListener) {
        this.removeEventListener(type, currentListener);
      }

      if (typeof newListener === 'function') {
        currentListener = newListener;
        this.addEventListener(type, currentListener);
      } else {
        currentListener = null;
      }
    }
  });
}

/**
 * This is a function for turning a Promise into the kind referenced in the
 * Legacy Interface Extensions section of the WebRTC spec.
 * @param {Promise<*>} promise
 * @param {function<*>} onSuccess
 * @param {function<Error>} onFailure
 * @returns {Promise<undefined>}
 */
function legacyPromise(promise, onSuccess, onFailure) {
  if (onSuccess) {
    return promise.then(function(result) {
      onSuccess(result);
    }, function(error) {
      onFailure(error);
    });
  }
  return promise;
}

/**
 * Make a unique ID.
 * @return {string}
 */
function makeUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * For each property name on the `source` prototype, add getters and/or setters
 * to `wrapper` that proxy to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @returns {undefined}
 */
function proxyProperties(source, wrapper, target) {
  Object.getOwnPropertyNames(source).forEach(function(propertyName) {
    proxyProperty(source, wrapper, target, propertyName);
  });
}

/**
 * For the property name on the `source` prototype, add a getter and/or setter
 * to `wrapper` that proxies to `target`.
 * @param {object} source
 * @param {object} wrapper
 * @param {string} target
 * @param {string} propertyName
 * @returns {undefined}
 */
function proxyProperty(source, wrapper, target, propertyName) {
  if (propertyName in wrapper) {
    // Skip any properties already set.
    return;
  } else if (propertyName.match(/^on[a-z]+$/)) {
    Object.defineProperty(wrapper, propertyName, {
      value: null,
      writable: true
    });

    target.addEventListener(propertyName.slice(2), function() {
      wrapper.dispatchEvent.apply(wrapper, arguments);
    });

    return;
  }

  Object.defineProperty(wrapper, propertyName, {
    enumerable: true,
    get: function() {
      return target[propertyName];
    }
  });
}

/**
 * @typedef {object} Deferred
 * @property {Promise} promise
 * @property {function} reject
 * @property {function} resolve
 */

exports.defer = defer;
exports.delegateMethods = delegateMethods;
exports.difference = difference;
exports.flatMap = flatMap;
exports.guessBrowser = guessBrowser;
exports.interceptEvent = interceptEvent;
exports.legacyPromise = legacyPromise;
exports.makeUUID = makeUUID;
exports.proxyProperties = proxyProperties;

},{}],139:[function(require,module,exports){
'use strict';

var defer = require('./').defer;

var states = {
  high: new Set(['low']),
  low: new Set(['high'])
};

/**
 * Construct a {@link Latch}.
 * @class
 * @classdesc A {@link Latch} has two states ("high" and "low") and methods for
 * transitioning between them ({@link Latch#raise} and {@link Latch#lower}).
 * @param {string} [initialState="low"] - either "high" or "low"
 */
function Latch(initialState) {
  if (!(this instanceof Latch)) {
    return new Latch(initialState);
  }
  var state = initialState || 'low';
  Object.defineProperties(this, {
    _state: {
      set: function(_state) {
        if (state !== _state) {
          state = _state;
          var whenDeferreds = this._whenDeferreds.get(state);
          whenDeferreds.forEach(function(deferred) {
            deferred.resolve(this);
          }, this);
          whenDeferreds.clear();
        }
      },
      get: function() {
        return state;
      }
    },
    _whenDeferreds: {
      value: new Map([
        ['high', new Set()],
        ['low', new Set()]
      ])
    },
    state: {
      enumerable: true,
      get: function() {
        return this._state;
      }
    }
  });
}

/**
 * Transition to "low".
 * @returns {this}
 * @throws {Error}
 */
Latch.prototype.lower = function lower() {
  return this.transition('low');
};

/**
 * Transition to "high".
 * @returns {this}
 * @throws {Error}
 */
Latch.prototype.raise = function raise() {
  return this.transition('high');
};

/**
 * Transition to a new state.
 * @param {string} newState
 * @returns {this}
 * @throws {Error}
 */
Latch.prototype.transition = function transition(newState) {
  if (!states[this.state].has(newState)) {
    throw createUnreachableStateError(this.state, newState);
  }
  this._state = newState;
  return this;
};

/**
 * Return a Promise that resolves when the {@link Latch} transitions to
 * the specified state.
 * @param {string} state
 * @returns {Promise<this>}
 */
Latch.prototype.when = function when(state) {
  if (this.state === state) {
    return Promise.resolve(this);
  }
  if (!states[this.state].has(state)) {
    return Promise.reject(createUnreachableStateError(this.state, state));
  }
  var deferred = defer();
  this._whenDeferreds.get(state).add(deferred);
  return deferred.promise;
};

/**
 * Create an unreachable state Error.
 * @param {string} from - state to be transitioned from
 * @param {string} to - state to be transitioned to
 * @return {Error}
 */
function createUnreachableStateError(from, to) {
  return new Error('Cannot transition from "' + from + '" to "' + to + '"');
}

module.exports = Latch;

},{"./":138}],140:[function(require,module,exports){
'use strict';

var flatMap = require('./').flatMap;

/**
 * Match a pattern across lines, returning the first capture group for any
 * matches.
 * @param {string} pattern
 * @param {string} lines
 * @returns {Set<string>} matches
 */
function getMatches(pattern, lines) {
  var matches = lines.match(new RegExp(pattern, 'gm')) || [];
  return matches.reduce(function(results, line) {
    var match = line.match(new RegExp(pattern));
    return match ? results.add(match[1]) : results;
  }, new Set());
}

/**
 * Get a Set of MediaStreamTrack IDs from an SDP.
 * @param {string} pattern
 * @param {string} sdp
 * @returns {Set<string>}
 */
function getTrackIds(pattern, sdp) {
  return getMatches(pattern, sdp);
}

/**
 * Get a Set of MediaStreamTrack IDs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Set<string>} trackIds
 */
function getPlanBTrackIds(sdp) {
  return getTrackIds('^a=ssrc:[0-9]+ +msid:.+ +(.+) *$', sdp);
}

/**
 * Get a Set of MediaStreamTrack IDs from a Unified Plan SDP.
 * @param {string} sdp - Unified Plan SDP
 * @returns {Set<string>} trackIds
 */
function getUnifiedPlanTrackIds(sdp) {
  return getTrackIds('^a=msid:.+ +(.+) *$', sdp);
}

/**
 * Get a Set of SSRCs for a MediaStreamTrack from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @param {string} trackId - MediaStreamTrack ID
 * @returns {Set<string>}
 */
function getPlanBSSRCs(sdp, trackId) {
  var pattern = '^a=ssrc:([0-9]+) +msid:[^ ]+ +' + trackId + ' *$';
  return getMatches(pattern, sdp);
}

/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp -  sdp string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
  kind = kind || '.*';
  direction = direction || '.*';
  return sdp.split('\r\nm=').slice(1).map(function(mediaSection) {
    return 'm=' + mediaSection;
  }).filter(function(mediaSection) {
    var kindPattern = new RegExp('m=' + kind, 'gm');
    var directionPattern = new RegExp('a=' + direction, 'gm');
    return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
  });
}

/**
 * Get the Set of SSRCs announced in a MediaSection.
 * @param {string} mediaSection
 * @returns {Array<string>} ssrcs
 */
function getMediaSectionSSRCs(mediaSection) {
  return Array.from(getMatches('^a=ssrc:([0-9]+) +.*$', mediaSection));
}

/**
 * Get a Set of SSRCs for a MediaStreamTrack from a Unified Plan SDP.
 * @param {string} sdp - Unified Plan SDP
 * @param {string} trackId - MediaStreamTrack ID
 * @returns {Set<string>}
 */
function getUnifiedPlanSSRCs(sdp, trackId) {
  var mediaSections = getMediaSections(sdp);

  var msidAttrRegExp = new RegExp('^a=msid:[^ ]+ +' + trackId + ' *$', 'gm');
  var matchingMediaSections = mediaSections.filter(function(mediaSection) {
    return mediaSection.match(msidAttrRegExp);
  });

  return new Set(flatMap(matchingMediaSections, getMediaSectionSSRCs));
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from an SDP.
 * @param {function(string): Set<string>} getTrackIds
 * @param {function(string, string): Set<string>} getSSRCs
 * @param {string} sdp - SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getTrackIdsToSSRCs(getTrackIds, getSSRCs, sdp) {
  return new Map(Array.from(getTrackIds(sdp)).map(function(trackId) {
    return [trackId, getSSRCs(sdp, trackId)];
  }));
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getPlanBTrackIdsToSSRCs(sdp) {
  return getTrackIdsToSSRCs(getPlanBTrackIds, getPlanBSSRCs, sdp);
}

/**
 * Get a Map from MediaStreamTrack IDs to SSRCs from a Plan B SDP.
 * @param {string} sdp - Plan B SDP
 * @returns {Map<string, Set<string>>} trackIdsToSSRCs
 */
function getUnifiedPlanTrackIdsToSSRCs(sdp) {
  return getTrackIdsToSSRCs(getUnifiedPlanTrackIds, getUnifiedPlanSSRCs, sdp);
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the SDP itself. This method
 * ensures that SSRCs never change once announced.
 * @param {function(string): Map<string, Set<string>>} getTrackIdsToSSRCs
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - SDP
 * @returns {strinng} updatedSdp - updated SDP
 */
function updateTrackIdsToSSRCs(getTrackIdsToSSRCs, trackIdsToSSRCs, sdp) {
  var newTrackIdsToSSRCs = getTrackIdsToSSRCs(sdp);
  var newSSRCsToOldSSRCs = new Map();

  // NOTE(mroberts): First, update a=ssrc attributes.
  newTrackIdsToSSRCs.forEach(function(ssrcs, trackId) {
    if (!trackIdsToSSRCs.has(trackId)) {
      trackIdsToSSRCs.set(trackId, ssrcs);
      return;
    }
    var oldSSRCs = Array.from(trackIdsToSSRCs.get(trackId));
    var newSSRCs = Array.from(ssrcs);
    oldSSRCs.forEach(function(oldSSRC, i) {
      var newSSRC = newSSRCs[i];
      newSSRCsToOldSSRCs.set(newSSRC, oldSSRC);
      var pattern = '^a=ssrc:' + newSSRC + ' (.*)$';
      var replacement = 'a=ssrc:' + oldSSRC + ' $1';
      sdp = sdp.replace(new RegExp(pattern, 'gm'), replacement);
    });
  });

  // NOTE(mroberts): Then, update a=ssrc-group attributes.
  var pattern = '^(a=ssrc-group:[^ ]+ +)(.*)$';
  var matches = sdp.match(new RegExp(pattern, 'gm')) || [];
  matches.forEach(function(line) {
    var match = line.match(new RegExp(pattern));
    if (!match) {
      return;
    }
    var prefix = match[1];
    var newSSRCs = match[2];
    var oldSSRCs = newSSRCs.split(' ').map(function(newSSRC) {
      var oldSSRC = newSSRCsToOldSSRCs.get(newSSRC);
      return oldSSRC ? oldSSRC : newSSRC;
    }).join(' ');
    sdp = sdp.replace(match[0], prefix + oldSSRCs);
  });

  return sdp;
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the Plan B SDP itself. This
 * method ensures that SSRCs never change once announced.
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - Plan B SDP
 * @returns {string} updatedSdp - updated Plan B SDP
 */
function updatePlanBTrackIdsToSSRCs(trackIdsToSSRCs, sdp) {
  return updateTrackIdsToSSRCs(getPlanBTrackIdsToSSRCs, trackIdsToSSRCs, sdp);
}

/**
 * Update the mappings from MediaStreamTrack IDs to SSRCs as indicated by both
 * the Map from MediaStreamTrack IDs to SSRCs and the Plan B SDP itself. This
 * method ensures that SSRCs never change once announced.
 * @param {Map<string, Set<string>>} trackIdsToSSRCs
 * @param {string} sdp - Plan B SDP
 * @returns {string} updatedSdp - updated Plan B SDP
 */
function updateUnifiedPlanTrackIdsToSSRCs(trackIdsToSSRCs, sdp) {
  return updateTrackIdsToSSRCs(getUnifiedPlanTrackIdsToSSRCs, trackIdsToSSRCs, sdp);
}

exports.getMediaSections = getMediaSections;
exports.getPlanBTrackIds = getPlanBTrackIds;
exports.getUnifiedPlanTrackIds = getUnifiedPlanTrackIds;
exports.getPlanBSSRCs = getPlanBSSRCs;
exports.getUnifiedPlanSSRCs = getUnifiedPlanSSRCs;
exports.updatePlanBTrackIdsToSSRCs = updatePlanBTrackIdsToSSRCs;
exports.updateUnifiedPlanTrackIdsToSSRCs = updateUnifiedPlanTrackIdsToSSRCs;

},{"./":138}],141:[function(require,module,exports){
module.exports={
  "_args": [
    [
      {
        "raw": "@twilio/webrtc@^2.0.0",
        "scope": "@twilio",
        "escapedName": "@twilio%2fwebrtc",
        "name": "@twilio/webrtc",
        "rawSpec": "^2.0.0",
        "spec": ">=2.0.0 <3.0.0",
        "type": "range"
      },
      "/home/travis/build/twilio/twilio-video.js"
    ]
  ],
  "_from": "@twilio/webrtc@>=2.0.0 <3.0.0",
  "_id": "@twilio/webrtc@2.0.0",
  "_inCache": true,
  "_location": "/@twilio/webrtc",
  "_nodeVersion": "7.10.1",
  "_npmOperationalInternal": {
    "host": "s3://npm-registry-packages",
    "tmp": "tmp/webrtc-2.0.0.tgz_1515518966270_0.21925474982708693"
  },
  "_npmUser": {
    "name": "twilio-ci",
    "email": "mroberts+twilio-ci@twilio.com"
  },
  "_npmVersion": "4.2.0",
  "_phantomChildren": {},
  "_requested": {
    "raw": "@twilio/webrtc@^2.0.0",
    "scope": "@twilio",
    "escapedName": "@twilio%2fwebrtc",
    "name": "@twilio/webrtc",
    "rawSpec": "^2.0.0",
    "spec": ">=2.0.0 <3.0.0",
    "type": "range"
  },
  "_requiredBy": [
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/@twilio/webrtc/-/webrtc-2.0.0.tgz",
  "_shasum": "ae96446b2e9e2932bb3838d5ccb7dba4752bc158",
  "_shrinkwrap": null,
  "_spec": "@twilio/webrtc@^2.0.0",
  "_where": "/home/travis/build/twilio/twilio-video.js",
  "author": {
    "name": "Manjesh Malavalli",
    "email": "mmalavalli@twilio.com"
  },
  "bugs": {
    "url": "https://github.com/twilio/twilio-webrtc.js/issues"
  },
  "contributors": [
    {
      "name": "Mark Roberts",
      "email": "mroberts@twilio.com"
    },
    {
      "name": "Ryan Rowland",
      "email": "rrowland@twilio.com"
    }
  ],
  "dependencies": {},
  "description": "WebRTC-related APIs and shims used by twilio-video.js",
  "devDependencies": {
    "browserify": "^14.4.0",
    "envify": "^4.1.0",
    "eslint": "^4.4.1",
    "istanbul": "^0.4.5",
    "karma": "^1.7.0",
    "karma-browserify": "^5.1.1",
    "karma-chrome-launcher": "^2.2.0",
    "karma-firefox-launcher": "^1.0.1",
    "karma-mocha": "^1.3.0",
    "karma-safaritechpreview-launcher": "0.0.6",
    "karma-spec-reporter": "0.0.31",
    "mocha": "^3.5.0",
    "npm-run-all": "^4.0.2",
    "release-tool": "^0.2.2",
    "rimraf": "^2.6.1",
    "travis-multirunner": "^4.2.3",
    "watchify": "^3.9.0",
    "webrtc-adapter": "^6.0.1"
  },
  "directories": {},
  "dist": {
    "shasum": "ae96446b2e9e2932bb3838d5ccb7dba4752bc158",
    "tarball": "https://registry.npmjs.org/@twilio/webrtc/-/webrtc-2.0.0.tgz"
  },
  "gitHead": "411352358f50f0004cd6e409a114988fce20eb19",
  "homepage": "https://github.com/twilio/twilio-webrtc.js#readme",
  "keywords": [
    "shim",
    "twilio",
    "video",
    "webrtc"
  ],
  "license": "BSD-3-Clause",
  "main": "./lib/index.js",
  "maintainers": [
    {
      "name": "twilio-ci",
      "email": "mroberts+twilio-ci@twilio.com"
    }
  ],
  "name": "@twilio/webrtc",
  "optionalDependencies": {},
  "readme": "ERROR: No README data found!",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/twilio/twilio-webrtc.js.git"
  },
  "scripts": {
    "build": "npm-run-all clean lint test",
    "clean": "rimraf coverage",
    "lint": "eslint ./lib",
    "test": "npm-run-all test:*",
    "test:integration": "npm-run-all test:integration:*",
    "test:integration:adapter": "karma start karma/integration.adapter.conf.js",
    "test:integration:native": "karma start karma/integration.conf.js",
    "test:unit": "istanbul cover node_modules/mocha/bin/_mocha -- ./test/unit/index.js"
  },
  "version": "2.0.0"
}

},{}],142:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],143:[function(require,module,exports){
// shim for using process in browser
var process = module.exports = {};

// cached from whatever global is present so that test runners that stub it
// don't break things.  But we need to wrap it in a try catch in case it is
// wrapped in strict mode code which doesn't define any globals.  It's inside a
// function because try/catches deoptimize in certain engines.

var cachedSetTimeout;
var cachedClearTimeout;

function defaultSetTimout() {
    throw new Error('setTimeout has not been defined');
}
function defaultClearTimeout () {
    throw new Error('clearTimeout has not been defined');
}
(function () {
    try {
        if (typeof setTimeout === 'function') {
            cachedSetTimeout = setTimeout;
        } else {
            cachedSetTimeout = defaultSetTimout;
        }
    } catch (e) {
        cachedSetTimeout = defaultSetTimout;
    }
    try {
        if (typeof clearTimeout === 'function') {
            cachedClearTimeout = clearTimeout;
        } else {
            cachedClearTimeout = defaultClearTimeout;
        }
    } catch (e) {
        cachedClearTimeout = defaultClearTimeout;
    }
} ())
function runTimeout(fun) {
    if (cachedSetTimeout === setTimeout) {
        //normal enviroments in sane situations
        return setTimeout(fun, 0);
    }
    // if setTimeout wasn't available but was latter defined
    if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
        cachedSetTimeout = setTimeout;
        return setTimeout(fun, 0);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedSetTimeout(fun, 0);
    } catch(e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
            return cachedSetTimeout.call(null, fun, 0);
        } catch(e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
            return cachedSetTimeout.call(this, fun, 0);
        }
    }


}
function runClearTimeout(marker) {
    if (cachedClearTimeout === clearTimeout) {
        //normal enviroments in sane situations
        return clearTimeout(marker);
    }
    // if clearTimeout wasn't available but was latter defined
    if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
        cachedClearTimeout = clearTimeout;
        return clearTimeout(marker);
    }
    try {
        // when when somebody has screwed with setTimeout but no I.E. maddness
        return cachedClearTimeout(marker);
    } catch (e){
        try {
            // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
            return cachedClearTimeout.call(null, marker);
        } catch (e){
            // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
            // Some versions of I.E. have different rules for clearTimeout vs setTimeout
            return cachedClearTimeout.call(this, marker);
        }
    }



}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = runTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    runClearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        runTimeout(drainQueue);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;
process.prependListener = noop;
process.prependOnceListener = noop;

process.listeners = function (name) { return [] }

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],144:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],145:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],146:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":145,"_process":143,"inherits":144}],147:[function(require,module,exports){
module.exports={
  "name": "twilio-video",
  "title": "Twilio Video",
  "description": "Twilio Video JavaScript library",
  "version": "1.7.0",
  "homepage": "https://twilio.com",
  "author": "Mark Andrus Roberts <mroberts@twilio.com>",
  "contributors": [
    "Ryan Rowland <rrowland@twilio.com>",
    "Manjesh Malavalli <mmalavalli@twilio.com>"
  ],
  "keywords": [
    "twilio",
    "webrtc",
    "library",
    "javascript",
    "video",
    "rooms"
  ],
  "repository": {
    "type": "git",
    "url": "https://github.com/twilio/twilio-video.js.git"
  },
  "devDependencies": {
    "browserify": "^14.3.0",
    "cheerio": "^0.22.0",
    "chromedriver": "2.28.0",
    "envify": "^4.0.0",
    "eslint": "^4.9.0",
    "geckodriver": "1.4.0",
    "ink-docstrap": "^1.3.0",
    "istanbul": "^0.4.5",
    "jsdoc": "^3.4.3",
    "karma": "^1.6.0",
    "karma-browserify": "^5.1.1",
    "karma-chrome-launcher": "^2.0.0",
    "karma-firefox-launcher": "^1.0.1",
    "karma-mocha": "^1.3.0",
    "karma-safaritechpreview-launcher": "0.0.6",
    "karma-spec-reporter": "^0.0.31",
    "mocha": "^3.2.0",
    "npm-run-all": "^4.0.2",
    "phantom": "^4.0.2",
    "release-tool": "^0.2.2",
    "requirejs": "^2.3.3",
    "rimraf": "^2.6.1",
    "selenium-webdriver": "3.3.0",
    "sinon": "^4.0.1",
    "travis-multirunner": "^4.0.0",
    "twilio": "^2.11.1",
    "uglify-js": "^2.8.22",
    "vinyl-fs": "^2.4.4",
    "vinyl-source-stream": "^1.1.0",
    "webrtc-adapter": "^4.1.1"
  },
  "engines": {
    "node": ">=0.12"
  },
  "license": "BSD-3-Clause",
  "main": "./lib/index.js",
  "scripts": {
    "lint": "eslint ./lib ./test/*.js ./test/framework/*.js ./test/lib/*.js ./test/integration/** ./test/unit/**",
    "test:unit": "mocha ./test/unit/index.js",
    "test:integration:adapter": "node ./scripts/karma.js karma/integration.adapter.conf.js",
    "test:integration:travis": "node ./scripts/integration.js",
    "test:integration": "node ./scripts/karma.js karma/integration.conf.js",
    "test:umd": "mocha ./test/umd/index.js",
    "test:framework:angular:install": "cd ./test/framework/twilio-video-angular && rimraf ./node_modules && npm install",
    "test:framework:angular:test": "node ./scripts/framework.js twilio-video-angular",
    "test:framework:angular:run": "mocha ./test/framework/twilio-video-angular.js",
    "test:framework:angular": "npm-run-all test:framework:angular:*",
    "test:framework:meteor:install": "cd ./test/framework/twilio-video-meteor && rimraf ./node_modules && npm install",
    "test:framework:meteor:test": "node ./scripts/framework.js twilio-video-meteor",
    "test:framework:meteor:run": "mocha ./test/framework/twilio-video-meteor.js",
    "test:framework:meteor": "npm-run-all test:framework:meteor:*",
    "test:framework:no-framework:run": "mocha ./test/framework/twilio-video-no-framework.js",
    "test:framework:no-framework": "npm-run-all test:framework:no-framework:*",
    "test:framework:react:install": "cd ./test/framework/twilio-video-react && rimraf ./node_modules && npm install",
    "test:framework:react:test": "node ./scripts/framework.js twilio-video-react",
    "test:framework:react:build": "cd ./test/framework/twilio-video-react && npm run build",
    "test:framework:react:run": "mocha ./test/framework/twilio-video-react.js",
    "test:framework:react": "npm-run-all test:framework:react:*",
    "test:framework": "npm-run-all test:framework:angular test:framework:meteor test:framework:no-framework test:framework:react",
    "test": "npm-run-all test:unit test:integration",
    "build:js": "node ./scripts/build.js ./src/twilio-video.js ./LICENSE.md ./dist/twilio-video.js",
    "build:min.js": "uglifyjs ./dist/twilio-video.js -o ./dist/twilio-video.min.js --comments \"/^! twilio-video.js/\" -b beautify=false,ascii_only=true",
    "build": "npm-run-all clean lint docs cover test:integration build:js build:min.js test:umd",
    "build:travis": "npm-run-all clean lint docs cover test:integration:travis build:js build:min.js test:umd test:framework",
    "build:quick": "npm-run-all clean lint docs build:js build:min.js",
    "docs": "node ./scripts/docs.js ./dist/docs",
    "clean": "rimraf ./coverage ./dist",
    "cover": "istanbul cover node_modules/mocha/bin/_mocha -- ./test/unit/index.js"
  },
  "dependencies": {
    "@twilio/sip.js": "^0.7.7",
    "@twilio/webrtc": "^2.0.0",
    "ws": "^3.3.1",
    "xmlhttprequest": "^1.8.0"
  },
  "browser": {
    "ws": "./src/ws.js",
    "xmlhttprequest": "./src/xmlhttprequest.js"
  }
}

},{}],148:[function(require,module,exports){
module.exports = WebSocket;

},{}],149:[function(require,module,exports){
exports.XMLHttpRequest = XMLHttpRequest;

},{}]},{},[12]);
;
  var Video = bundle(12);
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Video; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Video = Twilio.Video || Video;
  }
})(typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : this);
