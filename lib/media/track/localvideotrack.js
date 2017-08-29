'use strict';

var inherits = require('util').inherits;
var LocalMediaTrack = require('./localmediatrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link LocalVideoTrack} from MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 *   video that your {@link LocalParticipant} sends to a {@link Room}.
 * @extends {VideoTrack}
 * @extends {LocalMediaTrack}
 * @param {MediaStreamTrack} mediaStreamTrack - The underlying MediaStreamTrack
 * @param {LocalTrackOptions} [options] - {@link LocalTrack} options
 */
function LocalVideoTrack(mediaStreamTrack, options) {
  if (!(this instanceof LocalVideoTrack)) {
    return new LocalVideoTrack(mediaStreamTrack, options);
  }
  LocalMediaTrack.call(this, VideoTrack, mediaStreamTrack, options);
}

inherits(LocalVideoTrack, VideoTrack);

LocalVideoTrack.prototype._end = LocalMediaTrack.prototype._end;

LocalVideoTrack.prototype.toString = function toString() {
  return '[LocalVideoTrack #' + this._instanceId + ': ' + this.id + ']';
};

/**
 * Enable the {@link LocalVideoTrack}. This is effectively "unpause".
 * @method
 * @returns {this}
 * @fires MediaTrack#enabled
*//**
 * Enable or disable the {@link LocalVideoTrack}. This is effectively "unpause"
 * or "pause".
 * @method
 * @param {boolean} [enabled] - Specify false to pause the
 *   {@link LocalVideoTrack}
 * @returns {this}
 * @fires MediaTrack#disabled
 * @fires MediaTrack#enabled
 */
LocalVideoTrack.prototype.enable = LocalMediaTrack.prototype.enable;

/**
 * Disable the {@link LocalVideoTrack}. This is effectively "pause".
 * @method
 * @returns {this}
 * @fires MediaTrack#disabled
 */
LocalVideoTrack.prototype.disable = LocalMediaTrack.prototype.disable;

/**
 * See {@link LocalMediaTrack#stop}.
 */
LocalVideoTrack.prototype.stop = LocalMediaTrack.prototype.stop;

module.exports = LocalVideoTrack;
