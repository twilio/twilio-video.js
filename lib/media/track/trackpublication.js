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
 * @emits TrackPublication#trackDisabled
 * @emits TrackPublication#trackEnabled
 */
class TrackPublication extends EventEmitter {
  /**
   * Construct a {@link TrackPublication}.
   * @param {boolean} isTrackEnabled - whether the {@link Track} is enabled
   * @param {string} trackName - the published {@link Track}'s name
   * @param {Track.SID} trackSid - SID assigned to the {@link Track}
   * @param {TrackPublicationOptions} options - {@link TrackPublication} options
   */
  constructor(isTrackEnabled, trackName, trackSid, options) {
    super();

    options = Object.assign({
      logLevel: DEFAULT_LOG_LEVEL
    }, options);

    const logLevels = buildLogLevels(options.logLevel);
    let _isTrackEnabled = isTrackEnabled;

    Object.defineProperties(this, {
      _instanceId: {
        value: nInstances++
      },
      _isTrackEnabled: {
        get() {
          return _isTrackEnabled;
        },
        set(isTrackEnabled) {
          if (_isTrackEnabled !== isTrackEnabled) {
            _isTrackEnabled = isTrackEnabled;
            this.emit(_isTrackEnabled ? 'trackEnabled' : 'trackDisabled');
          }
        }
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

  /**
   * Whether the published {@link Track} is enabled
   * @property {boolean}
   */
  get isTrackEnabled() {
    return this._isTrackEnabled;
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
 * {@link TrackPublication} options
 * @typedef {object} TrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = TrackPublication;
