/* eslint consistent-return:0 */
'use strict';

var inherits = require('util').inherits;
var RoomSignaling = require('./room');
var StateMachine = require('../statemachine');

/*
Signaling States
----------------

              +---------+
              |         |
              | opening |
         +--->|         |
         |    +---------+
    +--------+   |   |   +------+
    |        |<--+   +-->|      |
    | closed |<----------| open |
    |        |<--+   +-->|      |
    +--------+   |   |   +------+
              +---------+   |
              |         |<--+
              | closing |
              |         |
              +---------+

*/

var states = {
  closed: [
    'opening'
  ],
  opening: [
    'closed',
    'open'
  ],
  open: [
    'closed',
    'closing'
  ],
  closing: [
    'closed',
    'open'
  ]
};

/**
 * Construct {@link Signaling}.
 * @class
 * @extends EventEmitter
 * @property {string} state - one of "closed", "opening", "open", or "closing"
 */
function Signaling() {
  StateMachine.call(this, 'closed', states);
}

inherits(Signaling, StateMachine);

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._close = function _close(key) {
  this.transition('closing', key);
  this.transition('closed', key);
  return Promise.resolve();
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._connect = function _connect(identities, nameOrSid, localMedia, options) {
  var participantSid = 'PA00000000000000000000000000000000';
  var sid = 'CV00000000000000000000000000000000';
  var promise = Promise.resolve(new RoomSignaling(localMedia, participantSid, sid, options));
  promise.cancel = function cancel() {};
  return promise;
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._open = function _open(key) {
  this.transition('opening', key);
  this.transition('open', key);
  return Promise.resolve();
};

/**
 * Close the {@link Signaling}.
 * @returns {Promise}
 */
Signaling.prototype.close = function close() {
  var self = this;
  return this.bracket('close', function transition(key) {
    switch (self.state) {
      case 'closed':
        return;
      case 'open':
        return self._close(key);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Connect to a {@link RoomSignaling}.
 * @param {Array<string>} identities
 * @param {?(string|Room.SID)} nameOrSid
 * @param {LocalMedia} localMedia
 * @param {object} options
 * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
 */
Signaling.prototype.connect = function connect(identities, nameOrSid, localMedia, options) {
  var self = this;
  return this.bracket('connect', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
        // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
        // we just need to ensure the Signaling remains open.
        self.releaseLockCompletely(key);
        return self._connect(identities, nameOrSid, localMedia, options);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Open the {@link Signaling}.
 * @returns {Promise}
 */
Signaling.prototype.open = function open() {
  var self = this;
  return this.bracket('open', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key);
      case 'open':
        return;
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

module.exports = Signaling;
