'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var isIOS = require('../../util/browserdetection').isIOS;
var detectSilentVideo = require('../../util/detectsilentvideo');
var mixinLocalMediaTrack = require('./localmediatrack');
var VideoTrack = require('./videotrack');
var LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);
/**
 * A {@link LocalVideoTrack} is a {@link VideoTrack} representing video that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalVideoTrack#enable} and
 * {@link LocalVideoTrack#disable} or stopped completely with
 * {@link LocalVideoTrack#stop}.
 * @extends VideoTrack
 * @property {Track.ID} id - The {@link LocalVideoTrack}'s ID
 * @property {boolean} isMuted - Whether or not the video source has stopped sending frames to the
 *   {@link LocalVideoTrack}; This can happen when the camera is taken over by another application,
 *   mainly on mobile devices; When this property toggles, then <code>muted</code> and <code>unmuted</code>
 *   events are fired appropriately
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @emits LocalVideoTrack#disabled
 * @emits LocalVideoTrack#enabled
 * @emits LocalVideoTrack#muted
 * @emits LocalVideoTrack#started
 * @emits LocalVideoTrack#stopped
 * @emits LocalVideoTrack#unmuted
 */
var LocalVideoTrack = /** @class */ (function (_super) {
    __extends(LocalVideoTrack, _super);
    /**
     * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    function LocalVideoTrack(mediaStreamTrack, options) {
        var _this = this;
        options = Object.assign({
            workaroundSilentLocalVideo: isIOS()
                && typeof document !== 'undefined'
                && typeof document.createElement === 'function'
        }, options);
        _this = _super.call(this, mediaStreamTrack, options) || this;
        Object.defineProperties(_this, {
            _workaroundSilentLocalVideo: {
                value: options.workaroundSilentLocalVideo
                    ? workaroundSilentLocalVideo
                    : null
            },
            _workaroundSilentLocalVideoCleanup: {
                value: null,
                writable: true
            }
        });
        // NOTE(mmalavalli): In iOS Safari, we work around a bug where local video
        // MediaStreamTracks are silent (even though they are enabled, live and unmuted)
        // after accepting/rejecting a phone call.
        if (_this._workaroundSilentLocalVideo) {
            _this._workaroundSilentLocalVideoCleanup = _this._workaroundSilentLocalVideo(_this, document);
        }
        return _this;
    }
    LocalVideoTrack.prototype.toString = function () {
        return "[LocalVideoTrack #" + this._instanceId + ": " + this.id + "]";
    };
    /**
     * @private
     */
    LocalVideoTrack.prototype._checkIfCanCaptureFrames = function () {
        return _super.prototype._checkIfCanCaptureFrames.call(this, this._trackSender.isPublishing);
    };
    /**
     * @private
     */
    LocalVideoTrack.prototype._end = function () {
        return _super.prototype._end.apply(this, arguments);
    };
    /**
     * @private
     */
    LocalVideoTrack.prototype._setSenderMediaStreamTrack = function (useProcessed) {
        var _this = this;
        var unprocessedTrack = this.mediaStreamTrack;
        var mediaStreamTrack = useProcessed ? this.processedTrack : unprocessedTrack;
        return this._trackSender.setMediaStreamTrack(mediaStreamTrack)
            .catch(function (error) { return _this._log.warn('setMediaStreamTrack failed on LocalVideoTrack RTCRtpSender', { error: error, mediaStreamTrack: mediaStreamTrack }); })
            .then(function () {
            _this._unprocessedTrack = useProcessed ? unprocessedTrack : null;
        });
    };
    /**
     * Add a {@link VideoProcessor} to allow for custom processing of video frames belonging to a VideoTrack.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to use.
     * @param {AddProcessorOptions} [options] - {@link AddProcessorOptions} to provide.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     * localVideoTrack.addProcessor(new GrayScaleProcessor(100));
     */
    LocalVideoTrack.prototype.addProcessor = function () {
        this._log.debug('Adding VideoProcessor to the LocalVideoTrack');
        var result = _super.prototype.addProcessor.apply(this, arguments);
        if (!this.processedTrack) {
            return this._log.warn('Unable to add a VideoProcessor to the LocalVideoTrack');
        }
        this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the processed MediaStreamTrack', this.processedTrack);
        this._setSenderMediaStreamTrack(true);
        return result;
    };
    /**
     * Remove the previously added {@link VideoProcessor} using `addProcessor` API.
     * @param {VideoProcessor} processor - The {@link VideoProcessor} to remove.
     * @returns {this}
     * @example
     * class GrayScaleProcessor {
     *   constructor(percentage) {
     *     this.percentage = percentage;
     *   }
     *   processFrame(inputFrameBuffer, outputFrameBuffer) {
     *     const context = outputFrameBuffer.getContext('2d');
     *     context.filter = `grayscale(${this.percentage}%)`;
     *     context.drawImage(inputFrameBuffer, 0, 0, inputFrameBuffer.width, inputFrameBuffer.height);
     *   }
     * }
     *
     * const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     * const grayScaleProcessor = new GrayScaleProcessor(100);
     * localVideoTrack.addProcessor(grayScaleProcessor);
     *
     * document.getElementById('remove-button').onclick = () => localVideoTrack.removeProcessor(grayScaleProcessor);
     */
    LocalVideoTrack.prototype.removeProcessor = function () {
        var _this = this;
        this._log.debug('Removing VideoProcessor from the LocalVideoTrack');
        var result = _super.prototype.removeProcessor.apply(this, arguments);
        this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the original MediaStreamTrack');
        this._setSenderMediaStreamTrack()
            .then(function () { return _this._updateElementsMediaStreamTrack(); });
        return result;
    };
    /**
     * Disable the {@link LocalVideoTrack}. This is equivalent to pausing a video source.
     * If a {@link VideoProcessor} is added, then <code>processedTrack</code> is also disabled.
     * @returns {this}
     * @fires VideoTrack#disabled
     */
    LocalVideoTrack.prototype.disable = function () {
        var result = _super.prototype.disable.apply(this, arguments);
        if (this.processedTrack) {
            this.processedTrack.enabled = false;
        }
        return result;
    };
    /**
     * Enable the {@link LocalVideoTrack}. This is equivalent to unpausing the video source.
     * If a {@link VideoProcessor} is added, then <code>processedTrack</code> is also enabled.
     * @returns {this}
     * @fires VideoTrack#enabled
    */ /**
     * Enable or disable the {@link LocalVideoTrack}. This is equivalent to unpausing or pausing
     * the video source respectively. If a {@link VideoProcessor} is added, then <code>processedTrack</code>
     * is also enabled or disabled.
     * @param {boolean} [enabled] - Specify false to disable the
     *   {@link LocalVideoTrack}
     * @returns {this}
     * @fires VideoTrack#disabled
     * @fires VideoTrack#enabled
     */
    LocalVideoTrack.prototype.enable = function (enabled) {
        if (enabled === void 0) { enabled = true; }
        var result = _super.prototype.enable.apply(this, arguments);
        if (this.processedTrack) {
            this.processedTrack.enabled = enabled;
            if (enabled) {
                this._captureFrames();
                this._log.debug('Updating LocalVideoTrack\'s MediaStreamTrack with the processed MediaStreamTrack', this.processedTrack);
                this._setSenderMediaStreamTrack(true);
            }
        }
        return result;
    };
    /**
     * Restart the {@link LocalVideoTrack}. This stops the existing MediaStreamTrack
     * and creates a new MediaStreamTrack. If the {@link LocalVideoTrack} is being published
     * to a {@link Room}, then all the {@link RemoteParticipant}s will start receiving media
     * from the newly created MediaStreamTrack. You can access the new MediaStreamTrack via
     * the <code>mediaStreamTrack</code> property. If you want to listen to events on
     * the MediaStreamTrack directly, please do so in the "started" event handler. Also,
     * the {@link LocalVideoTrack}'s ID is no longer guaranteed to be the same as the
     * underlying MediaStreamTrack's ID.
     * @param {MediaTrackConstraints} [constraints] - The optional <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints" target="_blank">MediaTrackConstraints</a>
     *   for restarting the {@link LocalVideoTrack}; If not specified, then the current MediaTrackConstraints
     *   will be used; If <code>{}</code> (empty object) is specified, then the default MediaTrackConstraints
     *   will be used
     * @returns {Promise<void>} Rejects with a TypeError if the {@link LocalVideoTrack} was not created
     *   using an one of <code>createLocalVideoTrack</code>, <code>createLocalTracks</code> or <code>connect</code>;
     *   Also rejects with the <a href="https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Exceptions" target="_blank">DOMException</a>
     *   raised by <code>getUserMedia</code> when it fails
     * @fires LocalVideoTrack#stopped
     * @fires LocalVideoTrack#started
     * @example
     * const { connect, createLocalVideoTrack } = require('twilio-video');
     *
     * // Create a LocalVideoTrack that captures video from the front-facing camera.
     * createLocalVideoTrack({ facingMode: 'user' }).then(function(localVideoTrack) {
     *   return connect('token', {
     *     name: 'my-cool-room',
     *     tracks: [localVideoTrack]
     *   });
     * }).then(function(room) {
     *   // Restart the LocalVideoTrack to capture video from the back-facing camera.
     *   const localVideoTrack = Array.from(room.localParticipant.videoTracks.values())[0].track;
     *   return localVideoTrack.restart({ facingMode: 'environment' });
     * });
     */
    LocalVideoTrack.prototype.restart = function () {
        var _this = this;
        if (this._workaroundSilentLocalVideoCleanup) {
            this._workaroundSilentLocalVideoCleanup();
            this._workaroundSilentLocalVideoCleanup = null;
        }
        var promise = _super.prototype.restart.apply(this, arguments);
        if (this.processor) {
            promise.then(function () {
                _this._restartProcessor();
            });
        }
        if (this._workaroundSilentLocalVideo) {
            promise.finally(function () {
                _this._workaroundSilentLocalVideoCleanup = _this._workaroundSilentLocalVideo(_this, document);
            });
        }
        return promise;
    };
    /**
     * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
     * {@link LocalVideoTrack}, you should unpublish it after stopping.
     * @returns {this}
     * @fires LocalVideoTrack#stopped
     */
    LocalVideoTrack.prototype.stop = function () {
        if (this._workaroundSilentLocalVideoCleanup) {
            this._workaroundSilentLocalVideoCleanup();
            this._workaroundSilentLocalVideoCleanup = null;
        }
        return _super.prototype.stop.apply(this, arguments);
    };
    return LocalVideoTrack;
}(LocalMediaVideoTrack));
/**
 * Work around a bug where local video MediaStreamTracks are silent (even though
 * they are enabled, live and unmuted) after accepting/rejecting a phone call.
 * @private
 * @param {LocalVideoTrack} localVideoTrack
 * @param {HTMLDocument} doc
 * @returns {function} Cleans up listeners attached by the workaround
 */
