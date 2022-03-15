'use strict';

import { AudioProcessor } from '../../../tsdef/AudioProcessor';
import { CreateLocalTrackOptions } from '../../createlocaltrack';
import { NoiseCancellationOptions } from '../../../tsdef/types';
import { createNoiseCancellationAudioProcessor } from '../../noisecancellationadapter';

const LocalAudioTrack = require('./localaudiotrack');

/**
 * A {@link KrispLocalAudioTrack} is an {@link LocalAudioTrack} cleaned by
 * an external noise cancellation SDK
 */
export class KrispLocalAudioTrack extends LocalAudioTrack {
  _processor: AudioProcessor|null;

  constructor(mediaStreamTrack: MediaStreamTrack, processor: AudioProcessor, options: CreateLocalTrackOptions) {
    super(mediaStreamTrack, options);
    this._processor = processor;
    this._log.info('LocalAudioTrack options: ', options);
  }

  private toString() : string {
    return `[KrispLocalAudioTrack #${this._instanceId}: ${this.id}]`;
  }


  private async _reacquireTrack(constraints: never)  {
    this._log.debug('_reacquireTrack: ', constraints);

    // disconnect the processor.
    const processorWasEnabled = this._processor?.isEnabled();
    if (this._processor) {
      this._processor.disconnect();
    }

    const track = await super._reacquireTrack.call(this, constraints);
    if (this._processor) {
      this._log.debug('_maybeProcessTrack: ', track);
      const processedTrack = this._processor.connect(track);
      if (processorWasEnabled) {
        this._processor.enable();
      } else {
        this._processor.disable();
      }
      return processedTrack;
    }
    return track;
  }

  /**
   * enables krisp audio processing.
   * if the track was enabled for krisp processing.
   */
  enableKrisp() : void {
    if (this._processor) {
      this._log.debug('enableKrisp: ');
      this._processor.enable();
    }
  }

  /**
   * disables krisp processing permanently for the track.
   */
  _disableKrispInternal(): void {
    if (this._processor) {
      this._log.debug('_disableKrispInternal: ');
      this._processor.disable();
    }
    this._processor = null;
  }

  /**
   * disables krisp processing
   */
  disableKrisp() : void {
    if (this._processor) {
      this._log.debug('disableKrisp: ');
      this._processor.disable();
    }
  }
}

export async function createKrispLocalAudioTrack(mediaStreamTrack: MediaStreamTrack, noiseCancellationOptions: NoiseCancellationOptions, options: CreateLocalTrackOptions) : Promise<KrispLocalAudioTrack> {
  // eslint-disable-next-line no-console
  const processor = await createNoiseCancellationAudioProcessor(noiseCancellationOptions.sdkAssetsPath, noiseCancellationOptions.sdkFile);
  const cleanTrack  = processor.connect(mediaStreamTrack);
  return new KrispLocalAudioTrack(cleanTrack, processor, options);
}

