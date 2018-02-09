'use strict';

const TrackTransceiver = require('../transceiver');

/**
 * A {@link DataTrackTransceiver} represents either one or more local
 * RTCDataChannels or a single remote RTCDataChannel. It can be used to send or
 * receive data.
 * @extends TrackTransceiver
 * @property {string} id
 * @property {string} kind - "data"
 * @property {?number} maxPacketLifeTime
 * @property {?number} maxRetransmits
 * @property {boolean} ordered
 */
class DataTrackTransceiver extends TrackTransceiver {
  /**
   * Construct a {@link DataTrackTransceiver}.
   * @param {string} id
   * @param {?number} maxPacketLifeTime
   * @param {?number} maxRetransmits
   * @param {boolean} ordered
   */
  constructor(id, maxPacketLifeTime, maxRetransmits, ordered) {
    super(id, 'data');
    Object.defineProperties(this, {
      maxPacketLifeTime: {
        enumerable: true,
        value: maxPacketLifeTime
      },
      maxRetransmits: {
        enumerable: true,
        value: maxRetransmits
      },
      ordered: {
        enumerable: true,
        value: ordered
      }
    });
  }
}

module.exports = DataTrackTransceiver;
