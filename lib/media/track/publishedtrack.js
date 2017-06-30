'use strict';

var buildLogLevels = require('../../util').buildLogLevels;
var Log = require('../../util/log');
var DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
var nInstances = 0;

/**
 * Construct a {@link PublishedTrack}.
 * @class
 * @classdesc A {@link PublishedTrack} is a {@link LocalTrack} that has been
 * published to a {@link Room}.
 * @param {Track.SID} sid - SID assigned to the published {@link LocalTrack}
 * @param {Track.ID} id - ID of the published {@link LocalTrack}
 * @param {string} kind - kind of the published {@link LocalTrack}
 * @param {PublishedTrackOptions} options - {@link PublishedTrack} options
 * @property {Track.ID} id - ID of the published {@link LocalTrack}
 * @property {string} kind - kind of the published {@link LocalTrack}; one of
 *   'audio' or 'video'
 * @property {Track.SID} sid - SID assigned to the published {@link LocalTrack}
 */
function PublishedTrack(sid, id, kind, options) {
  options = Object.assign({
    logLevel: DEFAULT_LOG_LEVEL
  }, options);

  var logLevels = buildLogLevels(options.logLevel);

  Object.defineProperties(this, {
    _instanceId: {
      value: nInstances++
    },
    _log: {
      value: options.log || new Log('default', this, logLevels),
    },
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    },
    sid: {
      enumerable: true,
      value: sid
    }
  });
}

PublishedTrack.prototype.toString = function toString() {
  return '[PublishedTrack #' + this._instanceId + ': ' + this.sid + ']';
};

/**
 * Unpublish a {@link PublishedTrack}. This means that the media
 * from this {@link PublishedTrack} is no longer available to the {@link Room}'s
 * {@link RemoteParticipant}s.
 */
PublishedTrack.prototype.unpublish = function unpublish() {};

/**
 * {@link PublishedTrack} options
 * @typedef {object} PublishedTrackOptions
 * @property {LogLevel|LogLevels} logLevel - Log level for 'media' modules
 */

module.exports = PublishedTrack;
