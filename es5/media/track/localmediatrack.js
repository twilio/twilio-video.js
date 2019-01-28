'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var MediaTrackSender = require('./sender');

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @property {boolean} isStopped - Whether or not the {@link LocalMediaTrack} is stopped
   * @emits LocalMediaTrack#stopped
   */
  return function (_AudioOrVideoTrack) {
    _inherits(LocalMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    function LocalMediaTrack(mediaStreamTrack, options) {
      _classCallCheck(this, LocalMediaTrack);

      options = Object.assign({}, options);

      var mediaTrackSender = new MediaTrackSender(mediaStreamTrack);

      var _this = _possibleConstructorReturn(this, (LocalMediaTrack.__proto__ || Object.getPrototypeOf(LocalMediaTrack)).call(this, mediaTrackSender, options));

      Object.defineProperties(_this, {
        _didCallEnd: {
          value: false,
          writable: true
        },
        _trackSender: {
          value: mediaTrackSender
        },
        isEnabled: {
          enumerable: true,
          get: function get() {
            return mediaStreamTrack.enabled;
          }
        },
        isStopped: {
          get: function get() {
            return mediaStreamTrack.readyState === 'ended';
          }
        }
      });
      return _this;
    }

    /**
     * @private
     */


    _createClass(LocalMediaTrack, [{
      key: '_end',
      value: function _end() {
        if (this._didCallEnd) {
          return;
        }
        _get(LocalMediaTrack.prototype.__proto__ || Object.getPrototypeOf(LocalMediaTrack.prototype), '_end', this).call(this);
        this._didCallEnd = true;
        this.emit('stopped', this);
      }
    }, {
      key: 'enable',
      value: function enable(enabled) {
        enabled = typeof enabled === 'boolean' ? enabled : true;
        if (enabled !== this.mediaStreamTrack.enabled) {
          this._log.info((enabled ? 'En' : 'Dis') + 'abling');
          this.mediaStreamTrack.enabled = enabled;
          this.emit(enabled ? 'enabled' : 'disabled', this);
        }
        return this;
      }
    }, {
      key: 'disable',
      value: function disable() {
        return this.enable(false);
      }
    }, {
      key: 'stop',
      value: function stop() {
        this._log.info('Stopping');
        this.mediaStreamTrack.stop();
        this._end();
        return this;
      }
    }]);

    return LocalMediaTrack;
  }(AudioOrVideoTrack);
}

module.exports = mixinLocalMediaTrack;