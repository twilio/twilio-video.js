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
var EventEmitter = require('events').EventEmitter;
/**
 * A {@link Track} implementation
 * @extends EventEmitter
 * @property {Track.Kind} kind
 * @property {string} name
 */
var TrackSignaling = /** @class */ (function (_super) {
    __extends(TrackSignaling, _super);
    /**
     * Construct a {@link TrackSignaling}.
     * @param {string} name
     * @param {Track.Kind} kind
     * @param {boolean} isEnabled
     * @param {Track.Priority} priority
     */
    function TrackSignaling(name, kind, isEnabled, priority) {
        var _this = _super.call(this) || this;
        var sid = null;
        Object.defineProperties(_this, {
            _error: {
                value: null,
                writable: true
            },
            _isEnabled: {
                value: isEnabled,
                writable: true
            },
            _priority: {
                value: priority,
                writable: true
            },
            _trackTransceiver: {
                value: null,
                writable: true
            },
            _sid: {
                get: function () {
                    return sid;
                },
                set: function (_sid) {
                    if (sid === null) {
                        sid = _sid;
                    }
                }
            },
            kind: {
                enumerable: true,
                value: kind
            },
            name: {
                enumerable: true,
                value: name
            }
        });
        return _this;
    }
    Object.defineProperty(TrackSignaling.prototype, "error", {
        /**
         * Non-null if publication or subscription failed.
         * @property {?Error} error
         */
        get: function () {
            return this._error;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TrackSignaling.prototype, "isEnabled", {
        /**
         * Whether the {@link TrackSignaling} is enabled.
         * @property {boolean}
         */
        get: function () {
            return this._isEnabled;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TrackSignaling.prototype, "priority", {
        /**
         * The {@link TrackSignaling}'s priority.
         * @property {Track.Priority}
         */
        get: function () {
            return this._priority;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TrackSignaling.prototype, "sid", {
        /**
         * The {@link TrackSignaling}'s {@link Track.SID}.
         * @property {Track.SID}
         */
        get: function () {
            return this._sid;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(TrackSignaling.prototype, "trackTransceiver", {
        /**
         * The {@link TrackSignaling}'s {@link TrackTransceiver}.
         * @property {TrackTransceiver}
         */
        get: function () {
            return this._trackTransceiver;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Disable the {@link TrackSignaling} if it is not already disabled.
     * @return {this}
     */
    TrackSignaling.prototype.disable = function () {
        return this.enable(false);
    };
    /**
     * Enable (or disable) the {@link TrackSignaling} if it is not already enabled
     * (or disabled).
     * @param {boolean} [enabled=true]
     * @return {this}
     */
    TrackSignaling.prototype.enable = function (enabled) {
        enabled = typeof enabled === 'boolean' ? enabled : true;
        if (this.isEnabled !== enabled) {
            this._isEnabled = enabled;
            this.emit('updated');
        }
        return this;
    };
    /**
     * Set the {@link TrackTransceiver} on the {@link TrackSignaling}.
     * @param {TrackTransceiver} trackTransceiver
     * @returns {this}
     */
    TrackSignaling.prototype.setTrackTransceiver = function (trackTransceiver) {
        trackTransceiver = trackTransceiver || null;
        if (this.trackTransceiver !== trackTransceiver) {
            this._trackTransceiver = trackTransceiver;
            this.emit('updated');
        }
        return this;
    };
    /**
     * Set the SID on the {@link TrackSignaling} once.
     * @param {string} sid
     * @returns {this}
     */
    TrackSignaling.prototype.setSid = function (sid) {
        if (this.sid === null) {
            this._sid = sid;
            this.emit('updated');
        }
        return this;
    };
    return TrackSignaling;
}(EventEmitter));
/**
 * Emitted whenever the {@link TrackSignaling} is updated
 * @event TrackSignaling#updated
 */
module.exports = TrackSignaling;
//# sourceMappingURL=track.js.map