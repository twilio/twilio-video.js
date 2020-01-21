'use strict';

const asLocalTrack = require('./util').asLocalTrack;
const buildLogLevels = require('./util').buildLogLevels;
const getUserMedia = require('@twilio/webrtc').getUserMedia;
const LocalAudioTrack = require('./media/track/es5/localaudiotrack');
const LocalDataTrack = require('./media/track/es5/localdatatrack');
const LocalVideoTrack = require('./media/track/es5/localvideotrack');
const MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
const Log = require('./util/log');
const DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;
const workaround180748 = require('./webaudio/workaround180748');

// This is used to make out which createLocalTracks() call a particular Log
// statement belongs to. Each call to createLocalTracks() increments this
// counter.
let createLocalTrackCalls = 0;

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
  const isAudioVideoAbsent =
    !(options && ('audio' in options || 'video' in options));

  options = Object.assign({
    audio: isAudioVideoAbsent,
    getUserMedia,
    logLevel: DEFAULT_LOG_LEVEL,
    LocalAudioTrack,
    LocalDataTrack,
    LocalVideoTrack,
    MediaStreamTrack,
    Log,
    video: isAudioVideoAbsent
  }, options);

  const logComponentName = `[createLocalTracks #${++createLocalTrackCalls}]`;
  const logLevels = buildLogLevels(options.logLevel);
  const log = new options.Log('default', logComponentName, logLevels);

  // NOTE(mmalavalli): The Room "name" in "options" was being used
  // as the LocalTrack name in asLocalTrack(). So we pass a copy of
  // "options" without the "name".
  const localTrackOptions = Object.assign({ log }, options);
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

  const localTrackNameOptions = {
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

  const mediaStreamConstraints = {
    audio: options.audio,
    video: options.video
  };

  const workaroundWebKitBug180748 = options.audio && options.audio.workaroundWebKitBug180748;

  const mediaStreamPromise = workaroundWebKitBug180748
    ? workaround180748(log, options.getUserMedia, mediaStreamConstraints)
    : options.getUserMedia(mediaStreamConstraints);

  return mediaStreamPromise.then(mediaStream => {
    const mediaStreamTracks = mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());

    log.info('Call to getUserMedia successful; got MediaStreamTracks:',
      mediaStreamTracks);

    return mediaStreamTracks.map(mediaStreamTrack => asLocalTrack(mediaStreamTrack, Object.assign(
      localTrackNameOptions[mediaStreamTrack.kind], localTrackOptions)));
  }, error => {
    log.warn('Call to getUserMedia failed:', error);
    throw error;
  });
}

/**
 * Create {@link LocalTrack} options. Apart from the properties listed here, you can
 * also specify any of the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
 * properties.
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
