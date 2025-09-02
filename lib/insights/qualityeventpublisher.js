'use strict';

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
 *     trackId: string, // MediaStreamTrack ID
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
    this._lastQualityLimitationReasonByTrackId = new Map();
  }

  /**
   * Process outbound-rtp stats to detect quality limitation reason changes
   * @param {RTCStatsReport} stats - The RTCStatsReport from getStats()
   */
  processStats(stats) {
    if (!stats) {
      return;
    }

    const outboundStats = [];
    stats.forEach(stat => {
      if (stat.type === 'outbound-rtp' && !stat.isRemote) {
        outboundStats.push(stat);
      }
    });

    outboundStats.forEach(stat => {
      if (!stat.trackId || typeof stat.qualityLimitationReason !== 'string') {
        return;
      }

      const qualityLimitationReason = stat.qualityLimitationReason;
      const trackId = stat.trackId;
      const lastQualityLimitationReason = this._lastQualityLimitationReasonByTrackId.get(trackId);

      if (lastQualityLimitationReason !== qualityLimitationReason) {
        this._log.debug(`Quality limitation reason changed for track ${trackId}: ${lastQualityLimitationReason || 'none'} -> ${qualityLimitationReason}`);

        this._lastQualityLimitationReasonByTrackId.set(trackId, qualityLimitationReason);

        this._publishQualityLimitationReasonChanged(trackId, qualityLimitationReason);
      }
    });
  }

  /**
   * Publish a quality limitation reason change event
   * @private
   * @param {string} trackId - The MediaStreamTrack ID
   * @param {string} qualityLimitationReason - The quality limitation reason
   */
  _publishQualityLimitationReasonChanged(trackId, qualityLimitationReason) {
    try {
      this._publishEvent('quality-limitation-state-changed', 'info', {
        trackId,
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
    this._lastQualityLimitationReasonByTrackId.clear();
  }
}

module.exports = QualityEventPublisher;
