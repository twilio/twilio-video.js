'use strict';

const MediaTrackSender = require('./sender');

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @property {boolean} isStopped - Whether or not the {@link LocalMediaTrack} is stopped
   * @emits LocalMediaTrack#stopped
   */
  return class LocalMediaTrack extends AudioOrVideoTrack {
    /**
     * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
     * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
     * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
     */
    constructor(mediaStreamTrack, options) {
      options = Object.assign({}, options);

      const mediaTrackSender = new MediaTrackSender(mediaStreamTrack);
      super(mediaTrackSender, options);

      Object.defineProperties(this, {
        _didCallEnd: {
          value: false,
          writable: true
        },
        _trackSender: {
          value: mediaTrackSender
        },
        isEnabled: {
          enumerable: true,
          get() {
            return mediaStreamTrack.enabled;
          }
        },
        isStopped: {
          get() {
            return mediaStreamTrack.readyState === 'ended';
          }
        }
      });
    }

    /**
     * @private
     */
    _end() {
      if (this._didCallEnd) {
        return;
      }
      super._end.call(this);
      this._didCallEnd = true;
      this.emit('stopped', this);
    }

    enable(enabled) {
      enabled = typeof enabled === 'boolean' ? enabled : true;
      if (enabled !== this.mediaStreamTrack.enabled) {
        this._log.info(`${enabled ? 'En' : 'Dis'}abling`);
        this.mediaStreamTrack.enabled = enabled;
        this.emit(enabled ? 'enabled' : 'disabled', this);
      }
      return this;
    }

    disable() {
      return this.enable(false);
    }

    stop() {
      this._log.info('Stopping');
      this.mediaStreamTrack.stop();
      this._end();
      return this;
    }
  };
}

module.exports = mixinLocalMediaTrack;
