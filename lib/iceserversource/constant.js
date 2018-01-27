'use strict';

const EventEmitter = require('events').EventEmitter;

let instances = 0;

/**
 * Construct a {@link ConstantIceServerSource}.
 * @class
 * @classdesc A {@link ConstantIceServerSource} only ever returns a single set
 *   of ICE servers. It is useful for providing a hard-coded set of ICE servers.
 * @implements {IceServerSource}
 * @param {Array<RTCIceServerInit>} iceServers
 */
class ConstantIceServerSource extends EventEmitter {
  constructor(iceServers) {
    super();
    Object.defineProperties(this, {
      _instance: {
        value: ++instances
      },
      _iceServers: {
        enumerable: true,
        value: iceServers,
        writable: true
      },
      _isStarted: {
        value: false,
        writable: true
      },
      isStarted: {
        enumerable: true,
        get() {
          return this._isStarted;
        }
      }
    });
  }

  start() {
    this._isStarted = true;
    return Promise.resolve(this._iceServers);
  }

  stop() {
    this._isStarted = false;
  }

  toString() {
    return `[ConstantIceServerSource #${this._instance}]`;
  }
}

module.exports = ConstantIceServerSource;
