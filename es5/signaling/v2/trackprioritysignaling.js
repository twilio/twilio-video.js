'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('events'),
    EventEmitter = _require.EventEmitter;

/**
 * @emits TrackPrioritySignaling#updated
 */


var TrackPrioritySignaling = function (_EventEmitter) {
  _inherits(TrackPrioritySignaling, _EventEmitter);

  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  function TrackPrioritySignaling(mediaSignalingTransport) {
    _classCallCheck(this, TrackPrioritySignaling);

    var _this = _possibleConstructorReturn(this, (TrackPrioritySignaling.__proto__ || Object.getPrototypeOf(TrackPrioritySignaling)).call(this));

    Object.defineProperties(_this, {
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      }
    });

    mediaSignalingTransport.on('message', function (message) {
      switch (message.type) {
        case 'track_priority':
          if (message.publish) {
            _this._setTrackPriorityUpdate(message.track, 'publish', message.publish);
          } else if (message.subscribe) {
            _this._setTrackPriorityUpdate(message.track, 'subscribe', message.subscribe);
          }
          break;
        default:
          break;
      }
    });
    return _this;
  }

  /**
   * @private
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   * @returns {void}
   */


  _createClass(TrackPrioritySignaling, [{
    key: '_setTrackPriorityUpdate',
    value: function _setTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
      this.emit('updated', trackSid, publishOrSubscribe, priority);
    }

    /**
     * @param {Track.SID} trackSid
     * @param {'publish'|'subscribe'} publishOrSubscribe
     * @param {Track.Priority} priority
     */

  }, {
    key: 'sendTrackPriorityUpdate',
    value: function sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
      this._mediaSignalingTransport.publish(_defineProperty({
        type: 'track_priority',
        track: trackSid
      }, publishOrSubscribe, priority));
    }
  }]);

  return TrackPrioritySignaling;
}(EventEmitter);

/**
 * @event TrackPrioritySignaling#updated
 */

module.exports = TrackPrioritySignaling;