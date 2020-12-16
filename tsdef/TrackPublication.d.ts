import { EventEmitter } from 'events';
import { Track } from './Track';

export class TrackPublication extends EventEmitter {
  isEnabled: boolean;
  kind: Track.Kind;
  trackName: string;
  trackSid: Track.SID;

  on(event: 'trackDisabled', listener: () => void): this;
  on(event: 'trackEnabled', listener: () => void): this;
}
