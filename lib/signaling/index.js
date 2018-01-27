/* eslint consistent-return:0 */
'use strict';

const ParticipantSignaling = require('./participant');
const RoomSignaling = require('./room');
const StateMachine = require('../statemachine');

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

const states = {
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
class Signaling extends StateMachine {
  constructor() {
    super('closed', states);
  }

  // NOTE(mroberts): This is a dummy implementation suitable for testing.
  _close(key) {
    this.transition('closing', key);
    this.transition('closed', key);
    return Promise.resolve(this);
  }

  // NOTE(mroberts): This is a dummy implementation suitable for testing.
  _connect(
    localParticipant,
    token,
    iceServerSource,
    encodingParameters,
    preferredCodecs,
    options
  ) {
    localParticipant.connect('PA00000000000000000000000000000000', 'test');
    const sid = 'RM00000000000000000000000000000000';
    const promise = Promise.resolve(new RoomSignaling(localParticipant, sid, options));
    promise.cancel = function cancel() {};
    return promise;
  }

  // NOTE(mroberts): This is a dummy implementation suitable for testing.
  _open(key) {
    this.transition('opening', key);
    this.transition('open', key);
    return Promise.resolve(this);
  }

  /**
   * Close the {@link Signaling}.
   * @returns {Promise<this>}
   */
  close() {
    const self = this;
    return this.bracket('close', function transition(key) {
      switch (self.state) {
        case 'closed':
          return self;
        case 'open':
          return self._close(key);
        default:
          throw new Error(`Unexpected Signaling state "${self.state}"`);
      }
    });
  }

  /**
   * Connect to a {@link RoomSignaling}.
   * @param {ParticipantSignaling} localParticipant
   * @param {string} token
   * @param {IceServerSource} iceServerSource
   * @param {EncodingParametersImpl} encodingParameters
   * @param {PreferredCodecs} preferredCodecs
   * @param {object} options
   * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
   */
  connect(
    localParticipant,
    token,
    iceServerSource,
    encodingParameters,
    preferredCodecs,
    options
  ) {
    const self = this;
    return this.bracket('connect', function transition(key) {
      switch (self.state) {
        case 'closed':
          return self._open(key).then(transition.bind(null, key));
        case 'open':
          // NOTE(mroberts): We don't need to hold the lock in _connect. Instead,
          // we just need to ensure the Signaling remains open.
          self.releaseLockCompletely(key);
          return self._connect(localParticipant, token, iceServerSource, encodingParameters, preferredCodecs, options);
        default:
          throw new Error(`Unexpected Signaling state "${self.state}"`);
      }
    });
  }

  /**
   * Create a local {@link ParticipantSignaling}.
   * @returns {ParticipantSignaling}
   */
  createLocalParticipantSignaling() {
    return new ParticipantSignaling();
  }

  /**
   * Open the {@link Signaling}.
   * @returns {Promise<this>}
   */
  open() {
    const self = this;
    return this.bracket('open', function transition(key) {
      switch (self.state) {
        case 'closed':
          return self._open(key);
        case 'open':
          return self;
        default:
          throw new Error(`Unexpected Signaling state "${self.state}"`);
      }
    });
  }
}

module.exports = Signaling;
