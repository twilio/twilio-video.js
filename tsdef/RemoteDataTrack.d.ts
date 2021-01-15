import { Track } from './Track';

export class RemoteDataTrack extends Track {
  isEnabled: boolean;
  isSubscribed: boolean;
  kind: 'data';
  maxPacketLifeTime: number | null;
  maxRetransmits: number | null;
  ordered: boolean;
  priority: Track.Priority | null;
  reliable: boolean;
  sid: Track.SID;

  setPriority(priority: Track.Priority | null): this;

  on(event: 'message', listener: (data: string | ArrayBuffer, track: RemoteDataTrack) => void): this;
  on(event: 'switchedOff', listener: (track: this) => void): this;
  on(event: 'switchedOn', listener: (track: this) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
