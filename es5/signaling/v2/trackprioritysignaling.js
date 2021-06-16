'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaSignaling = require('./mediasignaling');

var TrackPrioritySignaling = function (_MediaSignaling) {
  _inherits(TrackPrioritySignaling, _MediaSignaling);

  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {Promise<DataTrackReceiver>} getReceiver
   */
  function TrackPrioritySignaling(getReceiver, options) {
    _classCallCheck(this, TrackPrioritySignaling);

    var _this = _possibleConstructorReturn(this, (TrackPrioritySignaling.__proto__ || Object.getPrototypeOf(TrackPrioritySignaling)).call(this, getReceiver, 'track_priority', options));

    Object.defineProperties(_this, {
      _enqueuedPriorityUpdates: {
        value: new Map()
      }
    });

    _this.on('ready', function (transport) {
      Array.from(_this._enqueuedPriorityUpdates.keys()).forEach(function (trackSid) {
        transport.publish({
          type: 'track_priority',
          track: trackSid,
          subscribe: _this._enqueuedPriorityUpdates.get(trackSid)
        });
        // NOTE(mpatwardhan)- we do not clear _enqueuedPriorityUpdates intentionally,
        // this cache will is used to re-send the priorities in case of VMS-FailOver.
      });
    });
    return _this;
  }

  /**
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   */


  _createClass(TrackPrioritySignaling, [{
    key: 'sendTrackPriorityUpdate',
    value: function sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
      if (publishOrSubscribe !== 'subscribe') {
        throw new Error('only subscribe priorities are supported, found: ' + publishOrSubscribe);
      }
      this._enqueuedPriorityUpdates.set(trackSid, priority);
      if (this._transport) {
        this._transport.publish({
          type: 'track_priority',
          track: trackSid,
          subscribe: priority
        });
      }
    }
  }]);

  return TrackPrioritySignaling;
}(MediaSignaling);

module.exports = TrackPrioritySignaling;