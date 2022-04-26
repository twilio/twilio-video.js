'use strict';

import { NoiseCancellation, NoiseCancellationOptions, NoiseCancellationVendor } from '../../../tsdef/types';
import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { CreateLocalTrackOptions } from '../../createlocaltrack';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';

const LocalAudioTrack = require('./localaudiotrack');
export class NoiseCancellationImpl implements NoiseCancellation {
  private _processor: AudioProcessor;
  public vendor: NoiseCancellationVendor;
  constructor(processor: AudioProcessor, vendor: NoiseCancellationVendor) {
    this._processor = processor;
    this.vendor = vendor;
  }

  /**
   * enables audio processing.
   */
  enable() : Promise<void> {
    this._processor.enable();
    return Promise.resolve();
  }

  /**
   * disables krisp processing
   */
  disable() : Promise<void> {
    this._processor.disable();
    return Promise.resolve();
  }

  async reacquireTrack(reacquire: () => Promise<MediaStreamTrack>) : Promise<MediaStreamTrack>  {
    // disconnect the processor.
    const processorWasEnabled = this._processor.isEnabled();
    this._processor.disconnect();

    const track = await reacquire();
    const processedTrack = this._processor.connect(track);
    if (processorWasEnabled) {
      this._processor.enable();
    } else {
      this._processor.disable();
    }
    return processedTrack;
  }
}


export async function createLocalAudioTrackWithNoiseCancellation(mediaStreamTrack: MediaStreamTrack, noiseCancellationOptions: NoiseCancellationOptions, options: CreateLocalTrackOptions) : Promise<typeof LocalAudioTrack> {
  const processor = await createNoiseCancellationAudioProcessor(noiseCancellationOptions);
  const cleanTrack  = await processor.connect(mediaStreamTrack);

  const noiseCancellation = new NoiseCancellationImpl(processor, noiseCancellationOptions.vendor);

  return new LocalAudioTrack(cleanTrack, { ...options, noiseCancellation });
}

