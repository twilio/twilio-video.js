'use strict';

var AudioTrack = require('./audiotrack');
var inherits = require('util').inherits;
var LocalMediaTrack = require('./localmediatrack');

/**
 * Construct a {@link LocalAudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalAudioTrack} is an {@link AudioTrack} representing
 *   audio that your {@link LocalParticipant} sends to a {@link Room}.
 * @extends {AudioTrack}
 * @extends {LocalMediaTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 */
function LocalAudioTrack(mediaStreamTrack, options) {
  if (!(this instanceof LocalAudioTrack)) {
    return new LocalAudioTrack(mediaStreamTrack, options);
  }
  LocalMediaTrack.call(this, AudioTrack, mediaStreamTrack, options);
}

inherits(LocalAudioTrack, AudioTrack);

LocalAudioTrack.prototype._end = LocalMediaTrack.prototype._end;

LocalAudioTrack.prototype.toString = function toString() {
  return '[LocalAudioTrack #' + this._instanceId + ': ' + this.id + ']';
};

LocalAudioTrack.prototype.attach = function attach(el) {
  el = AudioTrack.prototype.attach.call(this, el);
  el.muted = true;
  return el;
};

/**
 * Disable the {@link LocalAudioTrack}. This is effectively "mute".
 * @method
 * @returns {this}
 * @fires MediaTrack#disabled
 */
LocalAudioTrack.prototype.disable = LocalMediaTrack.prototype.disable;

/**
 * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires MediaTrack#enabled
*//**
 * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute"
 * or "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the
 *   {@link LocalAudioTrack}
 * @returns {this}
 * @fires MediaTrack#disabled
 * @fires MediaTrack#enabled
 */
LocalAudioTrack.prototype.enable = LocalMediaTrack.prototype.enable;

LocalAudioTrack.prototype.stop = LocalMediaTrack.prototype.stop;

module.exports = LocalAudioTrack;
