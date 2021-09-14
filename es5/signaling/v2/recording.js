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
var RecordingSignaling = require('../recording');
/**
 * @extends RecordingSignaling
 */
var RecordingV2 = /** @class */ (function (_super) {
    __extends(RecordingV2, _super);
    /**
     * Construct a {@link RecordingV2}.
     */
    function RecordingV2() {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _revision: {
                value: 1,
                writable: true
            }
        });
        return _this;
    }
    /**
     * Compare the {@link RecordingV2} to a {@link RecordingV2#Representation}
     * of itself and perform any updates necessary.
     * @param {RecordingV2#Representation} recording
     * @returns {this}
     * @fires RecordingSignaling#updated
     */
    RecordingV2.prototype.update = function (recording) {
        if (recording.revision < this._revision) {
            return this;
        }
        this._revision = recording.revision;
        return this.enable(recording.is_recording);
    };
    return RecordingV2;
}(RecordingSignaling));
/**
 * The Room Signaling Protocol (RSP) representation of a {@link RecordingV2}
 * @typedef {object} RecordingV2#Representation
 * @property {boolean} enabled
 * @property {number} revision
 */
module.exports = RecordingV2;
//# sourceMappingURL=recording.js.map