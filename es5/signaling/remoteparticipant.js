'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ParticipantSignaling = require('./participant');

/**
 * A {@link Participant} implementation
 * @extends ParticipantSignaling
 * @property {string} identity
 * @property {Participant.SID} sid
 */

var RemoteParticipantSignaling = function (_ParticipantSignaling) {
  _inherits(RemoteParticipantSignaling, _ParticipantSignaling);

  /**
   * Construct a {@link RemoteParticipantSignaling}.
   * @param {Participant.SID} sid
   * @param {string} identity
   */
  function RemoteParticipantSignaling(sid, identity) {
    _classCallCheck(this, RemoteParticipantSignaling);

    var _this = _possibleConstructorReturn(this, (RemoteParticipantSignaling.__proto__ || Object.getPrototypeOf(RemoteParticipantSignaling)).call(this));

    _this.connect(sid, identity);
    return _this;
  }

  return RemoteParticipantSignaling;
}(ParticipantSignaling);

module.exports = RemoteParticipantSignaling;