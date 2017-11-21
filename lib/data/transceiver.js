'use strict';

var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var TrackTransceiver = require('../transceiver');

/**
 * Construct a {@link DataTrackTransceiver}.
 * @class
 * @classdesc A {@link DataTrackTransceiver} represents either one or more local
 *   RTCDataChannels or a single remote RTCDataChannel. It can be used to send
 *   or receive data.
 * @param {string} id
 * @param {?number} maxPacketLifeTime
 * @param {?number} maxRetransmits
 * @param {boolean} ordered
 * @property {string} id
 * @property {string} kind - "data"
 * @property {?number} maxPacketLifeTime
 * @property {?number} maxRetransmits
 * @property {boolean} ordered
 * @implements TrackTransceiver
 */
function DataTrackTransceiver(id, maxPacketLifeTime, maxRetransmits, ordered) {
  EventEmitter.call(this);
  TrackTransceiver.call(this, id, 'data');
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

inherits(DataTrackTransceiver, EventEmitter);

module.exports = DataTrackTransceiver;
