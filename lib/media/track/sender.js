/* eslint-disable no-console */
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
    console.log(`makarand MediaTrackTransceiver[${this._instanceId}]: constructor`);
    Object.defineProperties(this, {
      _senders: {
        value: new Set()
      },
      _clones: {
        value: new Set()
      }
    });
  }

  log(...args) {
    // eslint-disable-next-line no-console
    console.log(`Makarand[${this._instanceId}]: MediaTrackTransceiver: `, ...args);
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
      this.log('replacing tracks');
      const replaceTrackPromise = sender.replaceTrack(this.track);
      replaceTrackPromise.then(() => {
        this.log('track replaced successfully');
      }).catch(err => {
        this.log('track replace failed', err);
      });
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
