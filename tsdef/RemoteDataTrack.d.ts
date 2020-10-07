import { Track } from './Track';

export class RemoteDataTrack extends Track {
  isEnabled: boolean;
  isSubscribed: boolean;
  kind: 'data';
  maxPacketLifeTime: number | null;
  maxRetransmits: number | null;
  ordered: boolean;
  reliable: boolean;
  sid: Track.SID;

  setPriority(priority: Track.Priority | null): RemoteDataTrack;

  on(event: 'message', listener: (data: string | ArrayBuffer, track: RemoteDataTrack) => any): this;
  on(event: 'switchedOff', listener: (track: this) => any): this;
  on(event: 'switchedOn', listener: (track: this) => any): this;
}
