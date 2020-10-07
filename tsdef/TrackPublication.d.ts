import { EventEmitter } from 'events';
import { Track } from './Track';

export class TrackPublication extends EventEmitter {
  isEnabled: boolean;
  kind: Track.Kind;
  trackName: string;
  trackSid: Track.SID;

  toJSON(): string;
  toString(): string;

  on(event: 'trackDisabled', listener: () => any): this;
  on(event: 'trackEnabled', listener: () => any): this;
}
