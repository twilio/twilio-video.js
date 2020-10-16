import { EncodingParameters } from './EncodingParameters';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
import { LocalTrack } from './types';
import { LocalTrackOptions } from './LocalTrackOptions';
import { LocalTrackPublication } from './LocalTrackPublication';
import { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
import { NetworkQualityConfiguration } from './NetworkQuality';
import { Participant } from './Participant';
import { Track } from './Track';

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
}
