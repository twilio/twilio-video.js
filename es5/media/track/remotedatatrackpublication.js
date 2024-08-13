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
 * A {@link RemoteDataTrackPublication} represents a {@link RemoteDataTrack}
 * that has been published to a {@link Room}.
 * @property {Track.Kind} kind - "data"
 * @property {?RemoteDataTrack} track - unless you have subscribed to the
 *   {@link RemoteDataTrack}, this property is null
 * @emits RemoteDataTrackPublication#subscribed
 * @emits RemoteDataTrackPublication#subscriptionFailed
 * @emits RemoteDataTrackPublication#unsubscribed
 */
var RemoteDataTrackPublication = /** @class */ (function (_super) {
    __extends(RemoteDataTrackPublication, _super);
    /**
     * Construct a {@link RemoteDataTrackPublication}.
     * @param {RemoteTrackPublicationSignaling} signaling - {@link RemoteTrackPublication} signaling
     * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
     *   options
     */
    function RemoteDataTrackPublication(signaling, options) {
        return _super.call(this, signaling, options) || this;
    }
    RemoteDataTrackPublication.prototype.toString = function () {
        return "[RemoteDataTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return RemoteDataTrackPublication;
}(RemoteTrackPublication));
/**
 * Your {@link LocalParticipant} subscribed to the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was subscribed to
 * @event RemoteDataTrackPublication#subscribed
 */
/**
 * Your {@link LocalParticipant} failed to subscribe to the {@link RemoteDataTrack}.
 * @param {TwilioError} error - the reason the {@link RemoteDataTrack} could not be
 *   subscribed to
 * @event RemoteDataTrackPublication#subscriptionFailed
 */
/**
 * Your {@link LocalParticipant} unsubscribed from the {@link RemoteDataTrack}.
 * @param {RemoteDataTrack} track - the {@link RemoteDataTrack} that was unsubscribed from
 * @event RemoteDataTrackPublication#unsubscribed
 */
module.exports = RemoteDataTrackPublication;
//# sourceMappingURL=remotedatatrackpublication.js.map