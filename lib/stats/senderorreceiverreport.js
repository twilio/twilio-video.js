'use strict';

/**
 * @property {StatsId} id
 * @property {TrackId} trackId
 * @property {number} bitrate - bps
 */
class SenderOrReceiverReport {
  /**
   * Construct a {@link SenderOrReceiverReport}.
   * @param {StatsId} id
   * @param {TrackId} trackId
   * @param {number} bitrate - bps
   */
  constructor(id, trackId, bitrate) {
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
  }
}

module.exports = SenderOrReceiverReport;
