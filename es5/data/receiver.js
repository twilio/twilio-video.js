'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DataTrackTransceiver = require('./transceiver');
var DataTransport = require('./transport');

/**
 * A {@link DataTrackReceiver} represents a {@link DataTrackTransceiver} over
 * which data can be received. Internally, it users a single RTCDataChannel to
 * receive data.
 * @extends DataTrackTransceiver
 * @emits DataTrackReceiver#message
 * @emits DataTrackReceiver#close
 */

var DataTrackReceiver = function (_DataTrackTransceiver) {
  _inherits(DataTrackReceiver, _DataTrackTransceiver);

  /**
   * Construct an {@link DataTrackReceiver}.
   * @param {RTCDataChannel} dataChannel
   */
  function DataTrackReceiver(dataChannel) {
    _classCallCheck(this, DataTrackReceiver);

    var _this = _possibleConstructorReturn(this, (DataTrackReceiver.__proto__ || Object.getPrototypeOf(DataTrackReceiver)).call(this, dataChannel.label, dataChannel.maxPacketLifeTime, dataChannel.maxRetransmits, dataChannel.ordered));

    Object.defineProperties(_this, {
      _dataChannel: {
        value: dataChannel
      }
    });

    // NOTE(mmalavalli): In Firefox, the default value for "binaryType" is "blob".
    // So, we set it to "arraybuffer" to ensure that it is consistent with Chrome
    // and Safari.
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.addEventListener('message', function (event) {
      _this.emit('message', event.data);
    });

    dataChannel.addEventListener('close', function () {
      _this.emit('close');
    });
    return _this;
  }

  _createClass(DataTrackReceiver, [{
    key: 'stop',
    value: function stop() {
      this._dataChannel.close();
      _get(DataTrackReceiver.prototype.__proto__ || Object.getPrototypeOf(DataTrackReceiver.prototype), 'stop', this).call(this);
    }

    /**
     * Create a {@link DataTransport} from the {@link DataTrackReceiver}.
     * @returns {DataTransport}
     */

  }, {
    key: 'toDataTransport',
    value: function toDataTransport() {
      return new DataTransport(this._dataChannel);
    }
  }]);

  return DataTrackReceiver;
}(DataTrackTransceiver);

/**
 * @event DataTrackReceiver#message
 * @param {string|ArrayBuffer} data
 */

/**
 * @event DataTrackReceiver#close
 */

module.exports = DataTrackReceiver;