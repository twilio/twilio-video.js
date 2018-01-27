'use strict';

const mixinLocalMediaTrack = require('./localmediatrack');
const VideoTrack = require('./videotrack');

const LocalMediaVideoTrack = mixinLocalMediaTrack(VideoTrack);

/**
 * Construct a {@link LocalVideoTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 *   video that your {@link LocalParticipant} can publish to a {@link Room}. It
 *   can be enabled and disabled with {@link LocalVideoTrack#enable} and
 *   {@link LocalVideoTrack#disable} or stopped completely with
 *   {@link LocalVideoTrack#stop}.
 * @extends {VideoTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalVideoTrack} is
 *   stopped
 * @fires LocalVideoTrack#stopped
 */
class LocalVideoTrack extends LocalMediaVideoTrack {
  constructor(mediaStreamTrack, options) {
    super(mediaStreamTrack, options);
  }

  toString() {
    return `[LocalVideoTrack #${this._instanceId}: ${this.id}]`;
  }
}

LocalVideoTrack.prototype._end = LocalMediaVideoTrack.prototype._end;

/**
 * Disable the {@link LocalVideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires VideoTrack#disabled
 */
LocalVideoTrack.prototype.disable = LocalMediaVideoTrack.prototype.disable;

/**
 * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires VideoTrack#enabled
*//**
 * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
 * or "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the
 *   {@link LocalVideoTrack}
 * @returns {this}
 * @fires VideoTrack#disabled
 * @fires VideoTrack#enabled
 */
LocalVideoTrack.prototype.enable = LocalMediaVideoTrack.prototype.enable;

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalVideoTrack}, you should unpublish it after stopping.
 * @returns {this}
 * @fires LocalVideoTrack#stopped
 */
LocalVideoTrack.prototype.stop = LocalMediaVideoTrack.prototype.stop;

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
