import { ConnectOptions, CreateLocalTrackOptions, CreateLocalTracksOptions, LocalTrack } from './types';
import { LocalAudioTrack } from './LocalAudioTrack';
import { LocalVideoTrack } from './LocalVideoTrack';
import { Room } from './Room';

export const isSupported: boolean;
export const version:string;
export function connect(token: string, options?: ConnectOptions): Promise<Room>;
export function createLocalAudioTrack(options?: CreateLocalTrackOptions): Promise<LocalAudioTrack>;
export function createLocalTracks(options?: CreateLocalTracksOptions): Promise<LocalTrack[]>;
export function createLocalVideoTrack(options?: CreateLocalTrackOptions): Promise<LocalVideoTrack>;
