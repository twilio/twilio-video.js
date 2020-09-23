import { AudioTrack } from './AudioTrack';
import { Track } from './Track';

export class RemoteAudioTrack extends AudioTrack {
  sid: Track.SID;
  priority: Track.Priority;
  isSwitchedOff: boolean;
  isEnabled: boolean;
}
