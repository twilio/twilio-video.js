'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

/**
 * @classdesc A {@link DataTransport} implements {@link MediaSignalingTransport}
 *   in terms of an RTCDataChannel.
 * @extends EventEmitter
 * @implements MediaSignalingTransport
 * @emits DataTransport#message
 */


var DataTransport = function (_EventEmitter) {
  _inherits(DataTransport, _EventEmitter);

  /**
   * Construct a {@link DataTransport}.
   * @param {RTCDataChannel} dataChannel
   */
  function DataTransport(dataChannel) {
    _classCallCheck(this, DataTransport);

    var _this = _possibleConstructorReturn(this, (DataTransport.__proto__ || Object.getPrototypeOf(DataTransport)).call(this));

    Object.defineProperties(_this, {
      _dataChannel: {
        value: dataChannel
      },
      _messageQueue: {
        value: []
      }
    });

    dataChannel.addEventListener('open', function () {
      _this._messageQueue.splice(0).forEach(function (message) {
        return _this._publish(message);
      });
    });

    dataChannel.addEventListener('message', function (_ref) {
      var data = _ref.data;

      try {
        var message = JSON.parse(data);
        _this.emit('message', message);
      } catch (error) {
        // Do nothing.
      }
    });

    _this.publish({ type: 'ready' });
    return _this;
  }

  /**
   * @param message
   * @private
   */


  _createClass(DataTransport, [{
    key: '_publish',
    value: function _publish(message) {
      var data = JSON.stringify(message);
      try {
        this._dataChannel.send(data);
      } catch (error) {
        // Do nothing.
      }
    }

    /**
     * Publish a message. Returns true if calling the method resulted in
     * publishing (or eventually publishing) the update.
     * @param {object} message
     * @returns {boolean}
     */

  }, {
    key: 'publish',
    value: function publish(message) {
      var dataChannel = this._dataChannel;
      if (dataChannel.readyState === 'closing' || dataChannel.readyState === 'closed') {
        return false;
      }
      if (dataChannel.readyState === 'connecting') {
        this._messageQueue.push(message);
        return true;
      }
      this._publish(message);
      return true;
    }
  }]);

  return DataTransport;
}(EventEmitter);

/**
 * The {@link DataTransport} received a message.
 * @event DataTransport#message
 * @param {object} message
 */

module.exports = DataTransport;