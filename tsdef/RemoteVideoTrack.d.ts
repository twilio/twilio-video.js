import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export class RemoteVideoTrack extends VideoTrack {
  sid: Track.SID;
  priority: Track.Priority;
  isSwitchedOff: boolean;
  isEnabled: boolean;

  setPriority(priority: Track.Priority): RemoteVideoTrack;

  on(event: 'dimensionsChanged', listener: (track: this) => any): this;
  on(event: 'disabled', listener: (track: this) => any): this;
  on(event: 'enabled', listener: (track: this) => any): this;
  on(event: 'started', listener: (track: this) => any): this;
  on(event: 'stopped', listener: (track: this) => any): this;
  on(event: 'switchedOff', listener: (track: this) => any): this;
  on(event: 'switchedOn', listener: (track: this) => any): this;
}
