'use strict';

var inherits = require('util').inherits;
var LocalTrack = require('./localtrack');
var VideoTrack = require('./videotrack');

/**
 * Construct a {@link LocalVideoTrack} from MediaStream and MediaStreamTrack.
 * @class
 * @classdesc A {@link LocalVideoTrack} is a {@link VideoTrack} representing
 * audio that your {@link Client} sends to a {@link Room}.
 * @extends {VideoTrack}
 * @extends {LocalTrack}
 * @param {MediaStream} mediaStream
 * @param {MediaStreamTrack} mediaStreamTrack
 */
function LocalVideoTrack(mediaStream, mediaStreamTrack) {
  if (!(this instanceof LocalVideoTrack)) {
    return new LocalVideoTrack(mediaStream, mediaStreamTrack);
  }
  LocalTrack.call(this, VideoTrack, mediaStream, mediaStreamTrack);
}

inherits(LocalVideoTrack, VideoTrack);

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

LocalVideoTrack.prototype.stop = LocalTrack.prototype.stop;

module.exports = LocalVideoTrack;
