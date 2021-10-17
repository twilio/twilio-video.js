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
      _clones: {
        value: new Set()
      },
      _senders: {
        value: new Set()
      },
      _senderToPublisherHintCallbacks: {
        value: new Map()
      },
      isPublishing: {
        get() {
          return !!this._clones.size;
        }
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

  /**
   * Remove a cloned {@link MediaTrackSender}.
   * @returns {void}
   */
  removeClone(clone) {
    this._clones.delete(clone);
  }

  /**
   * Set the given MediaStreamTrack.
   * @param {MediaStreamTrack} mediaStreamTrack
   * @returns {Promise<void>}
   */
  setMediaStreamTrack(mediaStreamTrack) {
    const clones = Array.from(this._clones);
    const senders = Array.from(this._senders);
    return Promise.all(clones.map(clone => {
      return clone.setMediaStreamTrack(mediaStreamTrack.clone());
    }).concat(senders.map(sender => {
      return sender.replaceTrack(mediaStreamTrack);
    }))).finally(() => {
      this._track = mediaStreamTrack;
    });
  }

  /**
   * Add an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  addSender(sender, publisherHintCallback) {
    this._senders.add(sender);
    this._senderToPublisherHintCallbacks.set(sender, publisherHintCallback);
    return this;
  }

  /**
   * Remove an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @returns {this}
   */
  removeSender(sender) {
    this._senders.delete(sender);
    this._senderToPublisherHintCallbacks.delete(sender);
    return this;
  }

  setPublisherHint(encodings) {
    const publisherHintCallbacks = Array.from(this._senderToPublisherHintCallbacks.values());
    // Note(mpatwardhan): since publisher hint applies only to group rooms
    // we expect only 1 callback.
    if (publisherHintCallbacks.length === 1) {
      return publisherHintCallbacks[0](encodings);
    }
    return Promise.resolve('COULD_NOT_APPLY_HINT');
  }
}

module.exports = MediaTrackSender;
