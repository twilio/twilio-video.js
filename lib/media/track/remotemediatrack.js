'use strict';

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {boolean} isEnabled
     * @param {{log: Log, name: ?string}} options
     */
    constructor(mediaTrackReceiver, isEnabled, options) {
      super(mediaTrackReceiver, options);

      Object.defineProperties(this, {
        _isEnabled: {
          value: isEnabled,
          writable: true
        }
      });
    }

    /**
     * Whether the {@link RemoteMediaTrack} is enabled
     * @property {boolean}
     */
    get isEnabled() {
      return this._isEnabled;
    }

    /**
     * @private
     */
    setEnabled(isEnabled) {
      if (this._isEnabled !== isEnabled) {
        this._isEnabled = isEnabled;
        this.emit(this._isEnabled ? 'enabled' : 'disabled');
      }
    }
  };
}

/**
 * A {@link RemoteMediaTrack} was disabled
 * @event RemoteMediaTrack#disabled
 */

/**
 * A {@link RemoteMediaTrack} was enabled
 * @event RemoteMediaTrack#enabled
 */

module.exports = mixinRemoteMediaTrack;
