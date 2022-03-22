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
var MediaSignaling = require('./mediasignaling');
/**
 * @emits TrackSwitchOffSignalinging#updated
 */
var TrackSwitchOffSignaling = /** @class */ (function (_super) {
    __extends(TrackSwitchOffSignaling, _super);
    /**
     * Construct a {@link TrackSwitchOffSignaling}.
     * @param {Promise<DataTrackReceiver>} getReceiver
     */
    function TrackSwitchOffSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'track_switch_off', options) || this;
        _this.on('ready', function (transport) {
            transport.on('message', function (message) {
                switch (message.type) {
                    case 'track_switch_off':
                        _this._setTrackSwitchOffUpdates(message.off || [], message.on || []);
                        break;
                    default:
                        break;
                }
            });
        });
        return _this;
    }
    /**
     * @private
     * @param {[Track.SID]} tracksSwitchedOff
     * @param {[Track.SID]} tracksSwitchedOn
     * @returns {void}
     */
    TrackSwitchOffSignaling.prototype._setTrackSwitchOffUpdates = function (tracksSwitchedOff, tracksSwitchedOn) {
        this.emit('updated', tracksSwitchedOff, tracksSwitchedOn);
    };
    return TrackSwitchOffSignaling;
}(MediaSignaling));
/**
 * @event TrackSwitchOffSignaling#updated
 */
module.exports = TrackSwitchOffSignaling;
//# sourceMappingURL=trackswitchoffsignaling.js.map