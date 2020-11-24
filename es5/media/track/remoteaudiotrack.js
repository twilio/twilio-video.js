'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var AudioTrack = require('./audiotrack');
var mixinRemoteMediaTrack = require('./remotemediatrack');

var RemoteMediaAudioTrack = mixinRemoteMediaTrack(AudioTrack);

/**
 * A {@link RemoteAudioTrack} represents an {@link AudioTrack} published to a
 * {@link Room} by a {@link RemoteParticipant}.
 * @extends AudioTrack
 * @property {boolean} isEnabled - Whether the {@link RemoteAudioTrack} is enabled
 * @property {boolean} isSwitchedOff - Whether the {@link RemoteAudioTrack} is switched off
 * @property {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
 * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteAudioTrack}
 * @emits RemoteAudioTrack#disabled
 * @emits RemoteAudioTrack#enabled
 * @emits RemoteAudioTrack#started
 * @emits RemoteAudioTrack#switchedOff
 * @emits RemoteAudioTrack#switchedOn
 */

var RemoteAudioTrack = function (_RemoteMediaAudioTrac) {
  _inherits(RemoteAudioTrack, _RemoteMediaAudioTrac);

  /**
   * Construct a {@link RemoteAudioTrack}.
   * @param {Track.SID} sid - The {@link RemoteAudioTrack}'s SID
   * @param {MediaTrackReceiver} mediaTrackReceiver - An audio MediaStreamTrack container
   * @param {boolean} isEnabled - Whether the {@link RemoteAudioTrack} is enabled
   * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
   *  {@link Track.Priority} of the {@link RemoteAudioTrack}
   * @param {{log: Log}} options - The {@link RemoteTrack} options
   */
  function RemoteAudioTrack(sid, mediaTrackReceiver, isEnabled, setPriority, options) {
    _classCallCheck(this, RemoteAudioTrack);

    return _possibleConstructorReturn(this, (RemoteAudioTrack.__proto__ || Object.getPrototypeOf(RemoteAudioTrack)).call(this, sid, mediaTrackReceiver, isEnabled, setPriority, options));
  }

  _createClass(RemoteAudioTrack, [{
    key: 'toString',
    value: function toString() {
      return '[RemoteAudioTrack #' + this._instanceId + ': ' + this.sid + ']';
    }

    /**
     * Update the subscribe {@link Track.Priority} of the {@link RemoteAudioTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   Currently setPriority has no effect on audio tracks.
     * @returns {this}
     * @throws {RangeError}
     */

  }, {
    key: 'setPriority',
    value: function setPriority(priority) {
      return _get(RemoteAudioTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteAudioTrack.prototype), 'setPriority', this).call(this, priority);
    }
  }]);

  return RemoteAudioTrack;
}(RemoteMediaAudioTrack);

/**
 * The {@link RemoteAudioTrack} was disabled, i.e. "muted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   disabled
 * @event RemoteAudioTrack#disabled
 */

/**
 * The {@link RemoteAudioTrack} was enabled, i.e. "unmuted".
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   enabled
 * @event RemoteAudioTrack#enabled
 */

/**
 * The {@link RemoteAudioTrack} started. This means there is enough audio data
 * to begin playback.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that started
 * @event RemoteAudioTrack#started
 */

/**
 * A {@link RemoteAudioTrack} was switched off.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched off
 * @event RemoteAudioTrack#switchedOff
 */

/**
 * A {@link RemoteAudioTrack} was switched on.
 * @param {RemoteAudioTrack} track - The {@link RemoteAudioTrack} that was
 *   switched on
 * @event RemoteAudioTrack#switchedOn
 */

module.exports = RemoteAudioTrack;