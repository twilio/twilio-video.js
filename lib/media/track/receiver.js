'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackReceiver} represents a remote MediaStreamTrack.
 * @extends MediaTrackTransceiver
 * @property {boolean} isInterrupted - Whether the {@link MediaTrackReceiver} is interrupted
 * @emits MediaTrackReceiver#interrupted
 * @emits MediaTrackReceiver#resumed
 */
class MediaTrackReceiver extends MediaTrackTransceiver {
  /**
   * Construct a {@link MediaTrackReceiver}.
   * @param {Track.ID} id - The MediaStreamTrack ID signaled through RSP/SDP
   * @param {MediaStreamTrack} mediaStreamTrack - The remote MediaStreamTrack
   */
  constructor(id, mediaStreamTrack) {
    super(id, mediaStreamTrack);

    Object.defineProperties(this, {
      _isInterrupted: {
        value: false,
        writable: true
      },
      isInterrupted: {
        enumerable: true,
        get() {
          return this._isInterrupted;
        }
      }
    });
  }

  /**
   * The {@link MediaTrackReceiver} was interrupted.
   * @returns {this}
   */
  interrupted() {
    if (!this._isInterrupted) {
      this._isInterrupted = true;
      this.emit('interrupted');
    }
    return this;
  }

  /**
   * The {@link MediaTrackReceiver} was resumed.
   * @returns {this}
   */
  resumed() {
    if (this._isInterrupted) {
      this._isInterrupted = false;
      this.emit('resumed');
    }
    return this;
  }
}

/**
 * A {@link MediaTrackReceiver} was interrupted.
 * @event MediaTrackReceiver#interrupted
 */

/**
 * A {@link MediaTrackReceiver} was resumed.
 * @event MediaTrackReceiver#resumed
 */

module.exports = MediaTrackReceiver;
