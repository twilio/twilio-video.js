'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var TrackTransceiver = require('../transceiver');

/**
 * A {@link DataTrackTransceiver} represents either one or more local
 * RTCDataChannels or a single remote RTCDataChannel. It can be used to send or
 * receive data.
 * @extends TrackTransceiver
 * @property {string} id
 * @property {string} kind - "data"
 * @property {?number} maxPacketLifeTime
 * @property {?number} maxRetransmits
 * @property {boolean} ordered
 */

var DataTrackTransceiver = function (_TrackTransceiver) {
  _inherits(DataTrackTransceiver, _TrackTransceiver);

  /**
   * Construct a {@link DataTrackTransceiver}.
   * @param {string} id
   * @param {?number} maxPacketLifeTime
   * @param {?number} maxRetransmits
   * @param {boolean} ordered
   */
  function DataTrackTransceiver(id, maxPacketLifeTime, maxRetransmits, ordered) {
    _classCallCheck(this, DataTrackTransceiver);

    var _this = _possibleConstructorReturn(this, (DataTrackTransceiver.__proto__ || Object.getPrototypeOf(DataTrackTransceiver)).call(this, id, 'data'));

    Object.defineProperties(_this, {
      maxPacketLifeTime: {
        enumerable: true,
        value: maxPacketLifeTime
      },
      maxRetransmits: {
        enumerable: true,
        value: maxRetransmits
      },
      ordered: {
        enumerable: true,
        value: ordered
      }
    });
    return _this;
  }

  return DataTrackTransceiver;
}(TrackTransceiver);

module.exports = DataTrackTransceiver;