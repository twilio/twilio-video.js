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
/**
 * @emits TranscriptionSignaling#transcription
 */
var TranscriptionSignaling = /** @class */ (function (_super) {
    __extends(TranscriptionSignaling, _super);
    /**
     * Construct an {@link TranscriptionSignaling}.
     */
    function TranscriptionSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'extension_transcriptions', options) || this;
        _this.on('ready', function (transport) {
            transport.on('message', function (message) {
                switch (message.type) {
                    case 'extension_transcriptions':
                        _this.emit('transcription', message);
                        break;
                    default:
                        break;
                }
            });
        });
        return _this;
    }
    return TranscriptionSignaling;
}(MediaSignaling));
/**
 * @event TranscriptionSignaling#transcription
 */
module.exports = TranscriptionSignaling;
//# sourceMappingURL=transcriptionsignaling.js.map