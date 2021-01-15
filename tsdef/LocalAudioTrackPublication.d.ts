import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalTrackPublication } from './LocalTrackPublication';

export class LocalAudioTrackPublication extends LocalTrackPublication {
  kind: 'audio';
  track: LocalAudioTrack;
}
