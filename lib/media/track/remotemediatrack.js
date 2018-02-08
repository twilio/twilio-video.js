'use strict';

function mixinRemoteMediaTrack(AudioOrVideoTrack) {
  /**
   * Construct a {@link RemoteMediaTrack}.
   * @class
   * @classdesc A {@link RemoteMediaTrack} represents a {@link MediaTrack}
   *   published to a {@link Room} by a {@link RemoteParticipant}.
   * @extends {MediaTrack}
   * @param {MediaTrackReceiver} mediaTrackReceiver
   * @param {RemoteTrackSignaling} signaling
   * @param {{log: Log}} options
   * @property {boolean} isSubscribed - Whether the {@link RemoteMediaTrack} is
   *   subscribed by the {@link LocalParticipant}
   * @property {Track.SID} sid - The SID assigned to the {@link RemoteMediaTrack}
   * @fires RemoteTrack#unsubscribed
   */
  return class RemoteMediaTrack extends AudioOrVideoTrack {
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

      const self = this;
      this._signaling.on('updated', function onupdated() {
        self.emit(self.isEnabled ? 'enabled' : 'disabled', self);
      });
    }

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
