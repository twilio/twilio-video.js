import { EventEmitter } from 'events';

export namespace Track {
  type Kind = 'audio' | 'video' | 'data';
  type Priority = 'low' | 'standard' | 'high';
  type ID = string;
  type SID = string;
}

/**
 * A {@link Track} represents a stream of audio, video, or data.
 * @extends EventEmitter
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */
export class Track extends EventEmitter {
    kind: Track.Kind;
    name: string;
}

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @typedef {string} Track.ID
 */

/**
 * The {@link Track} kind is either "audio", "video", or "data".
 * @typedef {string} Track.Kind
 */

/**
 * The {@link Track}'s priority can be "low", "standard", or "high".
 * @typedef {string} Track.Priority
 */

/**
 * The {@link Track} SID is a unique string identifier for the {@link Track}
 * that is published to a {@link Room}.
 * @typedef {string} Track.SID
 */

/**
 * A {@link DataTrack} is a {@link LocalDataTrack} or {@link RemoteDataTrack}.
 * @typedef {LocalDataTrack|RemoteDataTrack} DataTrack
 */

/**
 * A {@link LocalTrack} is a {@link LocalAudioTrack}, {@link LocalVideoTrack},
 * or {@link LocalDataTrack}.
 * @typedef {LocalAudioTrack|LocalVideoTrack|LocalDataTrack} LocalTrack
 */

/**
 * {@link LocalTrack} options
 * @typedef {object} LocalTrackOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 */

/**
 * A {@link RemoteTrack} is a {@link RemoteAudioTrack},
 * {@link RemoteVideoTrack}, or {@link RemoteDataTrack}.
 * @typedef {RemoteAudioTrack|RemoteVideoTrack|RemoteDataTrack} RemoteTrack
 */
