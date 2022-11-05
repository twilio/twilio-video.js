import {
  CreateLocalTrackOptions,
  CreateLocalTracksOptions,
  LocalTrack,
} from './types';

export interface CreateLocalTrackOptionsInternal extends CreateLocalTrackOptions {
  createLocalTracks?: (options?: CreateLocalTracksOptions) => Promise<LocalTrack[]>;
  loggerName?: string;
}
