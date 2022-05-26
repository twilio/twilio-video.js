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
 * A {@link LocalDataTrackPublication} is a {@link LocalDataTrack} that has been
 * published to a {@link Room}.
 * @extends LocalTrackPublication
 * @property {Track.Kind} kind - "data"
 * @property {LocalDataTrack} track - the {@link LocalDataTrack}
 */
var LocalDataTrackPublication = /** @class */ (function (_super) {
    __extends(LocalDataTrackPublication, _super);
    /**
     * Construct a {@link LocalDataTrackPublication}.
     * @param {LocalTrackPublicationSignaling} signaling - The corresponding
     *   {@link LocalTrackPublicationSignaling}
     * @param {LocalDataTrack} track - the {@link LocalDataTrack}
     * @param {function(LocalTrackPublication): void} unpublish - The callback
     *    that unpublishes the {@link LocalTrackPublication}
     * @param {TrackPublicationOptions} options - {@link LocalTrackPublication} options
     */
    function LocalDataTrackPublication(signaling, track, unpublish, options) {
        return _super.call(this, signaling, track, unpublish, options) || this;
    }
    LocalDataTrackPublication.prototype.toString = function () {
        return "[LocalDataTrackPublication #" + this._instanceId + ": " + this.trackSid + "]";
    };
    return LocalDataTrackPublication;
}(LocalTrackPublication));
module.exports = LocalDataTrackPublication;
//# sourceMappingURL=localdatatrackpublication.js.map