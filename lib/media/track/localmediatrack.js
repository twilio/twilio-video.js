'use strict';

// const buildLogLevels = require('../../util').buildLogLevels;
// const Log = require('../../util/log');
const DEFAULT_LOG_LEVEL = require('../../util/constants').DEFAULT_LOG_LEVEL;
const MediaTrack = require('./mediatrack');
const MediaTrackSender = require('./sender');

function mixinLocalMediaTrack(AudioOrVideoTrack) {
  /**
   * Construct a {@link LocalMediaTrack} from a MediaStreamTrack.
   * @class
   * @classdesc A {@link LocalMediaTrack} represents audio or video that your
   * {@link LocalParticipant} is sending to a {@link Room}. As such, it can be
   * enabled and disabled with {@link LocalMediaTrack#enable} and
   * {@link LocalMediaTrack#disable} or stopped completely with
   * {@link LocalMediaTrack#stop}.
   * @extends MediaTrack
   * @param {MediaStream} mediaStreamTrack - The underlying MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   * @property {boolean} isStopped - Whether or not the {@link LocalMediaTrack} is stopped
   * @fires LocalMediaTrack#stopped
   */
  return class LocalMediaTrack extends AudioOrVideoTrack {
    constructor(mediaStreamTrack, options) {
      options = Object.assign({
        logLevel: DEFAULT_LOG_LEVEL
      }, options);

      // FIXME(mroberts): ...
      // const logLevels = buildLogLevels(options.logLevel);
      // options.log = options.log || new Log('default', this, logLevels);

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
            return this.mediaStreamTrack.enabled;
          }
        },
        isStopped: {
          get() {
            return this.mediaStreamTrack.readyState === 'ended';
          }
        }
      });
    }

    _end() {
      if (this._didCallEnd) {
        return;
      }
      MediaTrack.prototype._end.call(this);
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
