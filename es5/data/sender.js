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
var makeUUID = require('../util').makeUUID;
/**
 * A {@link DataTrackSender} represents a {@link DataTrackTransceiver} over
 * which data can be sent. Internally, it uses a collection of RTCDataChannels
 * to send data.
 * @extends DataTrackTransceiver
 */
var DataTrackSender = /** @class */ (function (_super) {
    __extends(DataTrackSender, _super);
    /**
     * Construct a {@link DataTrackSender}.
     * @param {?number} maxPacketLifeTime
     * @param {?number} maxRetransmits
     * @param {boolean} ordered
     */
    function DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered) {
        var _this = _super.call(this, makeUUID(), maxPacketLifeTime, maxRetransmtis, ordered) || this;
        Object.defineProperties(_this, {
            _clones: {
                value: new Set()
            },
            _dataChannels: {
                value: new Set()
            }
        });
        return _this;
    }
    /**
     * Add a cloned {@link DataTrackSender}.
     * @private
     * @returns {void}
     */
    DataTrackSender.prototype._addClone = function (clone) {
        this._clones.add(clone);
    };
    /**
     * Remove a cloned {@link DataTrackSender}.
     * @returns {void}
     */
    DataTrackSender.prototype.removeClone = function (clone) {
        this._clones.delete(clone);
    };
    /**
     * Add an RTCDataChannel to the {@link DataTrackSender}.
     * @param {RTCDataChannel} dataChannel
     * @returns {this}
     */
    DataTrackSender.prototype.addDataChannel = function (dataChannel) {
        this._dataChannels.add(dataChannel);
        return this;
    };
    /**
     * Return a new {@link DataTrackSender}. Any message sent over this
     * {@link DataTrackSender} will also be sent over the clone. Whenever this
     * {@link DataTrackSender} is stopped, so to will the clone.
     * @returns {DataTrackSender}
     */
    DataTrackSender.prototype.clone = function () {
        var _this = this;
        var clone = new DataTrackSender(this.maxPacketLifeTime, this.maxRetransmits, this.ordered);
        this._addClone(clone);
        clone.once('stopped', function () { return _this.removeClone(clone); });
        return clone;
    };
    /**
     * Remove an RTCDataChannel from the {@link DataTrackSender}.
     * @param {RTCDataChannel} dataChannel
     * @returns {this}
     */
    DataTrackSender.prototype.removeDataChannel = function (dataChannel) {
        this._dataChannels.delete(dataChannel);
        return this;
    };
    /**
     * Send data over the {@link DataTrackSender}. Internally, this calls
     * <code>send</code> over each of the underlying RTCDataChannels.
     * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
     * @returns {this}
     */
    DataTrackSender.prototype.send = function (data) {
        this._dataChannels.forEach(function (dataChannel) {
            try {
                dataChannel.send(data);
            }
            catch (error) {
                // Do nothing.
            }
        });
        this._clones.forEach(function (clone) {
            try {
                clone.send(data);
            }
            catch (error) {
                // Do nothing.
            }
        });
        return this;
    };
    DataTrackSender.prototype.stop = function () {
        this._dataChannels.forEach(function (dataChannel) { return dataChannel.close(); });
        this._clones.forEach(function (clone) { return clone.stop(); });
        _super.prototype.stop.call(this);
    };
    return DataTrackSender;
}(DataTrackTransceiver));
module.exports = DataTrackSender;
//# sourceMappingURL=sender.js.map