'use strict';

var inherits = require('util').inherits;
var Track = require('./');

/**
 * Construct an {@link AudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link Track} representing audio.
 * @extends Track
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {TrackSignaling} signaling
 * @param {{log: Log}} options
 */
function AudioTrack(mediaStreamTrack, signaling, options) {
  Track.call(this, mediaStreamTrack, signaling, options);
}

inherits(AudioTrack, Track);

AudioTrack.prototype.toString = function toString() {
  return '[AudioTrack #' + this._instanceId + ': ' + this.id + ']';
};

AudioTrack.prototype.attach = Track.prototype.attach;

AudioTrack.prototype.detach = Track.prototype.detach;

module.exports = AudioTrack;
