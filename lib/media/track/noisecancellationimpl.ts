'use strict';

import { NoiseCancellation, NoiseCancellationOptions, NoiseCancellationVendor } from '../../../tsdef/types';
import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';
const Log = require('../../util/log');

/**
 * {@link NoiseCancellation} interface provides methods to control noise cancellation at runtime.
 * This interface is exposed on {@link LocalAudioTrack} property `noiseCancellation`. It is available only when
 * {@link NoiseCancellationOptions} are specified when creating a {@link LocalAudioTrack}
 * @alias NoiseCancellation
 * @interface
 *
 * @example
 * const { connect, createLocalAudioTrack } = require('twilio-video');
 *
 * // create a local audio track and have it use
 * // @twilio/krisp-audio-plugin for noise cancellation processing.
 * const localAudioTrack = await Video.createLocalAudioTrack({
 *   noiseCancellationOptions: {
 *     vendor: 'krisp',
 *     sdkAssetsPath: '/twilio-krisp-audio-plugin/1.0.0/dist'
 *   }
 * });
 *
 * // publish the track to a room
 * const room = await connect( token, {
 *   tracks: [localAudioTrack]
 *   // ... any other connect options
 * });
 *
 * // you can enable/disable noise cancellation at runtime
 * // using noiseCancellation interface exposed by localAudioTrack
 * function updateNoiseCancellation(enable: boolean) {
 *   const noiseCancellation = localAudioTrack.noiseCancellation;
 *
 *   if (noiseCancellation) {
 *     enable ? noiseCancellation.enable() : noiseCancellation.disable();
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
   * Identifies the vendor
   * @type {NoiseCancellationVendor}
   */
  get vendor(): NoiseCancellationVendor {
    return this._processor.vendor;
  }

  /**
   * Underlying MediaStreamTrack
   * @type {MediaStreamTrack}
   */
  get sourceTrack(): MediaStreamTrack {
    return this._sourceTrack;
  }

  /**
   * Set to true if noise cancellation is currently enabled
   * @type {boolean}
   */
  get isEnabled(): boolean {
    return this._processor.isEnabled();
  }

  /**
   * Enables noise cancellation
   * @returns {Promise<void>} a promise that resolves when operation is complete.
   */
  enable() : Promise<void> {
    if (this._disabledPermanent) {
      throw new Error(`${this.vendor} noise cancellation is disabled permanently for this track`);
    }

    this._processor.enable();
    return Promise.resolve();
  }

  /**
   * Disables noise cancellation
   * @returns {Promise<void>} a promise that resolves when operation is complete.
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
