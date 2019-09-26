'use strict';

const defaultCreateLocalTracks = require('./createlocaltracks');
const DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;

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

  const createOptions = {};
  createOptions.logLevel = options.logLevel;
  delete options.logLevel;

  const createLocalTracks = options.createLocalTracks;
  delete options.createLocalTracks;
  createOptions[kind] = Object.keys(options).length > 0 ? options : true;

  return createLocalTracks(createOptions).then(localTracks => localTracks[0]);
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
 * Request a {@link LocalVideoTrack}.
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
 * Create {@link LocalTrack} options.
 * @typedef {MediaTrackConstraints} CreateLocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel
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
