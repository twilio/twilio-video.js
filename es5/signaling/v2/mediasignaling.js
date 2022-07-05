/* eslint callback-return:0 */
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
var EventEmitter = require('events');
var nInstances = 0;
var MediaSignaling = /** @class */ (function (_super) {
    __extends(MediaSignaling, _super);
    /**
     * Construct a {@link MediaSignaling}.
     * @param {Promise<DataTrackReceiver>} getReceive
     * @param {string} channel
     */
    function MediaSignaling(getReceiver, channel, options) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _instanceId: {
                value: nInstances++
            },
            channel: {
                value: channel,
            },
            _log: {
                value: options.log.createLog('default', _this)
            },
            _getReceiver: {
                value: getReceiver
            },
            _receiverPromise: {
                value: null,
                writable: true,
            },
            _transport: {
                value: null,
                writable: true
            }
        });
        return _this;
    }
    Object.defineProperty(MediaSignaling.prototype, "isSetup", {
        get: function () {
            return !!this._receiverPromise;
        },
        enumerable: false,
        configurable: true
    });
    MediaSignaling.prototype.toString = function () {
        return "[MediaSignaling #" + this._instanceId + ":" + this.channel + "]";
    };
    MediaSignaling.prototype.setup = function (id) {
        var _this = this;
        this._teardown();
        this._log.info('setting up msp transport for id:', id);
        var receiverPromise = this._getReceiver(id).then(function (receiver) {
            if (receiver.kind !== 'data') {
                _this._log.error('Expected a DataTrackReceiver');
            }
            if (_this._receiverPromise !== receiverPromise) {
                return;
            }
            try {
                _this._transport = receiver.toDataTransport();
                _this.emit('ready', _this._transport);
            }
            catch (ex) {
                _this._log.error("Failed to toDataTransport: " + ex.message);
            }
            receiver.once('close', function () { return _this._teardown(); });
        });
        this._receiverPromise = receiverPromise;
    };
    MediaSignaling.prototype._teardown = function () {
        if (this._transport) {
            this._log.info('Tearing down');
            this._transport = null;
            this._receiverPromise = null;
            this.emit('teardown');
        }
    };
    return MediaSignaling;
}(EventEmitter));
module.exports = MediaSignaling;
//# sourceMappingURL=mediasignaling.js.map