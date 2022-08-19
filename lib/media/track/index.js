'use strict';

const EventEmitter = require('../../eventemitter');
const { valueToJSON } = require('../../util');
const { DEFAULT_LOGGER_NAME } = require('../../util/constants');
const Log = require('../../util/log');

let nInstances = 0;

/**
 * A {@link Track} represents a stream of audio, video, or data.
 * @extends EventEmitter
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */
class Track extends EventEmitter {
  /**
   * Construct a {@link Track}.
   * @param {Track.Kind} kind - The {@link Track}'s kind
   * @param {{ log: Log, name: string }} options
   */
  constructor(kind, options) {
    options = Object.assign({
      log: null,
      loggerName: DEFAULT_LOGGER_NAME
    }, options);

    super();

    const name = String(options.name);

    const log = options.log
      ? options.log.createLog(this)
      : new Log(this, options.loggerName);

    Object.defineProperties(this, {
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: log
      },
      kind: {
        enumerable: true,
        value: kind
      },
      name: {
        enumerable: true,
        value: name
      }
    });
  }

  toJSON() {
    return valueToJSON(this);
  }
}

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
 * @property {string} [name] - The {@link LocalTrack}'s name; by default,
 *   it is set to the {@link LocalTrack}'s ID.
 */

/**
 * A {@link RemoteTrack} is a {@link RemoteAudioTrack},
 * {@link RemoteVideoTrack}, or {@link RemoteDataTrack}.
 * @typedef {RemoteAudioTrack|RemoteVideoTrack|RemoteDataTrack} RemoteTrack
 */

module.exports = Track;
