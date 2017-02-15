/* eslint consistent-return:0 */
'use strict';

var inherits = require('util').inherits;
var ParticipantSignaling = require('./participant');
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
 * @extends StateMachine
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
  return Promise.resolve(this);
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._connect = function _connect(localParticipant, token, options) {
  localParticipant.connect('PA00000000000000000000000000000000', 'test');
  var sid = 'RM00000000000000000000000000000000';
  var promise = Promise.resolve(new RoomSignaling(localParticipant, sid, options));
  promise.cancel = function cancel() {};
  return promise;
};

// NOTE(mroberts): This is a dummy implementation suitable for testing.
Signaling.prototype._open = function _open(key) {
  this.transition('opening', key);
  this.transition('open', key);
  return Promise.resolve(this);
};

/**
 * Close the {@link Signaling}.
 * @returns {Promise<this>}
 */
Signaling.prototype.close = function close() {
  var self = this;
  return this.bracket('close', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self;
      case 'open':
        return self._close(key);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Connect to a {@link RoomSignaling}.
 * @param {ParticipantSignaling} localParticipant
 * @param {string} token
 * @param {object} options
 * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
 */
Signaling.prototype.connect = function connect(localParticipant, token, options) {
  var self = this;
  return this.bracket('connect', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key).then(transition.bind(null, key));
      case 'open':
        // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
        // we just need to ensure the Signaling remains open.
        self.releaseLockCompletely(key);
        return self._connect(localParticipant, token, options);
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

/**
 * Create a local {@link ParticipantSignaling}.
 * @returns {ParticipantSignaling}
 */
Signaling.prototype.createLocalParticipantSignaling = function createLocalParticipantSignaling() {
  return new ParticipantSignaling();
};

/**
 * Open the {@link Signaling}.
 * @returns {Promise<this>}
 */
Signaling.prototype.open = function open() {
  var self = this;
  return this.bracket('open', function transition(key) {
    switch (self.state) {
      case 'closed':
        return self._open(key);
      case 'open':
        return self;
      default:
        throw new Error('Unexpected Signaling state "' + self.state + '"');
    }
  });
};

module.exports = Signaling;
