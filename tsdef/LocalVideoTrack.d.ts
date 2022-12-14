import { LocalTrackOptions } from './LocalTrackOptions';
import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export class LocalVideoTrack extends VideoTrack {
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isMuted: boolean;
  isStopped: boolean;

  disable(): this;
  enable(enabled?: boolean): this;
  restart(constraints?: MediaTrackConstraints): Promise<void>;
  stop(): this;

  on(event: 'dimensionsChanged', listener: (track: VideoTrack) => void): this;
  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'muted', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: 'stopped', listener: (track: this) => void): this;
  on(event: 'unmuted', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
