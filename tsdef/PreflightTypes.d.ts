// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AudioCodec, AudioCodecSettings, OpusCodecSettings, VP8CodecSettings, VideoCodec, VideoCodecSettings } from './types';

export interface PreflightOptions {
  preferredAudioCodecs?: Array<AudioCodec | AudioCodecSettings | OpusCodecSettings>;
  preferredVideoCodecs?: Array<VideoCodec | VideoCodecSettings | VP8CodecSettings>;
  duration?: number;
  environment?: string;
  region?: string;
}

export interface TimeMeasurement {
  start: number,
  end?: number,
  duration?: number
}

export interface NetworkTiming {
  connect?: TimeMeasurement;
  dtls?: TimeMeasurement;
  ice?: TimeMeasurement;
  peerConnection?: TimeMeasurement;
  media?: TimeMeasurement;
}

interface RTCIceCandidate {
  readonly candidate: string;
  readonly component: RTCIceComponent | null;
  readonly foundation: string | null;
  readonly port: number | null;
  readonly priority: number | null;
  readonly protocol: RTCIceProtocol | null;
  readonly relatedAddress: string | null;
  readonly relatedPort: number | null;
  readonly sdpMLineIndex: number | null;
  readonly sdpMid: string | null;
  readonly tcpType: RTCIceTcpCandidateType | null;
  readonly type: RTCIceCandidateType | null;
  readonly usernameFragment: string | null;
  toJSON(): RTCIceCandidateInit;
}

export interface RTCIceCandidateStats {
  transportId: string;
  address?: string;
  port?: number;
  protocol?: string;
  candidateType?: string;
  priority?: number;
  url?: number;
  relayProtocol?: number;
}

export interface SelectedIceCandidatePairStats {
  localCandidate: RTCIceCandidateStats;
  remoteCandidate: RTCIceCandidateStats;
}

export interface Stats {
  average: number;
  max: number;
  min: number;
}

export interface PreflightReportTrackStats {
  jitter: Stats|null;
  rtt: Stats|null;
  mos: Stats|null;
  outgoingBitrate?: Stats|null;
  incomingBitrate?: Stats|null;
  packetLoss: Stats|null;
}

export interface PreflightTestReport {
  preflightSID: string;
  sessionSID: string;
  testTiming: TimeMeasurement;
  networkTiming: NetworkTiming;
  stats: PreflightReportTrackStats
  iceCandidateStats: RTCIceCandidateStats[];
  selectedIceCandidatePairStats: SelectedIceCandidatePairStats | null;
  qualityScore: number
}


