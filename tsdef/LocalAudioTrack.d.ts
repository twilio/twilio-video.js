import { AudioTrack } from './AudioTrack';
import { LocalTrackOptions } from './LocalTrackOptions';
import { Track } from './Track';

export class LocalAudioTrack extends AudioTrack {
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isStopped: boolean;

  disable(): LocalAudioTrack;
  enable(enabled?: boolean): LocalAudioTrack;
  restart(constraints?: MediaTrackConstraints): Promise<void>;
  stop(): LocalAudioTrack;

  on(event: 'disabled', listener: (track: this) => any): this;
  on(event: 'enabled', listener: (track: this) => any): this;
  on(event: 'started', listener: (track: this) => any): this;
  on(event: 'stopped', listener: (track: this) => any): this;
}
