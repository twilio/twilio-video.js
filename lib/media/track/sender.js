'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackSender} represents one or more local RTCRtpSenders.
 * @extends MediaTrackTransceiver
 */
class MediaTrackSender extends MediaTrackTransceiver {

  /**
   * Construct a {@link MediaTrackSender}.
   * @param {MediaStreamTrack} mediaStreamTrack
   */
  constructor(mediaStreamTrack) {
    super(mediaStreamTrack.id, mediaStreamTrack);
    Object.defineProperties(this, {
      _senders: {
        value: new Set()
      },
      _clones: {
        value: new Set()
      }
    });
  }

  /**
   * Return a new {@link MediaTrackSender} containing a clone of the underlying
   * MediaStreamTrack. No RTCRtpSenders are copied.
   * @returns {MediaTrackSender}
   */
  clone() {
    const clone = new MediaTrackSender(this.track.clone());
    this._clones.add(clone);
    return clone;
  }

  replaceTrack(newTrack) {
    this.track = newTrack;
    this._senders.forEach(sender => {
      if (sender.track) {
        return sender.replaceTrack(this.track).catch(() => {});
      }
    });
    this._clones.forEach(clone => clone.replaceTrack(newTrack.clone()));
  }

  /**
   * Add an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  addSender(sender) {
    this._senders.add(sender);
    return this;
  }

  /**
   * Remove an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  removeSender(sender) {
    this._senders.delete(sender);
    return this;
  }
}

module.exports = MediaTrackSender;
