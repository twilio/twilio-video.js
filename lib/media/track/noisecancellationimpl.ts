'use strict';

import { NoiseCancellation, NoiseCancellationOptions, NoiseCancellationVendor } from '../../../tsdef/types';
import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';
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
export class NoiseCancellationImpl implements NoiseCancellation {
  private _processor: AudioProcessor;
  private _sourceTrack: MediaStreamTrack;
  private _disabledPermanent: boolean;

  constructor(processor: AudioProcessor, originalTrack: MediaStreamTrack) {
    this._processor = processor;
    this._sourceTrack = originalTrack;
    this._disabledPermanent = false;
  }

  /**
   * Name of the noise cancellation vendor.
   * @type {NoiseCancellationVendor}
   */
  get vendor(): NoiseCancellationVendor {
    return this._processor.vendor;
  }

  /**
   * The underlying MediaStreamTrack of the {@link LocalAudioTrack}.
   * @type {MediaStreamTrack}
   */
  get sourceTrack(): MediaStreamTrack {
    return this._sourceTrack;
  }

  /**
   * Whether noise cancellation is enabled.
   * @type {boolean}
   */
  get isEnabled(): boolean {
    return this._processor.isEnabled();
  }

  /**
   * Enable noise cancellation.
   * @returns {Promise<void>} Promise that resolves when the operation is complete
   * @throws {Error} Throws an error if noise cancellation is disabled permanently
   *   for the {@link LocalAudioTrack}
   */
  enable() : Promise<void> {
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
  disable() : Promise<void> {
    this._processor.disable();
    return Promise.resolve();
  }

  /**
   * @private
   */
  async reacquireTrack(reacquire: () => Promise<MediaStreamTrack>) : Promise<MediaStreamTrack>  {
    const processorWasEnabled = this._processor.isEnabled();
    this._processor.disconnect();

    const track = await reacquire();
    this._sourceTrack = track;

    const processedTrack = await this._processor.connect(track);
    if (processorWasEnabled) {
      this._processor.enable();
    } else {
      this._processor.disable();
    }
    return processedTrack;
  }

  /**
   * @private
   */
  disablePermanently(): Promise<void> {
    this._disabledPermanent = true;
    return this.disable();
  }


  /**
   * @private
   */
  stop(): void {
    this._processor.disconnect();
    this._sourceTrack.stop();
  }
}


export async function applyNoiseCancellation(
  mediaStreamTrack: MediaStreamTrack,
  noiseCancellationOptions: NoiseCancellationOptions,
  log: typeof Log
) : Promise<{ cleanTrack: MediaStreamTrack, noiseCancellation?: NoiseCancellation }> {
  try {
    const processor = await createNoiseCancellationAudioProcessor(noiseCancellationOptions, log);
    const cleanTrack = processor.connect(mediaStreamTrack);
    const noiseCancellation = new NoiseCancellationImpl(processor, mediaStreamTrack);
    return { cleanTrack, noiseCancellation };
  } catch (ex) {
    // in case of failures to load noise cancellation library just return original media stream.
    log.warn(`Failed to create noise cancellation. Returning normal audio track: ${ex}`);
    return { cleanTrack: mediaStreamTrack };
  }
}
