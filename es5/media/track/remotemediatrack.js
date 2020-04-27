'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('../../util/constants'),
    E = _require.typeErrors,
    trackPriority = _require.trackPriority;

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isEnabled - Whether the {@link RemoteMediaTrack} is enabled
   * @property {boolean} isSwitchedOff - Whether the {@link RemoteMediaTrack} is switched off
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @property {?Track.Priority} priority - The subscribe priority of the {@link RemoteMediaTrack}
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#switchedOff
   * @emits RemoteMediaTrack#switchedOn
   */
  return function (_AudioOrVideoTrack) {
    _inherits(RemoteMediaTrack, _AudioOrVideoTrack);

    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {Track.SID} sid
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {function(?Track.Priority): void} setPriority - Set or clear the subscribe
     *  {@link Track.Priority} of the {@link RemoteMediaTrack}
     * @param {{log: Log, name: ?string}} options
     */
    function RemoteMediaTrack(sid, mediaTrackReceiver, isEnabled, setPriority, options) {
      _classCallCheck(this, RemoteMediaTrack);

      var _this = _possibleConstructorReturn(this, (RemoteMediaTrack.__proto__ || Object.getPrototypeOf(RemoteMediaTrack)).call(this, mediaTrackReceiver, options));

      Object.defineProperties(_this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        },
        _isSwitchedOff: {
          value: false,
          writable: true
        },
        _priority: {
          value: null,
          writable: true
        },
        _setPriority: {
          value: setPriority
        },
        isEnabled: {
          enumerable: true,
          get: function get() {
            return this._isEnabled;
          }
        },
        isSwitchedOff: {
          enumerable: true,
          get: function get() {
            return this._isSwitchedOff;
          }
        },
        priority: {
          enumerable: true,
          get: function get() {
            return this._priority;
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
     * Update the subscribe {@link Track.Priority} of the {@link RemoteMediaTrack}.
     * @param {?Track.Priority} priority - the new subscribe {@link Track.Priority};
     *   If <code>null</code>, then the subscribe {@link Track.Priority} is cleared, which
     *   means the {@link Track.Priority} set by the publisher is now the effective priority.
     * @returns {this}
     * @throws {RangeError}
     */


    _createClass(RemoteMediaTrack, [{
      key: 'setPriority',
      value: function setPriority(priority) {
        var priorityValues = [null].concat(_toConsumableArray(Object.values(trackPriority)));
        if (!priorityValues.includes(priority)) {
          // eslint-disable-next-line new-cap
          throw E.INVALID_VALUE('priority', priorityValues);
        }
        if (this._priority !== priority) {
          this._priority = priority;
          this._setPriority(priority);
        }
        return this;
      }

      /**
       * @private
       * @param {boolean} isEnabled
       */

    }, {
      key: '_setEnabled',
      value: function _setEnabled(isEnabled) {
        if (this._isEnabled !== isEnabled) {
          this._isEnabled = isEnabled;
          this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
        }
      }

      /**
       * @private
       * @param {boolean} isSwitchedOff
       */

    }, {
      key: '_setSwitchedOff',
      value: function _setSwitchedOff(isSwitchedOff) {
        if (this._isSwitchedOff !== isSwitchedOff) {
          this._isSwitchedOff = isSwitchedOff;
          this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this);
        }
      }
    }, {
      key: 'attach',
      value: function attach(el) {
        var result = _get(RemoteMediaTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteMediaTrack.prototype), 'attach', this).call(this, el);
        if (this.mediaStreamTrack.enabled !== true) {
          // NOTE(mpatwardhan): we disable mediaStreamTrack when there
          // are no attchments to it (see notes below). Now that there
          // are attachments reenable the track.
          this.mediaStreamTrack.enabled = true;
        }
        return result;
      }
    }, {
      key: 'detach',
      value: function detach(el) {
        var result = _get(RemoteMediaTrack.prototype.__proto__ || Object.getPrototypeOf(RemoteMediaTrack.prototype), 'detach', this).call(this, el);
        if (this._attachments.size === 0) {
          // NOTE(mpatwardhan): chrome continues playing webrtc audio
          // track even after audio element is removed from the DOM.
          // https://bugs.chromium.org/p/chromium/issues/detail?id=749928
          // to workaround: here disable the track when
          // there are no elements attached to it.
          this.mediaStreamTrack.enabled = false;
        }
        return result;
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
 * A {@link RemoteMediaTrack} was switched off.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched off
 * @event RemoteMediaTrack#switchedOff
 */

/**
 * A {@link RemoteMediaTrack} was switched on.
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   switched on
 * @event RemoteMediaTrack#switchedOn
 */

module.exports = mixinRemoteMediaTrack;