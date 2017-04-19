'use strict';

var asLocalTrack = require('./util').asLocalTrack;
var buildLogLevels = require('./util').buildLogLevels;
var getUserMedia = require('./webrtc/getusermedia');
var LocalAudioTrack = require('./media/track/localaudiotrack');
var LocalVideoTrack = require('./media/track/localvideotrack');
var MediaStreamTrack = require('./webrtc/mediastreamtrack');
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
 * @returns {Array<LocalTrack>}
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
 *     name: 'my-room-name',
 *     tracks: localTracks
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
    LocalVideoTrack: LocalVideoTrack,
    MediaStreamTrack: MediaStreamTrack,
    Log: Log,
    video: isAudioVideoAbsent
  }, options);

  var logComponentName = '[createLocalTracks #' + ++createLocalTrackCalls + ']';
  var logLevels = buildLogLevels(options.logLevel);
  var log = new options.Log('default', logComponentName, logLevels);

  if (options.audio === false && options.video === false) {
    log.info('Neither audio nor video requested, so returning empty LocalTracks');
    return Promise.resolve([]);
  }

  if (options.tracks) {
    log.info('Adding user-provided LocalTracks');
    log.debug('LocalTracks:', options.tracks);
    return Promise.resolve(options.tracks);
  }

  return options.getUserMedia({
    audio: options.audio,
    video: options.video
  }).then(function(mediaStream) {
    var mediaStreamTracks = mediaStream.getTracks();

    log.info('Call to getUserMedia successful; got MediaStreamTracks:',
      mediaStreamTracks);

    return mediaStreamTracks.map(function(mediaStreamTrack) {
      return asLocalTrack(mediaStreamTrack, Object.assign({ log: log }, options));
    });
  }, function(error) {
    log.warn('Call to getUserMedia failed:', error);
    throw error;
  });
}

/**
 * {@link createLocalTracks} options
 * @typedef {object} CreateLocalTracksOptions
 * @property {boolean} [audio=true] - Whether or not to get local audio
 *   with <code>getUserMedia</code> when <code>tracks</code> are not
 *   provided.
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {boolean} [video=true] - Whether or not to get local video
 *   with <code>getUserMedia</code> when <code>tracks</code> are not
 *   provided.
 */

module.exports = createLocalTracks;
