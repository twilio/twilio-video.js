'use strict';

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isInterrupted - Whether the {@link RemoteMediaTrack} is interrupted
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#interrupted
   * @emits RemoteMediaTrack#resumed
   * @emits RemoteMediaTrack#switchedOff
   * @emits RemoteMediaTrack#switchedOn
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {Track.SID} sid
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {{log: Log, name: ?string}} options
     */
    constructor(sid, mediaTrackReceiver, isEnabled, options) {
      super(mediaTrackReceiver, options);

      Object.defineProperties(this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        },
        _isSwitchedOff: {
          value: false,
          writable: true
        },
        isEnabled: {
          enumerable: true,
          get() {
            return this._isEnabled;
          }
        },
        isInterrupted: {
          enumerable: true,
          get() {
            return mediaTrackReceiver.isInterrupted;
          }
        },
        isSwitchedOff: {
          enumerable: true,
          get() {
            return this._isSwitchedOff;
          }
        },
        sid: {
          enumerable: true,
          value: sid
        }
      });

      ['interrupted', 'resumed'].forEach(event => {
        mediaTrackReceiver.on(event, () => this.emit(event));
      });
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
 * A {@link RemoteMediaTrack} was interrupted.
 * @event RemoteMediaTrack#interrupted
 */

/**
 * A {@link RemoteMediaTrack} was resumed.
 * @event RemoteMediaTrack#resumed
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
