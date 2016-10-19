'use strict';

var AudioTrack = require('./audiotrack');
var inherits = require('util').inherits;
var LocalTrack = require('./localtrack');

/**
 * Construct a {@link LocalAudioTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalAudioTrack} is an {@link AudioTrack} representing
 * audio that your {@link Client} sends to a {@link Room}.
 * @extends {AudioTrack}
 * @extends {LocalTrack}
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {{log: Log}} options
 */
function LocalAudioTrack(mediaStream, mediaStreamTrack, options) {
  if (!(this instanceof LocalAudioTrack)) {
    return new LocalAudioTrack(mediaStream, mediaStreamTrack, options);
  }
  LocalTrack.call(this, AudioTrack, mediaStream, mediaStreamTrack, options);
}

inherits(LocalAudioTrack, AudioTrack);

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
 * @fires Track#disabled
 */
LocalAudioTrack.prototype.disable = LocalTrack.prototype.disable;

/**
 * Enable the {@link LocalAudioTrack}. This is effectively "unmute".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalAudioTrack}. This is effectively "unmute" or
 * "mute".
 * @method
 * @param {boolean} [enabled] - Specify false to mute the {@link LocalAudioTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalAudioTrack.prototype.enable = LocalTrack.prototype.enable;

LocalAudioTrack.prototype.stop = LocalTrack.prototype.stop;

module.exports = LocalAudioTrack;
