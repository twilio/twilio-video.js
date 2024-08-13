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
var ParticipantSignaling = require('./participant');
/**
 * A {@link Participant} implementation
 * @extends ParticipantSignaling
 * @property {string} identity
 * @property {Participant.SID} sid
 */
var RemoteParticipantSignaling = /** @class */ (function (_super) {
    __extends(RemoteParticipantSignaling, _super);
    /**
     * Construct a {@link RemoteParticipantSignaling}.
     * @param {Participant.SID} sid
     * @param {string} identity
     */
    function RemoteParticipantSignaling(sid, identity) {
        var _this = _super.call(this) || this;
        _this.connect(sid, identity);
        return _this;
    }
    return RemoteParticipantSignaling;
}(ParticipantSignaling));
module.exports = RemoteParticipantSignaling;
//# sourceMappingURL=remoteparticipant.js.map