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
var TrackTransceiver = require('../transceiver');
/**
 * A {@link DataTrackTransceiver} represents either one or more local
 * RTCDataChannels or a single remote RTCDataChannel. It can be used to send or
 * receive data.
 * @extends TrackTransceiver
 * @property {string} id
 * @property {string} kind - "data"
 * @property {?number} maxPacketLifeTime
 * @property {?number} maxRetransmits
 * @property {boolean} ordered
 */
var DataTrackTransceiver = /** @class */ (function (_super) {
    __extends(DataTrackTransceiver, _super);
    /**
     * Construct a {@link DataTrackTransceiver}.
     * @param {string} id
     * @param {?number} maxPacketLifeTime
     * @param {?number} maxRetransmits
     * @param {boolean} ordered
     */
    function DataTrackTransceiver(id, maxPacketLifeTime, maxRetransmits, ordered) {
        var _this = _super.call(this, id, 'data') || this;
        Object.defineProperties(_this, {
            maxPacketLifeTime: {
                enumerable: true,
                value: maxPacketLifeTime
            },
            maxRetransmits: {
                enumerable: true,
                value: maxRetransmits
            },
            ordered: {
                enumerable: true,
                value: ordered
            }
        });
        return _this;
    }
    return DataTrackTransceiver;
}(TrackTransceiver));
module.exports = DataTrackTransceiver;
//# sourceMappingURL=transceiver.js.map