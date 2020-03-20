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
 * @extends StateMachine
 * @property {string} state - one of "closed", "opening", "open", or "closing"
 */
class Signaling extends StateMachine {
  /**
   * Construct {@link Signaling}.
   */
  constructor() {
    super('closed', states);
  }

  /**
   * @private
   */
  // NOTE(mroberts): This is a dummy implementation suitable for testing.
  _close(key) {
    this.transition('closing', key);
    this.transition('closed', key);
    return Promise.resolve(this);
  }

  /**
   * @private
   */
  // NOTE(mroberts): This is a dummy implementation suitable for testing.
  _connect(
    localParticipant,
    token,
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

  /**
   * @private
   */
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
    return this.bracket('close', key => {
      switch (this.state) {
        case 'closed':
          return this;
        case 'open':
          return this._close(key);
        default:
          throw new Error(`Unexpected Signaling state "${this.state}"`);
      }
    });
  }

  /**
   * Connect to a {@link RoomSignaling}.
   * @param {ParticipantSignaling} localParticipant
   * @param {string} token
   * @param {EncodingParametersImpl} encodingParameters
   * @param {PreferredCodecs} preferredCodecs
   * @param {object} options
   * @returns {Promise<function(): CancelablePromise<RoomSignaling>>}
   */
  connect(
    localParticipant,
    token,
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
          return self._connect(localParticipant, token, encodingParameters, preferredCodecs, options);
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
    return this.bracket('open', key => {
      switch (this.state) {
        case 'closed':
          return this._open(key);
        case 'open':
          return this;
        default:
          throw new Error(`Unexpected Signaling state "${this.state}"`);
      }
    });
  }
}

module.exports = Signaling;
