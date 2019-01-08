'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DataTrackTransceiver = require('./transceiver');
var makeUUID = require('../util').makeUUID;

/**
 * A {@link DataTrackSender} represents a {@link DataTrackTransceiver} over
 * which data can be sent. Internally, it uses a collection of RTCDataChannels
 * to send data.
 * @extends DataTrackTransceiver
 */

var DataTrackSender = function (_DataTrackTransceiver) {
  _inherits(DataTrackSender, _DataTrackTransceiver);

  /**
   * Construct a {@link DataTrackSender}.
   * @param {?number} maxPacketLifeTime
   * @param {?number} maxRetransmits
   * @param {boolean} ordered
   */
  function DataTrackSender(maxPacketLifeTime, maxRetransmtis, ordered) {
    _classCallCheck(this, DataTrackSender);

    var _this = _possibleConstructorReturn(this, (DataTrackSender.__proto__ || Object.getPrototypeOf(DataTrackSender)).call(this, makeUUID(), maxPacketLifeTime, maxRetransmtis, ordered));

    Object.defineProperties(_this, {
      _dataChannels: {
        value: new Set()
      }
    });
    return _this;
  }

  /**
   * Add an RTCDataChannel to the {@link DataTrackSender}.
   * @param {RTCDataChannel} dataChannel
   * @returns {this}
   */


  _createClass(DataTrackSender, [{
    key: 'addDataChannel',
    value: function addDataChannel(dataChannel) {
      this._dataChannels.add(dataChannel);
      return this;
    }

    /**
     * Remove an RTCDataChannel from the {@link DataTrackSender}.
     * @param {RTCDataChannel} dataChannel
     * @returns {this}
     */

  }, {
    key: 'removeDataChannel',
    value: function removeDataChannel(dataChannel) {
      this._dataChannels.delete(dataChannel);
      return this;
    }

    /**
     * Send data over the {@link DataTrackSender}. Internally, this calls
     * <code>send</code> over each of the underlying RTCDataChannels.
     * @param {string|Blob|ArrayBuffer|ArrayBufferView} data
     * @returns {this}
     */

  }, {
    key: 'send',
    value: function send(data) {
      this._dataChannels.forEach(function (dataChannel) {
        try {
          dataChannel.send(data);
        } catch (error) {
          // Do nothing.
        }
      });
      return this;
    }
  }]);

  return DataTrackSender;
}(DataTrackTransceiver);

module.exports = DataTrackSender;