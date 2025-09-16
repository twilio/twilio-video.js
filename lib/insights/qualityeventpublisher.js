'use strict';

const BufferedEventPublisher = require('./bufferedeventpublisher');

/**
 * QualityEventPublisher handles publishing quality information events to the Twilio Video SDK insights.
 * Extends BufferedEventPublisher for batch event publishing.
 *
 * @example
 * const qualityEventPublisher = new QualityEventPublisher(eventObserver, log, { publishIntervalMs: 10000 });
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
class QualityEventPublisher extends BufferedEventPublisher {
  /**
   * Create a QualityEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log, options = {}) {
    super(eventObserver, log, options);
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
      this._bufferEvent({
        group: 'quality',
        name: 'quality-limitation-state-changed',
        level: 'info',
        payload: {
          trackId,
          qualityLimitationReason,
        }
      });
    } catch (error) {
      this._log.error('Error publishing quality limitation reason change:', error);
    }
  }


  /**
   * Cleanup all quality event monitoring
   */
  cleanup() {
    this._lastQualityLimitationReasonByTrackId.clear();
    super.cleanup();
  }
}

module.exports = QualityEventPublisher;
