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
var MediaSignaling = require('../v2/mediasignaling');
var TrackSubscriptionsSignaling = /** @class */ (function (_super) {
    __extends(TrackSubscriptionsSignaling, _super);
    /**
     * Construct a {@link TrackSubscriptionsSignaling}.
     */
    function TrackSubscriptionsSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'track_subscriptions', options) || this;
        Object.defineProperties(_this, {
            _currentRevision: {
                value: null,
                writable: true
            }
        });
        var log = _this._log;
        _this.on('ready', function (transport) {
            log.debug(_this.channel + " transport ready");
            transport.on('message', function (message) {
                switch (message.type) {
                    case _this.channel:
                        _this._handleIncomingMessage(message);
                        break;
                    default:
                        log.warn("Unknown " + _this.channel + " MSP message type:", message.type);
                        break;
                }
            });
        });
        return _this;
    }
    /**
     * @private
     */
    TrackSubscriptionsSignaling.prototype._handleIncomingMessage = function (message) {
        var _a = this, log = _a._log, currentRevision = _a._currentRevision;
        var _b = message.data, data = _b === void 0 ? {} : _b, _c = message.errors, errors = _c === void 0 ? {} : _c, _d = message.media, media = _d === void 0 ? {} : _d, revision = message.revision;
        // TODO(mmalavalli): Remove this once SFU sends revision as integer instead of string.
        var revisionNumber = Number(revision);
        if (currentRevision !== null && currentRevision >= revisionNumber) {
            log.warn("Ignoring incoming " + this.channel + " message as " + currentRevision + " (current revision) >= " + revision + " (incoming revision)");
            log.debug("Ignored incoming " + this.channel + " message:", message);
            return;
        }
        log.debug("Incoming " + this.channel + " MSP message:", message);
        this._currentRevision = revisionNumber;
        this.emit('updated', media, data, errors);
    };
    return TrackSubscriptionsSignaling;
}(MediaSignaling));
module.exports = TrackSubscriptionsSignaling;
//# sourceMappingURL=tracksubscriptionssignaling.js.map