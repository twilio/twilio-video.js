import { LocalTrackPublication } from './LocalTrackPublication';
import { LocalVideoTrack } from './LocalVideoTrack';

export class LocalVideoTrackPublication extends LocalTrackPublication {
  kind: 'video';
  track: LocalVideoTrack;
}
