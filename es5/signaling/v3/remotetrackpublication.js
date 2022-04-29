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
var RemoteTrackPublicationSignaling = require('../remotetrackpublication');
/**
 * @extends RemoteTrackPublicationSignaling
 */
var RemoteTrackPublicationV3 = /** @class */ (function (_super) {
    __extends(RemoteTrackPublicationV3, _super);
    /**
     * Construct a {@link RemoteTrackPublicationV3}.
     * @param {RemoteTrackPublicationV3#Representation} track
     * @param {boolean} isSwitchedOff
     * @param {?string} switchOffReason
     */
    function RemoteTrackPublicationV3(track, isSwitchedOff, switchOffReason) {
        if (switchOffReason === void 0) { switchOffReason = null; }
        var _this = this;
        switchOffReason = isSwitchedOff ? switchOffReason : null;
        var enabled = isEnabled(isSwitchedOff, switchOffReason);
        var kind = track.kind, name = track.name, priority = track.priority, sid = track.sid;
        _this = _super.call(this, sid, name, kind, enabled, priority, isSwitchedOff) || this;
        Object.defineProperties(_this, {
            _isSubscribed: {
                value: false,
                writable: true
            },
            _switchOffReason: {
                value: switchOffReason,
                writable: true
            }
        });
        return _this;
    }
    Object.defineProperty(RemoteTrackPublicationV3.prototype, "isSubscribed", {
        /**
         * Whether the {@link RemoteTrackPublicationV3} is subscribed to.
         * @property {boolean}
         */
        get: function () {
            return this._isSubscribed;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RemoteTrackPublicationV3.prototype, "switchOffReason", {
        /**
         * The reason for the {@link RemoteTrackPublicationV3} being switched off.
         * @returns {?string}
         */
        get: function () {
            return this._switchOffReason;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Updates track switch on/off state.
     * @param {boolean} isSwitchedOff
     * @param {?string} switchOffReason
     * @returns {this}
     */
    RemoteTrackPublicationV3.prototype.setSwitchedOff = function (isSwitchedOff, switchOffReason) {
        switchOffReason = isSwitchedOff ? switchOffReason : null;
        var shouldEmitUpdated = isSwitchedOff !== this.isSwitchedOff
            || switchOffReason !== this.switchOffReason;
        this._isSwitchedOff = isSwitchedOff;
        this._switchOffReason = switchOffReason;
        if (shouldEmitUpdated) {
            this.emit('updated');
        }
        return this.enable(isEnabled(isSwitchedOff, switchOffReason));
    };
    /**
     * Set the {@link MediaTrackReceiver} on the {@link RemoteTrackPublicationV3}.
     * @override
     * @param {MediaTrackReceiver} trackReceiver
     * @param {boolean} isSubscribed
     * @returns {this}
     */
    RemoteTrackPublicationV3.prototype.setTrackTransceiver = function (trackReceiver, isSubscribed) {
        isSubscribed = !!trackReceiver || isSubscribed;
        var shouldEmitUpdated = trackReceiver !== this.trackTransceiver || isSubscribed !== this.isSubscribed;
        this._trackTransceiver = trackReceiver;
        this._isSubscribed = isSubscribed;
        if (shouldEmitUpdated) {
            this.emit('updated');
        }
        return this;
    };
    /**
     * Compare the {@link RemoteTrackPublicationV3} to a
     * {@link RemoteTrackPublicationV3#Representation} of itself and perform any
     * updates necessary.
     * @param {RemoteTrackPublicationV3#Representation} track
     * @returns {this}
     * @fires TrackSignaling#updated
     */
    RemoteTrackPublicationV3.prototype.update = function (track) {
        this.setPriority(track.priority);
        return this;
    };
    return RemoteTrackPublicationV3;
}(RemoteTrackPublicationSignaling));
/**
 * @private
 * @param {boolean} isSwitchedOff
 * @param {?string} switchOffReason
 * @returns {boolean}
 */
function isEnabled(isSwitchedOff, switchOffReason) {
    return !(isSwitchedOff && switchOffReason === 'DISABLED_BY_PUBLISHER');
}
/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV3}.
 * @typedef {object} RemoteTrackPublicationV3#Representation
 * @property {Track.Kind} kind
 * @property {string} name
 * @priority {Track.Priority} priority
 * @property {Track.SID} sid
 */
module.exports = RemoteTrackPublicationV3;
//# sourceMappingURL=remotetrackpublication.js.map