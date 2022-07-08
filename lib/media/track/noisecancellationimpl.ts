'use strict';

import { NoiseCancellation, NoiseCancellationOptions, NoiseCancellationVendor } from '../../../tsdef/types';
import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';
const Log = require('../../util/log');

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
   * @returns {NoiseCancellationVendor} vendor
   */
  get vendor(): NoiseCancellationVendor {
    return this._processor.vendor;
  }

  /**
   * @returns {MediaStreamTrack} returns original underlying track
   */
  get sourceTrack(): MediaStreamTrack {
    return this._sourceTrack;
  }

  /**
   * @returns {boolean} true if noise cancellation is enabled
   */
  get isEnabled(): boolean {
    return this._processor.isEnabled();
  }

  /**
   * enables noise cancellation
   */
  enable() : Promise<void> {
    if (this._disabledPermanent) {
      throw new Error(`${this.vendor} noise cancellation is disabled permanently for this track`);
    }

    this._processor.enable();
    return Promise.resolve();
  }

  /**
   * disables noise cancellation
   */
  disable() : Promise<void> {
    this._processor.disable();
    return Promise.resolve();
  }

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
   * disables noise cancellation permanently.
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
