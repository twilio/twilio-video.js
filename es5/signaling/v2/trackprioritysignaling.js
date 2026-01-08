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
var TrackPrioritySignaling = /** @class */ (function (_super) {
    __extends(TrackPrioritySignaling, _super);
    /**
     * Construct a {@link TrackPrioritySignaling}.
     * @param {Promise<DataTrackReceiver>} getReceiver
     */
    function TrackPrioritySignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'track_priority', options) || this;
        Object.defineProperties(_this, {
            _enqueuedPriorityUpdates: {
                value: new Map()
            },
        });
        _this.on('ready', function (transport) {
            Array.from(_this._enqueuedPriorityUpdates.keys()).forEach(function (trackSid) {
                transport.publish({
                    type: 'track_priority',
                    track: trackSid,
                    subscribe: _this._enqueuedPriorityUpdates.get(trackSid)
                });
                // NOTE(mpatwardhan)- we do not clear _enqueuedPriorityUpdates intentionally,
                // this cache will is used to re-send the priorities in case of VMS-FailOver.
            });
        });
        return _this;
    }
    /**
     * @param {Track.SID} trackSid
     * @param {'publish'|'subscribe'} publishOrSubscribe
     * @param {Track.Priority} priority
     */
    TrackPrioritySignaling.prototype.sendTrackPriorityUpdate = function (trackSid, publishOrSubscribe, priority) {
        if (publishOrSubscribe !== 'subscribe') {
            throw new Error('only subscribe priorities are supported, found: ' + publishOrSubscribe);
        }
        this._enqueuedPriorityUpdates.set(trackSid, priority);
        if (this._transport) {
            this._transport.publish({
                type: 'track_priority',
                track: trackSid,
                subscribe: priority
            });
        }
    };
    return TrackPrioritySignaling;
}(MediaSignaling));
module.exports = TrackPrioritySignaling;
//# sourceMappingURL=trackprioritysignaling.js.map