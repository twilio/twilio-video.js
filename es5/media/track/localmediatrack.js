/* eslint new-cap:0 */
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
var getUserMedia = require('../../webrtc').getUserMedia;
var isIOS = require('../../util/browserdetection').isIOS;
var _a = require('../../util'), capitalize = _a.capitalize, defer = _a.defer, waitForSometime = _a.waitForSometime, waitForEvent = _a.waitForEvent;
var ILLEGAL_INVOKE = require('../../util/constants').typeErrors.ILLEGAL_INVOKE;
var detectSilentAudio = require('../../util/detectsilentaudio');
var detectSilentVideo = require('../../util/detectsilentvideo');
var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
var localMediaRestartDeferreds = require('../../util/localmediarestartdeferreds');
var gUMSilentTrackWorkaround = require('../../webaudio/workaround180748');
var MediaTrackSender = require('./sender');
function mixinLocalMediaTrack(AudioOrVideoTrack) {
    /**
     * A {@link LocalMediaTrack} represents audio or video that your
     * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
     * enabled and disabled with {@link LocalMediaTrack#enable} and
     * {@link LocalMediaTrack#disable} or stopped completely with
     * {@link LocalMediaTrack#stop}.
     * @emits LocalMediaTrack#muted
     * @emits LocalMediaTrack#stopped
     * @emits LocalMediaTrack#unmuted
     */
    return /** @class */ (function (_super) {
        __extends(LocalMediaTrack, _super);
        /**
         * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
         * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
         * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
         */
        function LocalMediaTrack(mediaStreamTrack, options) {
            var _this = this;
            var workaroundWebKitBug1208516 = isIOS()
                && typeof document === 'object'
                && typeof document.addEventListener === 'function'
                && typeof document.visibilityState === 'string';
            options = Object.assign({
                getUserMedia: getUserMedia,
                isCreatedByCreateLocalTracks: false,
                workaroundWebKitBug1208516: workaroundWebKitBug1208516,
                gUMSilentTrackWorkaround: gUMSilentTrackWorkaround
            }, options);
            var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
            var kind = mediaTrackSender.kind;
            _this = _super.call(this, mediaTrackSender, options) || this;
            Object.defineProperties(_this, {
                _constraints: {
                    value: typeof options[kind] === 'object'
                        ? options[kind]
                        : {},
                    writable: true
                },
                _getUserMedia: {
                    value: options.getUserMedia
                },
                _gUMSilentTrackWorkaround: {
                    value: options.gUMSilentTrackWorkaround
                },
                _eventsToReemitters: {
                    value: new Map([
                        ['muted', function () { return _this.emit('muted', _this); }],
                        ['unmuted', function () { return _this.emit('unmuted', _this); }]
                    ])
                },
                _workaroundWebKitBug1208516: {
                    value: options.workaroundWebKitBug1208516
                },
                _workaroundWebKitBug1208516Cleanup: {
                    value: null,
                    writable: true
                },
                _didCallEnd: {
                    value: false,
                    writable: true
                },
                _isCreatedByCreateLocalTracks: {
                    value: options.isCreatedByCreateLocalTracks
                },
                _noiseCancellation: {
                    value: options.noiseCancellation || null
                },
                _trackSender: {
                    value: mediaTrackSender
                },
                id: {
                    enumerable: true,
                    value: mediaTrackSender.id
                },
                isEnabled: {
                    enumerable: true,
                    get: function () {
                        return mediaTrackSender.enabled;
                    }
                },
                isMuted: {
                    enumerable: true,
                    get: function () {
                        return mediaTrackSender.muted;
                    }
                },
                isStopped: {
                    enumerable: true,
                    get: function () {
                        return mediaTrackSender.readyState === 'ended';
                    }
                }
            });
            // NOTE(mpatwardhan): As a workaround for WebKit bug: https://bugs.webkit.org/show_bug.cgi?id=208516,
            // upon foregrounding, re-acquire new MediaStreamTrack if the existing one is ended or muted.
            if (_this._workaroundWebKitBug1208516) {
                _this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(_this);
            }
            _this._reemitTrackSenderEvents();
            return _this;
        }
        /**
         * @private
         */
        LocalMediaTrack.prototype._end = function () {
            var _this = this;
            if (this._didCallEnd) {
                return;
            }
            _super.prototype._end.call(this);
            this._didCallEnd = true;
            this._eventsToReemitters.forEach(function (reemitter, event) { return _this._trackSender.removeListener(event, reemitter); });
            this.emit('stopped', this);
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._initialize = function () {
            if (this._didCallEnd) {
                this._didCallEnd = false;
            }
            if (this._eventsToReemitters) {
                this._reemitTrackSenderEvents();
            }
            _super.prototype._initialize.call(this);
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._reacquireTrack = function (constraints) {
            var _a;
            var _b = this, getUserMedia = _b._getUserMedia, gUMSilentTrackWorkaround = _b._gUMSilentTrackWorkaround, log = _b._log, kind = _b.mediaStreamTrack.kind;
            log.info('Re-acquiring the MediaStreamTrack');
            log.debug('Constraints:', constraints);
            var gUMConstraints = Object.assign({
                audio: false,
                video: false
            }, (_a = {}, _a[kind] = constraints, _a));
            var gUMPromise = this._workaroundWebKitBug1208516Cleanup
                ? gUMSilentTrackWorkaround(log, getUserMedia, gUMConstraints)
                : getUserMedia(gUMConstraints);
            return gUMPromise.then(function (mediaStream) {
                return mediaStream.getTracks()[0];
            });
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._reemitTrackSenderEvents = function () {
            var _this = this;
            this._eventsToReemitters.forEach(function (reemitter, event) { return _this._trackSender.on(event, reemitter); });
            this._trackSender.dequeue('muted');
            this._trackSender.dequeue('unmuted');
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._restart = function (constraints) {
            var _this = this;
            var log = this._log;
            constraints = constraints || this._constraints;
            // NOTE(mmalavalli): If we try and restart a silent MediaStreamTrack
            // without stopping it first, then a NotReadableError is raised in case of
            // video, or the restarted audio will still be silent. Hence, we stop the
            // MediaStreamTrack here.
            this._stop();
            return this._reacquireTrack(constraints).catch(function (error) {
                log.error('Failed to re-acquire the MediaStreamTrack:', { error: error, constraints: constraints });
                throw error;
            }).then(function (newMediaStreamTrack) {
                log.info('Re-acquired the MediaStreamTrack');
                log.debug('MediaStreamTrack:', newMediaStreamTrack);
                _this._constraints = Object.assign({}, constraints);
                return _this._setMediaStreamTrack(newMediaStreamTrack);
            });
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._setMediaStreamTrack = function (mediaStreamTrack) {
            var _this = this;
            // NOTE(mpatwardhan): Preserve the value of the "enabled" flag.
            mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;
            // NOTE(mmalavalli): Stop the current MediaStreamTrack. If not already
            // stopped, this should fire a "stopped" event.
            this._stop();
            // NOTE(csantos): If there's an unprocessedTrack, this means RTCRtpSender has
            // the processedTrack already set, we don't want to replace that.
            return (this._unprocessedTrack ? Promise.resolve().then(function () {
                _this._unprocessedTrack = mediaStreamTrack;
            }) : this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(function (error) {
                _this._log.warn('setMediaStreamTrack failed:', { error: error, mediaStreamTrack: mediaStreamTrack });
            })).then(function () {
                _this._initialize();
                _this._getAllAttachedElements().forEach(function (el) { return _this._attach(el); });
            });
        };
        /**
         * @private
         */
        LocalMediaTrack.prototype._stop = function () {
            this.mediaStreamTrack.stop();
            this._end();
            return this;
        };
        LocalMediaTrack.prototype.enable = function (enabled) {
            enabled = typeof enabled === 'boolean' ? enabled : true;
            if (enabled !== this.mediaStreamTrack.enabled) {
                this._log.info((enabled ? 'En' : 'Dis') + "abling");
                this.mediaStreamTrack.enabled = enabled;
                this.emit(enabled ? 'enabled' : 'disabled', this);
            }
            return this;
        };
        LocalMediaTrack.prototype.disable = function () {
            return this.enable(false);
        };
        LocalMediaTrack.prototype.restart = function (constraints) {
            var _this = this;
            var kind = this.kind;
            if (!this._isCreatedByCreateLocalTracks) {
                return Promise.reject(ILLEGAL_INVOKE('restart', 'can only be called on a'
                    + (" Local" + capitalize(kind) + "Track that is created using createLocalTracks")
                    + (" or createLocal" + capitalize(kind) + "Track.")));
            }
            if (this._workaroundWebKitBug1208516Cleanup) {
                this._workaroundWebKitBug1208516Cleanup();
                this._workaroundWebKitBug1208516Cleanup = null;
            }
            var promise = this._restart(constraints);
            if (this._workaroundWebKitBug1208516) {
                promise = promise.finally(function () {
                    _this._workaroundWebKitBug1208516Cleanup = restartWhenInadvertentlyStopped(_this);
                });
            }
            return promise;
        };
        LocalMediaTrack.prototype.stop = function () {
            this._log.info('Stopping');
            if (this._workaroundWebKitBug1208516Cleanup) {
                this._workaroundWebKitBug1208516Cleanup();
                this._workaroundWebKitBug1208516Cleanup = null;
            }
            return this._stop();
        };
        return LocalMediaTrack;
    }(AudioOrVideoTrack));
}
/**
 * Restart the given {@link LocalMediaTrack} if it has been inadvertently stopped.
 * @private
 * @param {LocalAudioTrack|LocalVideoTrack} localMediaTrack
 * @returns {function} Clean up listeners attached by the workaround
 */
function restartWhenInadvertentlyStopped(localMediaTrack) {
    var log = localMediaTrack._log, kind = localMediaTrack.kind, noiseCancellation = localMediaTrack._noiseCancellation;
    var detectSilence = {
        audio: detectSilentAudio,
        video: detectSilentVideo
    }[kind];
    var getSourceMediaStreamTrack = function () { return noiseCancellation
        ? noiseCancellation.sourceTrack
        : localMediaTrack.mediaStreamTrack; };
    var el = localMediaTrack._dummyEl;
    var mediaStreamTrack = getSourceMediaStreamTrack();
    var trackChangeInProgress = null;
    function checkSilence() {
        // The dummy element is paused, so play it and then detect silence.
        return el.play().then(function () { return detectSilence(el); }).then(function (isSilent) {
            if (isSilent) {
                log.warn('Silence detected');
            }
            else {
                log.info('Non-silence detected');
            }
            return isSilent;
        }).catch(function (error) {
            log.warn('Failed to detect silence:', error);
        }).finally(function () {
            // Pause the dummy element again, if there is no processed track.
            if (!localMediaTrack.processedTrack) {
                el.pause();
            }
        });
    }
    function shouldReacquireTrack() {
        var _workaroundWebKitBug1208516Cleanup = localMediaTrack._workaroundWebKitBug1208516Cleanup, isStopped = localMediaTrack.isStopped;
        var isInadvertentlyStopped = isStopped && !!_workaroundWebKitBug1208516Cleanup;
        var muted = getSourceMediaStreamTrack().muted;
        // NOTE(mmalavalli): Restart the LocalMediaTrack if:
        // 1. The app is foregrounded, and
        // 2. A restart is not already in progress, and
        // 3. The LocalMediaTrack is either muted, inadvertently stopped or silent
        return Promise.resolve().then(function () {
            return document.visibilityState === 'visible'
                && !trackChangeInProgress
                && (muted || isInadvertentlyStopped || checkSilence());
        });
    }
    function maybeRestart() {
        return Promise.race([
            waitForEvent(mediaStreamTrack, 'unmute'),
            waitForSometime(50)
        ]).then(function () { return shouldReacquireTrack(); }).then(function (shouldReacquire) {
            if (shouldReacquire && !trackChangeInProgress) {
                trackChangeInProgress = defer();
                localMediaTrack._restart().finally(function () {
                    el = localMediaTrack._dummyEl;
                    removeMediaStreamTrackListeners();
                    mediaStreamTrack = getSourceMediaStreamTrack();
                    addMediaStreamTrackListeners();
                    trackChangeInProgress.resolve();
                    trackChangeInProgress = null;
                }).catch(function (error) {
                    log.error('failed to restart track: ', error);
                });
            }
            // NOTE(mmalavalli): If the MediaStreamTrack ends before the DOM is visible,
            // then this makes sure that visibility callback for phase 2 is called only
            // after the MediaStreamTrack is re-acquired.
            var promise = (trackChangeInProgress && trackChangeInProgress.promise) || Promise.resolve();
            return promise.finally(function () { return localMediaRestartDeferreds.resolveDeferred(kind); });
        }).catch(function (ex) {
            log.error("error in maybeRestart: " + ex.message);
        });
    }
    function onMute() {
        var log = localMediaTrack._log, kind = localMediaTrack.kind;
        log.info('Muted');
        log.debug('LocalMediaTrack:', localMediaTrack);
        // NOTE(mmalavalli): When a LocalMediaTrack is muted without the app being
        // backgrounded, and the inadvertently paused elements are played before it
        // is restarted, it never gets unmuted due to the WebKit Bug 213853. Hence,
        // setting this Deferred will make sure that the inadvertently paused elements
        // are played only after the LocalMediaTrack is unmuted.
        //
        // Bug: https://bugs.webkit.org/show_bug.cgi?id=213853
        //
        localMediaRestartDeferreds.startDeferred(kind);
    }
    function addMediaStreamTrackListeners() {
        mediaStreamTrack.addEventListener('ended', maybeRestart);
        mediaStreamTrack.addEventListener('mute', onMute);
        mediaStreamTrack.addEventListener('unmute', maybeRestart);
    }
    function removeMediaStreamTrackListeners() {
        mediaStreamTrack.removeEventListener('ended', maybeRestart);
        mediaStreamTrack.removeEventListener('mute', onMute);
        mediaStreamTrack.removeEventListener('unmute', maybeRestart);
    }
    // NOTE(mpatwardhan): listen for document visibility callback on phase 1.
    // this ensures that we acquire media tracks before RemoteMediaTrack
    // tries to `play` them (in phase 2). This order is important because
    // play can fail on safari if audio is not being captured.
    var onVisibilityChange = function (isVisible) {
        return isVisible ? maybeRestart() : false;
    };
    documentVisibilityMonitor.onVisibilityChange(1, onVisibilityChange);
    addMediaStreamTrackListeners();
    return function () {
        documentVisibilityMonitor.offVisibilityChange(1, onVisibilityChange);
        removeMediaStreamTrackListeners();
    };
}
module.exports = mixinLocalMediaTrack;
//# sourceMappingURL=localmediatrack.js.map