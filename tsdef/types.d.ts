
import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrack } from './LocalDataTrack';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
import { LocalVideoTrack } from './LocalVideoTrack';
import { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
import { RemoteAudioTrack } from './RemoteAudioTrack';
import { RemoteAudioTrackPublication } from './RemoteAudioTrackPublication';
import { RemoteDataTrack } from './RemoteDataTrack';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { RemoteVideoTrackPublication } from './RemoteVideoTrackPublication';

export type LocalTrack = LocalAudioTrack | LocalVideoTrack | LocalDataTrack;
export type RemoteTrack = RemoteAudioTrack | RemoteVideoTrack | RemoteDataTrack;
export type AudioTrackPublication = LocalAudioTrackPublication | RemoteAudioTrackPublication;
export type DataTrackPublication = LocalDataTrackPublication | RemoteAudioTrackPublication;
export type VideoTrackPublication = LocalVideoTrackPublication | RemoteVideoTrackPublication;

export interface EncodingParameters {
  maxAudioBitrate?: number | null;
  maxVideoBitrate?: number | null;
}

export type NetworkQualityLevel = number;

export type NetworkQualityVerbosity = 0 | 1 | 2 | 3;

export class NetworkQualityStats {
  level: NetworkQualityLevel;
  audio: NetworkQualityAudioStats | null;
  video: NetworkQualityVideoStats | null;
}

export class NetworkQualityMediaStats {
  send: NetworkQualityLevel;
  recv: NetworkQualityLevel;
  sendStats: NetworkQualitySendOrRecvStats | null;
  recvStats: NetworkQualitySendOrRecvStats | null;
}

export class NetworkQualityAudioStats extends NetworkQualityMediaStats {}

export class NetworkQualityVideoStats extends NetworkQualityMediaStats {}

export class NetworkQualitySendOrRecvStats {
  bandwidth: NetworkQualityBandwidthStats | null;
  latency: NetworkQualityLatencyStats | null;
  fractionLost: NetworkQualityFractionLostStats | null;
}

export class NetworkQualityBandwidthStats {
  actual: number | null;
  available: number | null;
  level: NetworkQualityLevel | null;
}
export class NetworkQualityFractionLostStats {
  fractionLost: number | null;
  level: NetworkQualityLevel | null;
}
export class NetworkQualityLatencyStats {
  jitter: number | null;
  rtt: number | null;
  level: NetworkQualityLevel | null;
}

export interface NetworkQualityConfiguration {
  local?: NetworkQualityVerbosity;
  remote?: NetworkQualityVerbosity;
}
