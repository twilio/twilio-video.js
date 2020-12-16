import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrack } from './LocalDataTrack';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
import { LocalVideoTrack } from './LocalVideoTrack';
import { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
import { RemoteAudioTrack } from './RemoteAudioTrack';
import { RemoteAudioTrackPublication } from './RemoteAudioTrackPublication';
import { RemoteDataTrack } from './RemoteDataTrack';
import { RemoteDataTrackPublication } from './RemoteDataTrackPublication';
import { RemoteVideoTrack } from './RemoteVideoTrack';
import { RemoteVideoTrackPublication } from './RemoteVideoTrackPublication';
import { Track } from './Track';
import { VideoTrack } from './VideoTrack';

export type LocalTrack = LocalAudioTrack | LocalVideoTrack | LocalDataTrack;
export type RemoteTrack = RemoteAudioTrack | RemoteVideoTrack | RemoteDataTrack;
export type DataTrack = LocalDataTrack | RemoteDataTrack;
export type AudioTrackPublication = LocalAudioTrackPublication | RemoteAudioTrackPublication;
export type DataTrackPublication = LocalDataTrackPublication | RemoteDataTrackPublication;
export type VideoTrackPublication = LocalVideoTrackPublication | RemoteVideoTrackPublication;

export interface EncodingParameters {
  maxAudioBitrate?: number | null;
  maxVideoBitrate?: number | null;
}

export type NetworkQualityLevel = number;

export type NetworkQualityVerbosity = 0 | 1 | 2 | 3;

export class NetworkQualityStats {
  level: NetworkQualityLevel;
  audio: NetworkQualityMediaStats | null;
  video: NetworkQualityMediaStats | null;
}

export class NetworkQualityMediaStats {
  send: NetworkQualityLevel;
  recv: NetworkQualityLevel;
  sendStats: NetworkQualitySendOrRecvStats | null;
  recvStats: NetworkQualitySendOrRecvStats | null;
}

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

/**
 * @deprecated
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'off';

/**
 * @deprecated
 */
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

export interface AudioCodecSettings {
  codec: AudioCodec;
}

export interface OpusCodecSettings extends AudioCodecSettings {
  codec: 'opus';
  dtx?: boolean;
}

export interface VideoCodecSettings {
  codec: VideoCodec;
}

export interface VP8CodecSettings extends VideoCodecSettings {
  codec: 'VP8';
  simulcast?: boolean;
}

export interface LocalDataTrackOptions {
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  ordered?: boolean;
}

export interface LocalTrackOptions {
/**
 * @deprecated
 */
  logLevel: LogLevel | LogLevels;
  name?: string;
}

export interface LocalTrackPublishOptions {
  priority?: Track.Priority;
}

export interface MediaStreamTrackPublishOptions {
  name?: string;
  priority?: Track.Priority;
}

export interface ConnectOptions {
  audio?: boolean | CreateLocalTrackOptions;
  automaticSubscription?: boolean;
  bandwidthProfile?: BandwidthProfileOptions;
  dominantSpeaker?: boolean;

  /**
   * @deprecated use enableDscp
   */
  dscpTagging?: boolean;
  enableDscp?: boolean;

  /**
   * @deprecated use Video.Logger
   */
  loggerName?: string;
  eventListener?: EventListener;
  iceServers?: Array<RTCIceServer>;
  iceTransportPolicy?: RTCIceTransportPolicy;
  insights?: boolean;
  maxAudioBitrate?: number | null;
  maxVideoBitrate?: number | null;
  name?: string | null;
  networkQuality?: boolean | NetworkQualityConfiguration;
  region?: string;
  preferredAudioCodecs?: Array<AudioCodec | AudioCodecSettings | OpusCodecSettings>;
  preferredVideoCodecs?: Array<VideoCodec | VideoCodecSettings | VP8CodecSettings>;

  /**
   * @deprecated use Video.Logger.
   */
  logLevel?: LogLevel | LogLevels;

  tracks?: Array<LocalTrack | MediaStreamTrack>;
  video?: boolean | CreateLocalTrackOptions;
}

export interface CreateLocalTrackOptions extends MediaTrackConstraints {
  /**
   * @deprecated
   */
  logLevel?: LogLevel | LogLevels;
  name?: string;
  workaroundWebKitBug180748?: boolean;
}
export interface CreateLocalTracksOptions {
  audio?: boolean | CreateLocalTrackOptions;
  /**
   * @deprecated
   */
  logLevel?: LogLevel | LogLevels;
  video?: boolean | CreateLocalTrackOptions;
}

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
