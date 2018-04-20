'use strict';

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link RemoteMediaTrack} represents a {@link MediaTrack} published to a
   * {@link Room} by a {@link RemoteParticipant}.
   * @property {boolean} isSubscribed - Whether the {@link RemoteMediaTrack} is
   *   subscribed by the {@link LocalParticipant}
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @emits RemoteTrack#unsubscribed
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link RemoteMediaTrack}.
     * @param {MediaTrackReceiver} mediaTrackReceiver
     * @param {RemoteTrackPublicationSignaling} signaling
     * @param {{log: Log}} options
     */
    constructor(mediaTrackReceiver, signaling, options) {
      options = Object.assign({
        name: signaling.name
      }, options);

      super(mediaTrackReceiver, options);

      let isSubscribed = signaling.isSubscribed;
      Object.defineProperties(this, {
        _isSubscribed: {
          set(_isSubscribed) {
            isSubscribed = _isSubscribed;
          },
          get() {
            return isSubscribed;
          }
        },
        _mediaTrackReceiver: {
          value: mediaTrackReceiver
        },
        _signaling: {
          value: signaling
        },
        isEnabled: {
          enumerable: true,
          get() {
            return signaling.isEnabled;
          }
        },
        isSubscribed: {
          enumerable: true,
          get() {
            return this._isSubscribed;
          }
        },
        sid: {
          enumerable: true,
          value: signaling.sid
        }
      });

      this._signaling.on('updated', () => {
        this.emit(this.isEnabled ? 'enabled' : 'disabled', this);
      });
    }

    /**
     * @private
     */
    _unsubscribe() {
      if (this.isSubscribed) {
        this._isSubscribed = false;
        this.emit('unsubscribed', this);
      }
      return this;
    }
  };
}

module.exports = mixinRemoteMediaTrack;
