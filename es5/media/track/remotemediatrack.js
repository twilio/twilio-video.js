'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('../../util'),
    deprecateEvents = _require.deprecateEvents;

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#unsubscribed
   */
  return function (_AudioOrVideoTrack) {
    _inherits(RemoteMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {{log: Log, name: ?string}} options
     */
    function RemoteMediaTrack(mediaTrackReceiver, isEnabled, options) {
      _classCallCheck(this, RemoteMediaTrack);

      var _this = _possibleConstructorReturn(this, (RemoteMediaTrack.__proto__ || Object.getPrototypeOf(RemoteMediaTrack)).call(this, mediaTrackReceiver, options));

      Object.defineProperties(_this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        },
        _isSubscribed: {
          value: true,
          writable: true
        },
        _sid: {
          value: null,
          writable: true
        }
      });

      deprecateEvents('RemoteMediaTrack', _this, new Map([['unsubscribed', null]]), _this._log);
      return _this;
    }

    /**
     * The {@link RemoteMediaTrack}'s ID.
     * @property {Track.ID}
     * @deprecated Use the parent {@link RemoteTrackPublication}'s .trackName or
     *   .trackSid instead
     */


    _createClass(RemoteMediaTrack, [{
      key: '_setEnabled',


      /**
       * @private
       * @param {boolean} isEnabled
       */
      value: function _setEnabled(isEnabled) {
        if (this._isEnabled !== isEnabled) {
          this._isEnabled = isEnabled;
          this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
        }
      }

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
        this._log.deprecated('RemoteMediaTrack#id has been deprecated and is ' + 'scheduled for removal in twilio-video.js@2.0.0. Use the parent ' + 'RemoteTrackPublication\'s .trackName or .trackSid instead.');
        return this._id;
      }

      /**
       * Whether the {@link RemoteMediaTrack} is enabled
       * @property {boolean}
       */

    }, {
      key: 'isEnabled',
      get: function get() {
        return this._isEnabled;
      }

      /**
       * Whether the {@link RemoteMediaTrack} is subscribed to
       * @property {boolean}
       * @deprecated Use the parent {@link RemoteTrackPublication}'s .isSubscribed
       *   instead
       */

    }, {
      key: 'isSubscribed',
      get: function get() {
        this._log.deprecated('RemoteMediaTrack#isSubscribed has been deprecated and is ' + 'scheduled for removal in twilio-video.js@2.0.0. Use the ' + 'parent RemoteTrackPublication\'s .isSubscribed instead.');
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

    return RemoteMediaTrack;
  }(AudioOrVideoTrack);
}

/**
 * A {@link RemoteMediaTrack} was disabled.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   disabled
 * @event RemoteMediaTrack#disabled
 */

/**
 * A {@link RemoteMediaTrack} was enabled.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   enabled
 * @event RemoteMediaTrack#enabled
 */

/**
 * The {@link RemoteMediaTrack} was unsubscribed from.
 * @event RemoteMediaTrack#unsubscribed
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   unsubscribed from
 * @deprecated Use the parent {@link RemoteTrackPublication}'s "unsubscribed"
 *   event instead
 */

module.exports = mixinRemoteMediaTrack;