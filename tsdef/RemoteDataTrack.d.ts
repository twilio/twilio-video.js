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
}
