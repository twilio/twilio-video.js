import { ConnectOptions, CreateLocalTrackOptions, CreateLocalTracksOptions, LocalTrack } from './types';
import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalVideoTrack } from './LocalVideoTrack';
import { Log } from './loglevel';
import { Room } from './Room';

export const isSupported: boolean;
export const version:string;
export const Logger: Log.RootLogger;
export function connect(token: string, options?: ConnectOptions): Promise<Room>;
export function createLocalAudioTrack(options?: CreateLocalTrackOptions): Promise<LocalAudioTrack>;
export function createLocalTracks(options?: CreateLocalTracksOptions): Promise<LocalTrack[]>;
export function createLocalVideoTrack(options?: CreateLocalTrackOptions): Promise<LocalVideoTrack>;

export { AudioTrack } from './AudioTrack';
export { LocalAudioTrack } from './LocalAudioTrack';
export { LocalAudioTrackPublication } from './LocalAudioTrackPublication';
export { LocalDataTrack } from './LocalDataTrack';
export { LocalDataTrackPublication } from './LocalDataTrackPublication';
export { LocalParticipant } from './LocalParticipant';
export { LocalTrackPublication } from './LocalTrackPublication';
export { LocalVideoTrack } from './LocalVideoTrack';
export { LocalVideoTrackPublication } from './LocalVideoTrackPublication';
export { Log } from './loglevel';
export { Participant } from './Participant';
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
export {
  AudioCodec,
  AudioCodecSettings,
  AudioLevel,
  AudioTrackPublication,
  BandwidthProfileMode,
  BandwidthProfileOptions,
  ConnectOptions,
  CreateLocalTrackOptions,
  CreateLocalTracksOptions,
  DataTrack,
  DataTrackPublication,
  EncodingParameters,
  LocalAudioTrackStats,
  LocalDataTrackOptions,
  LocalTrack,
  LocalTrackOptions,
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
export { VideoTrack } from './VideoTrack';
