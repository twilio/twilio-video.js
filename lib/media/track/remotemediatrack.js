'use strict';
const { typeErrors: E, trackPriority } = require('../../util/constants');

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @property {?Track.Priority} priority - The subscriber assigned priority to the {@link RemoteMediaTrack}
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#switchedOff
   * @emits RemoteMediaTrack#switchedOn
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {Track.SID} sid
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {{log: Log, name: ?string, onPriorityChange: ()}} options
     */
    constructor(sid, mediaTrackReceiver, isEnabled, options) {
      super(mediaTrackReceiver, options);

      const onPriorityChanged = options && options.onPriorityChange ? options.onPriorityChange : () => {};
      Object.defineProperties(this, {
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
        _onPriorityChange: {
          value: onPriorityChanged
        },
        isEnabled: {
          enumerable: true,
          get() {
            return this._isEnabled;
          }
        },
        isSwitchedOff: {
          enumerable: true,
          get() {
            return this._isSwitchedOff;
          }
        },
        priority: {
          enumerable: true,
          get() {
            return this._priority;
          }
        },
        sid: {
          enumerable: true,
          value: sid
        }
      });
    }

    /**
     * Update the subscriber {@link Track.Priority} of the {@link RemoteMediaTrack}.
     * @param {?Track.Priority} priority - the new {@link Track.priority}.
     *   if set to `null` the subscriber priority is reset, thus making publisher
     *   priority effective.
     * @returns {this}
     * @throws {RangeError}
     */
    setPriority(priority) {
      const priorityValues = [null, ...Object.values(trackPriority)];
      if (!priorityValues.includes(priority)) {
        // eslint-disable-next-line new-cap
        throw E.INVALID_VALUE('priority', priorityValues);
      }

      if (this._priority !== priority) {
        this._priority = priority;
        this._onPriorityChange(priority);
      }
      return this;
    }

    /**
     * @private
     * @param {boolean} isEnabled
     */
    _setEnabled(isEnabled) {
      if (this._isEnabled !== isEnabled) {
        this._isEnabled = isEnabled;
        this.emit(this._isEnabled ? 'enabled' : 'disabled', this);
      }
    }

    /**
     * @private
     * @param {boolean} isSwitchedOff
     */
    _setSwitchedOff(isSwitchedOff) {
      if (this._isSwitchedOff !== isSwitchedOff) {
        this._isSwitchedOff = isSwitchedOff;
        this.emit(isSwitchedOff ? 'switchedOff' : 'switchedOn', this);
      }
    }
  };
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
