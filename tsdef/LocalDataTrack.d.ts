import { LocalDataTrackOptions } from './LocalDataTrackOptions';
import { Track } from './Track';

export class LocalDataTrack extends Track {
  constructor(options?: LocalDataTrackOptions);

  id: Track.ID;
  kind: 'data';
  maxPacketLifeTime: number | null;
  maxRetransmits: number | null;
  ordered: boolean;
  reliable: boolean;

  send(data: string | Blob | ArrayBuffer | ArrayBufferView): void;
}
