'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLocalTracks = createLocalTracks;
const tslib_1 = require("tslib");
const noisecancellationimpl_1 = require("./media/track/noisecancellationimpl");
const { buildLogLevels } = require('./util');
const { getUserMedia } = require('./webrtc');
const { LocalAudioTrack, LocalDataTrack, LocalVideoTrack } = require('./media/track/es5');
const Log = require('./util/log');
const { DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME, typeErrors: { INVALID_VALUE } } = require('./util/constants');
const workaround180748 = require('./webaudio/workaround180748');
const telemetry = require('./insights/telemetry');
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
function createLocalTracks(options) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        const isAudioVideoAbsent = !(options && ('audio' in options || 'video' in options));
        const fullOptions = Object.assign({ audio: isAudioVideoAbsent, getUserMedia, loggerName: DEFAULT_LOGGER_NAME, logLevel: DEFAULT_LOG_LEVEL, LocalAudioTrack,
            LocalDataTrack,
            LocalVideoTrack,
            MediaStreamTrack,
            Log, video: isAudioVideoAbsent }, options);
        const logComponentName = `[createLocalTracks #${++createLocalTrackCalls}]`;
        const logLevels = buildLogLevels(fullOptions.logLevel);
        const log = new fullOptions.Log('default', logComponentName, logLevels, fullOptions.loggerName);
        const localTrackOptions = Object.assign({ log }, fullOptions);
        // NOTE(mmalavalli): The Room "name" in "options" was being used
        // as the LocalTrack name in asLocalTrack(). So we pass a copy of
        // "options" without the "name".
        // NOTE(joma): CreateLocalTracksOptions type does not really have a "name" property when used publicly by customers.
        // But we are passing this property when used internally by other JS files.
        // We can update this "any" type once those JS files are converted to TS.
        delete localTrackOptions.name;
        if (fullOptions.audio === false && fullOptions.video === false) {
            log.info('Neither audio nor video requested, so returning empty LocalTracks');
            return [];
        }
        if (fullOptions.tracks) {
            log.info('Adding user-provided LocalTracks');
            log.debug('LocalTracks:', fullOptions.tracks);
            return fullOptions.tracks;
        }
        const extraLocalTrackOptions = {
            audio: typeof fullOptions.audio === 'object' && fullOptions.audio.name
                ? { name: fullOptions.audio.name }
                : { defaultDeviceCaptureMode: 'auto' },
            video: typeof fullOptions.video === 'object' && fullOptions.video.name
                ? { name: fullOptions.video.name }
                : {}
        };
        extraLocalTrackOptions.audio.isCreatedByCreateLocalTracks = true;
        extraLocalTrackOptions.video.isCreatedByCreateLocalTracks = true;
        let noiseCancellationOptions;
        if (typeof fullOptions.audio === 'object') {
            if (typeof fullOptions.audio.workaroundWebKitBug1208516 === 'boolean') {
                extraLocalTrackOptions.audio.workaroundWebKitBug1208516 = fullOptions.audio.workaroundWebKitBug1208516;
            }
            if ('noiseCancellationOptions' in fullOptions.audio) {
                noiseCancellationOptions = fullOptions.audio.noiseCancellationOptions;
                delete fullOptions.audio.noiseCancellationOptions;
            }
            if (!('defaultDeviceCaptureMode' in fullOptions.audio)) {
                extraLocalTrackOptions.audio.defaultDeviceCaptureMode = 'auto';
            }
            else if (['auto', 'manual'].every(mode => mode !== fullOptions.audio.defaultDeviceCaptureMode)) {
                // eslint-disable-next-line new-cap
                throw INVALID_VALUE('CreateLocalAudioTrackOptions.defaultDeviceCaptureMode', ['auto', 'manual']);
            }
            else {
                extraLocalTrackOptions.audio.defaultDeviceCaptureMode = fullOptions.audio.defaultDeviceCaptureMode;
            }
        }
        if (typeof fullOptions.video === 'object' && typeof fullOptions.video.workaroundWebKitBug1208516 === 'boolean') {
            extraLocalTrackOptions.video.workaroundWebKitBug1208516 = fullOptions.video.workaroundWebKitBug1208516;
        }
        if (typeof fullOptions.audio === 'object') {
            delete fullOptions.audio.name;
        }
        if (typeof fullOptions.video === 'object') {
            delete fullOptions.video.name;
        }
        const mediaStreamConstraints = {
            audio: fullOptions.audio,
            video: fullOptions.video
        };
        const workaroundWebKitBug180748 = typeof fullOptions.audio === 'object' && fullOptions.audio.workaroundWebKitBug180748;
        try {
            const mediaStream = yield (workaroundWebKitBug180748
                ? workaround180748(log, fullOptions.getUserMedia, mediaStreamConstraints)
                : fullOptions.getUserMedia(mediaStreamConstraints));
            telemetry.getUserMedia.succeeded();
            const mediaStreamTracks = [
                ...mediaStream.getAudioTracks(),
                ...mediaStream.getVideoTracks(),
            ];
            log.info('Call to getUserMedia successful; got tracks:', mediaStreamTracks);
            return yield Promise.all(mediaStreamTracks.map((mediaStreamTrack) => tslib_1.__awaiter(this, void 0, void 0, function* () {
                if (mediaStreamTrack.kind === 'audio' && noiseCancellationOptions) {
                    const { cleanTrack, noiseCancellation } = yield (0, noisecancellationimpl_1.applyNoiseCancellation)(mediaStreamTrack, noiseCancellationOptions, log);
                    return new localTrackOptions.LocalAudioTrack(cleanTrack, Object.assign(Object.assign(Object.assign({}, extraLocalTrackOptions.audio), localTrackOptions), { noiseCancellation }));
                }
                else if (mediaStreamTrack.kind === 'audio') {
                    return new localTrackOptions.LocalAudioTrack(mediaStreamTrack, Object.assign(Object.assign({}, extraLocalTrackOptions.audio), localTrackOptions));
                }
                return new localTrackOptions.LocalVideoTrack(mediaStreamTrack, Object.assign(Object.assign({}, extraLocalTrackOptions.video), localTrackOptions));
            })));
        }
        catch (error) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                telemetry.getUserMedia.denied();
            }
            else {
                telemetry.getUserMedia.failed(error);
            }
            log.warn('Call to getUserMedia failed:', error);
            throw error;
        }
    });
}
//# sourceMappingURL=createlocaltracks.js.map