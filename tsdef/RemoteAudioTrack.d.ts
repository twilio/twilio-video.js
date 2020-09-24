import { AudioTrack } from './AudioTrack';
import { Track } from './Track';

export class RemoteAudioTrack extends AudioTrack {
  sid: Track.SID;
  priority: Track.Priority;
  isSwitchedOff: boolean;
  isEnabled: boolean;

  on(event: "disabled", listener: () => void): void;
  on(event: "enabled", listener: () => void): void;
  on(event: "started", listener: () => void): void;
  on(event: "switchedOff", listener: () => void): void;
  on(event: "switchedOn", listener: () => void): void;
}
