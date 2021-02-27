'use strict';

/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {RTCStats} lastStats
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SenderOrReceiverReportFactory =
/**
 * @param {StatsId} id
 * @param {TrackId} trackId
 * @param {RTCStats} initialStats
 */
function SenderOrReceiverReportFactory(id, trackId, initialStats) {
  _classCallCheck(this, SenderOrReceiverReportFactory);

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id,
      writable: true
    },
    trackId: {
      enumerable: true,
      value: trackId,
      writable: true
    },
    lastStats: {
      enumerable: true,
      value: initialStats,
      writable: true
    }
  });
};

module.exports = SenderOrReceiverReportFactory;