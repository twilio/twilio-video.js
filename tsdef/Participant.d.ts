import { AudioTrackPublication, DataTrackPublication, NetworkQualityLevel, NetworkQualityStats, VideoTrackPublication } from './types';
import { EventEmitter } from 'events';
import { Track } from './Track';
import { TrackPublication } from './TrackPublication';
import { VideoTrack } from './VideoTrack';

export namespace Participant {
  type Identity = string;
  type SID = string;
}

export class Participant extends EventEmitter {
  audioTracks: Map<Track.SID, AudioTrackPublication>;
  dataTracks: Map<Track.SID, DataTrackPublication>;
  identity: Participant.Identity;
  networkQualityLevel: NetworkQualityLevel | null;
  networkQualityStats: NetworkQualityStats | null;
  sid: Participant.SID;
  state: string;
  tracks: Map<Track.SID, TrackPublication>;
  videoTracks: Map<Track.SID, VideoTrackPublication>;

  on(event: 'disconnected', listener: (participant: this) => void): this;
  on(event: 'networkQualityLevelChanged', listener: (networkQualityLevel: NetworkQualityLevel, networkQualityStats: NetworkQualityStats) => void): this;
  on(event: 'reconnected', listener: (participant: this) => void): this;
  on(event: 'reconnecting', listener: (participant: this) => void): this;
  on(event: 'trackDimensionsChanged', listener: (track: VideoTrack) => void): this;
  on(event: 'trackStarted', listener: (track: Track) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
