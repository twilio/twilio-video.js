'use strict';

/**
 * @class
 * @classdesc A {@link LocalTrack} represents audio or video that your
 * {@link Client} is sending to a {@link Conversation}. As such, it can be
 * enabled and disabled with {@link LocalTrack#enable} and
 * {@link LocalTrack#disable} or stopped completely with
 * {@link LocalTrack#stop}.
 * @extends Track
 */
function LocalTrack() {
  // A LocalTrack should never be constructed directly; instead,
  // LocalAudioTrack and LocalVideoTrack borrow methods from LocalTrack's
  // prototype.
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
  return this._enable(enabled);
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
 * Stop sending this {@link LocalTrack}.
 * @returns {this}
 * @fires Track#ended
 */
LocalTrack.prototype.stop = function stop() {
  this._isEnded = true;
  this.mediaStreamTrack.stop();
  return this;
};

module.exports = LocalTrack;
