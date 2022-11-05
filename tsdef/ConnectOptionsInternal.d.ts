import {
  ClientTrackSwitchOffControl,
  ConnectOptions,
  CreateLocalTracksOptions,
  LocalTrack,
  VP8CodecSettings,
  VideoCodec,
  VideoCodecSettings,
  VideoContentPreferencesMode,
} from './types';

interface AdaptiveSimulcastVP8CodecSettings extends VP8CodecSettings {
  adaptiveSimulcast?: boolean;
}

export interface ConnectOptionsInternal extends ConnectOptions {
  LocalParticipant?: any;
  Log?: any;
  environment?: string;
  eventObserver?: any;
  clientTrackSwitchOffControl?: ClientTrackSwitchOffControl | 'disabled';
  contentPreferencesMode?: VideoContentPreferencesMode | 'disabled';
  createLocalTracks?: (options?: CreateLocalTracksOptions) => Promise<LocalTrack[]>;
  log?: any;
  preferredVideoCodecs?: Array<VideoCodec | VideoCodecSettings | VP8CodecSettings | AdaptiveSimulcastVP8CodecSettings>;
  realm?: string;
  shouldStopLocalTracks?: boolean;
  signaling?: any;
  wsServer?: string;
  wsServerInsights?: string;
}
