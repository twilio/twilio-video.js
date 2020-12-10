import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export class RemoteVideoTrack extends VideoTrack {
  sid: Track.SID;
  priority: Track.Priority | null;
  isSwitchedOff: boolean;
  isEnabled: boolean;

  setPriority(priority: Track.Priority | null): this;

  on(event: 'dimensionsChanged', listener: (track: this) => void): this;
  on(event: 'disabled', listener: (track: this) => void): this;
  on(event: 'enabled', listener: (track: this) => void): this;
  on(event: 'started', listener: (track: this) => void): this;
  on(event: 'stopped', listener: (track: this) => void): this;
  on(event: 'switchedOff', listener: (track: this) => void): this;
  on(event: 'switchedOn', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
