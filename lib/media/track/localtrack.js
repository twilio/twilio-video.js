'use strict';

var LocalTrackSignaling = require('../../signaling/localtrack');

/**
 * @class
 * @classdesc A {@link LocalTrack} represents audio or video that your
 * {@link Client} is sending to a {@link Room}. As such, it can be
 * enabled and disabled with {@link LocalTrack#enable} and
 * {@link LocalTrack#disable} or stopped completely with
 * {@link LocalTrack#stop}.
 * @extends Track
 * @param {function(MediaStream, MediaStreamTrack, TrackSignaling): Track} Track
 * @param {MediaStream} mediaStream
 * @param {MediaStream} mediaStreamTrack
 */
function LocalTrack(Track, mediaStream, mediaStreamTrack) {
  var self = this;
  var signaling = new LocalTrackSignaling(mediaStreamTrack, mediaStream);
  Track.call(this, mediaStream, mediaStreamTrack, signaling);
  this.mediaStreamTrack.addEventListener('ended', function onended() {
    self._signaling.end();
    self.mediaStreamTrack.removeEventListener('ended', onended);
  });
}

/**
 * Enable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#enabled
*//**
 * Enable or disable the {@link LocalTrack}.
 * @param {boolean} [enabled] - Specify false to disable the {@link LocalTrack}
 * @returns {this}
 * @fires Track#disabled
 * @fires Track#enabled
 */
LocalTrack.prototype.enable = function enable(enabled) {
  enabled = typeof enabled === 'boolean' ? enabled : true;
  this.mediaStreamTrack.enabled = enabled;
  this._signaling.enable(enabled);
  return this;
};

/**
 * Disable the {@link LocalTrack}.
 * @returns {this}
 * @fires Track#disabled
 */
LocalTrack.prototype.disable = function disable() {
  return this.enable(false);
};

/**
 * Calls stop on the underlying MediaStreamTrack. If you choose to stop a
 * {@link LocalTrack}, you should use {@link LocalMedia#removeTrack} to remove
 * it after stopping. You do not need to stop a track before using
 * {@link LocalTrack#disable} or {@link LocalMedia#removeTrack}.
 * @returns {this}
 * @fires Track#ended
 */
LocalTrack.prototype.stop = function stop() {
  this.mediaStreamTrack.stop();
  return this;
};

module.exports = LocalTrack;
