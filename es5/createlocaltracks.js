/* eslint-disable @typescript-eslint/no-explicit-any */
'use strict';
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLocalTracks = void 0;
var noisecancellationimpl_1 = require("./media/track/noisecancellationimpl");
var buildLogLevels = require('./util').buildLogLevels;
var _a = require('./webrtc'), getUserMedia = _a.getUserMedia, MediaStreamTrack = _a.MediaStreamTrack;
var _b = require('./media/track/es5'), LocalAudioTrack = _b.LocalAudioTrack, LocalDataTrack = _b.LocalDataTrack, LocalVideoTrack = _b.LocalVideoTrack;
var Log = require('./util/log');
var _c = require('./util/constants'), DEFAULT_LOG_LEVEL = _c.DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME = _c.DEFAULT_LOGGER_NAME, INVALID_VALUE = _c.typeErrors.INVALID_VALUE;
var workaround180748 = require('./webaudio/workaround180748');
// This is used to make out which createLocalTracks() call a particular Log
// statement belongs to. Each call to createLocalTracks() increments this
// counter.
var createLocalTrackCalls = 0;
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
    return __awaiter(this, void 0, void 0, function () {
        var isAudioVideoAbsent, fullOptions, logComponentName, logLevels, log, localTrackOptions, extraLocalTrackOptions, noiseCancellationOptions, mediaStreamConstraints, workaroundWebKitBug180748, mediaStream, mediaStreamTracks, error_1;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    isAudioVideoAbsent = !(options && ('audio' in options || 'video' in options));
                    fullOptions = __assign({ audio: isAudioVideoAbsent, getUserMedia: getUserMedia, loggerName: DEFAULT_LOGGER_NAME, logLevel: DEFAULT_LOG_LEVEL, LocalAudioTrack: LocalAudioTrack,
                        LocalDataTrack: LocalDataTrack,
                        LocalVideoTrack: LocalVideoTrack,
                        MediaStreamTrack: MediaStreamTrack,
                        Log: Log, video: isAudioVideoAbsent }, options);
                    logComponentName = "[createLocalTracks #" + ++createLocalTrackCalls + "]";
                    logLevels = buildLogLevels(fullOptions.logLevel);
                    log = new fullOptions.Log('default', logComponentName, logLevels, fullOptions.loggerName);
                    localTrackOptions = Object.assign({ log: log }, fullOptions);
                    // NOTE(mmalavalli): The Room "name" in "options" was being used
                    // as the LocalTrack name in asLocalTrack(). So we pass a copy of
                    // "options" without the "name".
                    // NOTE(joma): CreateLocalTracksOptions type does not really have a "name" property when used publicly by customers.
                    // But we are passing this property when used internally by other JS files.
                    // We can update this "any" type once those JS files are converted to TS.
                    delete localTrackOptions.name;
                    if (fullOptions.audio === false && fullOptions.video === false) {
                        log.info('Neither audio nor video requested, so returning empty LocalTracks');
                        return [2 /*return*/, []];
                    }
                    if (fullOptions.tracks) {
                        log.info('Adding user-provided LocalTracks');
                        log.debug('LocalTracks:', fullOptions.tracks);
                        return [2 /*return*/, fullOptions.tracks];
                    }
                    extraLocalTrackOptions = {
                        audio: typeof fullOptions.audio === 'object' && fullOptions.audio.name
                            ? { name: fullOptions.audio.name }
                            : { defaultDeviceCaptureMode: 'auto' },
                        video: typeof fullOptions.video === 'object' && fullOptions.video.name
                            ? { name: fullOptions.video.name }
                            : {}
                    };
                    extraLocalTrackOptions.audio.isCreatedByCreateLocalTracks = true;
                    extraLocalTrackOptions.video.isCreatedByCreateLocalTracks = true;
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
                        else if (['auto', 'manual'].every(function (mode) { return mode !== fullOptions.audio.defaultDeviceCaptureMode; })) {
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
                    mediaStreamConstraints = {
                        audio: fullOptions.audio,
                        video: fullOptions.video
                    };
                    workaroundWebKitBug180748 = typeof fullOptions.audio === 'object' && fullOptions.audio.workaroundWebKitBug180748;
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, , 5]);
                    return [4 /*yield*/, (workaroundWebKitBug180748
                            ? workaround180748(log, fullOptions.getUserMedia, mediaStreamConstraints)
                            : fullOptions.getUserMedia(mediaStreamConstraints))];
                case 2:
                    mediaStream = _a.sent();
                    mediaStreamTracks = __spreadArray(__spreadArray([], __read(mediaStream.getAudioTracks())), __read(mediaStream.getVideoTracks()));
                    log.info('Call to getUserMedia successful; got tracks:', mediaStreamTracks);
                    return [4 /*yield*/, Promise.all(mediaStreamTracks.map(function (mediaStreamTrack) { return __awaiter(_this, void 0, void 0, function () {
                            var _a, cleanTrack, noiseCancellation;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        if (!(mediaStreamTrack.kind === 'audio' && noiseCancellationOptions)) return [3 /*break*/, 2];
                                        return [4 /*yield*/, noisecancellationimpl_1.applyNoiseCancellation(mediaStreamTrack, noiseCancellationOptions, log)];
                                    case 1:
                                        _a = _b.sent(), cleanTrack = _a.cleanTrack, noiseCancellation = _a.noiseCancellation;
                                        return [2 /*return*/, new localTrackOptions.LocalAudioTrack(cleanTrack, __assign(__assign(__assign({}, extraLocalTrackOptions.audio), localTrackOptions), { noiseCancellation: noiseCancellation }))];
                                    case 2:
                                        if (mediaStreamTrack.kind === 'audio') {
                                            return [2 /*return*/, new localTrackOptions.LocalAudioTrack(mediaStreamTrack, __assign(__assign({}, extraLocalTrackOptions.audio), localTrackOptions))];
                                        }
                                        _b.label = 3;
                                    case 3: return [2 /*return*/, new localTrackOptions.LocalVideoTrack(mediaStreamTrack, __assign(__assign({}, extraLocalTrackOptions.video), localTrackOptions))];
                                }
                            });
                        }); }))];
                case 3: return [2 /*return*/, _a.sent()];
                case 4:
                    error_1 = _a.sent();
                    log.warn('Call to getUserMedia failed:', error_1);
                    throw error_1;
                case 5: return [2 /*return*/];
            }
        });
    });
}
exports.createLocalTracks = createLocalTracks;
//# sourceMappingURL=createlocaltracks.js.map