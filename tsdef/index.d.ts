
import { CancelablePromise, ConnectOptions, CreateLocalAudioTrackOptions, CreateLocalTrackOptions, CreateLocalTracksOptions, LocalTrack } from './types';
import { PreflightOptions, PreflightTestReport } from './PreflightTypes';
import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalVideoTrack } from './LocalVideoTrack';
import { Log } from './loglevel';

import { PreflightTest } from './preflighttest';
import { Room } from './Room';

export const isSupported: boolean;
export const version:string;
export const Logger: Log.RootLogger;
export function connect(token: string, options?: ConnectOptions): CancelablePromise<Room>;
export function createLocalAudioTrack(options?: CreateLocalTrackOptions|CreateLocalAudioTrackOptions): Promise<LocalAudioTrack>;
export function createLocalTracks(options?: CreateLocalTracksOptions): Promise<LocalTrack[]>;
export function createLocalVideoTrack(options?: CreateLocalTrackOptions): Promise<LocalVideoTrack>;
export function runPreflight(token: string, options?: PreflightOptions): PreflightTest;

export { AudioTrack } from './AudioTrack';
export { LocalAudioTrack } from './LocalAudioTrack';
export { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
export { LocalDataTrack } from './LocalDataTrack';
export { LocalDataTrackOptions } from './LocalDataTrackOptions';
export { LocalDataTrackPublication } from './LocalDataTrackPublication';
export { LocalParticipant } from './LocalParticipant';
export { LocalTrackOptions } from './LocalTrackOptions';
export { LocalTrackPublication } from './LocalTrackPublication';
export { LocalVideoTrack } from './LocalVideoTrack';
export { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
export { Log } from './loglevel';
export { Participant } from './Participant';
export { PreflightTest, PreflightOptions, PreflightTestReport };
export { RemoteAudioTrack } from './RemoteAudioTrack';
export { RemoteAudioTrackPublication } from './RemoteAudioTrackPublication';
export { RemoteDataTrack } from './RemoteDataTrack';
export { RemoteDataTrackPublication } from './RemoteDataTrackPublication';
export { RemoteParticipant } from './RemoteParticipant';
export { RemoteTrackPublication } from './RemoteTrackPublication';
export { RemoteVideoTrack } from './RemoteVideoTrack';
export { RemoteVideoTrackPublication } from './RemoteVideoTrackPublication';
export { Room } from './Room';
export { Track } from './Track';
export { TrackPublication } from './TrackPublication';
export { TwilioError } from './TwilioError';
export { VideoProcessor } from './VideoProcessor';
export { VideoTrack } from './VideoTrack';

export {
  AddProcessorOptions,
  AudioCodec,
  AudioCodecSettings,
  AudioLevel,
  AudioTrackPublication,
  BandwidthProfileMode,
  BandwidthProfileOptions,
  DefaultDeviceCaptureMode,
  ConnectOptions,
  CreateLocalTrackOptions,
  CreateLocalTracksOptions,
  DataTrack,
  DataTrackPublication,
  EncodingParameters,
  CreateLocalAudioTrackOptions,
  LocalAudioTrackStats,
  LocalTrack,
  LocalTrackPublishOptions,
  LocalTrackStats,
  LocalVideoTrackStats,
  LogLevel,
  LogLevels,
  MediaStreamTrackPublishOptions,
  NetworkQualityBandwidthStats,
  NetworkQualityConfiguration,
  NetworkQualityFractionLostStats,
  NetworkQualityLatencyStats,
  NetworkQualityLevel,
  NetworkQualityMediaStats,
  NetworkQualitySendOrRecvStats,
  NetworkQualityStats,
  NetworkQualityVerbosity,
  NoiseCancellation,
  NoiseCancellationOptions,
  NoiseCancellationVendor,
  OpusCodecSettings,
  RemoteAudioTrackStats,
  RemoteTrack,
  RemoteTrackStats,
  RemoteVideoTrackStats,
  StatsReport,
  TrackStats,
  TrackSwitchOffMode,
  VideoBandwidthProfileOptions,
  VideoCodec,
  VideoCodecSettings,
  VideoRenderDimensions,
  VideoTrackPublication,
  VP8CodecSettings
} from './types';
