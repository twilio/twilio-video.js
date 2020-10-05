import { EventEmitter } from 'events';
import { Track } from './Track';

export class TrackPublication extends EventEmitter {
  trackName: string;
  trackSid: Track.SID;

  toJSON(): string;
  toString(): string;

  on(event: 'trackDisabled', listener: (publication: this) => any): this;
  on(event: 'trackEnabled', listener: (publication: this) => any): this;
}
