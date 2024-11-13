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
var MediaSignaling = require('./mediasignaling');
var messageId = 1;
var PublisherHintsSignaling = /** @class */ (function (_super) {
    __extends(PublisherHintsSignaling, _super);
    /**
     * Construct a {@link RenderHintsSignaling}.
     */
    function PublisherHintsSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'publisher_hints', options) || this;
        _this.on('ready', function (transport) {
            _this._log.debug('publisher_hints transport ready:', transport);
            transport.on('message', function (message) {
                _this._log.debug('Incoming: ', message);
                switch (message.type) {
                    case 'publisher_hints':
                        if (message.publisher && message.publisher.hints && message.publisher.id) {
                            _this._processPublisherHints(message.publisher.hints, message.publisher.id);
                        }
                        break;
                    default:
                        _this._log.warn('Unknown message type: ', message.type);
                        break;
                }
            });
        });
        return _this;
    }
    PublisherHintsSignaling.prototype.sendTrackReplaced = function (_a) {
        var trackSid = _a.trackSid;
        if (!this._transport) {
            return;
        }
        var payLoad = {
            type: 'client_reset',
            track: trackSid,
            id: messageId++
        };
        this._log.debug('Outgoing: ', payLoad);
        this._transport.publish(payLoad);
    };
    PublisherHintsSignaling.prototype.sendHintResponse = function (_a) {
        var id = _a.id, hints = _a.hints;
        if (!this._transport) {
            return;
        }
        var payLoad = {
            type: 'publisher_hints',
            id: id,
            hints: hints
        };
        this._log.debug('Outgoing: ', payLoad);
        this._transport.publish(payLoad);
    };
    /**
     * @private
     */
    PublisherHintsSignaling.prototype._processPublisherHints = function (hints, id) {
        try {
            this.emit('updated', hints, id);
        }
        catch (ex) {
            this._log.error('error processing hints:', ex);
        }
    };
    return PublisherHintsSignaling;
}(MediaSignaling));
module.exports = PublisherHintsSignaling;
//# sourceMappingURL=publisherhintsignaling.js.map