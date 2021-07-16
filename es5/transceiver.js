'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

/**
 * A {@link TrackTransceiver} represents either one or more local RTCRtpSenders
 * or RTCDataChannels, or a single RTCRtpReceiver or remote RTCDataChannel.
 * @extends EventEmitter
 * @property {Track.ID} id
 * @property {Track.kind} kind
 */

var TrackTransceiver = function (_EventEmitter) {
  _inherits(TrackTransceiver, _EventEmitter);

  /**
   * Construct a {@link TrackTransceiver}.
   * @param {Track.ID} id
   * @param {Track.kind} kind
   */
  function TrackTransceiver(id, kind) {
    _classCallCheck(this, TrackTransceiver);

    var _this = _possibleConstructorReturn(this, (TrackTransceiver.__proto__ || Object.getPrototypeOf(TrackTransceiver)).call(this));

    Object.defineProperties(_this, {
      id: {
        enumerable: true,
        value: id
      },
      kind: {
        enumerable: true,
        value: kind
      }
    });
    return _this;
  }

  /**
   * Stop the {@link TrackTransceiver}.
   * #emits TrackTransceiver#stopped
   * @returns {void}
   */


  _createClass(TrackTransceiver, [{
    key: 'stop',
    value: function stop() {
      this.emit('stopped');
    }
  }]);

  return TrackTransceiver;
}(EventEmitter);

/**
 * The {@link TrackTransceiver} was stopped.
 * @event TrackTransceiver#stopped
 */

module.exports = TrackTransceiver;