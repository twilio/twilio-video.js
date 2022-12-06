'use strict';

const MediaTrackTransceiver = require('./transceiver');

/**
 * A {@link MediaTrackSender} represents one or more local RTCRtpSenders.
 * @extends MediaTrackTransceiver
 * @emits MediaTrackSender#replaced
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
      _eventsToReemitters: {
        value: new Map([
          ['mute', () => this.queue('muted')],
          ['unmute', () => this.queue('unmuted')]
        ])
      },
      _senders: {
        value: new Set()
      },
      _senderToPublisherHintCallbacks: {
        value: new Map()
      },
      isPublishing: {
        enumerable: true,
        get() {
          return !!this._clones.size;
        }
      },
      muted: {
        enumerable: true,
        get() {
          return this._track.muted;
        }
      }
    });

    this._reemitMediaStreamTrackEvents();
  }

  /**
   * @private
   */
  _reemitMediaStreamTrackEvents(mediaStreamTrack = this._track) {
    const { _eventsToReemitters: eventsToReemitters, _track: track } = this;
    eventsToReemitters.forEach((reemitter, event) => mediaStreamTrack.addEventListener(event, reemitter));
    if (track !== mediaStreamTrack) {
      eventsToReemitters.forEach((reemitter, event) => track.removeEventListener(event, reemitter));
      if (track.muted !== mediaStreamTrack.muted) {
        const reemitter = eventsToReemitters.get(mediaStreamTrack.muted ? 'mute' : 'unmute');
        reemitter();
      }
    }
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
      return this._replaceTrack(sender, mediaStreamTrack);
    }))).finally(() => {
      this._reemitMediaStreamTrackEvents(mediaStreamTrack);
      this._track = mediaStreamTrack;
    });
  }

  /**
   * Add an RTCRtpSender.
   * @param {RTCRtpSender} sender
   * @param {?()=>Promise<string>} publisherHintCallback
   * @returns {this}
   */
  addSender(sender, publisherHintCallback) {
    this._senders.add(sender);
    if (publisherHintCallback) {
      this._senderToPublisherHintCallbacks.set(sender, publisherHintCallback);
    }
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

  /**
   * Applies given encodings, or resets encodings if none specified.
   * @param {Array<{enabled: boolean, layer_index: number}>|null} encodings
   * @returns {Promise<string>}
   */
  setPublisherHint(encodings) {
    // Note(mpatwardhan): since publisher hint applies only to group rooms we only look at 1st call callback.
    const [publisherHintCallback] = Array.from(this._senderToPublisherHintCallbacks.values());
    return publisherHintCallback ? publisherHintCallback(encodings) : Promise.resolve('COULD_NOT_APPLY_HINT');
  }

  _replaceTrack(sender, mediaStreamTrack) {
    return sender.replaceTrack(mediaStreamTrack).then(replaceTrackResult => {
      // clear any publisherHints and apply default encodings.
      this.setPublisherHint(null).catch(() => {});
      this.emit('replaced');
      return replaceTrackResult;
    });
  }
}

/**
 * The {@link MediaTrackSender}'s underlying MediaStreamTrack was muted.
 * @event MediaTrackSender#muted
 */

/**
 * The {@link MediaTrackSender} replaced the underlying MediaStreamTrack.
 * @event MediaTrackSender#replaced
 */

/**
 * The {@link MediaTrackSender}'s underlying MediaStreamTrack was unmuted.
 * @event MediaTrackSender#unmuted
 */

module.exports = MediaTrackSender;