function workaroundSilentLocalVideo(localVideoTrack, doc) {
    var log = localVideoTrack._log;
    var el = localVideoTrack._dummyEl, mediaStreamTrack = localVideoTrack.mediaStreamTrack;
    function onUnmute() {
        if (!localVideoTrack.isEnabled) {
            return;
        }
        log.info('Unmuted, checking silence');
        // The dummy element is paused, so play it and then detect silence.
        el.play().then(function () { return detectSilentVideo(el, doc); }).then(function (isSilent) {
            if (!isSilent) {
                log.info('Non-silent frames detected, so no need to restart');
                return;
            }
            log.warn('Silence detected, restarting');
            // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
            // without stopping it first, then a NotReadableError is raised. Hence,
            // we stop the MediaStreamTrack here.
            localVideoTrack._stop();
            // Restart the LocalVideoTrack.
            // eslint-disable-next-line consistent-return
            return localVideoTrack._restart();
        }).catch(function (error) {
            log.warn('Failed to detect silence and restart:', error);
        }).finally(function () {
            // If silent frames were not detected, then pause the dummy element again,
            // if there is no processed track.
            el = localVideoTrack._dummyEl;
            if (el && !el.paused && !localVideoTrack.processedTrack) {
                el.pause();
            }
            // Reset the unmute handler.
            mediaStreamTrack.removeEventListener('unmute', onUnmute);
            mediaStreamTrack = localVideoTrack.mediaStreamTrack;
            mediaStreamTrack.addEventListener('unmute', onUnmute);
        });
    }
    // Set the unmute handler.
    mediaStreamTrack.addEventListener('unmute', onUnmute);
    return function () {
        mediaStreamTrack.removeEventListener('unmute', onUnmute);
    };
}
/**
 * The {@link LocalVideoTrack} was disabled, i.e. the video source was paused by the user.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */
/**
 * The {@link LocalVideoTrack} was enabled, i.e. the video source was unpaused by the user.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */
/**
 * The {@link LocalVideoTrack} was muted because the video source stopped sending frames, most
 * likely due to another application taking said video source, especially on mobile devices.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was muted
 * @event LocalVideoTrack#muted
 */
/**
 * The {@link LocalVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that started
 * @event LocalVideoTrack#started
 */
/**
 * The {@link LocalVideoTrack} stopped, either because {@link LocalVideoTrack#stop}
 * or {@link LocalVideoTrack#restart} was called or because the underlying
 * MediaStreamTrack ended.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that stopped
 * @event LocalVideoTrack#stopped
 */
/**
 * The {@link LocalVideoTrack} was unmuted because the video source resumed sending frames,
 * most likely due to the application that took over the said video source has released it
 * back to the application, especially on mobile devices. This event is also fired when
 * {@link LocalVideoTrack#restart} is called on a muted {@link LocalVideoTrack} with a
 * new video source.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was unmuted
 * @event LocalVideoTrack#unmuted
 */
module.exports = LocalVideoTrack;
//# sourceMappingURL=localvideotrack.js.map