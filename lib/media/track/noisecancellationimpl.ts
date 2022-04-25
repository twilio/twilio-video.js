'use strict';

import { NoiseCancellation, NoiseCancellationOptions, NoiseCancellationVendor } from '../../../tsdef/types';
import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { CreateLocalTrackOptions } from '../../createlocaltrack';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';
const Log = require('../../util/log');

const LocalAudioTrack = require('./localaudiotrack');
export class NoiseCancellationImpl implements NoiseCancellation {
  private _processor: AudioProcessor;
  constructor(processor: AudioProcessor) {
    this._processor = processor;
  }

  /**
   * @returns vendor
   */
  get vendor(): NoiseCancellationVendor {
    return this._processor.vendor;
  }

  /**
   * enables noise cancellation
   */
  enable() : Promise<void> {
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
    const processedTrack = await this._processor.connect(track);
    if (processorWasEnabled) {
      this._processor.enable();
    } else {
      this._processor.disable();
    }
    return processedTrack;
  }
}


export async function createLocalAudioTrackWithNoiseCancellation(
  mediaStreamTrack: MediaStreamTrack,
  noiseCancellationOptions: NoiseCancellationOptions,
  options: CreateLocalTrackOptions,
  log: typeof Log
) : Promise<typeof LocalAudioTrack> {
  try {
    const processor = await createNoiseCancellationAudioProcessor(noiseCancellationOptions, log);
    const cleanTrack  = await processor.connect(mediaStreamTrack);
    const noiseCancellation = new NoiseCancellationImpl(processor);
    return new LocalAudioTrack(cleanTrack, { ...options, noiseCancellation });
  } catch (ex) {
    // in case of failures to load noise cancellation library we should just create normal LocalAudioTrack.
    log.warn(`Failed to create noise cancellation. Returning normal audio track: ${ex}`);
    return new LocalAudioTrack(mediaStreamTrack, options);
  }
}

