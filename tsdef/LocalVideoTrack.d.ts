import { LocalTrackOptions } from './LocalTrackOptions';
import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export class LocalVideoTrack extends VideoTrack {
  constructor(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions);

  id: Track.ID;
  isStopped: boolean;

  disable(): this;
  enable(enabled?: boolean): this;
  restart(constraints?: MediaTrackConstraints): Promise<void>;
  stop(): this;

  on(event: 'dimensionsChanged', listener: (track: VideoTrack) => any): this;
  on(event: 'disabled', listener: (track: this) => any): this;
  on(event: 'enabled', listener: (track: this) => any): this;
  on(event: 'started', listener: (track: this) => any): this;
  on(event: 'stopped', listener: (track: this) => any): this;
}
