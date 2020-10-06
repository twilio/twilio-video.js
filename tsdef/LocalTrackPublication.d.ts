import { Track } from './Track';
import { TrackPublication } from './TrackPublication';

export class LocalTrackPublication extends TrackPublication {
  isTrackEnabled: boolean;
  kind: Track.Kind;
  priority: Track.Priority;
  track: LocalTrack;

  setPriority(priority: Track.Priority): this;
  unpublish(): this;

  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
}
