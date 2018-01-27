'use strict';

const buildLogLevels = require('../../util').buildLogLevels;
const Log = require('../../util/log');
const DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
let nInstances = 0;

/**
 * Construct a {@link RemoteTrackPublication}.
 * @class
 * @classdesc A {@link RemoteTrackPublication} represents a {@link RemoteTrack}
 *   that has been published to a {@link Room}.
 * @param {Track.Kind} kind - the {@link RemoteTrack}'s kind
 * @param {Track.SID} trackSid - the {@link RemoteTrack}'s SID
 * @param {string} trackName - the {@link RemoteTrack}'s name
 * @param {RemoteTrackPublicationOptions} options - {@link RemoteTrackPublication}
 *   options
 * @property {Track.Kind} kind - kind of the published {@link RemoteTrack}
 * @property {?RemoteTrack} track - unless you have subscribed to the
 *   {@link RemoteTrack}, this property is null
 * @property {string} trackName - the {@link RemoteTrack}'s name
 * @property {Track.SID} trackSid - the {@link RemoteTrack}'s SID
 */
class RemoteTrackPublication {
  constructor(kind, trackSid, trackName, options) {
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
      kind: {
        enumerable: true,
        value: kind
      },
      track: {
        enumerable: true,
        value: null
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

  toString() {
    return `[RemoteTrackPublication #${this._instanceId}: ${this.trackSid}]`;
  }
}

/**
/**
 * {@link RemoteTrackPublication} options
 * @typedef {object} RemoteTrackPublicationOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = RemoteTrackPublication;
