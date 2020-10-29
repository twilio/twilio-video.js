
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
import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

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

export type AudioLevel = number;

export type AudioCodec = 'isac' | 'opus' | 'PCMA' | 'PCMU';
export type VideoCodec = 'H264' | 'VP8' | 'VP9';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';
export interface LogLevels {
  default: LogLevel;
  media: LogLevel;
  signaling: LogLevel;
  webrtc: LogLevel;
}

export type TrackSwitchOffMode = 'detected' | 'predicted' | 'disabled';
export type BandwidthProfileMode = 'grid' | 'collaboration' | 'presentation';

export interface VideoRenderDimensions {
  high?: VideoTrack.Dimensions;
  low?: VideoTrack.Dimensions;
  standard?: VideoTrack.Dimensions;
}

export interface VideoBandwidthProfileOptions {
  dominantSpeakerPriority?: Track.Priority;
  maxSubscriptionBitrate?: number;
  maxTracks?: number;
  mode?: BandwidthProfileMode;
  renderDimensions?: VideoRenderDimensions;
  trackSwitchOffMode?: TrackSwitchOffMode;
}

export interface BandwidthProfileOptions {
  video?: VideoBandwidthProfileOptions;
}

export interface VideoCodecSettings {
  codec: VideoCodec;
}

export interface VP8CodecSettings extends VideoCodecSettings {
  codec: 'VP8';
  simulcast?: boolean;
}

export interface LocalTrackOptions {
  logLevel: LogLevel | LogLevels;
  name?: string;
}

export interface ConnectOptions {
  abortOnIceServersTimeout?: boolean;
  audio?: boolean | CreateLocalTrackOptions;
  automaticSubscription?: boolean;
  bandwidthProfile?: BandwidthProfileOptions;
  dominantSpeaker?: boolean;
  dscpTagging?: boolean;
  enableDscp?: boolean;
  iceServers?: RTCIceServer[];
  iceServersTimeout?: number;
  iceTransportPolicy?: RTCIceTransportPolicy;
  insights?: boolean;
  maxAudioBitrate?: number | null;
  maxVideoBitrate?: number | null;
  name?: string | null;
  networkQuality?: boolean | NetworkQualityConfiguration;
  region?: 'au1' | 'br1' | 'ie1' | 'de1' | 'jp1' | 'sg1' | 'us1' | 'us2' | 'gll';
  preferredAudioCodecs?: AudioCodec[];
  preferredVideoCodecs?: Array<VideoCodec | VideoCodecSettings | VP8CodecSettings>;
  logLevel?: LogLevel | LogLevels;
  tracks?: LocalTrack[] | MediaStreamTrack[];
  video?: boolean | CreateLocalTrackOptions;
}

export interface CreateLocalTrackOptions extends MediaTrackConstraints {
  logLevel?: LogLevel | LogLevels;
  name?: string;
  workaroundWebKitBug180748?: boolean;
}
export interface CreateLocalTracksOptions {
  audio?: boolean | CreateLocalTrackOptions;
  logLevel?: LogLevel | LogLevels;
  video?: boolean | CreateLocalTrackOptions;
}
