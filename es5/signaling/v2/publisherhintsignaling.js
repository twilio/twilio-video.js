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
var PublisherHintsSignaling = /** @class */ (function (_super) {
    __extends(PublisherHintsSignaling, _super);
    /**
     * Construct a {@link RenderHintsSignaling}.
     */
    function PublisherHintsSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'publisher_hints', options) || this;
        _this.on('ready', function (transport) {
            _this._log.info('publisher_hints transport ready:', transport);
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
    /**
     * @private
     */
    PublisherHintsSignaling.prototype._processPublisherHints = function (hints, id) {
        var hintResponses = [];
        try {
            hints.forEach(function (hint) {
                hintResponses.push({
                    track: hint.track,
                    result: 'OK'
                });
            });
            this.emit('updated', hints);
        }
        catch (ex) {
            this._log.error('error processing hints:', ex);
        }
        var payLoad = {
            type: 'publisher_hints',
            publisher: { id: id, hints: hintResponses }
        };
        this._log.debug('Outgoing: ', payLoad);
        this._transport.publish(payLoad);
    };
    return PublisherHintsSignaling;
}(MediaSignaling));
module.exports = PublisherHintsSignaling;
//# sourceMappingURL=publisherhintsignaling.js.map