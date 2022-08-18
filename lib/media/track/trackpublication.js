'use strict';

const EventEmitter = require('../../eventemitter');
const { valueToJSON } = require('../../util');
const { DEFAULT_LOGGER_NAME } = require('../../util/constants');
const Log = require('../../util/log');
let nInstances = 0;

/**
 * A {@link TrackPublication} represents a {@link Track} that
 * has been published to a {@link Room}.
 * @property {string} trackName - the published {@link Track}'s name
 * @property {Track.SID} trackSid - SID assigned to the published {@link Track}
 * @emits TrackPublication#trackDisabled
 * @emits TrackPublication#trackEnabled
 */
class TrackPublication extends EventEmitter {
  /**
   * Construct a {@link TrackPublication}.
   * @param {string} trackName - the published {@link Track}'s name
   * @param {Track.SID} trackSid - SID assigned to the {@link Track}
   * @param {TrackPublicationOptions} options - {@link TrackPublication} options
   */
  constructor(trackName, trackSid, options) {
    super();

    options = Object.assign({
      log: null,
      loggerName: DEFAULT_LOGGER_NAME
    }, options);

    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: options.log ? options.log.createLog(this) : new Log(this, options.loggerName)
      },
      trackName: {
        enumerable: true,
        value: trackName
      },
      trackSid: {
        enumerable: true,
        value: trackSid
      }
    });
  }

  toJSON() {
    return valueToJSON(this);
  }

  toString() {
    return `[TrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * The published {@link Track} was disabled.
 * @event TrackPublication#trackDisabled
 */

/**
 * The published {@link Track} was enabled.
 * @event TrackPublication#trackEnabled
 */

/**
 * A {@link LocalAudioTrackPublication} or a {@link RemoteAudioTrackPublication}.
 * @typedef {LocalAudioTrackPublication|RemoteAudioTrackPublication} AudioTrackPublication
 */

/**
 * A {@link LocalDataTrackPublication} or a {@link RemoteDataTrackPublication}.
 * @typedef {LocalDataTrackPublication|RemoteDataTrackPublication} DataTrackPublication
 */

/**
 * A {@link LocalVideoTrackPublication} or a {@link RemoteVideoTrackPublication}.
 * @typedef {LocalVideoTrackPublication|RemoteVideoTrackPublication} VideoTrackPublication
 */

/**
 * {@link TrackPublication} options
 * @typedef {object} TrackPublicationOptions
 */

module.exports = TrackPublication;
