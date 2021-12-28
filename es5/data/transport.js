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
var EventEmitter = require('events').EventEmitter;
/**
 * @classdesc A {@link DataTransport} implements {@link MediaSignalingTransport}
 *   in terms of an RTCDataChannel.
 * @extends EventEmitter
 * @implements MediaSignalingTransport
 * @emits DataTransport#message
 */
var DataTransport = /** @class */ (function (_super) {
    __extends(DataTransport, _super);
    /**
     * Construct a {@link DataTransport}.
     * @param {RTCDataChannel} dataChannel
     */
    function DataTransport(dataChannel) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _dataChannel: {
                value: dataChannel
            },
            _messageQueue: {
                value: []
            }
        });
        dataChannel.addEventListener('open', function () {
            _this._messageQueue.splice(0).forEach(function (message) { return _this._publish(message); });
        });
        dataChannel.addEventListener('message', function (_a) {
            var data = _a.data;
            try {
                var message = JSON.parse(data);
                _this.emit('message', message);
            }
            catch (error) {
                // Do nothing.
            }
        });
        _this.publish({ type: 'ready' });
        return _this;
    }
    /**
     * @param message
     * @private
     */
    DataTransport.prototype._publish = function (message) {
        var data = JSON.stringify(message);
        try {
            this._dataChannel.send(data);
        }
        catch (error) {
            // Do nothing.
        }
    };
    /**
     * Publish a message. Returns true if calling the method resulted in
     * publishing (or eventually publishing) the update.
     * @param {object} message
     * @returns {boolean}
     */
    DataTransport.prototype.publish = function (message) {
        var dataChannel = this._dataChannel;
        if (dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
            return false;
        }
        if (dataChannel.readyState === 'connecting') {
            this._messageQueue.push(message);
            return true;
        }
        this._publish(message);
        return true;
    };
    return DataTransport;
}(EventEmitter));
/**
 * The {@link DataTransport} received a message.
 * @event DataTransport#message
 * @param {object} message
 */
module.exports = DataTransport;
//# sourceMappingURL=transport.js.map