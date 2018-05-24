'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DataTrackTransceiver = require('./transceiver');

/**
 * A {@link DataTrackReceiver} represents a {@link DataTrackTransceiver} over
 * which data can be received. Internally, it users a single RTCDataChannel to
 * receive data.
 * @extends DataTrackTransceiver
 * @emits DataTrackReceiver#message
 */

var DataTrackReceiver = function (_DataTrackTransceiver) {
  _inherits(DataTrackReceiver, _DataTrackTransceiver);

  /**
   * Construct an {@link DataTrackReceiver}.
   * @param {RTCDataChannel} dataChannel
   */
  function DataTrackReceiver(dataChannel) {
    _classCallCheck(this, DataTrackReceiver);

    // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
    // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
    // and Safari.
    var _this = _possibleConstructorReturn(this, (DataTrackReceiver.__proto__ || Object.getPrototypeOf(DataTrackReceiver)).call(this, dataChannel.label, dataChannel.maxPacketLifeTime, dataChannel.maxRetransmits, dataChannel.ordered));

    dataChannel.binaryType = 'arraybuffer';

    dataChannel.addEventListener('message', function (event) {
      _this.emit('message', event.data);
    });
    return _this;
  }

  return DataTrackReceiver;
}(DataTrackTransceiver);

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

module.exports = DataTrackReceiver;