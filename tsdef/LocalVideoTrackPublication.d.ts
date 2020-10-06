import { LocalTrackPublication } from './LocalTrackPublication';

export class LocalVideoTrackPublication extends LocalTrackPublication {
  kind: 'data';
  track: LocalVideoTrack;

  setPriority(priority: Track.Priority): this;
  unpublish(): this;

  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
}
