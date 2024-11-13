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
 * A {@link RemoteAudioTrackPublication} represents a {@link RemoteAudioTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "audio"
 * @property {?RemoteAudioTrack} track - unless you have subscribed to the
 *   {@link RemoteAudioTrack}, this property is null
 * @emits RemoteAudioTrackPublication#subscribed
 * @emits RemoteAudioTrackPublication#subscriptionFailed
 * @emits RemoteAudioTrackPublication#trackDisabled
 * @emits RemoteAudioTrackPublication#trackEnabled
 * @emits RemoteAudioTrackPublication#unsubscribed
 */
var RemoteAudioTrackPublication = /** @class */ (function (_super) {
    __extends(RemoteAudioTrackPublication, _super);
    /**
     * Construct a {@link RemoteAudioTrackPublication}.
     * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
     * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
     *   options
     */
    function RemoteAudioTrackPublication(signaling, options) {
        return _super.call(this, signaling, options) || this;
    }
    RemoteAudioTrackPublication.prototype.toString = function () {
        return "[RemoteAudioTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return RemoteAudioTrackPublication;
}(RemoteTrackPublication));
/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was subscribed to
 * @event RemoteAudioTrackPublication#subscribed
 */
/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteAudioTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteAudioTrack} could not be
 *   subscribed to
 * @event RemoteAudioTrackPublication#subscriptionFailed
 */
/**
 * The {@link RemoteAudioTrack} was disabled.
 * @event RemoteAudioTrackPublication#trackDisabled
 */
/**
 * The {@link RemoteAudioTrack} was enabled.
 * @event RemoteAudioTrackPublication#trackEnabled
 */
/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was unsubscribed from
 * @event RemoteAudioTrackPublication#unsubscribed
 */
module.exports = RemoteAudioTrackPublication;
//# sourceMappingURL=remoteaudiotrackpublication.js.map