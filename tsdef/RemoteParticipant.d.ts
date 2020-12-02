import { Participant } from './Participant';
import { RemoteAudioTrackPublication } from './RemoteAudioTrackPublication';
import { RemoteDataTrack } from './RemoteDataTrack';
import { RemoteDataTrackPublication } from './RemoteDataTrackPublication';
import { RemoteTrack } from './types';
import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { RemoteVideoTrackPublication } from './RemoteVideoTrackPublication';
import { Track } from './Track';
import { TwilioError } from './TwilioError';

export class RemoteParticipant extends Participant {
  audioTracks: Map<Track.SID, RemoteAudioTrackPublication>;
  dataTracks: Map<Track.SID, RemoteDataTrackPublication>;
  tracks: Map<Track.SID, RemoteTrackPublication>;
  videoTracks: Map<Track.SID, RemoteVideoTrackPublication>;

  on(event: 'disconnected', listener: (participant: this) => void): this;
  on(event: 'trackDimensionsChanged', listener: (track: RemoteVideoTrack) => void): this;
  on(event: 'trackDisabled', listener: (track: RemoteTrackPublication) => void): this;
  on(event: 'trackEnabled', listener: (track: RemoteTrackPublication) => void): this;
  on(event: 'trackMessage', listener: (data: string | ArrayBuffer, track: RemoteDataTrack) => void):this;
  on(event: 'trackPublished', listener: (publication: RemoteTrackPublication) => void): this;
  on(event: 'trackPublishPriorityChanged', listener: (priority: Track.Priority, publication: RemoteTrackPublication) => void): this;
  on(event: 'trackStarted', listener: (track: RemoteTrack) => void): this;
  on(event: 'trackSubscribed', listener: (track: RemoteTrack, publication: RemoteTrackPublication) => void): this;
  on(event: 'trackSubscriptionFailed', listener: (error: TwilioError, publication: RemoteTrackPublication) => void): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteTrack, publication: RemoteTrackPublication) => void): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteTrack, publication: RemoteTrackPublication) => void): this;
  on(event: 'trackUnpublished', listener: (publication: RemoteTrackPublication) => void): this;
  on(event: 'trackUnsubscribed', listener: (track: RemoteTrack, publication: RemoteTrackPublication) => void): this;
  on(event: string, listener: (...args: any[]) => void): this;
}
