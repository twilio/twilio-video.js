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
 * @property {?Track.SID} loudestParticipantSid
 * @emits DominantSpeakerSignaling#updated
 */
var DominantSpeakerSignaling = /** @class */ (function (_super) {
    __extends(DominantSpeakerSignaling, _super);
    /**
     * Construct an {@link DominantSpeakerSignaling}.
     */
    function DominantSpeakerSignaling(getReceiver, options) {
        var _this = _super.call(this, getReceiver, 'active_speaker', options) || this;
        Object.defineProperties(_this, {
            _loudestParticipantSid: {
                value: null,
                writable: true
            },
        });
        _this.on('ready', function (transport) {
            transport.on('message', function (message) {
                switch (message.type) {
                    case 'active_speaker':
                        _this._setLoudestParticipantSid(message.participant);
                        break;
                    default:
                        break;
                }
            });
        });
        return _this;
    }
    Object.defineProperty(DominantSpeakerSignaling.prototype, "loudestParticipantSid", {
        /**
         * Get the loudest {@link Track.SID}, if known.
         * @returns {?Track.SID}
         */
        get: function () {
            return this._loudestParticipantSid;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @private
     * @param {Track.SID} loudestParticipantSid
     * @returns {void}
     */
    DominantSpeakerSignaling.prototype._setLoudestParticipantSid = function (loudestParticipantSid) {
        if (this.loudestParticipantSid === loudestParticipantSid) {
            return;
        }
        this._loudestParticipantSid = loudestParticipantSid;
        this.emit('updated');
    };
    return DominantSpeakerSignaling;
}(MediaSignaling));
/**
 * @event DominantSpeakerSignaling#updated
 */
module.exports = DominantSpeakerSignaling;
//# sourceMappingURL=dominantspeakersignaling.js.map