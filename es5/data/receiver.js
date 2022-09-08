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
var DataTrackTransceiver = require('./transceiver');
var DataTransport = require('./transport');
/**
 * A {@link DataTrackReceiver} represents a {@link DataTrackTransceiver} over
 * which data can be received. Internally, it users a single RTCDataChannel to
 * receive data.
 * @extends DataTrackTransceiver
 * @emits DataTrackReceiver#message
 * @emits DataTrackReceiver#close
 */
var DataTrackReceiver = /** @class */ (function (_super) {
    __extends(DataTrackReceiver, _super);
    /**
     * Construct an {@link DataTrackReceiver}.
     * @param {RTCDataChannel} dataChannel
     */
    function DataTrackReceiver(dataChannel) {
        var _this = _super.call(this, dataChannel.label, dataChannel.maxPacketLifeTime, dataChannel.maxRetransmits, dataChannel.ordered) || this;
        Object.defineProperties(_this, {
            _dataChannel: {
                value: dataChannel
            }
        });
        // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
        // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
        // and Safari.
        dataChannel.binaryType = 'arraybuffer';
        dataChannel.addEventListener('message', function (event) {
            _this.emit('message', event.data);
        });
        dataChannel.addEventListener('close', function () {
            _this.emit('close');
        });
        return _this;
    }
    DataTrackReceiver.prototype.stop = function () {
        this._dataChannel.close();
        _super.prototype.stop.call(this);
    };
    /**
     * Create a {@link DataTransport} from the {@link DataTrackReceiver}.
     * @returns {DataTransport}
     */
    DataTrackReceiver.prototype.toDataTransport = function () {
        return new DataTransport(this._dataChannel);
    };
    return DataTrackReceiver;
}(DataTrackTransceiver));
/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */
/**
 * @event DataTrackReceiver#close
 */
module.exports = DataTrackReceiver;
//# sourceMappingURL=receiver.js.map