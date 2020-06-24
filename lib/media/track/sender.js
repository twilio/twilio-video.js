/* eslint-disable no-console */
'use strict';

const MediaTrackTransceiver = require('./transceiver');

let globalInstanceId = 0;
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
    const instanceId = globalInstanceId++;
    const clones = Array.from(this._clones);
    const senders = Array.from(this._senders);
    return Promise.all(clones.map(clone => {
      return clone.setMediaStreamTrack(mediaStreamTrack.clone());
    }).concat(senders.map(sender => {
      console.log(`makarand[${instanceId}]: replaceTrack started`);
      return sender.replaceTrack(mediaStreamTrack).catch(err => {
        console.log(`makarand[${instanceId}]: replaceTrack failed`, err);
      }).finally(() => {
        console.log(`makarand[${instanceId}]: replaceTrack finished`);
      });
    }))).finally(() => {
      this._track.stop();
      this._track = mediaStreamTrack;
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
