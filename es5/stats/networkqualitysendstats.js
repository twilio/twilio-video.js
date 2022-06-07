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
var NetworkQualitySendOrRecvStats = require('./networkqualitysendorrecvstats');
/**
 * {@link NetworkQualitySendOrRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code> is calculated.
 */
var NetworkQualitySendStats = /** @class */ (function (_super) {
    __extends(NetworkQualitySendStats, _super);
    /**
     * Construct a {@link NetworkQualitySendStats}.
     * @param {SendOrRecvStats} sendOrRecvStats
     */
    function NetworkQualitySendStats(sendOrRecvStats) {
        return _super.call(this, sendOrRecvStats) || this;
    }
    return NetworkQualitySendStats;
}(NetworkQualitySendOrRecvStats));
module.exports = NetworkQualitySendStats;
//# sourceMappingURL=networkqualitysendstats.js.map