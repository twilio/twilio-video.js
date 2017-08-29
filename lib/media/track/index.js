'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var nInstances = 0;

/**
 * Construct a {@link Track}.
 * @class
 * @classdesc A {@link Track} represents audio or video that can be sent to or
 *   received from a {@link Room}.
 * @param {Track.ID} id - The {@link Track}'s ID
 * @param {Track.Kind} kind - The {@link Track}'s kind
 * @param {{ log: Log }} options
 * @property {Track.ID} id - The {@link Track}'s ID
 * @property {Track.Kind} kind - The {@link Track}'s kind
 */
function Track(id, kind, options) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: options.log.createLog('media', this)
    },
    id: {
      enumerable: true,
      value: id
    },
    kind: {
      enumerable: true,
      value: kind
    }
  });
}

inherits(Track, EventEmitter);

/**
 * The {@link Track} ID is a string identifier for the {@link Track}.
 * @type string
 * @typedef Track.ID
 */

/**
 * The {@link Track} kind is either "audio", "video", or "data".
 * @type {string}
 * @typedef Track.Kind
 */

/**
 * The {@link Track} SID is a unique string identifier for the {@link Track}
 * that is published to a {@link Room}.
 * @type string
 * @typedef Track.SID
 */

module.exports = Track;
