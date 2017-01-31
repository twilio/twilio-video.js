'use strict';

var inherits = require('util').inherits;
var TrackStats = require('./trackstats');

/**
 * Statistics for a remote {@link Track}.
 * @extends TrackStats
 * @property {?number} bytesReceived - Number of bytes received
 * @property {?number} packetsReceived - Number of packets received
 * @param {string} trackId - {@link Track} ID
 * @param {StandardizedTrackStatsReport} statsReport
 * @constructor
 */
function RemoteTrackStats(trackId, statsReport) {
  TrackStats.call(this, trackId, statsReport);

  Object.defineProperties(this, {
    bytesReceived: {
      value: typeof statsReport.bytesReceived === 'number'
        ? statsReport.bytesReceived
        : null,
      enumerable: true
    },
    packetsReceived: {
      value: typeof statsReport.packetsReceived === 'number'
        ? statsReport.packetsReceived
        : null,
      enumerable: true
    }
  });
}

inherits(RemoteTrackStats, TrackStats);

module.exports = RemoteTrackStats;
