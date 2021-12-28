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
var RemoteTrackPublication = require('./remotetrackpublication');
/**
 * A {@link RemoteVideoTrackPublication} represents a {@link RemoteVideoTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "video"
 * @property {?RemoteVideoTrack} track - unless you have subscribed to the
 *   {@link RemoteVideoTrack}, this property is null
 * @emits RemoteVideoTrackPublication#subscribed
 * @emits RemoteVideoTrackPublication#subscriptionFailed
 * @emits RemoteVideoTrackPublication#trackDisabled
 * @emits RemoteVideoTrackPublication#trackEnabled
 * @emits RemoteVideoTrackPublication#unsubscribed
 */
var RemoteVideoTrackPublication = /** @class */ (function (_super) {
    __extends(RemoteVideoTrackPublication, _super);
    /**
     * Construct a {@link RemoteVideoTrackPublication}.
     * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
     * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
     *   options
     */
    function RemoteVideoTrackPublication(signaling, options) {
        return _super.call(this, signaling, options) || this;
    }
    RemoteVideoTrackPublication.prototype.toString = function () {
        return "[RemoteVideoTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return RemoteVideoTrackPublication;
}(RemoteTrackPublication));
/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was subscribed to
 * @event RemoteVideoTrackPublication#subscribed
 */
/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteVideoTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteVideoTrack} could not be
 *   subscribed to
 * @event RemoteVideoTrackPublication#subscriptionFailed
 */
/**
 * The {@link RemoteVideoTrack} was disabled.
 * @event RemoteVideoTrackPublication#trackDisabled
 */
/**
 * The {@link RemoteVideoTrack} was enabled.
 * @event RemoteVideoTrackPublication#trackEnabled
 */
/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteVideoTrack}.
 * @param {RemoteVideoTrack} track - the {@link RemoteVideoTrack} that was unsubscribed from
 * @event RemoteVideoTrackPublication#unsubscribed
 */
module.exports = RemoteVideoTrackPublication;
//# sourceMappingURL=remotevideotrackpublication.js.map