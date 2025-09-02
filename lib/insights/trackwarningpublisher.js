'use strict';

/**
 * TrackWarningPublisher handles publishing track warning events to the Twilio Video SDK insights.
 * It monitors video track frame rates from WebRTC stats to detect stalled tracks.
 *
 * @example
 * const trackWarningPublisher = new TrackWarningPublisher(eventObserver, log);
 * trackWarningPublisher.processStats(stats);
 *
 * // Track warning events for stalled tracks are published in the following format:
 * {
 *   group: 'quality',
 *   name: 'track-warning-raised',
 *   level: 'warning',
 *   payload: {
 *     trackSID: string, // Track SID
 *     frameRate: number, // Current frame rate
 *     threshold: number // Frame rate threshold
 *   }
 * }
 *
 * // Track warning cleared events for resumed tracks are published in the following format:
 *
 * {
 *   group: 'quality',
 *   name: 'track-warning-cleared',
 *   level: 'info',
 *   payload: {
 *     trackSID: string, // Track SID
 *     frameRate: number, // Current frame rate
 *     threshold: number // Frame rate threshold
 *   }
 * }
 *
 * // Clean up when no longer needed
 * trackWarningPublisher.cleanup();
 */
class TrackWarningPublisher {
  /**
   * Create a TrackWarningPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
    this._stalledTrackSIDs = new Set();

    this._stallThreshold = 0.5;   // Frame rate below this is considered stalled
    this._resumeThreshold = 5;  // Frame rate equal or above this is considered resumed
  }

  /**
   * Process stats to detect stalled tracks and track resumptions
   * @param {RTCStatsReport} stats - The RTCStatsReport from getStats()
   */
  processStats(stats) {
    if (!stats || !stats.remoteVideoTrackStats) {
      return;
    }

    stats.remoteVideoTrackStats.forEach(trackStat => {
      if (trackStat.trackSid && typeof trackStat.frameRate === 'number') {
        this._processTrackFrameRate(
          trackStat.trackSid,
          trackStat.frameRate
        );
      }
    });
  }

  /**
   * Process track frame rate to detect stalls and resumptions
   * @private
   * @param {string} trackSid - The track SID
   * @param {number} frameRate - Current frame rate
   */
  _processTrackFrameRate(trackSid, frameRate) {

    const isStalled = this._stalledTrackSIDs.has(trackSid);

    if (!isStalled && frameRate < this._stallThreshold) {
      this._stalledTrackSIDs.add(trackSid);
      this._publishTrackStalled(trackSid, frameRate, this._stallThreshold);
    } else if (isStalled && frameRate >= this._resumeThreshold) {
      this._stalledTrackSIDs.delete(trackSid);
      this._publishTrackResumed(trackSid, frameRate, this._stallThreshold);
    }
  }

  /**
   * Publish a track stalled event
   * @private
   * @param {string} trackSID - The Track SID
   * @param {number} frameRate - Current frame rate
   * @param {number} threshold - Frame rate threshold
   */
  _publishTrackStalled(trackSID, frameRate, threshold) {
    this._log.debug(`Track ${trackSID} stalled: frame rate ${frameRate} below threshold ${threshold}`);


    this._publishEvent('track-warning-raised', 'warning', {
      trackSID,
      frameRate,
      threshold
    });
  }

  /**
   * Publish a track resumed event
   * @private
   * @param {string} trackSID - The Track SID
   * @param {number} frameRate - Current frame rate
   * @param {number} threshold - Frame rate threshold
   */
  _publishTrackResumed(trackSID, frameRate, threshold) {
    this._log.debug(`Track ${trackSID} resumed: frame rate ${frameRate} above threshold ${threshold}`);

    this._publishEvent('track-warning-cleared', 'info', {
      trackSID,
      frameRate,
      threshold
    });
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
      this._log.error(`TrackWarningPublisher: Error publishing event ${name}:`, error);
    }
  }

  /**
   * Cleanup all track warning monitoring
   */
  cleanup() {
    this._stalledTrackSIDs.clear();
  }
}

module.exports = TrackWarningPublisher;
