'use strict';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyNoiseCancellation = exports.NoiseCancellationImpl = void 0;
var noisecancellationadapter_1 = require("../../noisecancellationadapter");
var Log = require('../../util/log');
/**
 * {@link NoiseCancellation} interface provides methods to control noise cancellation at runtime. This interface is exposed
 * on {@link LocalAudioTrack} property `noiseCancellation`. It is available only when {@link NoiseCancellationOptions} are
 * specified when creating a {@link LocalAudioTrack}, and the plugin is successfully loaded.
 * @alias NoiseCancellation
 * @interface
 *
 * @example
 * const { connect, createLocalAudioTrack } = require('twilio-video');
 *
 * // Create a LocalAudioTrack with Krisp noise cancellation enabled.
 * const localAudioTrack = await createLocalAudioTrack({
 *   noiseCancellationOptions: {
 *     sdkAssetsPath: 'path/to/hosted/twilio/krisp/audio/plugin/1.0.0/dist',
 *     vendor: 'krisp'
 *   }
 * });
 *
 * if (!localAudioTrack.noiseCancellation) {
 *   // If the Krisp audio plugin fails to load, then a warning message will be logged
 *   // in the browser console, and the "noiseCancellation" property will be set to null.
 *   // You can still use the LocalAudioTrack to join a Room. However, it will use the
 *   // browser's noise suppression instead of the Krisp noise cancellation. Make sure
 *   // the "sdkAssetsPath" provided in "noiseCancellationOptions" points to the correct
 *   // hosted path of the plugin assets.
 * } else {
 *   // Join a Room with the LocalAudioTrack.
 *   const room = await connect('token', {
 *     name: 'my-cool-room',
 *     tracks: [localAudioTrack]
 *   });
 *
 *   if (!localAudioTrack.noiseCancellation.isEnabled) {
 *     // Krisp noise cancellation is permanently disabled in Peer-to-Peer and Go Rooms.
 *   }
 * }
 *
 * //
 * // Enable/disable noise cancellation.
 * // @param {boolean} enable - whether noise cancellation should be enabled
 * //
 * function setNoiseCancellation(enable) {
 *   const { noiseCancellation } = localAudioTrack;
 *   if (noiseCancellation) {
 *     if (enable) {
 *       // If enabled, then the LocalAudioTrack will use the Krisp noise
 *       // cancellation instead of the browser's noise suppression.
 *       noiseCancellation.enable();
 *     } else {
 *       // If disabled, then the LocalAudioTrack will use the browser's
 *       // noise suppression instead of the Krisp noise cancellation.
 *       noiseCancellation.disable();
 *     }
 *   }
 * }
 */
var NoiseCancellationImpl = /** @class */ (function () {
    function NoiseCancellationImpl(processor, originalTrack) {
        this._processor = processor;
        this._sourceTrack = originalTrack;
        this._disabledPermanent = false;
    }
    Object.defineProperty(NoiseCancellationImpl.prototype, "vendor", {
        /**
         * Name of the noise cancellation vendor.
         * @type {NoiseCancellationVendor}
         */
        get: function () {
            return this._processor.vendor;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoiseCancellationImpl.prototype, "sourceTrack", {
        /**
         * The underlying MediaStreamTrack of the {@link LocalAudioTrack}.
         * @type {MediaStreamTrack}
         */
        get: function () {
            return this._sourceTrack;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(NoiseCancellationImpl.prototype, "isEnabled", {
        /**
         * Whether noise cancellation is enabled.
         * @type {boolean}
         */
        get: function () {
            return this._processor.isEnabled();
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Enable noise cancellation.
     * @returns {Promise<void>} Promise that resolves when the operation is complete
     * @throws {Error} Throws an error if noise cancellation is disabled permanently
     *   for the {@link LocalAudioTrack}
     */
    NoiseCancellationImpl.prototype.enable = function () {
        if (this._disabledPermanent) {
            throw new Error(this.vendor + " noise cancellation is disabled permanently for this track");
        }
        this._processor.enable();
        return Promise.resolve();
    };
    /**
     * Disable noise cancellation.
     * @returns {Promise<void>} Promise that resolves when the operation is complete
     */
    NoiseCancellationImpl.prototype.disable = function () {
        this._processor.disable();
        return Promise.resolve();
    };
    /**
     * @private
     */
    NoiseCancellationImpl.prototype.reacquireTrack = function (reacquire) {
        return __awaiter(this, void 0, void 0, function () {
            var processorWasEnabled, track, processedTrack;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        processorWasEnabled = this._processor.isEnabled();
                        this._processor.disconnect();
                        return [4 /*yield*/, reacquire()];
                    case 1:
                        track = _a.sent();
                        this._sourceTrack = track;
                        return [4 /*yield*/, this._processor.connect(track)];
                    case 2:
                        processedTrack = _a.sent();
                        if (processorWasEnabled) {
                            this._processor.enable();
                        }
                        else {
                            this._processor.disable();
                        }
                        return [2 /*return*/, processedTrack];
                }
            });
        });
    };
    /**
     * @private
     */
    NoiseCancellationImpl.prototype.disablePermanently = function () {
        this._disabledPermanent = true;
        return this.disable();
    };
    /**
     * @private
     */
    NoiseCancellationImpl.prototype.stop = function () {
        this._processor.disconnect();
        this._sourceTrack.stop();
    };
    return NoiseCancellationImpl;
}());
exports.NoiseCancellationImpl = NoiseCancellationImpl;
function applyNoiseCancellation(mediaStreamTrack, noiseCancellationOptions, log) {
    return __awaiter(this, void 0, void 0, function () {
        var processor, cleanTrack, noiseCancellation, ex_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, noisecancellationadapter_1.createNoiseCancellationAudioProcessor(noiseCancellationOptions, log)];
                case 1:
                    processor = _a.sent();
                    cleanTrack = processor.connect(mediaStreamTrack);
                    noiseCancellation = new NoiseCancellationImpl(processor, mediaStreamTrack);
                    return [2 /*return*/, { cleanTrack: cleanTrack, noiseCancellation: noiseCancellation }];
                case 2:
                    ex_1 = _a.sent();
                    // in case of failures to load noise cancellation library just return original media stream.
                    log.warn("Failed to create noise cancellation. Returning normal audio track: " + ex_1);
                    return [2 /*return*/, { cleanTrack: mediaStreamTrack }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
exports.applyNoiseCancellation = applyNoiseCancellation;
//# sourceMappingURL=noisecancellationimpl.js.map