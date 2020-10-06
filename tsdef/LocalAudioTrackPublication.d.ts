import { LocalTrackPublication } from './LocalTrackPublication';

export class LocalAudioTrackPublication extends LocalTrackPublication {
  kind: 'audio';
  track: LocalAudioTrack;

  setPriority(priority: Track.Priority): this;
  unpublish(): this;

  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
}
