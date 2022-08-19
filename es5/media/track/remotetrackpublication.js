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
var TrackPublication = require('./trackpublication');
/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isSubscribed - whether the published {@link RemoteTrack}
 *   is subscribed to
 * @property {boolean} isTrackEnabled - <code>Deprecated: Use (track.switchOffReason !== "disabled-by-publisher") instead. This property is only valid if the corresponding RemoteTrack is subscribed to.</code>
 *   whether the published {@link RemoteTrack} is enabled (Deprecated only for large group Rooms)
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {Track.Priority} publishPriority - the {@link Track.Priority} of the published
 *   {@link RemoteTrack} set by the {@link RemoteParticipant}
 * @property {?RemoteTrack} track - Unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @emits RemoteTrackPublication#publishPriorityChanged
 * @emits RemoteTrackPublication#subscribed
 * @emits RemoteTrackPublication#subscriptionFailed
 * @emits RemoteTrackPublication#trackDisabled
 * @emits RemoteTrackPublication#trackEnabled
 * @emits RemoteTrackPublication#trackSwitchedOff
 * @emits RemoteTrackPublication#trackSwitchedOn
 * @emits RemoteTrackPublication#unsubscribed
 *
 */
var RemoteTrackPublication = /** @class */ (function (_super) {
    __extends(RemoteTrackPublication, _super);
    /**
     * Construct a {@link RemoteTrackPublication}.
     * @param {RemoteTrackPublicationV2|RemoteTrackPublicationV3} signaling - {@link RemoteTrackPublication} signaling
     * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
     *   options
     */
    function RemoteTrackPublication(signaling, options) {
        var _this = this;
        options = Object.assign({
            reemitEventsToRemoteParticipant: function () { }
        }, options);
        var rspVersion = signaling.rspVersion, sid = signaling.sid, trackName = signaling.name;
        var shouldDeprecateEnabledState = rspVersion >= 3;
        _this = _super.call(this, trackName, sid, options) || this;
        Object.defineProperties(_this, {
            _signaling: {
                value: signaling
            },
            _track: {
                value: null,
                writable: true
            },
            isSubscribed: {
                enumerable: true,
                get: function () {
                    return !!this._track;
                }
            },
            isTrackEnabled: {
                enumerable: true,
                get: function () {
                    if (shouldDeprecateEnabledState) {
                        this._log.deprecated('.isTrackEnabled is deprecated and scheduled for removal. '
                            + 'During the deprecation period, this property is only valid if the corresponding '
                            + 'RemoteTrack is subscribed to. The RemoteTrack can be considered disabled if '
                            + '.switchOffReason is set to "disabled-by-publisher".');
                    }
                    return signaling.isEnabled;
                }
            },
            kind: {
                enumerable: true,
                value: signaling.kind
            },
            publishPriority: {
                enumerable: true,
                get: function () {
                    return signaling.priority;
                }
            },
            track: {
                enumerable: true,
                get: function () {
                    return this._track;
                }
            }
        });
        // remember original state, and fire events only on change.
        var error = signaling.error, isEnabled = signaling.isEnabled, isSwitchedOff = signaling.isSwitchedOff, priority = signaling.priority, _a = signaling.switchOffReason, switchOffReason = _a === void 0 ? null : _a, trackTransceiver = signaling.trackTransceiver;
        var _b = _this, log = _b._log, name = _b.constructor.name;
        signaling.on('updated', function () {
            if (error !== signaling.error) {
                error = signaling.error;
                _this.emit('subscriptionFailed', signaling.error);
                return;
            }
            if (isEnabled !== signaling.isEnabled) {
                isEnabled = signaling.isEnabled;
                if (_this.track) {
                    _this.track._setEnabled(signaling.isEnabled);
                }
                _this.emit(signaling.isEnabled ? 'trackEnabled' : 'trackDisabled');
            }
            var newSwitchOffReason = signaling.switchOffReason || null;
            if (isSwitchedOff !== signaling.isSwitchedOff || switchOffReason !== newSwitchOffReason) {
                log.debug(_this.trackSid + ": " + (isSwitchedOff ? 'OFF' : 'ON') + " => " + (signaling.isSwitchedOff ? 'OFF' : 'ON'));
                log.debug(_this.trackSid + " off_reason: " + switchOffReason + " => " + newSwitchOffReason);
                isSwitchedOff = signaling.isSwitchedOff;
                switchOffReason = newSwitchOffReason;
                if (_this.track) {
                    _this.track._setSwitchedOff(signaling.isSwitchedOff, switchOffReason);
                    _this.emit.apply(_this, __spreadArray([isSwitchedOff ? 'trackSwitchedOff' : 'trackSwitchedOn', _this.track], __read((isSwitchedOff ? [_this.track.switchOffReason] : []))));
                }
                else {
                    log.debug("Track was not subscribed to when switched " + (isSwitchedOff ? 'off' : 'on') + ".");
                }
            }
            if (trackTransceiver !== signaling.trackTransceiver) {
                log.debug(_this.trackSid + " MediaTrackReceiver changed:", trackTransceiver, signaling.trackTransceiver);
                trackTransceiver = signaling.trackTransceiver;
                if (_this.track && _this.kind !== 'data') {
                    _this.track._setMediaTrackReceiver(trackTransceiver);
                }
                else if (!_this.track) {
                    log.debug('Track was not subscribed to when TrackReceiver changed.');
                }
            }
            if (priority !== signaling.priority) {
                priority = signaling.priority;
                _this.emit('publishPriorityChanged', priority);
            }
        });
        options.reemitEventsToRemoteParticipant(_this);
        if (shouldDeprecateEnabledState) {
            deprecateEvents(name, _this, new Map([
                ['trackDisabled', 'trackSwitchedOff (track.switchOffReason === "disabled-by-publisher")'],
                ['trackEnabled', 'trackSwitchedOn']
            ]), log);
        }
        return _this;
    }
    RemoteTrackPublication.prototype.toString = function () {
        return "[RemoteTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    /**
     * @private
     * @param {RemoteTrack} track
     */
    RemoteTrackPublication.prototype._subscribed = function (track) {
        if (!this._track && track) {
            this._track = track;
            this.emit('subscribed', track);
        }
    };
    /**
     * @private
     */
    RemoteTrackPublication.prototype._unsubscribe = function () {
        if (this._track) {
            var track = this._track;
            this._track = null;
            this.emit('unsubscribed', track);
        }
    };
    return RemoteTrackPublication;
}(TrackPublication));
/**
 * The {@link RemoteTrack}'s publish {@link Track.Priority} was changed by the
 * {@link RemoteParticipant}.
 * @param {Track.Priority} priority - the {@link RemoteTrack}'s new publish
 *   {@link Track.Priority}; RemoteTrackPublication#publishPriority is also
 *   updated accordingly
 * @event RemoteTrackPublication#publishPriorityChanged
 */
/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was subscribed to
 * @event RemoteTrackPublication#subscribed
 */
/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteTrack} could not be
 *   subscribed to
 * @event RemoteTrackPublication#subscriptionFailed
 */
