'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var mixinLocalMediaTrack = require('./localmediatrack');
var VideoTrack = require('./videotrack');

var LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);

/**
 * A {@link LocalVideoTrack} is a {@link VideoTrack} representing video that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalVideoTrack#enable} and
 * {@link LocalVideoTrack#disable} or stopped completely with
 * {@link LocalVideoTrack#stop}.
 * @extends VideoTrack
 * @property {Track.ID} id - The {@link LocalVideoTrack}'s ID
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @emits LocalVideoTrack#disabled
 * @emits LocalVideoTrack#enabled
 * @emits LocalVideoTrack#started
 * @emits LocalVideoTrack#stopped
 */

var LocalVideoTrack = function (_LocalMediaVideoTrack) {
  _inherits(LocalVideoTrack, _LocalMediaVideoTrack);

  /**
   * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  function LocalVideoTrack(mediaStreamTrack, options) {
    _classCallCheck(this, LocalVideoTrack);

    return _possibleConstructorReturn(this, (LocalVideoTrack.__proto__ || Object.getPrototypeOf(LocalVideoTrack)).call(this, mediaStreamTrack, options));
  }

  _createClass(LocalVideoTrack, [{
    key: 'toString',
    value: function toString() {
      return '[LocalVideoTrack #' + this._instanceId + ': ' + this.id + ']';
    }

    /**
     * @private
     */

  }, {
    key: '_end',
    value: function _end() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), '_end', this).apply(this, arguments);
    }

    /**
     * Disable the {@link LocalVideoTrack}. This is effectively "pause".
     * @returns {this}
     * @fires VideoTrack#disabled
     */

  }, {
    key: 'disable',
    value: function disable() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'disable', this).apply(this, arguments);
    }

    /**
     * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
     * @returns {this}
     * @fires VideoTrack#enabled
    */ /**
       * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
       * or "pause".
       * @param {boolean} [enabled] - Specify false to pause the
       *   {@link LocalVideoTrack}
       * @returns {this}
       * @fires VideoTrack#disabled
       * @fires VideoTrack#enabled
       */

  }, {
    key: 'enable',
    value: function enable() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'enable', this).apply(this, arguments);
    }

    /**
     * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
     * {@link LocalVideoTrack}, you should unpublish it after stopping.
     * @returns {this}
     * @fires LocalVideoTrack#stopped
     */

  }, {
    key: 'stop',
    value: function stop() {
      return _get(LocalVideoTrack.prototype.__proto__ || Object.getPrototypeOf(LocalVideoTrack.prototype), 'stop', this).apply(this, arguments);
    }
  }]);

  return LocalVideoTrack;
}(LocalMediaVideoTrack);

/**
 * The {@link LocalVideoTrack} was disabled, i.e. "muted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */

/**
 * The {@link LocalVideoTrack} was enabled, i.e. "unmuted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */

/**
 * The {@link LocalVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that started
 * @event LocalVideoTrack#started
 */

/**
 * The {@link LocalVideoTrack} stopped, either because
 * {@link LocalVideoTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that stopped
 * @event LocalVideoTrack#stopped
 */

module.exports = LocalVideoTrack;