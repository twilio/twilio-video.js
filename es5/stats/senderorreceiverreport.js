'use strict';
/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {number} bitrate - bps
 */
var SenderOrReceiverReport = /** @class */ (function () {
    /**
     * Construct a {@link SenderOrReceiverReport}.
     * @param {StatsId} id
     * @param {TrackId} trackId
     * @param {number} bitrate - bps
     */
    function SenderOrReceiverReport(id, trackId, bitrate) {
        Object.defineProperties(this, {
            id: {
                enumerable: true,
                value: id
            },
            trackId: {
                enumerable: true,
                value: trackId
            },
            bitrate: {
                enumerable: true,
                value: bitrate
            }
        });
    }
    return SenderOrReceiverReport;
}());
module.exports = SenderOrReceiverReport;
//# sourceMappingURL=senderorreceiverreport.js.map