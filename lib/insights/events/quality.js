'use strict';

/**
 * Quality telemetry events
 * @internal
 */
class QualityEvents {
  /**
   * @param {import('../telemetry')} telemetry - The telemetry instance
   */
  constructor(telemetry) {
    this._telemetry = telemetry;
  }

  /**
   * Emit when quality limitation reason changes for a track
   * @param {string} trackSid - Track SID
   * @param {('none'|'cpu'|'bandwidth'|'other')} qualityLimitationReason - Limitation reason
   * @returns {void}
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
   * @param {Record<string, any>} payload - Stats report payload
   * @returns {void}
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
   * @param {Record<string, any>} payload - ICE candidate pair payload
   * @returns {void}
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
