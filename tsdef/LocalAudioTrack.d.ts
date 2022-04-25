import { AudioTrack } from './AudioTrack';
import { LocalTrackOptions } from './LocalTrackOptions';
import { NoiseCancellation } from './types';
import { Track } from './Track';

export class LocalAudioTrack extends AudioTrack {
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isStopped: boolean;
  noiseCancellation?: NoiseCancellation;

  disable(): this;
  enable(enabled?: boolean): this;
  restart(constraints?: MediaTrackConstraints): Promise<void>;
  stop(): this;

  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: 'stopped', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}

/**
* createLocalAudioTrack returns KrispAudioTrack if
* LocalAudioTrackOptions.noiseCancellationOptions was
* specified when creating a track
*/
export interface KrispAudioTrack extends LocalAudioTrack {
  /**
   * enables krisp audio processing.
   */
  enableKrisp(): void;

  /**
   * disables krisp audio processing.
   */
  disableKrisp(): void;
}
