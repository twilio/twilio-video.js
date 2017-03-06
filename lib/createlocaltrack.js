'use strict';

var createLocalTracks = require('./createlocaltracks');
var DEFAULT_LOG_LEVEL = require('./util/constants').DEFAULT_LOG_LEVEL;

/**
 * Request a {@link LocalTrack} of a particular kind.
 * @param {string} kind - 'audio' | 'video'
 * @param {CreateLocalTrackOptions} [options]
 * @returns {Promise<LocalTrack>}
 * @private
 */
function _createLocalTrack(kind, options) {
  options = Object.assign({
    createLocalTracks: createLocalTracks,
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var createOptions = {};
  createOptions.logLevel = options.logLevel;
  delete options.logLevel;

  var _createLocalTracks = options.createLocalTracks;
  delete options.createLocalTracks;
  createOptions[kind] = Object.keys(options).length > 0 ? options : true;

  return _createLocalTracks(createOptions).then(function(localTracks) {
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
 *   name: 'my-room-name',
 *   video: true
 * }).then(function(room) {
 *   // Add audio after connecting to the Room
 *   Video.createLocalAudioTrack().then(function(localTrack) {
 *     room.localParticipant.addTrack(localTrack);
 *   });
 * });
 */
function createLocalAudioTrack(options) {
  return _createLocalTrack('audio', options);
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
 *   name: 'my-room-name',
 *   audio: true
 * }).then(function(room) {
 *   // Add video after connecting to the Room
 *   Video.createLocalVideoTrack().then(function(localTrack) {
 *     room.localParticipant.addTrack(localTrack);
 *   });
 * });
 */
function createLocalVideoTrack(options) {
  return _createLocalTrack('video', options);
}

/**
 * Create {@link LocalTrack} options.
 * @typedef {MediaTrackConstraints} CreateLocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel
 */

module.exports = {
  audio: createLocalAudioTrack,
  video: createLocalVideoTrack
};
