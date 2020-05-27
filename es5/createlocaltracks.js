'use strict';

var asLocalTrack = require('./util').asLocalTrack;
var buildLogLevels = require('./util').buildLogLevels;
var getUserMedia = require('@twilio/webrtc').getUserMedia;

var _require = require('./media/track/es5'),
    LocalAudioTrack = _require.LocalAudioTrack,
    LocalDataTrack = _require.LocalDataTrack,
    LocalVideoTrack = _require.LocalVideoTrack;

var MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
var Log = require('./util/log');
var DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;
var workaround180748 = require('./webaudio/workaround180748');

// This is used to make out which createLocalTracks() call a particular Log
// statement belongs to. Each call to createLocalTracks() increments this
// counter.
var createLocalTrackCalls = 0;

/**
 * Request {@link LocalTrack}s. By default, it requests a
 * {@link LocalAudioTrack} and a {@link LocalVideoTrack}.
 * @alias module:twilio-video.createLocalTracks
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
  var isAudioVideoAbsent = !(options && ('audio' in options || 'video' in options));

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
    audio: options.audio && options.audio.name ? { name: options.audio.name } : {},
    video: options.video && options.video.name ? { name: options.video.name } : {}
  };

  if (options.audio) {
    delete options.audio.name;
  }
  if (options.video) {
    delete options.video.name;
  }

  var mediaStreamConstraints = {
    audio: options.audio,
    video: options.video
  };

  var workaroundWebKitBug180748 = options.audio && options.audio.workaroundWebKitBug180748;

  var mediaStreamPromise = workaroundWebKitBug180748 ? workaround180748(log, options.getUserMedia, mediaStreamConstraints) : options.getUserMedia(mediaStreamConstraints);

  return mediaStreamPromise.then(function (mediaStream) {
    var mediaStreamTracks = mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());

    log.info('Call to getUserMedia successful; got MediaStreamTracks:', mediaStreamTracks);

    return mediaStreamTracks.map(function (mediaStreamTrack) {
      return asLocalTrack(mediaStreamTrack, Object.assign(localTrackNameOptions[mediaStreamTrack.kind], localTrackOptions));
    });
  }, function (error) {
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