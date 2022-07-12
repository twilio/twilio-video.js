import { LocalTrack } from './types';
import { Track } from './Track';
import { TrackPublication } from './TrackPublication';

export class LocalTrackPublication extends TrackPublication {
  isTrackEnabled: boolean;
  kind: Track.Kind;
  priority: Track.Priority;
  track: LocalTrack;

  setPriority(priority: Track.Priority): this;
  unpublish(): this;

  on(event: 'trackDisabled', listener: () => void): this;
  on(event: 'trackEnabled', listener: () => void): this;
  on(event: 'warning', listener: (name: string) => void): this;
  on(event: 'warningsCleared', listener: () => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
