import { EncodingParameters, LocalTrack, LocalTrackPublishOptions, MediaStreamTrackPublishOptions, NetworkQualityConfiguration } from './types';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
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

  publishTrack(track: LocalTrack, options?: LocalTrackPublishOptions): Promise<LocalTrackPublication>;
  publishTrack(track: MediaStreamTrack, options?: MediaStreamTrackPublishOptions): Promise<LocalTrackPublication>;
  publishTracks(tracks: Array<LocalTrack | MediaStreamTrack>): Promise<LocalTrackPublication[]>;
  setNetworkQualityConfiguration(networkQualityConfiguration: NetworkQualityConfiguration): this;
  setParameters(encodingParameters?: EncodingParameters | null): this;
  unpublishTrack(track: LocalTrack | MediaStreamTrack): LocalTrackPublication | null;
  unpublishTracks(tracks: Array<LocalTrack | MediaStreamTrack>): LocalTrackPublication[];

  on(event: 'disconnected', listener: (participant: this) => void): this;
  on(event: 'trackDimensionsChanged', listener: (track: LocalVideoTrack) => void): this;
  on(event: 'trackDisabled', listener: (track: LocalTrack) => void): this;
  on(event: 'trackEnabled', listener: (track: LocalTrack) => void): this;
  on(event: 'trackPublicationFailed', listener: (error: TwilioError, track: LocalTrack) => void): this;
  on(event: 'trackPublished', listener: (publication: LocalTrackPublication) => void): this;
  on(event: 'trackStarted', listener: (track: LocalTrack) => void): this;
  on(event: 'trackStopped', listener: (track: LocalTrack) => void): this;
  on(event: 'trackWarning', listener: (name: string, publication: LocalTrackPublication) => void): this;
  on(event: 'trackWarningsCleared', listener: (publication: LocalTrackPublication) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
