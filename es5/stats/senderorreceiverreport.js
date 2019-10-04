'use strict';

/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {number} bitrate - bps
 */

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var SenderOrReceiverReport =
/**
 * Construct a {@link SenderOrReceiverReport}.
 * @param {StatsId} id
 * @param {TrackId} trackId
 * @param {number} bitrate - bps
 */
function SenderOrReceiverReport(id, trackId, bitrate) {
  _classCallCheck(this, SenderOrReceiverReport);

  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    trackId: {
      enumerable: true,
      value: trackId
    },
    bitrate: {
      enumerable: true,
      value: bitrate
    }
  });
};

module.exports = SenderOrReceiverReport;