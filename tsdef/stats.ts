import { AudioLevel } from './types';
import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export class TrackStats {
  trackId: Track.ID;
  trackSid: Track.SID;
  timestamp: number;
  ssrc: string;
  packetsLost: number | null;
  codec: string | null;
}

export class LocalTrackStats extends TrackStats {
  bytesSent: number | null;
  packetsSent: number | null;
  roundTripTime: number | null;
}

export class LocalVideoTrackStats extends LocalTrackStats {
  captureDimensions: VideoTrack.Dimensions | null;
  dimensions: VideoTrack.Dimensions | null;
  captureFrameRate: number | null;
  frameRate: number | null;
}

export class LocalAudioTrackStats extends LocalTrackStats {
  audioLevel: AudioLevel | null;
  jitter: number | null;
}

export class RemoteTrackStats extends TrackStats {
  bytesReceived: number | null;
  packetsReceived: number | null;
}

export class RemoteAudioTrackStats extends RemoteTrackStats {
  audioLevel: AudioLevel | null;
  jitter: number | null;
}

export class RemoteVideoTrackStats extends RemoteTrackStats {
  dimensions: VideoTrack.Dimensions | null;
  frameRate: number | null;
}

export class StatsReport {
  peerConnectionId: string;
  localAudioTrackStats: LocalAudioTrackStats[];
  localVideoTrackStats: LocalVideoTrackStats[];
  remoteAudioTrackStats: RemoteAudioTrackStats[];
  remoteVideoTrackStats: RemoteVideoTrackStats[];
}
