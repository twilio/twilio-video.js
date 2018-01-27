'use strict';

const EventEmitter = require('events').EventEmitter;
const Log = require('../../util/log');

let nInstances = 0;

/**
 * Construct a {@link Track}.
 * @class
 * @classdesc A {@link Track} represents a stream of audio, video, or data.
 * @param {Track.ID} id - The {@link Track}'s ID
 * @param {Track.Kind} kind - The {@link Track}'s kind
 * @param {{ log: Log, name: ?string }} options
 * @property {Track.ID} id - The {@link Track}'s ID
 * @property {Track.Kind} kind - The {@link Track}'s kind
 * @property {string} name - The {@link Track}'s name
 */
class Track extends EventEmitter {
  constructor(id, kind, options) {
    options = Object.assign({
      name: id,
      // FIXME(mroberts): ...
      log: {
        createLog() {
          return new Log('Track', 'media', 'off');
        }
      }
    }, options);

    super();

    const name = String(options.name);

    Object.defineProperties(this, {
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: options.log.createLog('media', this)
      },
      id: {
        enumerable: true,
        value: id
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
}

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @type string
 * @typedef Track.ID
 */

/**
 * The {@link Track} kind is either "audio", "video", or "data".
 * @type {string}
 * @typedef Track.Kind
 */

/**
 * The {@link Track} SID is a unique string identifier for the {@link Track}
 * that is published to a {@link Room}.
 * @type string
 * @typedef Track.SID
 */

/**
 * A {@link DataTrack} is a {@link LocalDataTrack} or {@link RemoteDataTrack}.
 * @type {LocalDataTrack|RemoteDataTrack}
 * @typedef DataTrack
 */

/**
 * A {@link LocalTrack} is a {@link LocalAudioTrack}, {@link LocalVideoTrack},
 * or {@link LocalDataTrack}.
 * @type {LocalAudioTrack|LocalVideoTrack|LocalDataTrack}
 * @typedef LocalTrack
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
 * @type {RemoteAudioTrack|RemoteVideoTrack|RemoteDataTrack}
 * @typedef RemoteTrack
 */

module.exports = Track;
