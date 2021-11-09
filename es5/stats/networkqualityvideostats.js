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
 * {@link NetworkQualityMediaStats} for a {@link Participant}'s video.
 */
var NetworkQualityVideoStats = /** @class */ (function (_super) {
    __extends(NetworkQualityVideoStats, _super);
    /**
     * Construct a {@link NetworkQualityVideoStats}.
     * @param {MediaLevels} mediaLevels
     */
    function NetworkQualityVideoStats(mediaLevels) {
        return _super.call(this, mediaLevels) || this;
    }
    return NetworkQualityVideoStats;
}(NetworkQualityMediaStats));
module.exports = NetworkQualityVideoStats;
//# sourceMappingURL=networkqualityvideostats.js.map