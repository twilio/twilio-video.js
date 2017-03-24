'use strict';

var inherits = require('util').inherits;
var LocalTrack = require('./localtrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link LocalVideoTrack} from MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 * audio that your {@link LocalParticipant} sends to a {@link Room}.
 * @extends {VideoTrack}
 * @extends {LocalTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} options - {@link LocalTrack} options
 */
function LocalVideoTrack(mediaStreamTrack, options) {
  if (!(this instanceof LocalVideoTrack)) {
    return new LocalVideoTrack(mediaStreamTrack, options);
  }
  LocalTrack.call(this, VideoTrack, mediaStreamTrack, options);
}

inherits(LocalVideoTrack, VideoTrack);

LocalVideoTrack.prototype._end = LocalTrack.prototype._end;

LocalVideoTrack.prototype.toString = function toString() {
  return '[LocalVideoTrack #' + this._instanceId + ': ' + this.id + ']';
};

/**
 * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause" or
 * "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the {@link LocalVideoTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalVideoTrack.prototype.enable = LocalTrack.prototype.enable;

/**
 * Disable the {@link LocalVideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires Track#disabled
 */
LocalVideoTrack.prototype.disable = LocalTrack.prototype.disable;

/**
 * See {@link LocalTrack#stop}.
 */
LocalVideoTrack.prototype.stop = LocalTrack.prototype.stop;

module.exports = LocalVideoTrack;
