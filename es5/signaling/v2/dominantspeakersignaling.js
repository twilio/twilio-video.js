'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

/**
 * @property {?Track.SID} loudestParticipantSid
 * @emits DominantSpeakerSignaling#updated
 */


var DominantSpeakerSignaling = function (_EventEmitter) {
  _inherits(DominantSpeakerSignaling, _EventEmitter);

  /**
   * Construct an {@link DominantSpeakerSignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  function DominantSpeakerSignaling(mediaSignalingTransport) {
    _classCallCheck(this, DominantSpeakerSignaling);

    var _this = _possibleConstructorReturn(this, (DominantSpeakerSignaling.__proto__ || Object.getPrototypeOf(DominantSpeakerSignaling)).call(this));

    Object.defineProperties(_this, {
      _loudestParticipantSid: {
        value: null,
        writable: true
      }
    });

    mediaSignalingTransport.on('message', function (message) {
      switch (message.type) {
        case 'active_speaker':
          _this._setLoudestParticipantSid(message.participant);
          break;
        default:
          break;
      }
    });
    return _this;
  }

  /**
   * Get the loudest {@link Track.SID}, if known.
   * @returns {?Track.SID}
   */


  _createClass(DominantSpeakerSignaling, [{
    key: '_setLoudestParticipantSid',


    /**
     * @private
     * @param {Track.SID} loudestParticipantSid
     * @returns {void}
     */
    value: function _setLoudestParticipantSid(loudestParticipantSid) {
      if (this.loudestParticipantSid === loudestParticipantSid) {
        return;
      }
      this._loudestParticipantSid = loudestParticipantSid;
      this.emit('updated');
    }
  }, {
    key: 'loudestParticipantSid',
    get: function get() {
      return this._loudestParticipantSid;
    }
  }]);

  return DominantSpeakerSignaling;
}(EventEmitter);

/**
 * @event DominantSpeakerSignaling#updated
 */

module.exports = DominantSpeakerSignaling;