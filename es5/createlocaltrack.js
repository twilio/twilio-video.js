'use strict';

var defaultCreateLocalTracks = require('./createlocaltracks');

var _require = require('./util/constants'),
    DEFAULT_LOG_LEVEL = _require.DEFAULT_LOG_LEVEL,
    DEFAULT_LOGGER_NAME = _require.DEFAULT_LOGGER_NAME;

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
    loggerName: DEFAULT_LOGGER_NAME,
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var createOptions = {};
  createOptions.loggerName = options.loggerName;
  createOptions.logLevel = options.logLevel;
  delete options.loggerName;
  delete options.logLevel;

  var createLocalTracks = options.createLocalTracks;
  delete options.createLocalTracks;
  createOptions[kind] = Object.keys(options).length > 0 ? options : true;

  return createLocalTracks(createOptions).then(function (localTracks) {
    return localTracks[0];
  });
}

/**
 * Request a {@link LocalAudioTrack}.
 * @alias module:twilio-video.createLocalAudioTrack
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
 *     room.localParticipant.publishTrack(localTrack);
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
 * Request a {@link LocalVideoTrack}. Note that on mobile browsers,
 * the camera can be reserved by only one {@link LocalVideoTrack} at any given
 * time. If you attempt to create a second {@link LocalVideoTrack}, video frames
 * will no longer be supplied to the first {@link LocalVideoTrack}.
 * @alias module:twilio-video.createLocalVideoTrack
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
 *     room.localParticipant.publishTrack(localTrack);
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
 * Create {@link LocalTrack} options. Apart from the properties listed here, you can
 * also specify any of the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
 * properties.
 * @typedef {MediaTrackConstraints} CreateLocalTrackOptions
 * @property {LogLevel|LogLevels} [logLevel='warn'] - <code>(deprecated: use [Video.Logger](module-twilio-video.html) instead.
 *   See [examples](module-twilio-video.html#.connect) for details)</code>
 *   Set the default log verbosity
 *   of logging. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {string} [loggerName='twilio-video'] - The name of the logger. Use this name when accessing the logger used by the SDK.
 *   See [examples](module-twilio-video.html#.connect) for details.
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 * @property {boolean} [workaroundWebKitBug180748=false] - Only valid for
 *   {@link LocalAudioTrack}s; setting this attempts to workaround WebKit Bug
 *   180748, where, in Safari, getUserMedia may return a silent audio
 *   MediaStreamTrack.
 */

module.exports = {
  audio: createLocalAudioTrack,
  video: createLocalVideoTrack
};