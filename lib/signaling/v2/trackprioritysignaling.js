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
   * @param {VideoTrack.Dimensions} [renderHint]
   */
  sendTrackPriorityUpdate(trackSid, publishOrSubscribe, priority, renderHint) {
    const payload = Object.assign({
      type: 'track_priority',
      track: trackSid,
      [publishOrSubscribe]: priority
    }, renderHint ? { hint: renderHint } : {});
    console.log('New track_priority payload:', JSON.stringify(payload, null, 2));
    this._mediaSignalingTransport.publish(payload);
  }
}

module.exports = TrackPrioritySignaling;
