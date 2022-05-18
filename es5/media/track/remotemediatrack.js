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
var deprecateEvents = require('../../util').deprecateEvents;
var _a = require('../../util/constants'), E = _a.typeErrors, trackPriority = _a.trackPriority, trackSwitchOffReason = _a.trackSwitchOffReason;
var _b = require('../../webrtc/util'), guessBrowser = _b.guessBrowser, isIOSChrome = _b.isIOSChrome;
var documentVisibilityMonitor = require('../../util/documentvisibilitymonitor.js');
function mixinRemoteMediaTrack(AudioOrVideoTrack) {
    /**
     * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
     * {@link Room} by a {@link RemoteParticipant}.
     * @property {boolean} isEnabled - <code>Deprecated: Use (.switchOffReason !== "disabled-by-publisher") instead.</code>
     *   Whether the {@link RemoteAudioTrack} is enabled (Deprecated only for large group Rooms)
     * @property {boolean} isSwitchedOff - Whether the {@link RemoteMediaTrack} is switched off
     * @property {?TrackSwitchOffReason} switchOffReason - The reason for the {@link RemoteMediaTrack} being switched off;
     *   If switched on, it is set to <code>null</code>; The {@link RemoteMediaTrack} is initially switched off with this
     *   property set to <code>disabled-by-subscriber</code>
     * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
     * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteMediaTrack}
     * @emits RemoteMediaTrack#disabled
     * @emits RemoteMediaTrack#enabled
     * @emits RemoteMediaTrack#switchedOff
     * @emits RemoteMediaTrack#switchedOn
     */
    return /** @class */ (function (_super) {
        __extends(RemoteMediaTrack, _super);
        /**
         * Construct a {@link RemoteMediaTrack}.
         * @param {Track.Kind} kind
         * @param {Track.SID} sid
         * @param {?MediaTrackReceiver} mediaTrackReceiver
         * @param {boolean} isEnabled
         * @param {boolean} isSwitchedOff
         * @param {?string} switchOffReason
         * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
         *  {@link Track.Priority} of the {@link RemoteMediaTrack}
         * @param {function(ClientRenderHint): void} setRenderHint - Set render hints.
         * @param {{log: Log, name: string}} options
         */
        function RemoteMediaTrack(kind, sid, mediaTrackReceiver, isEnabled, isSwitchedOff, switchOffReason, setPriority, setRenderHint, options) {
            var _this = this;
            options = Object.assign({
                shouldDeprecateEnabledState: false,
                // NOTE(mpatwardhan): WebKit bug: 212780 sometimes causes the audio/video elements to stay paused when safari
                // regains foreground. To workaround it, when safari gains foreground - we will play any elements that were
                // playing before safari lost foreground.
                workaroundWebKitBug212780: (guessBrowser() === 'safari' || isIOSChrome())
                    && typeof document === 'object'
                    && typeof document.addEventListener === 'function'
                    && typeof document.visibilityState === 'string'
            }, options);
            var shouldDeprecateEnabledState = options.shouldDeprecateEnabledState;
            _this = _super.call(this, mediaTrackReceiver, options) || this;
            Object.defineProperties(_this, {
                _isEnabled: {
                    value: isEnabled,
                    writable: true
                },
                _isSwitchedOff: {
                    value: isSwitchedOff,
                    writable: true
                },
                _priority: {
                    value: null,
                    writable: true
                },
                _setPriority: {
                    value: setPriority
                },
                _setRenderHint: {
                    value: function (renderHint) {
                        _this._log.debug('updating render hint:', renderHint);
                        setRenderHint(renderHint);
                    }
                },
                _switchOffReason: {
                    value: switchOffReason,
                    writable: true
                },
                _workaroundWebKitBug212780: {
                    value: options.workaroundWebKitBug212780
                },
                _workaroundWebKitBug212780Cleanup: {
                    value: null,
                    writable: true
                },
                isEnabled: {
                    enumerable: true,
                    get: function () {
                        if (shouldDeprecateEnabledState) {
                            this._log.deprecated('.isEnabled is deprecated and scheduled for removal. '
                                + 'The RemoteMediaTrack is can be considered disabled if .switchOffReason '
                                + 'is set to "disabled-by-publisher".');
                        }
                        return this._isEnabled;
                    }
                },
                isSwitchedOff: {
                    enumerable: true,
                    get: function () {
                        return this._isSwitchedOff;
                    }
                },
                priority: {
                    enumerable: true,
                    get: function () {
                        return this._priority;
                    }
                },
                sid: {
                    enumerable: true,
                    value: sid
                },
                switchOffReason: {
                    enumerable: true,
                    get: function () {
                        return trackSwitchOffReason[this._switchOffReason] || null;
                    }
                }
            });
            var _a = _this, log = _a._log, name = _a.constructor.name;
            if (shouldDeprecateEnabledState) {
                deprecateEvents(name, _this, new Map([
                    ['disabled', 'switchedOff (.switchOffReason === "disabled-by-publisher")'],
                    ['enabled', 'switchedOn']
                ]), log);
            }
            return _this;
        }
        /**
         * Update the subscribe {@link Track.Priority} of the {@link RemoteMediaTrack}.
         * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
         *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
         *   means the {@link Track.Priority} set by the publisher is now the effective priority.
         * @returns {this}
         * @throws {RangeError}
         */
        RemoteMediaTrack.prototype.setPriority = function (priority) {
            var priorityValues = __spreadArray([null], __read(Object.values(trackPriority)));
            if (!priorityValues.includes(priority)) {
                // eslint-disable-next-line new-cap
                throw E.INVALID_VALUE('priority', priorityValues);
            }
            if (this._priority !== priority) {
                this._priority = priority;
                this._setPriority(priority);
            }
            return this;
        };
        /**
         * @private
         * @param {boolean} isEnabled
         */
        RemoteMediaTrack.prototype._setEnabled = function (isEnabled) {
            if (this._isEnabled !== isEnabled) {
                this._isEnabled = isEnabled;
                this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
            }
        };
        /**
         * @private
         * @param {?MediaTrackReceiver} mediaTrackReceiver
         */
        RemoteMediaTrack.prototype._setMediaTrackReceiver = function (mediaTrackReceiver) {
            if (this._mediaTrackTransceiver !== mediaTrackReceiver) {
                this._mediaTrackTransceiver = mediaTrackReceiver;
                this._initialize();
                this._updateElementsMediaStreamTrack();
            }
        };
        /**
         * @private
         * @param {boolean} isSwitchedOff
         * @param {?string} [switchOffReason=null]
         */
        RemoteMediaTrack.prototype._setSwitchedOff = function (isSwitchedOff, switchOffReason) {
            if (switchOffReason === void 0) { switchOffReason = null; }
            if (this._isSwitchedOff !== isSwitchedOff || this._switchOffReason !== switchOffReason) {
                this._isSwitchedOff = isSwitchedOff;
                this._switchOffReason = switchOffReason;
                this.emit.apply(this, __spreadArray([isSwitchedOff ? 'switchedOff' : 'switchedOn', this], __read((isSwitchedOff ? [this.switchOffReason] : []))));
            }
        };
        RemoteMediaTrack.prototype.attach = function (el) {
            var result = _super.prototype.attach.call(this, el);
            if (this.mediaStreamTrack && this.mediaStreamTrack.enabled !== true) {
                // NOTE(mpatwardhan): we disable mediaStreamTrack when there
                // are no attachments to it (see notes below). Now that there
                // are attachments re-enable the track.
                this.mediaStreamTrack.enabled = true;
                if (this.processedTrack) {
                    this.processedTrack.enabled = true;
                }
                // NOTE(csantos): since remote tracks disables/enables the mediaStreamTrack,
                // captureFrames stops along with it. We need to start it again after re-enabling.
                // See attach/detach methods in this class and in VideoTrack class.
                if (this.processor) {
                    this._captureFrames();
                }
            }
            if (this._workaroundWebKitBug212780) {
                this._workaroundWebKitBug212780Cleanup = this._workaroundWebKitBug212780Cleanup
                    || playIfPausedWhileInBackground(this);
            }
            return result;
        };
        RemoteMediaTrack.prototype.detach = function (el) {
            var result = _super.prototype.detach.call(this, el);
            if (this._attachments.size === 0) {
                // NOTE(mpatwardhan): chrome continues playing webrtc audio
                // track even after audio element is removed from the DOM.
                // https://bugs.chromium.org/p/chromium/issues/detail?id=749928
                // to workaround: here disable the track when
                // there are no elements attached to it.
                if (this.mediaStreamTrack) {
                    this.mediaStreamTrack.enabled = false;
                }
                if (this.processedTrack) {
                    this.processedTrack.enabled = false;
                }
                if (this._workaroundWebKitBug212780Cleanup) {
                    // unhook visibility change
                    this._workaroundWebKitBug212780Cleanup();
                    this._workaroundWebKitBug212780Cleanup = null;
                }
            }
            return result;
        };
        return RemoteMediaTrack;
    }(AudioOrVideoTrack));
}
function playIfPausedWhileInBackground(remoteMediaTrack) {
    var log = remoteMediaTrack._log, kind = remoteMediaTrack.kind;
    function onVisibilityChanged(isVisible) {
        if (!isVisible) {
            return;
        }
        remoteMediaTrack._attachments.forEach(function (el) {
            var shim = remoteMediaTrack._elShims.get(el);
            var isInadvertentlyPaused = el.paused && shim && !shim.pausedIntentionally();
            if (isInadvertentlyPaused) {
                log.info("Playing inadvertently paused <" + kind + "> element");
                log.debug('Element:', el);
                log.debug('RemoteMediaTrack:', remoteMediaTrack);
                el.play().then(function () {
                    log.info("Successfully played inadvertently paused <" + kind + "> element");
                    log.debug('Element:', el);
                    log.debug('RemoteMediaTrack:', remoteMediaTrack);
                }).catch(function (err) {
                    log.warn("Error while playing inadvertently paused <" + kind + "> element:", { err: err, el: el, remoteMediaTrack: remoteMediaTrack });
                });
            }
        });
    }
    // NOTE(mpatwardhan): listen for document visibility callback on phase 2.
    // this ensures that any LocalMediaTrack's restart (which listen on phase 1) gets executed
    // first. This order is important because we `play` tracks in the callback, and
    // play can fail on safari if audio is not being captured.
    documentVisibilityMonitor.onVisibilityChange(2, onVisibilityChanged);
    return function () {
        documentVisibilityMonitor.offVisibilityChange(2, onVisibilityChanged);
    };
}
/**
 * A {@link RemoteMediaTrack} was disabled (Deprecated only for large group Rooms).
 * @deprecated Use <a href="#event:switchedOff"><code>switchedOff</code></a> (<code>.switchOffReason !== "disabled-by-publisher"</code>) instead
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   disabled
 * @event RemoteMediaTrack#disabled
 */