/**
 * The {@link RemoteTrack} was disabled. In large group Rooms, it is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code> (Deprecated only for large group Rooms).
 * @deprecated Use <a href="event:trackSwitchedOff"><code>trackSwitchedOff</code></a> (<code>track.switchOffReason === "disabled-by-publisher"</code>) instead
 * @event RemoteTrackPublication#trackDisabled
 */
/**
 * The {@link RemoteTrack} was enabled. In large group Rooms, it is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code> (Deprecated only for large group Rooms).
 * @deprecated Use <a href="event:trackSwitchedOn"><code>trackSwitchedOn</code></a> instead
 * @event RemoteTrackPublication#trackEnabled
 */
/**
 * The {@link RemoteTrack} was switched off. The media server stops sending media or data
 * for the {@link RemoteTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code>
 * is set to a {@link TrackSwitchOffReason} in large group Rooms (<code>switchOffReason</code> is
 * <code>null</code> non-large group Rooms). Also, if the {@link RemoteTrack} receives either
 * audio or video media, the <code>mediaStreamTrack</code> property is set to <code>null</code>.
 * (only in large group Rooms)
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched off
 * @param {?TrackSwitchOffReason} switchOffReason - the reason the {@link RemoteTrack}
 *   was switched off
 * @event RemoteTrackPublication#trackSwitchedOff
 */
/**
 * The {@link RemoteTrack} was switched on. The media server starts sending media or data
 * for the {@link RemoteMediaTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, if the {@link RemoteTrack} receives either audio or video
 * media,the <code>mediaStreamTrack</code> property is set to a MediaStreamTrack that is the
 * source of the {@link RemoteTrack}'s media.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched on
 * @event RemoteTrackPublication#trackSwitchedOn
 */
/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteTrack}.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was unsubscribed from
 * @event RemoteTrackPublication#unsubscribed
 */
/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 */
module.exports = RemoteTrackPublication;
//# sourceMappingURL=remotetrackpublication.js.map