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
var TrackSignaling = require('./track');
/**
 * A {@link RemoteTrackPublication} implementation
 * @extends TrackSignaling
 */
var RemoteTrackPublicationSignaling = /** @class */ (function (_super) {
    __extends(RemoteTrackPublicationSignaling, _super);
    /**
     * Construct a {@link RemoteTrackPublicationSignaling}.
     * @param {Track.SID} sid
     * @param {string} name
     * @param {Track.Kind} kind
     * @param {boolean} isEnabled
     * @param {Track.Priority} priority
     * @param {boolean} isSwitchedOff
     */
    function RemoteTrackPublicationSignaling(sid, name, kind, isEnabled, priority, isSwitchedOff) {
        var _this = _super.call(this, name, kind, isEnabled, priority) || this;
        Object.defineProperties(_this, {
            _isSwitchedOff: {
                value: isSwitchedOff,
                writable: true
            },
        });
        _this.setSid(sid);
        return _this;
    }
    Object.defineProperty(RemoteTrackPublicationSignaling.prototype, "isSubscribed", {
        /**
         * Whether the {@link RemoteTrackPublicationSignaling} is subscribed to.
         * @property {boolean}
         */
        get: function () {
            return !!this.trackTransceiver;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RemoteTrackPublicationSignaling.prototype, "isSwitchedOff", {
        /**
         * Whether the {@link RemoteTrackPublicationSignaling} is switched off.
         * @property {boolean}
         */
        get: function () {
            return this._isSwitchedOff;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @param {Error} error
     * @returns {this}
     */
    RemoteTrackPublicationSignaling.prototype.subscribeFailed = function (error) {
        if (!this.error) {
            this._error = error;
            this.emit('updated');
        }
        return this;
    };
    /**
     * Update the publish {@link Track.Priority}.
     * @param {Track.Priority} priority
     * @returns {this}
     */
    RemoteTrackPublicationSignaling.prototype.setPriority = function (priority) {
        if (this._priority !== priority) {
            this._priority = priority;
            this.emit('updated');
        }
        return this;
    };
    /**
     * Updates track switch on/off state.
     * @param {boolean} isSwitchedOff
     * @returns {this}
     */
    RemoteTrackPublicationSignaling.prototype.setSwitchedOff = function (isSwitchedOff) {
        if (this._isSwitchedOff !== isSwitchedOff) {
            this._isSwitchedOff = isSwitchedOff;
            this.emit('updated');
        }
        return this;
    };
    return RemoteTrackPublicationSignaling;
}(TrackSignaling));
module.exports = RemoteTrackPublicationSignaling;
//# sourceMappingURL=remotetrackpublication.js.map