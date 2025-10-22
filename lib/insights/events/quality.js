'use strict';

/**
 * Quality telemetry events
 * @internal
 */
class QualityEvents {
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when quality limitation reason changes for a track
   * @param {string} trackSid - Track SID
   * @param {string} qualityLimitationReason - Limitation reason: 'none', 'cpu', 'bandwidth', 'other'
   */
  limitationChanged(trackSid, qualityLimitationReason) {
    this._telemetry.info({
      group: 'quality',
      name: 'quality-limitation-state-changed',
      payload: {
        trackSid,
        qualityLimitationReason
      }
    });
  }

  /**
   * Emit stats report
   * @param {Object} payload - Stats report payload
   */
  statsReport(payload) {
    this._telemetry.info({
      group: 'quality',
      name: 'stats-report',
      payload
    });
  }

  /**
   * Emit active ICE candidate pair
   * @param {Object} payload - ICE candidate pair payload
   */
  iceCandidatePair(payload) {
    this._telemetry.info({
      group: 'quality',
      name: 'active-ice-candidate-pair',
      payload
    });
  }
}

module.exports = QualityEvents;
