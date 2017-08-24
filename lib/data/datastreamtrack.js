'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link DataStreamTrack}.
 * @class
 * @classdesc A {@link DataStreamTrack} represents either one or more local
 *   RTCDataChannels or a single remote RTCDataChannel. It can be used to send
 *   or receive data.
 * @param {string} id
 * @property {string} id
 * @property {string} kind - "data"
 */
function DataStreamTrack(id) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: 'data'
    }
  });
}

inherits(DataStreamTrack, EventEmitter);

module.exports = DataStreamTrack;
