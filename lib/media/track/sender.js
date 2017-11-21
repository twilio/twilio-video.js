'use strict';

var inherits = require('util').inherits;
var MediaTrackTransceiver = require('./transceiver');

/**
 * Construct a {@link MediaTrackSender}.
 * @class
 * @classdesc A {@link MediaTrackSender} represents one or more
 *   local RTCRtpSenders.
 * @param {MediaStreamTrack} mediaStreamTrack
 * @extends MediaTrackTransceiver
 */
function MediaTrackSender(mediaStreamTrack) {
  if (!(this instanceof MediaTrackSender)) {
    return new MediaTrackSender(mediaStreamTrack);
  }
  MediaTrackTransceiver.call(this, mediaStreamTrack.id, mediaStreamTrack);
  Object.defineProperties(this, {
    _senders: {
      value: new Set()
    }
  });
}

inherits(MediaTrackSender, MediaTrackTransceiver);

/**
 * Add an RTCRtpSender.
 * @param {RTCRtpSender} sender
 * @returns {this}
 */
MediaTrackSender.prototype.addSender = function addSender(sender) {
  this._senders.add(sender);
  return this;
};

/**
 * Remove an RTCRtpSender.
 * @param {RTCRtpSender} sender
 * @returns {this}
 */
MediaTrackSender.prototype.removeSender = function removeSender(sender) {
  this._senders.delete(sender);
  return this;
};

module.exports = MediaTrackSender;
