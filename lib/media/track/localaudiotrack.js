'use strict';

const AudioTrack = require('./audiotrack');
const mixinLocalMediaTrack = require('./localmediatrack');

const LocalMediaAudioTrack = mixinLocalMediaTrack(AudioTrack);

/**
 * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalAudioTrack} is an {@link AudioTrack} representing
 *   audio that your {@link LocalParticipant} can publish to a {@link Room}. It
 *   can be enabled and disabled with {@link LocalAudioTrack#enable} and
 *   {@link LocalAudioTrack#disable} or stopped completely with
 *   {@link LocalAudioTrack#stop}.
 * @extends {AudioTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - An audio MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 * @property {boolean} isStopped - Whether or not the {@link LocalAudioTrack} is
 *   stopped
 * @fires LocalAudioTrack#disabled
 * @fires LocalAudioTrack#enabled
 * @fires LocalAudioTrack#started
 * @fires LocalAudioTrack#stopped
 */
class LocalAudioTrack extends LocalMediaAudioTrack {
  constructor(mediaStreamTrack, options) {
    super(mediaStreamTrack, options);
  }

  toString() {
    return `[LocalAudioTrack #${this._instanceId}: ${this.id}]`;
  }

  attach(el) {
    el = AudioTrack.prototype.attach.call(this, el);
    el.muted = true;
    return el;
  }
}

LocalAudioTrack.prototype._end = LocalMediaAudioTrack.prototype._end;

/**
 * Disable the {@link LocalAudioTrack}. This is effectively "mute".
 * @method
 * @returns {this}
 * @fires LocalAudioTrack#disabled
 */
LocalAudioTrack.prototype.disable = LocalMediaAudioTrack.prototype.disable;

/**
 * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires LocalAudioTrack#enabled
*//**
 * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute"
 * or "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the
 *   {@link LocalAudioTrack}
 * @returns {this}
 * @fires LocalAudioTrack#disabled
 * @fires LocalAudioTrack#enabled
 */
LocalAudioTrack.prototype.enable = LocalMediaAudioTrack.prototype.enable;

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalAudioTrack}, you should unpublish it after stopping.
 * @returns {this}
 * @fires LocalAudioTrack#stopped
 */
LocalAudioTrack.prototype.stop = LocalMediaAudioTrack.prototype.stop;

/**
 * The {@link LocalAudioTrack} was disabled, i.e. "muted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was
 *   disabled
 * @event LocalAudioTrack#disabled
 */

/**
 * The {@link LocalAudioTrack} was enabled, i.e. "unmuted".
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that was enabled
 * @event LocalAudioTrack#enabled
 */

/**
 * The {@link LocalAudioTrack} started. This means there is enough audio data to
 * begin playback.
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that started
 * @event LocalAudioTrack#started
 */

/**
 * The {@link LocalAudioTrack} stopped, either because
 * {@link LocalAudioTrack#stop} was called or because the underlying
 * MediaStreamTrack ended).
 * @param {LocalAudioTrack} track - The {@link LocalAudioTrack} that stopped
 * @event LocalAudioTrack#stopped
 */

module.exports = LocalAudioTrack;
