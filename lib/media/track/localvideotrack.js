'use strict';

const mixinLocalMediaTrack = require('./localmediatrack');
const VideoTrack = require('./videotrack');

const LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);

/**
 * A {@link LocalVideoTrack} is a {@link VideoTrack} representing video that
 * your {@link LocalParticipant} can publish to a {@link Room}. It can be
 * enabled and disabled with {@link LocalVideoTrack#enable} and
 * {@link LocalVideoTrack#disable} or stopped completely with
 * {@link LocalVideoTrack#stop}.
 * @extends VideoTrack
 * @property {Track.ID} id - The {@link LocalVideoTrack}'s ID
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @emits LocalVideoTrack#disabled
 * @emits LocalVideoTrack#enabled
 * @emits LocalVideoTrack#started
 * @emits LocalVideoTrack#stopped
 */
class LocalVideoTrack extends LocalMediaVideoTrack {
  /**
   * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
   * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
   */
  constructor(mediaStreamTrack, options) {
    super(mediaStreamTrack, options);
  }

  toString() {
    return `[LocalVideoTrack #${this._instanceId}: ${this.id}]`;
  }

  /**
   * @private
   */
  _end() {
    return super._end.apply(this, arguments);
  }

  /**
   * Disable the {@link LocalVideoTrack}. This is effectively "pause".
   * @returns {this}
   * @fires VideoTrack#disabled
   */
  disable() {
    return super.disable.apply(this, arguments);
  }

  /**
   * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
   * @returns {this}
   * @fires VideoTrack#enabled
  *//**
   * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
   * or "pause".
   * @param {boolean} [enabled] - Specify false to pause the
   *   {@link LocalVideoTrack}
   * @returns {this}
   * @fires VideoTrack#disabled
   * @fires VideoTrack#enabled
   */
  enable() {
    return super.enable.apply(this, arguments);
  }

  /**
   * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
   * {@link LocalVideoTrack}, you should unpublish it after stopping.
   * @returns {this}
   * @fires LocalVideoTrack#stopped
   */
  stop() {
    return super.stop.apply(this, arguments);
  }
}

/**
 * The {@link LocalVideoTrack} was disabled, i.e. "muted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was
 *   disabled
 * @event LocalVideoTrack#disabled
 */

/**
 * The {@link LocalVideoTrack} was enabled, i.e. "unmuted".
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that was enabled
 * @event LocalVideoTrack#enabled
 */

/**
 * The {@link LocalVideoTrack} started. This means there is enough video data
 * to begin playback.
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that started
 * @event LocalVideoTrack#started
 */

/**
 * The {@link LocalVideoTrack} stopped, either because
 * {@link LocalVideoTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalVideoTrack} track - The {@link LocalVideoTrack} that stopped
 * @event LocalVideoTrack#stopped
 */

module.exports = LocalVideoTrack;
