import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
import { LocalDataTrack } from './LocalDataTrack';
import { LocalDataTrackPublication } from './LocalDataTrackPublication';
import { LocalTrackOptions } from './LocalTrackOptions';
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

export interface AddProcessorOptions {
  inputFrameBufferType?: 'video' | 'canvas' | 'offscreencanvas';
  outputFrameBufferContextType?: string;
}

export interface EncodingParameters {
  maxAudioBitrate?: number | null;
  maxVideoBitrate?: number | null;
}

export type NetworkQualityLevel = number;

export type NetworkQualityVerbosity = 0 | 1 | 2 | 3;

export class NetworkQualityFractionLostStats {
  fractionLost: number | null;
  level: NetworkQualityLevel | null;
}

export class NetworkQualityBandwidthStats {
  actual: number | null;
  available: number | null;
  level: NetworkQualityLevel | null;
}

export class NetworkQualityLatencyStats {
  jitter: number | null;
  rtt: number | null;
  level: NetworkQualityLevel | null;
}

export class NetworkQualitySendOrRecvStats {
  bandwidth: NetworkQualityBandwidthStats | null;
  latency: NetworkQualityLatencyStats | null;
  fractionLost: NetworkQualityFractionLostStats | null;
}

export class NetworkQualityMediaStats {
  send: NetworkQualityLevel;
  recv: NetworkQualityLevel;
  sendStats: NetworkQualitySendOrRecvStats | null;
  recvStats: NetworkQualitySendOrRecvStats | null;
}

export class NetworkQualityStats {
  level: NetworkQualityLevel;
  audio: NetworkQualityMediaStats | null;
  video: NetworkQualityMediaStats | null;
}

export interface NetworkQualityConfiguration {
  local?: NetworkQualityVerbosity;
  remote?: NetworkQualityVerbosity;
}

export type AudioLevel = number;

export type AudioCodec = 'isac' | 'opus' | 'PCMA' | 'PCMU';
export type VideoCodec = 'H264' | 'VP8' | 'VP9';

export type VideoEncodingMode = 'auto';
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

export type VideoContentPreferencesMode = 'auto' | 'manual';
export type ClientTrackSwitchOffControl = 'auto' | 'manual';
export type DefaultDeviceCaptureMode = 'auto' | 'manual';

export type NotifyWarning = 'recording-media-lost';

/**
* @deprecated
*/
export interface VideoRenderDimensions {
  high?: VideoTrack.Dimensions;
  low?: VideoTrack.Dimensions;
  standard?: VideoTrack.Dimensions;
}

export interface VideoBandwidthProfileOptions {
  contentPreferencesMode?: VideoContentPreferencesMode;
  dominantSpeakerPriority?: Track.Priority;
  maxSubscriptionBitrate?: number;
  /**
  * @deprecated use clientTrackSwitchOffControl instead
  */
  maxTracks?: number;
  mode?: BandwidthProfileMode;
  /**
  * @deprecated use contentPreferencesMode instead
  */
  renderDimensions?: VideoRenderDimensions;
  clientTrackSwitchOffControl?: ClientTrackSwitchOffControl;
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

export interface LocalTrackPublishOptions {
  priority?: Track.Priority;
}

export interface MediaStreamTrackPublishOptions extends LocalTrackOptions{
  priority?: Track.Priority;
}

export interface CreateLocalTrackOptions extends MediaTrackConstraints {
  /**
   * @deprecated
   */
  logLevel?: LogLevel | LogLevels;
  name?: string;
  workaroundWebKitBug180748?: boolean;
  workaroundWebKitBug1208516?: boolean;
}


export type NoiseCancellationVendor = 'krisp' | 'rnnoise';

export interface NoiseCancellation {
  readonly vendor: NoiseCancellationVendor;
  readonly sourceTrack: MediaStreamTrack;
  readonly isEnabled: boolean;

  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export interface NoiseCancellationOptions {
  sdkAssetsPath: string;
  vendor: NoiseCancellationVendor;
}

export interface CreateLocalAudioTrackOptions extends CreateLocalTrackOptions {
  defaultDeviceCaptureMode?: DefaultDeviceCaptureMode;
  noiseCancellationOptions?: NoiseCancellationOptions;
}

export interface ConnectOptions {
  audio?: boolean | CreateLocalTrackOptions| CreateLocalAudioTrackOptions;
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
  notifyWarnings?: Array<NotifyWarning>;
  region?: string;
  preferredAudioCodecs?: Array<AudioCodec | AudioCodecSettings | OpusCodecSettings>;
  preferredVideoCodecs?: Array<VideoCodec | VideoCodecSettings | VP8CodecSettings> | VideoEncodingMode;

  /**
   * @deprecated use Video.Logger.
   */
  logLevel?: LogLevel | LogLevels;

  tracks?: Array<LocalTrack | MediaStreamTrack>;
  video?: boolean | CreateLocalTrackOptions;
}

export interface CreateLocalTracksOptions {
  audio?: boolean | CreateLocalTrackOptions | CreateLocalAudioTrackOptions;
  /**
   * @deprecated
   */
  logLevel?: LogLevel | LogLevels;
  loggerName?: string;
  tracks?: LocalTrack[];
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
  jitter: number | null;
}

export class LocalVideoTrackStats extends LocalTrackStats {
  captureDimensions: VideoTrack.Dimensions | null;
  dimensions: VideoTrack.Dimensions | null;
  captureFrameRate: number | null;
  frameRate: number | null;
}

export class LocalAudioTrackStats extends LocalTrackStats {
  audioLevel: AudioLevel | null;
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

export interface CancelablePromise<T> extends Promise<T> {
  cancel: () => void;
}
