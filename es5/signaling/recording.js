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
 * Represents recording state
 * @extends EventEmitter
 * @property {?boolean} isEnabled
 */
var RecordingSignaling = /** @class */ (function (_super) {
    __extends(RecordingSignaling, _super);
    /**
     * Construct a {@link RecordingSignaling}.
     */
    function RecordingSignaling() {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _isEnabled: {
                value: null,
                writable: true
            },
            isEnabled: {
                enumerable: true,
                get: function () {
                    return this._isEnabled;
                }
            }
        });
        return _this;
    }
    /**
     * Disable the {@link RecordingSignaling} if it is not already disabled.
     * @return {this}
     */
    RecordingSignaling.prototype.disable = function () {
        return this.enable(false);
    };
    /**
     * Enable (or disable) the {@link RecordingSignaling} if it is not already enabled
     * (or disabled).
     * @param {boolean} [enabled=true]
     * @return {this}
     */
    RecordingSignaling.prototype.enable = function (enabled) {
        enabled = typeof enabled === 'boolean' ? enabled : true;
        if (this.isEnabled !== enabled) {
            this._isEnabled = enabled;
            this.emit('updated');
        }
        return this;
    };
    return RecordingSignaling;
}(EventEmitter));
/**
 * Emitted whenever the {@link RecordingSignaling} is updated
 * @event RecordingSignaling#updated
 */
module.exports = RecordingSignaling;
//# sourceMappingURL=recording.js.map