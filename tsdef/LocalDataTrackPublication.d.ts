import { LocalDataTrack } from './LocalDataTrack';
import { LocalTrackPublication } from './LocalTrackPublication';

export class LocalDataTrackPublication extends LocalTrackPublication {
  kind: 'data';
  track: LocalDataTrack;
}
