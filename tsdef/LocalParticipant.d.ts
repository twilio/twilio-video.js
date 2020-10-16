import { NetworkQualityConfiguration, NetworkQualityLevel, NetworkQualityStats } from './NetworkQuality';
import { EncodingParameters } from './EncodingParameters';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
import { LocalTrack } from './types';
import { LocalTrackOptions } from './LocalTrackOptions';
import { LocalTrackPublication } from './LocalTrackPublication';
import { LocalVideoTrack } from './LocalVideoTrack';
import { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
import { Participant } from './Participant';
import { Track } from './Track';
import { TwilioError } from './TwilioError';

export class LocalParticipant extends Participant {
  audioTracks: Map<Track.SID, LocalAudioTrackPublication>;
  dataTracks: Map<Track.SID, LocalDataTrackPublication>;
  tracks: Map<Track.SID, LocalTrackPublication>;
  videoTracks: Map<Track.SID, LocalVideoTrackPublication>;
  signalingRegion: string;

  publishTrack(track: LocalTrack): Promise<LocalTrackPublication>;
  publishTrack(mediaStreamTrack: MediaStreamTrack, options?: LocalTrackOptions): Promise<LocalTrackPublication>;
  publishTracks(tracks: Array<LocalTrack | MediaStreamTrack>): Promise<LocalTrackPublication[]>;
  setNetworkQualityConfiguration(networkQualityConfiguration: NetworkQualityConfiguration): LocalParticipant;
  setParameters(encodingParameters?: EncodingParameters | null): LocalParticipant;
  unpublishTrack(track: LocalTrack | MediaStreamTrack): LocalTrackPublication;
  unpublishTracks(tracks: Array<LocalTrack | MediaStreamTrack>): LocalTrackPublication[];

  on(event: 'disconnected', listener: (participant: Participant) => void): this;
  on(event: 'reconnected', listener: (participant: Participant) => void): this;
  on(event: 'reconnecting', listener: (participant: Participant) => void): this;
  on(event: 'trackDimensionsChanged', listener: (track: LocalVideoTrack) => void): this;
  on(event: 'networkQualityLevelChanged', listener: (networkQualityLevel: NetworkQualityLevel, networkQualityStats: NetworkQualityStats) => void): this;
  on(event: 'trackEnabled', listener: (track: LocalTrack) => void): this;
  on(event: 'trackDisabled', listener: (track: LocalTrack) => void): this;
  on(event: 'trackPublicationFailed', listener: (error: TwilioError, track: LocalTrack) => void): this;
  on(event: 'trackPublished', listener: (publication: LocalTrackPublication) => void): this;
  on(event: 'trackStarted', listener: (track: LocalTrack) => void): this;
  on(event: 'trackStopped', listener: (track: LocalTrack) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
