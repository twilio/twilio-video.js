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
var LocalTrackPublication = require('./localtrackpublication');
/**
 * A {@link LocalVideoTrackPublication} is a {@link LocalVideoTrack} that has
 * been published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "video"
 * @property {LocalVideoTrack} track - the {@link LocalVideoTrack}
 */
var LocalVideoTrackPublication = /** @class */ (function (_super) {
    __extends(LocalVideoTrackPublication, _super);
    /**
     * Construct a {@link LocalVideoTrackPublication}.
     * @param {LocalTrackPublicationSignaling} signaling - The corresponding
     *   {@link LocalTrackPublicationSignaling}
     * @param {LocalVideoTrack} track - the {@link LocalVideoTrack}
     * @param {function(LocalTrackPublication): void} unpublish - The callback
     *    that unpublishes the {@link LocalTrackPublication}
     * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
     */
    function LocalVideoTrackPublication(signaling, track, unpublish, options) {
        return _super.call(this, signaling, track, unpublish, options) || this;
    }
    LocalVideoTrackPublication.prototype.toString = function () {
        return "[LocalVideoTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return LocalVideoTrackPublication;
}(LocalTrackPublication));
module.exports = LocalVideoTrackPublication;
//# sourceMappingURL=localvideotrackpublication.js.map