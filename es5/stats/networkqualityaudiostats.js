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
var NetworkQualityMediaStats = require('./networkqualitymediastats');
/**
 * {@link NetworkQualityMediaStats} for a {@link Participant}'s audio.
 */
var NetworkQualityAudioStats = /** @class */ (function (_super) {
    __extends(NetworkQualityAudioStats, _super);
    /**
     * Construct a {@link NetworkQualityAudioStats}.
     * @param {MediaLevels} mediaLevels
     */
    function NetworkQualityAudioStats(mediaLevels) {
        return _super.call(this, mediaLevels) || this;
    }
    return NetworkQualityAudioStats;
}(NetworkQualityMediaStats));
module.exports = NetworkQualityAudioStats;
//# sourceMappingURL=networkqualityaudiostats.js.map