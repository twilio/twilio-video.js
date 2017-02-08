'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var instances = 0;

/**
 * Construct a {@link ConstantIceServerSource}.
 * @class
 * @classdesc A {@link ConstantIceServerSource} only ever returns a single set
 *   of ICE servers. It is useful for providing a hard-coded set of ICE servers.
 * @implements {IceServerSource}
 * @param {Array<RTCIceServerInit>} iceServers
 */
function ConstantIceServerSource(iceServers) {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _instance: {
      value: ++instances
    },
    _iceServers: {
      enumerable: true,
      value: iceServers,
      writable: true
    }
  });
}

inherits(ConstantIceServerSource, EventEmitter);

ConstantIceServerSource.prototype.start = function start() {
  return Promise.resolve(this._iceServers);
};

ConstantIceServerSource.prototype.stop = function stop() {
  // Do nothing;
};

ConstantIceServerSource.prototype.toString = function toString() {
  return '[ConstantIceServerSource #' + this._instance + ']';
};

module.exports = ConstantIceServerSource;
