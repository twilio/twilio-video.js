'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isSubscribed - Whether the {@link RemoteMediaTrack} is
   *   subscribed by the {@link LocalParticipant}
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @emits RemoteTrack#unsubscribed
   */
  return function (_AudioOrVideoTrack) {
    _inherits(RemoteMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {RemoteTrackSignaling} signaling
     * @param {{log: Log}} options
     */
    function RemoteMediaTrack(mediaTrackReceiver, signaling, options) {
      _classCallCheck(this, RemoteMediaTrack);

      options = Object.assign({
        name: signaling.name
      }, options);

      var _this = _possibleConstructorReturn(this, (RemoteMediaTrack.__proto__ || Object.getPrototypeOf(RemoteMediaTrack)).call(this, mediaTrackReceiver, options));

      var isSubscribed = signaling.isSubscribed;
      Object.defineProperties(_this, {
        _isSubscribed: {
          set: function set(_isSubscribed) {
            isSubscribed = _isSubscribed;
          },
          get: function get() {
            return isSubscribed;
          }
        },
        _mediaTrackReceiver: {
          value: mediaTrackReceiver
        },
        _signaling: {
          value: signaling
        },
        isEnabled: {
          enumerable: true,
          get: function get() {
            return signaling.isEnabled;
          }
        },
        isSubscribed: {
          enumerable: true,
          get: function get() {
            return this._isSubscribed;
          }
        },
        sid: {
          enumerable: true,
          value: signaling.sid
        }
      });

      _this._signaling.on('updated', function () {
        _this.emit(_this.isEnabled ? 'enabled' : 'disabled', _this);
      });
      return _this;
    }

    /**
     * @private
     */


    _createClass(RemoteMediaTrack, [{
      key: '_unsubscribe',
      value: function _unsubscribe() {
        if (this.isSubscribed) {
          this._isSubscribed = false;
          this.emit('unsubscribed', this);
        }
        return this;
      }
    }]);

    return RemoteMediaTrack;
  }(AudioOrVideoTrack);
}

module.exports = mixinRemoteMediaTrack;