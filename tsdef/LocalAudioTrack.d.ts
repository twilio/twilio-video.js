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

  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: 'stopped', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
