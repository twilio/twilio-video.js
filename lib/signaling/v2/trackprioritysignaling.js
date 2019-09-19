'use strict';

const { EventEmitter } = require('events');

/**
 * @emits TrackPrioritySignaling#updated
 */
class TrackPrioritySignaling extends EventEmitter {
  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    super();

    Object.defineProperties(this, {
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      }
    });

    mediaSignalingTransport.on('message', message => {
      switch (message.type) {
        case 'track_priority':
          if (message.publish) {
            this._setTrackPriorityUpdate(message.track, 'publish', message.publish);
          } else if (message.subscribe) {
            this._setTrackPriorityUpdate(message.track, 'subscribe', message.subscribe);
          }
          break;
        default:
          break;
      }
    });
  }

  /**
   * @private
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   * @returns {void}
   */
  _setTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
    this.emit('updated', trackSid, publishOrSubscribe, priority);
  }

  /**
   * @param {Track.SID} trackSid
   * @param {'publish'|'subscribe'} publishOrSubscribe
   * @param {Track.Priority} priority
   */
  sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority) {
    this._mediaSignalingTransport.publish({
      type: 'track_priority',
      track: trackSid,
      [publishOrSubscribe]: priority
    });
  }
}

/**
 * @event TrackPrioritySignaling#updated
 */

module.exports = TrackPrioritySignaling;
