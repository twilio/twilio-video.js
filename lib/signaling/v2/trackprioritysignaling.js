'use strict';

class TrackPrioritySignaling  {
  /**
   * Construct a {@link TrackPrioritySignaling}.
   * @param {MediaSignalingTransport} mediaSignalingTransport
   */
  constructor(mediaSignalingTransport) {
    Object.defineProperties(this, {
      _mediaSignalingTransport: {
        value: mediaSignalingTransport
      }
    });
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

module.exports = TrackPrioritySignaling;
