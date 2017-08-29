'use strict';

var inherits = require('util').inherits;
var MediaTrack = require('./mediatrack');

/**
 * Construct an {@link AudioTrack} from a MediaStreamTrack.
 * @class
 * @classdesc An {@link AudioTrack} is a {@link MediaTrack} representing audio.
 * @extends MediaTrack
 * @param {MediaStreamTrack} mediaStreamTrack
 * @param {{log: Log}} options
 * @property {Track.Kind} kind - "audio"
 */
function AudioTrack(mediaStreamTrack, options) {
  MediaTrack.call(this, mediaStreamTrack, options);
}

inherits(AudioTrack, MediaTrack);

AudioTrack.prototype.attach = MediaTrack.prototype.attach;

AudioTrack.prototype.detach = MediaTrack.prototype.detach;

module.exports = AudioTrack;
