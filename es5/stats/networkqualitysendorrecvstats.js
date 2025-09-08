'use strict';
var NetworkQualityBandwidthStats = require('./networkqualitybandwidthstats');
var NetworkQualityFractionLostStats = require('./networkqualityfractionloststats');
var NetworkQualityLatencyStats = require('./networkqualitylatencystats');
/**
 * Network quality statistics shared between {@link NetworkQualitySendStats} and
 * {@link NetworkQualityRecvStats} based on which a {@link Participant}'s
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#send</code> or
 * {@link NetworkQualityMediaStats}<code style="padding:0 0">#recv</code> is calculated.
 * @property {?NetworkQualityBandwidthStats} bandwidth - bandwidth statistics
 * @property {?NetworkQualityLatencyStats} latency - latency statistics
 * @property {?NetworkQualityFractionLostStats} fractionLost - fraction lost statistics
 */
var NetworkQualitySendOrRecvStats = /** @class */ (function () {
    /**
     * Construct a {@link NetworkQualitySendOrRecvStats}.
     * @param {SendOrRecvStats} sendOrRecvStats
     */
    function NetworkQualitySendOrRecvStats(_a) {
        var _b = _a.bandwidth, bandwidth = _b === void 0 ? null : _b, _c = _a.fractionLost, fractionLost = _c === void 0 ? null : _c, _d = _a.latency, latency = _d === void 0 ? null : _d;
        Object.defineProperties(this, {
            bandwidth: {
                value: bandwidth ? new NetworkQualityBandwidthStats(bandwidth) : null,
                enumerable: true
            },
            fractionLost: {
                value: fractionLost ? new NetworkQualityFractionLostStats(fractionLost) : null,
                enumerable: true
            },
            latency: {
                value: latency ? new NetworkQualityLatencyStats(latency) : null,
                enumerable: true
            }
        });
    }
    return NetworkQualitySendOrRecvStats;
}());
module.exports = NetworkQualitySendOrRecvStats;
//# sourceMappingURL=networkqualitysendorrecvstats.js.map