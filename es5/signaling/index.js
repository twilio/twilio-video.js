/* eslint consistent-return:0 */
'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

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
  closed: ['opening'],
  opening: ['closed', 'open'],
  open: ['closed', 'closing'],
  closing: ['closed', 'open']
};

/**
 * @extends StateMachine
 * @property {string} state - one of "closed", "opening", "open", or "closing"
 */

var Signaling = function (_StateMachine) {
  _inherits(Signaling, _StateMachine);

  /**
   * Construct {@link Signaling}.
   */
  function Signaling() {
    _classCallCheck(this, Signaling);

    return _possibleConstructorReturn(this, (Signaling.__proto__ || Object.getPrototypeOf(Signaling)).call(this, 'closed', states));
  }

  /**
   * @private
   */
  // NOTE(mroberts): This is a dummy implementation suitable for testing.


  _createClass(Signaling, [{
    key: '_close',
    value: function _close(key) {
      this.transition('closing', key);
      this.transition('closed', key);
      return Promise.resolve(this);
    }

    /**
     * @private
     */
    // NOTE(mroberts): This is a dummy implementation suitable for testing.

  }, {
    key: '_connect',
    value: function _connect(localParticipant, token, encodingParameters, preferredCodecs, options) {
      localParticipant.connect('PA00000000000000000000000000000000', 'test');
      var sid = 'RM00000000000000000000000000000000';
      var promise = Promise.resolve(new RoomSignaling(localParticipant, sid, options));
      promise.cancel = function cancel() {};
      return promise;
    }

    /**
     * @private
     */
    // NOTE(mroberts): This is a dummy implementation suitable for testing.

  }, {
    key: '_open',
    value: function _open(key) {
      this.transition('opening', key);
      this.transition('open', key);
      return Promise.resolve(this);
    }

    /**
     * Close the {@link Signaling}.
     * @returns {Promise<this>}
     */

  }, {
    key: 'close',
    value: function close() {
      var _this2 = this;

      return this.bracket('close', function (key) {
        switch (_this2.state) {
          case 'closed':
            return _this2;
          case 'open':
            return _this2._close(key);
          default:
            throw new Error('Unexpected Signaling state "' + _this2.state + '"');
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

  }, {
    key: 'connect',
    value: function connect(localParticipant, token, encodingParameters, preferredCodecs, options) {
      var self = this;
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
            throw new Error('Unexpected Signaling state "' + self.state + '"');
        }
      });
    }

    /**
     * Create a local {@link ParticipantSignaling}.
     * @returns {ParticipantSignaling}
     */

  }, {
    key: 'createLocalParticipantSignaling',
    value: function createLocalParticipantSignaling() {
      return new ParticipantSignaling();
    }

    /**
     * Open the {@link Signaling}.
     * @returns {Promise<this>}
     */

  }, {
    key: 'open',
    value: function open() {
      var _this3 = this;

      return this.bracket('open', function (key) {
        switch (_this3.state) {
          case 'closed':
            return _this3._open(key);
          case 'open':
            return _this3;
          default:
            throw new Error('Unexpected Signaling state "' + _this3.state + '"');
        }
      });
    }
  }]);

  return Signaling;
}(StateMachine);

module.exports = Signaling;