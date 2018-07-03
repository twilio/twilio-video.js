'use strict';

const { deprecateEvents } = require('../../util');

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @emits RemoteMediaTrack#disabled
   * @emits RemoteMediaTrack#enabled
   * @emits RemoteMediaTrack#unsubscribed
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
        },
        _isSubscribed: {
          value: true,
          writable: true
        },
        _sid: {
          value: null,
          writable: true
        }
      });

      deprecateEvents('RemoteMediaTrack', this, new Map([
        ['unsubscribed', null]
      ]), this._log);
    }

    /**
     * The {@link RemoteMediaTrack}'s ID.
     * @property {Track.ID}
     * @deprecated Use the parent {@link RemoteTrackPublication}'s .trackName or
     *   .trackSid instead
     */
    get id() {
      this._log.deprecated('RemoteMediaTrack#id has been deprecated and is '
        + 'scheduled for removal in twilio-video.js@2.0.0. Use the parent '
        + 'RemoteTrackPublication\'s .trackName or .trackSid instead.');
      return this._id;
    }

    /**
     * Whether the {@link RemoteMediaTrack} is enabled
     * @property {boolean}
     */
    get isEnabled() {
      return this._isEnabled;
    }

    /**
     * Whether the {@link RemoteMediaTrack} is subscribed to
     * @property {boolean}
     * @deprecated Use the parent {@link RemoteTrackPublication}'s .isSubscribed
     *   instead
     */
    get isSubscribed() {
      this._log.deprecated('RemoteMediaTrack#isSubscribed has been deprecated and is '
        + 'scheduled for removal in twilio-video.js@2.0.0. Use the '
        + 'parent RemoteTrackPublication\'s .isSubscribed instead.');
      return this._isSubscribed;
    }

    /**
     * The SID assigned to the {@link RemoteMediaTrack}
     * @property {Track.SID}
     */
    get sid() {
      return this._sid;
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
     * @param {Track.SID} sid
     */
    _setSid(sid) {
      if (!this._sid) {
        this._sid = sid;
      }
    }

    /**
     * @private
     */
    _unsubscribe() {
      if (this._isSubscribed) {
        this._isSubscribed = false;
        this.emit('unsubscribed', this);
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
 * The {@link RemoteMediaTrack} was unsubscribed from.
 * @event RemoteMediaTrack#unsubscribed
 * @param {RemoteMediaTrack} track - The {@link RemoteMediaTrack} that was
 *   unsubscribed from
 * @deprecated Use the parent {@link RemoteTrackPublication}'s "unsubscribed"
 *   event instead
 */

module.exports = mixinRemoteMediaTrack;
