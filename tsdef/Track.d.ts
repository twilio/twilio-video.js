import { EventEmitter } from 'events';

export namespace Track {
  type Kind = 'audio' | 'video' | 'data';
  type Priority = 'low' | 'standard' | 'high';
  type SID = string;
  enum SwitchOffReason {
    DISABLED_BY_PUBLISHER = 'disabled-by-publisher',
    DISABLED_BY_SUBSCRIBER = 'disabled-by-subscriber',
    MAX_BANDWIDTH_REACHED = 'max-bandwidth-reached',
    MAX_TRACKS_SWITCHED_ON = 'max-tracks-switched-on',
    NETWORK_CONGESTION = 'network-congestion'
  }
}

export class Track extends EventEmitter {
  kind: Track.Kind;
  name: string;
}
