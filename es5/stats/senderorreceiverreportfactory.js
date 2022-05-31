'use strict';
/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {RTCStats} lastStats
 */
var SenderOrReceiverReportFactory = /** @class */ (function () {
    /**
     * @param {StatsId} id
     * @param {TrackId} trackId
     * @param {RTCStats} initialStats
     */
    function SenderOrReceiverReportFactory(id, trackId, initialStats) {
        Object.defineProperties(this, {
            id: {
                enumerable: true,
                value: id,
                writable: true
            },
            trackId: {
                enumerable: true,
                value: trackId,
                writable: true
            },
            lastStats: {
                enumerable: true,
                value: initialStats,
                writable: true
            }
        });
    }
    return SenderOrReceiverReportFactory;
}());
module.exports = SenderOrReceiverReportFactory;
//# sourceMappingURL=senderorreceiverreportfactory.js.map