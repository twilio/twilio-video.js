'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoiseCancellationImpl = void 0;
exports.applyNoiseCancellation = applyNoiseCancellation;
const tslib_1 = require("tslib");
const noisecancellationadapter_1 = require("../../noisecancellationadapter");
const Log = require('../../util/log');
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
class NoiseCancellationImpl {
    constructor(processor, originalTrack) {
        this._processor = processor;
        this._sourceTrack = originalTrack;
        this._disabledPermanent = false;
    }
    /**
     * Name of the noise cancellation vendor.
     * @type {NoiseCancellationVendor}
     */
    get vendor() {
        return this._processor.vendor;
    }
    /**
     * The underlying MediaStreamTrack of the {@link LocalAudioTrack}.
     * @type {MediaStreamTrack}
     */
    get sourceTrack() {
        return this._sourceTrack;
    }
    /**
     * Whether noise cancellation is enabled.
     * @type {boolean}
     */
    get isEnabled() {
        return this._processor.isEnabled();
    }
    /**
     * Enable noise cancellation.
     * @returns {Promise<void>} Promise that resolves when the operation is complete
     * @throws {Error} Throws an error if noise cancellation is disabled permanently
     *   for the {@link LocalAudioTrack}
     */
    enable() {
        if (this._disabledPermanent) {
            throw new Error(`${this.vendor} noise cancellation is disabled permanently for this track`);
        }
        this._processor.enable();
        return Promise.resolve();
    }
    /**
     * Disable noise cancellation.
     * @returns {Promise<void>} Promise that resolves when the operation is complete
     */
    disable() {
        this._processor.disable();
        return Promise.resolve();
    }
    /**
     * @private
     */
    reacquireTrack(reacquire) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const processorWasEnabled = this._processor.isEnabled();
            this._processor.disconnect();
            const track = yield reacquire();
            this._sourceTrack = track;
            const processedTrack = yield this._processor.connect(track);
            if (processorWasEnabled) {
                this._processor.enable();
            }
            else {
                this._processor.disable();
            }
            return processedTrack;
        });
    }
    /**
     * @private
     */
    disablePermanently() {
        this._disabledPermanent = true;
        return this.disable();
    }
    /**
     * @private
     */
    stop() {
        this._processor.disconnect();
        this._sourceTrack.stop();
    }
}
exports.NoiseCancellationImpl = NoiseCancellationImpl;
function applyNoiseCancellation(mediaStreamTrack, noiseCancellationOptions, log) {
    return tslib_1.__awaiter(this, void 0, void 0, function* () {
        try {
            const processor = yield (0, noisecancellationadapter_1.createNoiseCancellationAudioProcessor)(noiseCancellationOptions, log);
            const cleanTrack = processor.connect(mediaStreamTrack);
            const noiseCancellation = new NoiseCancellationImpl(processor, mediaStreamTrack);
            return { cleanTrack, noiseCancellation };
        }
        catch (ex) {
            // in case of failures to load noise cancellation library just return original media stream.
            log.warn(`Failed to create noise cancellation. Returning normal audio track: ${ex}`);
            return { cleanTrack: mediaStreamTrack };
        }
    });
}
//# sourceMappingURL=noisecancellationimpl.js.map