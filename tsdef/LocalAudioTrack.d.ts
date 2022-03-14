import { AudioProcessor } from './AudioProcessor';
import { AudioTrack } from './AudioTrack';
import { LocalTrackOptions } from './LocalTrackOptions';
import { Track } from './Track';

export class LocalAudioTrack extends AudioTrack {
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isStopped: boolean;

  disable(): this;
  enable(enabled?: boolean): this;
  restart(constraints?: MediaTrackConstraints): Promise<void>;
  stop(): this;
  getProcessor(): AudioProcessor|null;

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
   * if restartConstraints are specified, reacquires audio track
   * with given constrains before enabling krisp audio processing.
   * Typically developers should specify restartConstraints of
   * {
   *   noiseSuppression:false
   * }
   */
  enableKrisp(restartConstraints?: MediaTrackConstraints): Promise<void>

  /**
   * disables krisp audio processing.
   * This will disable krisp and if restartConstraints were specified
   * reacquires and restart the audio track with specified constraints.
   * Typically developers should specify restartConstraints of
   * {
   *    noiseSuppression:true
   * }
   */
  disableKrisp(restartConstraints?: MediaTrackConstraints): Promise<void>
}
