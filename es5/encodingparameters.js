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
 * {@link EncodingParametersImpl} represents an object which notifies its
 * listeners of any changes in the values of its properties.
 * @extends EventEmitter
 * @implements EncodingParameters
 * @emits EncodingParametersImpl#changed
 * @property {?number} maxAudioBitrate
 * @property {?number} maxVideoBitrate
 */
var EncodingParametersImpl = /** @class */ (function (_super) {
    __extends(EncodingParametersImpl, _super);
    /**
     * Construct an {@link EncodingParametersImpl}.
     * @param {EncodingParamters} encodingParameters - Initial {@link EncodingParameters}
     * @param {Boolean} adaptiveSimulcast - true if adaptive simulcast was enabled by connect options.
     */
    function EncodingParametersImpl(encodingParameters, adaptiveSimulcast) {
        var _this = _super.call(this) || this;
        encodingParameters = Object.assign({
            maxAudioBitrate: null,
            maxVideoBitrate: null
        }, encodingParameters);
        Object.defineProperties(_this, {
            maxAudioBitrate: {
                value: encodingParameters.maxAudioBitrate,
                writable: true
            },
            maxVideoBitrate: {
                value: encodingParameters.maxVideoBitrate,
                writable: true
            },
            adaptiveSimulcast: {
                value: adaptiveSimulcast
            }
        });
        return _this;
    }
    /**
     * Returns the bitrate values in an {@link EncodingParameters}.
     * @returns {EncodingParameters}
     */
    EncodingParametersImpl.prototype.toJSON = function () {
        return {
            maxAudioBitrate: this.maxAudioBitrate,
            maxVideoBitrate: this.maxVideoBitrate
        };
    };
    /**
     * Update the bitrate values with those in the given {@link EncodingParameters}.
     * @param {EncodingParameters} encodingParameters - The new {@link EncodingParameters}
     * @fires EncodingParametersImpl#changed
     */
    EncodingParametersImpl.prototype.update = function (encodingParameters) {
        var _this = this;
        encodingParameters = Object.assign({
            maxAudioBitrate: this.maxAudioBitrate,
            maxVideoBitrate: this.maxVideoBitrate
        }, encodingParameters);
        var shouldEmitChanged = [
            'maxAudioBitrate',
            'maxVideoBitrate'
        ].reduce(function (shouldEmitChanged, maxKindBitrate) {
            if (_this[maxKindBitrate] !== encodingParameters[maxKindBitrate]) {
                _this[maxKindBitrate] = encodingParameters[maxKindBitrate];
                shouldEmitChanged = true;
            }
            return shouldEmitChanged;
        }, false);
        if (shouldEmitChanged) {
            this.emit('changed');
        }
    };
    return EncodingParametersImpl;
}(EventEmitter));
/**
 * At least one of the {@link EncodingParametersImpl}'s bitrate values changed.
 * @event EncodingParametersImpl#changed
 */
module.exports = EncodingParametersImpl;
//# sourceMappingURL=encodingparameters.js.map