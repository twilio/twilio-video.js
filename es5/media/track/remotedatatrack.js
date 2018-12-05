'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('../../util'),
    deprecateEvents = _require.deprecateEvents;

var Track = require('./');

/**
 * A {@link RemoteDataTrack} represents data published to a {@link Room} by a
 * {@link RemoteParticipant}.
 * @extends Track
 * @property {boolean} isEnabled - true
 * @property {Track.Kind} kind - "data"
 * @property {?number} maxPacketLifeTime - If non-null, this represents a time
 *   limit (in milliseconds) during which data will be transmitted or
 *   retransmitted if not acknowledged on the underlying RTCDataChannel.
 * @property {?number} maxRetransmits - If non-null, this represents the number
 *   of times the data will be retransmitted if not successfully received on the
 *   underlying RTCDataChannel.
 * @property {boolean} ordered - true if data on the {@link RemoteDataTrack} can
 *   be received out-of-order.
 * @property {boolean} reliable - This is true if both
 *   <code>maxPacketLifeTime</code> and <code>maxRetransmits</code> are set to
 *   null. In other words, if this is true, there is no bound on packet lifetime
 *   or the number of retransmits that will be attempted, ensuring "reliable"
 *   transmission.
 * @emits RemoteDataTrack#message
 * @emits RemoteDataTrack#unsubscribed
 */

var RemoteDataTrack = function (_Track) {
  _inherits(RemoteDataTrack, _Track);

  /**
   * Construct a {@link RemoteDataTrack} from a {@link DataTrackReceiver}.
   * @param {DataTrackReceiver} dataTrackReceiver
   * @param {{log: Log, name: ?string}} options
   */
  function RemoteDataTrack(dataTrackReceiver, options) {
    _classCallCheck(this, RemoteDataTrack);

    var _this = _possibleConstructorReturn(this, (RemoteDataTrack.__proto__ || Object.getPrototypeOf(RemoteDataTrack)).call(this, dataTrackReceiver.id, 'data', options));

    Object.defineProperties(_this, {
      _isSubscribed: {
        value: true,
        writable: true
      },
      _sid: {
        value: null,
        writable: true
      },
      isEnabled: {
        enumerable: true,
        value: true
      },
      maxPacketLifeTime: {
        enumerable: true,
        value: dataTrackReceiver.maxPacketLifeTime
      },
      maxRetransmits: {
        enumerable: true,
        value: dataTrackReceiver.maxRetransmits
      },
      ordered: {
        enumerable: true,
        value: dataTrackReceiver.ordered
      },
      reliable: {
        enumerable: true,
        value: dataTrackReceiver.maxPacketLifeTime === null && dataTrackReceiver.maxRetransmits === null
      }
    });

    deprecateEvents('RemoteDataTrack', _this, new Map([['unsubscribed', null]]), _this._log);

    dataTrackReceiver.on('message', function (data) {
      _this.emit('message', data, _this);
    });
    return _this;
  }

  /**
   * The {@link RemoteDataTrack}'s ID.
   * @property {Track.ID}
   * @deprecated Use the parent {@link RemoteTrackPublication}'s .trackName
   *   or .trackSid instead
   */


  _createClass(RemoteDataTrack, [{
    key: '_setEnabled',


    /**
     * @private
     */
    value: function _setEnabled() {}
    // Do nothing.


    /**
     * @private
     * @param {Track.SID} sid
     */

  }, {
    key: '_setSid',
    value: function _setSid(sid) {
      if (!this._sid) {
        this._sid = sid;
      }
    }

    /**
     * @private
     */

  }, {
    key: '_unsubscribe',
    value: function _unsubscribe() {
      if (this._isSubscribed) {
        this._isSubscribed = false;
        this.emit('unsubscribed', this);
      }
    }
  }, {
    key: 'id',
    get: function get() {
      this._log.deprecated('RemoteDataTrack#id has been deprecated and is ' + 'scheduled for removal in twilio-video.js@2.0.0. Use the parent ' + 'RemoteTrackPublication\'s .trackName or .trackSid instead.');
      return this._id;
    }

    /**
     * Whether the {@link RemoteDataTrack} is subscribed to
     * @property {boolean}
     * @deprecated Use the parent {@link RemoteTrackPublication}'s .isSubscribed
     *   instead
     */

  }, {
    key: 'isSubscribed',
    get: function get() {
      this._log.deprecated('RemoteDataTrack#isSubscribed has been deprecated and is ' + 'scheduled for removal in twilio-video.js@2.0.0. Use the ' + 'parent RemoteTrackPublication\'s .isSubscribed instead.');
      return this._isSubscribed;
    }

    /**
     * The SID assigned to the {@link RemoteMediaTrack}
     * @property {Track.SID}
     */

  }, {
    key: 'sid',
    get: function get() {
      return this._sid;
    }
  }]);

  return RemoteDataTrack;
}(Track);

/**
 * A message was received over the {@link RemoteDataTrack}.
 * @event RemoteDataTrack#message
 * @param {string|ArrayBuffer} data
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that received
 *   the message
 */

/**
 * The {@link RemoteDataTrack} was unsubscribed from.
 * @event RemoteDataTrack#unsubscribed
 * @param {RemoteDataTrack} track - The {@link RemoteDataTrack} that was
 *   unsubscribed from
 * @deprecated Use the parent {@link RemoteTrackPublication}'s "unsubscribed"
 *   event instead
 */

module.exports = RemoteDataTrack;