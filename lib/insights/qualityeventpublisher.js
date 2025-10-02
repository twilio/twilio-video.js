'use strict';

/**
 * @typedef {import('../../tsdef/types').LocalVideoTrackStats} LocalVideoTrackStats
 */
/**
 * @typedef {import('../../tsdef/index').Log.Logger} Log
 */

/**
 * QualityEventPublisher handles publishing quality information events to the Twilio Video SDK insights.
 *
 * @example
 * const qualityEventPublisher = new QualityEventPublisher(eventObserver, log);
 *
 * // Quality limitation reason changes are published in the following format:
 * {
 *   group: 'quality',
 *   name: 'quality-limitation-state-changed',
 *   level: 'info',
 *   payload: {
 *     trackSid: string, // Track Sid
 *     qualityLimitationReason: string // 'none', 'cpu', 'bandwidth', or 'other'
 *   }
 * }
 *
 * // Clean up when no longer needed
 * qualityEventPublisher.cleanup();
 */
class QualityEventPublisher {
  /**
   * Create a QualityEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
    this._lastQualityLimitationReasonByTrackSid = new Map();
  }

  /**
   * Process local video track stats to detect quality limitation reason changes.
   * @param {LocalVideoTrackStats[]} localVideoTrackStats
   */
  processStats(localVideoTrackStats) {
    if (!Array.isArray(localVideoTrackStats)) {
      return;
    }
    localVideoTrackStats.forEach(({ trackSid, qualityLimitationReason }) => {
      this._maybePublish(trackSid, qualityLimitationReason);
    });
  }

  /**
   * Check and publish if quality limitation reason changed.
   * @private
   * @param {LocalVideoTrackStats['trackSid']} trackSid
   * @param {LocalVideoTrackStats['qualityLimitationReason']} qualityLimitationReason
   */
  _maybePublish(trackSid, qualityLimitationReason) {
    if (!trackSid || typeof qualityLimitationReason !== 'string') {
      return;
    }

    const lastQualityLimitationReason = this._lastQualityLimitationReasonByTrackSid.get(trackSid);
    if (lastQualityLimitationReason !== qualityLimitationReason) {
      this._log.debug(`Quality limitation reason changed for track ${trackSid}: ${lastQualityLimitationReason || 'none'} -> ${qualityLimitationReason}`);
      this._lastQualityLimitationReasonByTrackSid.set(trackSid, qualityLimitationReason);
      this._publishQualityLimitationReasonChanged(trackSid, qualityLimitationReason);
    }
  }

  /**
   * Publish a quality limitation reason change event
   * @private
   * @param {string} trackSid - The Track SID
   * @param {string} qualityLimitationReason - The quality limitation reason
   */
  _publishQualityLimitationReasonChanged(trackSid, qualityLimitationReason) {
    try {
      this._publishEvent('quality-limitation-state-changed', 'info', {
        trackSid,
        qualityLimitationReason,
      });
    } catch (error) {
      this._log.error('Error publishing quality limitation reason change:', error);
    }
  }

  /**
   * Publish an event through the EventObserver.
   * @private
   * @param {string} name - Event name
   * @param {string} level - Event level (debug, info, warning, error)
   * @param {Object} payload - Event payload
   */
  _publishEvent(name, level, payload) {
    try {
      this._eventObserver.emit('event', {
        group: 'quality',
        name,
        level,
        payload,
      });
    } catch (error) {
      this._log.error(`QualityEventPublisher: Error publishing event ${name}:`, error);
    }
  }

  /**
   * Cleanup all quality event monitoring
   */
  cleanup() {
    this._lastQualityLimitationReasonByTrackSid.clear();
  }
}

module.exports = QualityEventPublisher;
