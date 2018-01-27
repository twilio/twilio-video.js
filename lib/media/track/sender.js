'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackSender}.
 * @class
 * @classdesc A {@link MediaTrackSender} represents one or more
 *   local RTCRtpSenders.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @extends MediaTrackTransceiver
 */
class MediaTrackSender extends MediaTrackTransceiver {
  constructor(mediaStreamTrack) {
    super(mediaStreamTrack.id, mediaStreamTrack);
    Object.defineProperties(this, {
      _senders: {
        value: new Set()
      }
    });
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
