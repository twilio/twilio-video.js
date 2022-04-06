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
 * The {@link RemoteAudioTrack} was disabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code>.
 * @deprecated Use <a href="event:trackSwitchedOff"><code>trackSwitchedOff</code></a> (<code>track.switchOffReason === "disabled-by-publisher"</code>) instead
 * @event RemoteAudioTrackPublication#trackDisabled
 */
/**
 * The {@link RemoteAudioTrack} was enabled. It is fired only if <code>.isSubscribed</code>
 * is set to <code>true</code>.
 * @deprecated Use <a href="event:trackSwitchedOn"><code>trackSwitchedOn</code></a> instead
 * @event RemoteAudioTrackPublication#trackEnabled
 */
/**
 * The {@link RemoteAudioTrack} was switched off. The media server stops sending media for
 * the {@link RemoteAudioTrack} until it is switched back on. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>true</code> and <code>switchOffReason</code>
 * is set to a {@link TrackSwitchOffReason}. Also, the <code>mediaStreamTrack</code> property
 * is set to <code>null</code>.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was switched off
 * @param {?TrackSwitchOffReason} switchOffReason - the reason the {@link RemoteAudioTrack}
 *   was switched off
 * @event RemoteAudioTrackPublication#trackSwitchedOff
 */
/**
 * The {@link RemoteAudioTrack} was switched on. The media server starts sending media for
 * the {@link RemoteAudioTrack} until it is switched off. Just before the event is raised,
 * <code>isSwitchedOff</code> is set to <code>false</code> and <code>switchOffReason</code>
 * is set to <code>null</code>. Also, the <code>mediaStreamTrack</code> property is set to a
 * MediaStreamTrack that is the source of the {@link RemoteAudioTrack}'s media.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was switched on
 * @event RemoteAudioTrackPublication#trackSwitchedOn
 */
/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteAudioTrack}.
 * @param {RemoteAudioTrack} track - the {@link RemoteAudioTrack} that was unsubscribed from
 * @event RemoteAudioTrackPublication#unsubscribed
 */
module.exports = RemoteAudioTrackPublication;
//# sourceMappingURL=remoteaudiotrackpublication.js.map