'use strict';

/**
 * Track telemetry events
 * @internal
 */
class TrackEvents {
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when a track stalls (frame rate drops below threshold)
   * @param {string} trackSid - Track SID
   * @param {number} frameRate - Current frame rate
   * @param {number} threshold - Stall threshold
   * @param {string} [trackType='video'] - Track type
   */
  stalled(trackSid, frameRate, threshold, trackType = 'video') {
    this._telemetry.warning({
      group: 'track-warning-raised',
      name: 'track-stalled',
      payload: {
        trackSid,
        frameRate,
        threshold,
        trackType
      }
    });
  }

  /**
   * Emit when a stalled track resumes (frame rate rises above threshold)
   * @param {string} trackSid - Track SID
   * @param {number} frameRate - Current frame rate
   * @param {number} threshold - Resume threshold
   * @param {string} [trackType='video'] - Track type
   */
  resumed(trackSid, frameRate, threshold, trackType = 'video') {
    this._telemetry.info({
      group: 'track-warning-cleared',
      name: 'track-stalled',
      payload: {
        trackSid,
        frameRate,
        threshold,
        trackType
      }
    });
  }
}

module.exports = TrackEvents;
