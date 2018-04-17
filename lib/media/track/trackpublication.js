'use strict';

const { EventEmitter } = require('events');
const { buildLogLevels } = require('../../util');
const { DEFAULT_LOG_LEVEL } = require('../../util/constants');
const Log = require('../../util/log');
let nInstances = 0;

/**
 * A {@link TrackPublication} represents a {@link Track} that
 * has been published to a {@link Room}.
 * @property {string} trackName - the published {@link Track}'s name
 * @property {Track.SID} trackSid - SID assigned to the published {@link Track}
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
      logLevel: DEFAULT_LOG_LEVEL
    }, options);

    const logLevels = buildLogLevels(options.logLevel);

    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _log: {
        value: options.log || new Log('default', this, logLevels)
      },
      trackName: {
        value: trackName
      },
      trackSid: {
        value: trackSid
      }
    });
  }

  toString() {
    return `[TrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
 * {@link TrackPublication} options
 * @typedef {object} TrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = TrackPublication;
