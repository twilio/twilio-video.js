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
var TrackTransceiver = require('../../transceiver');
/**
 * A {@link MediaTrackTransceiver} represents either one or more local
 * RTCRtpSenders, or a single RTCRtpReceiver.
 * @extends TrackTransceiver
 * @property {MediaStreamTrack} track
 */
var MediaTrackTransceiver = /** @class */ (function (_super) {
    __extends(MediaTrackTransceiver, _super);
    /**
     * Construct a {@link MediaTrackTransceiver}.
     * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
     * @param {MediaStreamTrack} mediaStreamTrack
     */
    function MediaTrackTransceiver(id, mediaStreamTrack) {
        var _this = _super.call(this, id, mediaStreamTrack.kind) || this;
        Object.defineProperties(_this, {
            _track: {
                value: mediaStreamTrack,
                writable: true
            },
            enabled: {
                enumerable: true,
                get: function () {
                    return this._track.enabled;
                }
            },
            readyState: {
                enumerable: true,
                get: function () {
                    return this._track.readyState;
                }
            },
            track: {
                enumerable: true,
                get: function () {
                    return this._track;
                }
            }
        });
        return _this;
    }
    MediaTrackTransceiver.prototype.stop = function () {
        this.track.stop();
        _super.prototype.stop.call(this);
    };
    return MediaTrackTransceiver;
}(TrackTransceiver));
module.exports = MediaTrackTransceiver;
//# sourceMappingURL=transceiver.js.map