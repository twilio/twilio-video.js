import { LocalTrackPublication } from './LocalTrackPublication';

export class LocalDataTrackPublication extends LocalTrackPublication {
  kind: 'data';
  track: LocalDataTrack;

  setPriority(priority: Track.Priority): this;
  unpublish(): this;

  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
}
