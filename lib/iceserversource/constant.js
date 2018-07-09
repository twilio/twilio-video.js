'use strict';

const EventEmitter = require('events').EventEmitter;

let instances = 0;

/**
 * A {@link ConstantIceServerSource} only ever returns a single set of ICE
 * servers. It is useful for providing a hard-coded set of ICE servers.
 * @extends EventEmitter
 * @implements {IceServerSource}
 */
class ConstantIceServerSource extends EventEmitter {
  /**
   * Construct a {@link ConstantIceServerSource}.
   * @param {Array<RTCIceServerInit>} iceServers
   */
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
      },
      status: {
        enumerable: true,
        value: 'overrode'
      },
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
