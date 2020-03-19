'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AudioTrack = require('./audiotrack');
var mixinLocalMediaTrack = require('./localmediatrack');

var LocalMediaAudioTrack = mixinLocalMediaTrack(AudioTrack);

/**
 * A {@link LocalAudioTrack} is an {@link AudioTrack} representing audio that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalAudioTrack#enable} and
 * {@link LocalAudioTrack#disable} or stopped completely with
 * {@link LocalAudioTrack#stop}.
 * @extends AudioTrack
 * @property {Track.ID} id - The {@link LocalAudioTrack}'s ID
 * @property {boolean} isStopped - Whether or not the {@link LocalAudioTrack} is
 *   stopped
 * @emits LocalAudioTrack#disabled
 * @emits LocalAudioTrack#enabled
 * @emits LocalAudioTrack#started
 * @emits LocalAudioTrack#stopped
 */

var LocalAudioTrack = function (_LocalMediaAudioTrack) {
  _inherits(LocalAudioTrack, _LocalMediaAudioTrack);

  /**
   * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  function LocalAudioTrack(mediaStreamTrack, options) {
    _classCallCheck(this, LocalAudioTrack);

    return _possibleConstructorReturn(this, (LocalAudioTrack.__proto__ || Object.getPrototypeOf(LocalAudioTrack)).call(this, mediaStreamTrack, options));
  }

  _createClass(LocalAudioTrack, [{
    key: 'toString',
    value: function toString() {
      return '[LocalAudioTrack #' + this._instanceId + ': ' + this.id + ']';
    }
  }, {
    key: 'attach',
    value: function attach(el) {
      el = _get(LocalAudioTrack.prototype.__proto__ || Object.getPrototypeOf(LocalAudioTrack.prototype), 'attach', this).call(this, el);
      el.muted = true;
      return el;
    }

    /**
     * @private
     */

  }, {
    key: '_end',
    value: function _end() {
      return _get(LocalAudioTrack.prototype.__proto__ || Object.getPrototypeOf(LocalAudioTrack.prototype), '_end', this).apply(this, arguments);
    }

    /**
     * Disable the {@link LocalAudioTrack}. This is effectively "mute".
     * @returns {this}
     * @fires LocalAudioTrack#disabled
     */

  }, {
    key: 'disable',
    value: function disable() {
      return _get(LocalAudioTrack.prototype.__proto__ || Object.getPrototypeOf(LocalAudioTrack.prototype), 'disable', this).apply(this, arguments);
    }

    /**
     * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
     * @returns {this}
     * @fires LocalAudioTrack#enabled
    */ /**
       * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute"
       * or "mute".
       * @param {boolean} [enabled] - Specify false to mute the
       *   {@link LocalAudioTrack}
       * @returns {this}
       * @fires LocalAudioTrack#disabled
       * @fires LocalAudioTrack#enabled
       */

  }, {
    key: 'enable',
    value: function enable() {
      return _get(LocalAudioTrack.prototype.__proto__ || Object.getPrototypeOf(LocalAudioTrack.prototype), 'enable', this).apply(this, arguments);
    }

    /**
     * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
     * {@link LocalAudioTrack}, you should unpublish it after stopping.
     * @returns {this}
     * @fires LocalAudioTrack#stopped
     */

  }, {
    key: 'stop',
    value: function stop() {
      return _get(LocalAudioTrack.prototype.__proto__ || Object.getPrototypeOf(LocalAudioTrack.prototype), 'stop', this).apply(this, arguments);
    }
  }]);

  return LocalAudioTrack;
}(LocalMediaAudioTrack);

/**
 * The {@link LocalAudioTrack} was disabled, i.e. "muted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was
 *   disabled
 * @event LocalAudioTrack#disabled
 */

/**
 * The {@link LocalAudioTrack} was enabled, i.e. "unmuted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was enabled
 * @event LocalAudioTrack#enabled
 */

/**
 * The {@link LocalAudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that started
 * @event LocalAudioTrack#started
 */

/**
 * The {@link LocalAudioTrack} stopped, either because
 * {@link LocalAudioTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that stopped
 * @event LocalAudioTrack#stopped
 */

module.exports = LocalAudioTrack;