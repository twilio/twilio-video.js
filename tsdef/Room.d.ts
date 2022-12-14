import { LocalTrack, RemoteTrack, StatsReport } from './types';
import { EventEmitter } from 'events';
import { LocalParticipant } from './LocalParticipant';
import { LocalTrackPublication } from './LocalTrackPublication';
import { Participant } from './Participant';
import { RemoteDataTrack } from './RemoteDataTrack';
import { RemoteParticipant } from './RemoteParticipant';
import { RemoteTrackPublication } from './RemoteTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { Track } from './Track';
import { TwilioError } from './TwilioError';

export namespace Room {
  type SID = string;
}

export class Room extends EventEmitter {
  dominantSpeaker: RemoteParticipant | null;
  isRecording: boolean;
  localParticipant: LocalParticipant;
  mediaRegion: string;
  name: string;
  participants: Map<Participant.SID, RemoteParticipant>;
  sid: Room.SID;
  state: string;

  disconnect(): Room;
  getStats(): Promise<StatsReport[]>;
  refreshInactiveMedia(): void;

  on(event: 'disconnected', listener: (room: Room, error: TwilioError) => void): this;
  on(event: 'dominantSpeakerChanged', listener: (dominantSpeaker: RemoteParticipant) => void): this;
  on(event: 'participantConnected', listener: (participant: RemoteParticipant) => void): this;
  on(event: 'participantDisconnected', listener: (participant: RemoteParticipant) => void): this;
  on(event: 'participantReconnected', listener: (participant: RemoteParticipant) => void): this;
  on(event: 'participantReconnecting', listener: (participant: RemoteParticipant) => void): this;
  on(event: 'reconnected', listener: () => void): this;
  on(event: 'reconnecting', listener: (error: TwilioError) => void): this;
  on(event: 'recordingStarted', listener: () => void): this;
  on(event: 'recordingStopped', listener: () => void): this;
  on(event: 'trackDimensionsChanged', listener: (track: RemoteVideoTrack, participant: RemoteParticipant) => void): this;
  on(event: 'trackDisabled', listener: (publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackEnabled', listener: (publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackMessage', listener: (data: string | ArrayBuffer, track: RemoteDataTrack, participant: RemoteParticipant) => void): this;
  on(event: 'trackPublished', listener: (publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackPublishPriorityChanged', listener: (priority: Track.Priority, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackStarted', listener: (track: RemoteTrack, participant: RemoteParticipant) => void): this;
  on(event: 'trackSubscribed', listener: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackSubscriptionFailed', listener: (error: TwilioError, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackSwitchedOff', listener: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackSwitchedOn', listener: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackUnpublished', listener: (publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackUnsubscribed', listener: (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => void): this;
  on(event: 'trackWarning', listener: (name: string, publication: LocalTrackPublication, participant: LocalParticipant) => void): this;
  on(event: 'trackWarningsCleared', listener: (publication: LocalTrackPublication, participant: LocalParticipant) => void): this;
}
