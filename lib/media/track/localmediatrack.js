'use strict';

const MediaTrackSender = require('./sender');

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
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
        id: {
          enumerable: true,
          value: mediaTrackSender.id
        },
        isEnabled: {
          enumerable: true,
          get() {
            return mediaTrackSender.enabled;
          }
        },
        isStopped: {
          enumerable: true,
          get() {
            return mediaTrackSender.readyState === 'ended';
          }
        }
      });
    }

    /**
     * @private
     * replaces underlying track and
     * returns a promise.
     */
    _setMediaStreamTrack(mediaStreamTrack) {
      // Note: ideally we would have liked to change the id
      // of the new mediaStreamTrack to match exsiting id, but
      // the property is readOnly and non configurable.

      // propagate enabled state
      mediaStreamTrack.enabled = this.mediaStreamTrack.enabled;
      return this._trackSender.setMediaStreamTrack(mediaStreamTrack).catch(err => {
        // log the error
        this._log.warn('failed to replace track', err);
      }).then(() => {
        // Initialize the new MediaStreamTrack (defined in MediaTrack)
        this._initialize();

        // Attach the newly created MediaStreamTrack.
        this._getAllAttachedElements().forEach(el => this._attach(el));
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
