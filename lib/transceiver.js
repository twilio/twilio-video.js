'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * A {@link TrackTransceiver} represents either one or more local RTCRtpSenders
 * or RTCDataChannels, or a single RTCRtpReceiver or remote RTCDataChannel.
 * @extends EventEmitter
 * @property {Track.ID} id
 * @property {Track.kind} kind
 */
class TrackTransceiver extends EventEmitter {
  /**
   * Construct a {@link TrackTransceiver}.
   * @param {Track.ID} id
   * @param {Track.kind} kind
   */
  constructor(id, kind) {
    super();
    Object.defineProperties(this, {
      id: {
        enumerable: true,
        value: id
      },
      kind: {
        enumerable: true,
        value: kind
      }
    });
  }

  /**
   * Stop the {@link TrackTransceiver}.
   * #emits TrackTransceiver#stopped
   * @returns {void}
   */
  stop() {
    this.emit('stopped');
  }
}

/**
 * The {@link TrackTransceiver} was stopped.
 * @event TrackTransceiver#stopped
 */

module.exports = TrackTransceiver;
