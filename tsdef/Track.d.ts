import { EventEmitter } from 'events';

export namespace Track {
  type Kind = 'audio' | 'video' | 'data';
  type Priority = 'low' | 'standard' | 'high';
  type ID = string;
  type SID = string;
}

export class Track extends EventEmitter {
  kind: Track.Kind;
  name: string;
}
