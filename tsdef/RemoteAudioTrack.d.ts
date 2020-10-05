import { AudioTrack } from './AudioTrack';
import { Track } from './Track';

export class RemoteAudioTrack extends AudioTrack {
  sid: Track.SID;
  priority: Track.Priority;
  isSwitchedOff: boolean;
  isEnabled: boolean;

  on(event: 'disabled', listener: (track: this) => any): this;
  on(event: 'enabled', listener: (track: this) => any): this;
  on(event: 'started', listener: (track: this) => any): this;
  on(event: 'switchedOff', listener: (track: this) => any): this;
  on(event: 'switchedOn', listener: (track: this) => any): this;
}
