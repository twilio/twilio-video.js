'use strict';
var _a = require('./util/constants'), DEFAULT_LOG_LEVEL = _a.DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME = _a.DEFAULT_LOGGER_NAME;
/**
 * Request a {@link LocalAudioTrack} or {@link LocalVideoTrack}.
 * @param {Track.Kind} kind - "audio" or "video"
 * @param {CreateLocalTrackOptions} [options]
 * @returns {Promise<LocalAudioTrack|LocalVideoTrack>}
 * @private
 */
function createLocalTrack(kind, options) {
    options = Object.assign({
        loggerName: DEFAULT_LOGGER_NAME,
        logLevel: DEFAULT_LOG_LEVEL,
    }, options);
    var createOptions = {};
    createOptions.loggerName = options.loggerName;
    createOptions.logLevel = options.logLevel;
    delete options.loggerName;
    delete options.logLevel;
    var createLocalTracks = options.createLocalTracks;
    delete options.createLocalTracks;
    createOptions[kind] = Object.keys(options).length > 0 ? options : true;
    return createLocalTracks(createOptions).then(function (localTracks) { return localTracks[0]; });
}
/**
 * Request a {@link LocalAudioTrack}.
 * @alias module:twilio-video.createLocalAudioTrack
 * @param {CreateLocalTracksOptions|CreateLocalAudioTrackOptions} [options] - Options for requesting a {@link LocalAudioTrack}
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
 * // Request the LocalAudioTrack with a custom name
 * // and krisp noise cancellation
 * Video.createLocalAudioTrack({
 *   name: 'microphone',
 *   noiseCancellationOptions: {
 *      vendor: 'krisp',
 *      sdkAssetsPath: '/twilio-krisp-audio-plugin/1.0.0/dist'
 *   }
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
 * {@link NoiseCancellationVendor} specifies the 3rd party plugin to use for noise cancellation.
 * @enum {string}
 */
// eslint-disable-next-line
var NoiseCancellationVendor = {
    /**
     * This plugin can be found by requesting access with this form {@link https://forms.gle/eeFyoGJj1mgMrxN88}
     */
    krisp: 'krisp',
};
/**
 * You can use 3rd party noise cancellation plugin when creating {@link LocalAudioTrack}
 * By specifying these options. This is a beta feature.
 * @typedef {object} NoiseCancellationOptions
 * @property {NoiseCancellationVendor} vendor - Specifies the vendor library to use
 *   You need to obtain and host the library files on your web server.
 * @property {string} sdkAssetsPath - Specifies path where vendor library files are
 *   hosted on your web server.
 */
/**
 * Create {@link LocalAudioTrack} options.
 * @typedef {CreateLocalTrackOptions} CreateLocalAudioTrackOptions
 * @property {boolean} [workaroundWebKitBug180748=false] - setting this
 *   attempts to workaround WebKit Bug 180748, where, in Safari, getUserMedia may return a silent audio
 *   MediaStreamTrack.
 * @property {DefaultDeviceCaptureMode} [defaultDeviceCaptureMode="auto"] - This optional property only applies if the
 *   {@link LocalAudioTrack} is capturing from the default audio input device connected to a desktop or laptop. When the
 *   property is set to "auto", the LocalAudioTrack restarts whenever the default audio input device changes, in order to
 *   capture audio from the new default audio input device. For example, when a bluetooth audio headset is connected to a
 *   Macbook, the LocalAudioTrack will start capturing audio from the headset microphone. When the headset is disconnected,
 *   the LocalAudioTrack will start capturing audio from the Macbook microphone. When the property is set to "manual", the
 *   LocalAudioTrack continues to capture from the same audio input device even after the default audio input device changes.
 *   When the property is not specified, it defaults to "auto".
 * @property {NoiseCancellationOptions} [noiseCancellationOptions] - This optional property enables using 3rd party plugins
 *   for noise cancellation.
 */
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
 */
module.exports = {
    audio: createLocalAudioTrack,
    video: createLocalVideoTrack
};
//# sourceMappingURL=createlocaltrack.js.map