/**
 * A {@link RemoteMediaTrack} was enabled (Deprecated only for large group Rooms).
 * @deprecated Use <a href="#event:switchedOn"><code>switchedOn</code></a> instead
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   enabled
 * @event RemoteMediaTrack#enabled
 */
/**
 * A {@link RemoteMediaTrack} was switched off. The media server stops sending media for the
 * {@link RemoteMediaTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code> is
 * set to a {@link TrackSwitchOffReason} in large group Rooms (<code>switchOffReason</code> is
 * <code>null</code> non-large group Rooms). Also, the <code>mediaStreamTrack</code> property
 * is set to <code>null</code> (only in large group Rooms).
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched off
 * @param {?TrackSwitchOffReason} switchOffReason - The reason the {@link RemoteMediaTrack}
 *   was switched off
 * @event RemoteMediaTrack#switchedOff
 */
/**
 * A {@link RemoteMediaTrack} was switched on. The media server starts sending media for the
 * {@link RemoteMediaTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteMediaTrack}'s media.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched on
 * @event RemoteMediaTrack#switchedOn
 */
/**
 * A {@link ClientRenderHint} object specifies track dimensions and /enabled disable state.
 * This state will be used by the server(SFU) to determine bandwidth allocation for the track,
 * and turn it on or off as needed.
 * @typedef {object} ClientRenderHint
 * @property {boolean} [enabled] - track is enabled or disabled. defaults to disabled.
 * @property {VideoTrack.Dimensions} [renderDimensions] - Optional parameter to specify the desired
 *   render dimensions of {@link RemoteVideoTrack}s. This property must be specified if enabled=true
 */
module.exports = mixinRemoteMediaTrack;
//# sourceMappingURL=remotemediatrack.js.map