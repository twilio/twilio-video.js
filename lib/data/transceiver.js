'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

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
 */
function DataTrackTransceiver(id, maxPacketLifeTime, maxRetransmits, ordered) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: 'data'
    },
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
