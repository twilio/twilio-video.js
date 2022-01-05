'use strict';

import { CreateLocalTracksOptions, extraLocalTrackOption, TwilioError } from '../tsdef/types';

const asLocalTrack = require('./util').asLocalTrack;
const buildLogLevels = require('./util').buildLogLevels;
const getUserMedia = require('@twilio/webrtc').getUserMedia;

const {
  LocalAudioTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('./media/track/es5');

const MediaStreamTrack = require('@twilio/webrtc').MediaStreamTrack;
const Log = require('./util/log');
const { DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME } = require('./util/constants');
const workaround180748 = require('./webaudio/workaround180748');

// This is used to make out which createLocalTracks() call a particular Log
// statement belongs to. Each call to createLocalTracks() increments this
// counter.
let createLocalTrackCalls = 0;

/**
 * Request {@link LocalTrack}s. By default, it requests a
 * {@link LocalAudioTrack} and a {@link LocalVideoTrack}.
 * Note that on mobile browsers, the camera can be reserved by only one {@link LocalVideoTrack}
 * at any given time. If you attempt to create a second {@link LocalVideoTrack}, video frames
 * will no longer be supplied to the first {@link LocalVideoTrack}.
 * @alias module:twilio-video.createLocalTracks
 * @param {CreateLocalTracksOptions} [config]
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
 *
 * @example
 * var Video = require('twilio-video');
 * var localTracks;
 *
 * // Pre-acquire tracks to display camera preview.
 * Video.createLocalTracks().then(function(tracks) {
 *  localTracks = tracks;
 *  var localVideoTrack = localTracks.find(track => track.kind === 'video');
 *  divContainer.appendChild(localVideoTrack.attach());
 * })
 *
 * // Later, join the Room with the pre-acquired LocalTracks.
 * Video.connect('token', {
 *   name: 'my-cool-room',
 *   tracks: localTracks
 * });
 *
 */
export function createLocalTracks(options: CreateLocalTracksOptions) {
  const isAudioVideoAbsent: boolean =
    !(options && ('audio' in options || 'video' in options));

  // const config = Object.assign({
  //   audio: isAudioVideoAbsent,
  //   getUserMedia,
  //   loggerName: DEFAULT_LOGGER_NAME,
  //   logLevel: DEFAULT_LOG_LEVEL,
  //   LocalAudioTrack,
  //   LocalDataTrack,
  //   LocalVideoTrack,
  //   MediaStreamTrack,
  //   Log,
  //   video: isAudioVideoAbsent,
  // }, options);

  const config = {
    audio: isAudioVideoAbsent,
    getUserMedia,
    loggerName: DEFAULT_LOGGER_NAME,
    logLevel: DEFAULT_LOG_LEVEL,
    LocalAudioTrack,
    LocalDataTrack,
    LocalVideoTrack,
    MediaStreamTrack,
    Log,
    video: isAudioVideoAbsent,
    ...options,
  };

  const logComponentName = `[createLocalTracks #${++createLocalTrackCalls}]`;
  const logLevels = buildLogLevels(config.logLevel);
  const log = new config.Log('default', logComponentName, logLevels, config.loggerName);

  // NOTE(mmalavalli): The Room "name" in "options" was being used
  // as the LocalTrack name in asLocalTrack(). So we pass a copy of
  // "options" without the "name".
  const localTrackOptions = Object.assign({ log }, config);

  // NOTE(joma): CreateLocalTracksOptions type does not really have a "name" property when used publicly by customers.
  // But we are passing this property when used internally by other JS files.
  // We can update this "any" type once those JS files are converted to TS.
  delete (localTrackOptions as any).name;

  if (config.audio === false && config.video === false) {
    log.info('Neither audio nor video requested, so returning empty LocalTracks');
    return Promise.resolve([]);
  }

  if (config.tracks) {
    log.info('Adding user-provided LocalTracks');
    log.debug('LocalTracks:', config.tracks);
    return Promise.resolve(config.tracks);
  }

  const extraLocalTrackOptions: { audio: extraLocalTrackOption; video: extraLocalTrackOption; } = {
    audio: config.audio && config.audio.name
      ? { name: config.audio.name }
      : {},
    video: config.video && config.video.name
      ? { name: config.video.name }
      : {}
  };

  extraLocalTrackOptions.audio.isCreatedByCreateLocalTracks = true;
  extraLocalTrackOptions.video.isCreatedByCreateLocalTracks = true;

  if (config.audio && typeof config.audio.workaroundWebKitBug1208516 === 'boolean') {
    extraLocalTrackOptions.audio.workaroundWebKitBug1208516 = config.audio.workaroundWebKitBug1208516;
  }

  if (config.video && typeof config.video.workaroundWebKitBug1208516 === 'boolean') {
    extraLocalTrackOptions.video.workaroundWebKitBug1208516 = config.video.workaroundWebKitBug1208516;
  }

  if (config.audio) {
    delete config.audio.name;
  }
  if (config.video) {
    delete config.video.name;
  }

  const mediaStreamConstraints = {
    audio: config.audio,
    video: config.video
  };

  const workaroundWebKitBug180748 = config.audio && config.audio.workaroundWebKitBug180748;

  const mediaStreamPromise = workaroundWebKitBug180748
    ? workaround180748(log, config.getUserMedia, mediaStreamConstraints)
    : config.getUserMedia(mediaStreamConstraints);

  return mediaStreamPromise.then((mediaStream: MediaStream) => {
    const mediaStreamTracks: MediaStreamTrack[] = mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());

    log.info('Call to getUserMedia successful; got MediaStreamTracks:',
      mediaStreamTracks);

    return mediaStreamTracks.map(mediaStreamTrack  => {
      const options = extraLocalTrackOptions[mediaStreamTrack.kind as 'audio' | 'video'];
      const localTrack = asLocalTrack(mediaStreamTrack, { ...options, ...localTrackOptions });
      return localTrack;
    });
  }, (error: TwilioError) => {
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
 * @property {LogLevel|LogLevels} [logLevel='warn'] - <code>(deprecated: use [Video.Logger](module-twilio-video.html) instead.
 *   See [examples](module-twilio-video.html#.connect) for details)</code>
 *   Set the default log verbosity
 *   of logging. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 * @property {string} [loggerName='twilio-video'] - The name of the logger. Use this name when accessing the logger used by the SDK.
 *   See [examples](module-twilio-video.html#.connect) for details.
 * @property {Array<LocalTrack|MediaStreamTrack>} [tracks] - The {@link LocalTrack}s or MediaStreamTracks which is used to construct the LocalTrack.
 *   These tracks can be obtained by constructing them from the MediaStream.
 * @property {boolean|CreateLocalTrackOptions} [video=true] - Whether or not to
 *   get local video with <code>getUserMedia</code> when <code>tracks</code>
 *   are not provided.
 */
