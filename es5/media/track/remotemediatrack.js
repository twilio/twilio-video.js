'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   */
  return function (_AudioOrVideoTrack) {
    _inherits(RemoteMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {Track.SID} sid
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {{log: Log, name: ?string}} options
     */
    function RemoteMediaTrack(sid, mediaTrackReceiver, isEnabled, options) {
      _classCallCheck(this, RemoteMediaTrack);

      var _this = _possibleConstructorReturn(this, (RemoteMediaTrack.__proto__ || Object.getPrototypeOf(RemoteMediaTrack)).call(this, mediaTrackReceiver, options));

      Object.defineProperties(_this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        },
        isEnabled: {
          enumerable: true,
          get: function get() {
            return this._isEnabled;
          }
        },
        sid: {
          enumerable: true,
          value: sid
        }
      });
      return _this;
    }

    /**
     * @private
     * @param {boolean} isEnabled
     */


    _createClass(RemoteMediaTrack, [{
      key: '_setEnabled',
      value: function _setEnabled(isEnabled) {
        if (this._isEnabled !== isEnabled) {
          this._isEnabled = isEnabled;
          this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
        }
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

module.exports = mixinRemoteMediaTrack;