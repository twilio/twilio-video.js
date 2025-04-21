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
var TrackPublication = require('./trackpublication');
/**
 * A {@link RemoteTrackPublication} represents a {@link RemoteTrack} that has
 * been published to a {@link Room}.
 * @extends TrackPublication
 * @property {boolean} isSubscribed - whether the published {@link RemoteTrack}
 *   is subscribed to
 * @property {boolean} isTrackEnabled - whether the published
 *   {@link RemoteTrack} is enabled
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
     * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
     * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
     *   options
     */
    function RemoteTrackPublication(signaling, options) {
        var _this = _super.call(this, signaling.name, signaling.sid, options) || this;
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
        var error = signaling.error, isEnabled = signaling.isEnabled, isSwitchedOff = signaling.isSwitchedOff, priority = signaling.priority;
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
            if (isSwitchedOff !== signaling.isSwitchedOff) {
                _this._log.debug(_this.trackSid + ": " + (isSwitchedOff ? 'OFF' : 'ON') + " => " + (signaling.isSwitchedOff ? 'OFF' : 'ON'));
                isSwitchedOff = signaling.isSwitchedOff;
                if (_this.track) {
                    _this.track._setSwitchedOff(signaling.isSwitchedOff);
                    _this.emit(isSwitchedOff ? 'trackSwitchedOff' : 'trackSwitchedOn', _this.track);
                }
                else if (isSwitchedOff) {
                    _this._log.warn('Track was not subscribed when switched Off.');
                }
            }
            if (priority !== signaling.priority) {
                priority = signaling.priority;
                _this.emit('publishPriorityChanged', priority);
            }
        });
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
 * The {@link RemoteTrack} was disabled.
 * @event RemoteTrackPublication#trackDisabled
 */
/**
 * The {@link RemoteTrack} was enabled.
 * @event RemoteTrackPublication#trackEnabled
 */
/**
 * The {@link RemoteTrack} was switched off.
 * @param {RemoteTrack} track - the {@link RemoteTrack} that was switched off
 * @event RemoteTrackPublication#trackSwitchedOff
 */
/**
 * The {@link RemoteTrack} was switched on.
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
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */
module.exports = RemoteTrackPublication;
//# sourceMappingURL=remotetrackpublication.js.map