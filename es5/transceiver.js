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
var QueueingEventEmitter = require('./queueingeventemitter');
/**
 * A {@link TrackTransceiver} represents either one or more local RTCRtpSenders
 * or RTCDataChannels, or a single RTCRtpReceiver or remote RTCDataChannel.
 * @extends QueueingEventEmitter
 * @property {Track.ID} id
 * @property {Track.kind} kind
 */
var TrackTransceiver = /** @class */ (function (_super) {
    __extends(TrackTransceiver, _super);
    /**
     * Construct a {@link TrackTransceiver}.
     * @param {Track.ID} id
     * @param {Track.kind} kind
     */
    function TrackTransceiver(id, kind) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            id: {
                enumerable: true,
                value: id
            },
            kind: {
                enumerable: true,
                value: kind
            }
        });
        return _this;
    }
    /**
     * Stop the {@link TrackTransceiver}.
     * #emits TrackTransceiver#stopped
     * @returns {void}
     */
    TrackTransceiver.prototype.stop = function () {
        this.emit('stopped');
    };
    return TrackTransceiver;
}(QueueingEventEmitter));
/**
 * The {@link TrackTransceiver} was stopped.
 * @event TrackTransceiver#stopped
 */
module.exports = TrackTransceiver;
//# sourceMappingURL=transceiver.js.map