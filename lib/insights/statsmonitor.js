'use strict';

const StatsReport = require('../stats/statsreport');
const MovingAverageDelta = require('../util/movingaveragedelta');
const { filterObject, flatMap, difference } = require('../util');
const telemetry = require('./telemetry');

/**
 * StatsMonitor analyzes WebRTC statistics and publishes insights events.
 * This is the single source of truth for all stats-related telemetry.
 * Stats collection starts automatically upon construction.
 *
 * Responsibilities:
 * - Periodic stats collection (every 1 second by default)
 * - Network type change detection (from ICE candidate pairs)
 * - Quality limitation tracking (CPU, bandwidth, etc.)
 * - Track stall detection (low frame rates)
 * - Periodic stats-report publishing (every 10 seconds by default)
 * - Active ICE candidate pair reporting (every 20 seconds)
 *
 * @example
 * const statsMonitor = new StatsMonitor({
 *   log,
 *   getStats: () => peerConnection.getStats(),
 *   publishIntervalMs: 10000,
 *   collectionIntervalMs: 1000
 * });
 *
 * // Later, when done
 * statsMonitor.cleanup();
 */
class StatsMonitor {
  /**
   * Create a StatsMonitor
   * @param {Object} options - Configuration options
   * @param {Log} options.log - Logger instance (required)
   * @param {Function} options.getStats - Function that returns a Promise resolving to stats
   * @param {number} [options.publishIntervalMs=10000] - Interval for publishing stats reports
   * @param {number} [options.collectionIntervalMs=1000] - Interval for collecting stats
   */
  constructor(options = {}) {
    if (!options?.log) {
      throw new Error('StatsMonitor: options.log is required');
    }

    this._log = options.log;
    this._getStats = options.getStats;

    this._publishIntervalMs = options.publishIntervalMs || 10000;
    this._collectionIntervalMs = options.collectionIntervalMs || 1000;
    this._collectionsPerPublish = Math.floor(this._publishIntervalMs / this._collectionIntervalMs);
    this._stallThreshold = 0.5;
    this._resumeThreshold = 5;

    this._initializeState();
    this._startStatsCollection();
  }

  /**
   * Initialize monitoring state
   * @private
   */
  _initializeState() {
    this._movingAverageDeltas = new Map();
    this._interval = null;
    this._statsCollectionCount = 0;
    this._iceCandidatePublishToggle = false;
    this._hasSeenActivePair = false;
    this._lastNetworkType = null;
    this._lastQualityLimitationReasonByTrackSid = new Map();
    this._stalledTrackSids = new Set();
  }

  /**
   * Start periodic stats collection and analysis
   * @private
   */
  _startStatsCollection() {
    if (this._interval) {
      this._log.warn('StatsMonitor already started');
      return;
    }

    this._interval = setInterval(async () => {
      await this._collectAndAnalyzeStats();
    }, this._collectionIntervalMs);

    this._log.debug('StatsMonitor started');
  }

  /**
   * Stop stats collection
   * @private
   */
  _stopStatsCollection() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    this._log.debug('StatsMonitor stopped');
  }

  /**
   * Collect stats and analyze them
   * @private
   */
  async _collectAndAnalyzeStats() {
    try {
      const stats = await this._getStats();
      this._statsCollectionCount++;

      const shouldPublishStatsReport = (this._statsCollectionCount % this._collectionsPerPublish) === 0;

      if (shouldPublishStatsReport) {
        this._iceCandidatePublishToggle = !this._iceCandidatePublishToggle;
      }

      const shouldPublishIceCandidate = shouldPublishStatsReport && this._iceCandidatePublishToggle;

      this._analyzeStats(stats, shouldPublishStatsReport, shouldPublishIceCandidate);
    } catch {
      // Stats collection failures are expected occasionally
    }
  }

  /**
   * Analyze WebRTC stats and publish insights
   * @private
   * @param {Map|Array} stats - Map or Array of StandardizedStatsResponse objects
   * @param {boolean} shouldPublishStatsReport - Whether to publish stats-report events this cycle
   * @param {boolean} shouldPublishIceCandidate - Whether to publish ICE candidate pair this cycle
   */
  _analyzeStats(stats, shouldPublishStatsReport, shouldPublishIceCandidate) {
    if (!stats || (stats instanceof Map && stats.size === 0) || (Array.isArray(stats) && stats.length === 0)) {
      return;
    }

    stats.forEach((response, id) => {
      this._checkNetworkTypeChanges(response);
      this._checkQualityLimitations(response.localVideoTrackStats);
      this._checkTrackStalls(response.remoteVideoTrackStats);

      if (shouldPublishStatsReport) {
        this._publishStatsReport(id, response);

        if (shouldPublishIceCandidate) {
          this._publishActiveIceCandidatePair(id, response);
        }
      }
    });
  }

  /**
   * Check for network type changes from active ICE candidate pair
   * @private
   * @param {Object} response - StandardizedStatsResponse
   */
  _checkNetworkTypeChanges(response) {
    const { activeIceCandidatePair } = response;

    if (!activeIceCandidatePair || !activeIceCandidatePair.localCandidate) {
      return;
    }

    const networkType = activeIceCandidatePair.localCandidate.networkType || 'unknown';

    if (!this._hasSeenActivePair) {
      this._hasSeenActivePair = true;
      this._lastNetworkType = networkType;
      telemetry.info({
        group: 'network',
        name: 'network-type-changed',
        payload: { networkType }
      });
      return;
    }

    if (this._lastNetworkType !== networkType) {
      this._log.debug(`Network type changed: ${this._lastNetworkType} -> ${networkType}`);
      this._lastNetworkType = networkType;
      telemetry.info({
        group: 'network',
        name: 'network-type-changed',
        payload: { networkType }
      });
    }
  }

  /**
   * Check for quality limitation reason changes
   * @private
   * @param {Array} localVideoTrackStats - Local video track statistics
   */
  _checkQualityLimitations(localVideoTrackStats) {
    if (!Array.isArray(localVideoTrackStats)) {
      return;
    }

    localVideoTrackStats.forEach(({ trackSid, qualityLimitationReason }) => {
      if (!trackSid || typeof qualityLimitationReason !== 'string') {
        return;
      }

      const lastReason = this._lastQualityLimitationReasonByTrackSid.get(trackSid);
      if (lastReason !== qualityLimitationReason) {
        this._log.debug(`Quality limitation reason changed for track ${trackSid}: ${lastReason || 'none'} -> ${qualityLimitationReason}`);
        this._lastQualityLimitationReasonByTrackSid.set(trackSid, qualityLimitationReason);
        telemetry.info({
          group: 'quality',
          name: 'quality-limitation-state-changed',
          payload: {
            trackSid,
            qualityLimitationReason
          }
        });
      }
    });
  }

  /**
   * Check for track stalls (low frame rates)
   * @private
   * @param {Array} remoteVideoTrackStats - Remote video track statistics
   */
  _checkTrackStalls(remoteVideoTrackStats) {
    if (!Array.isArray(remoteVideoTrackStats)) {
      return;
    }

    remoteVideoTrackStats.forEach(({ trackSid, frameRateReceived }) => {
      if (frameRateReceived === undefined) {
        return;
      }

      const frameRate = (typeof frameRateReceived === 'number' && !isNaN(frameRateReceived)) ? frameRateReceived : 0;
      const isStalled = this._stalledTrackSids.has(trackSid);

      if (!isStalled && frameRate < this._stallThreshold) {
        this._stalledTrackSids.add(trackSid);
        this._log.debug(`Track ${trackSid} stalled: frame rate ${frameRate} below threshold ${this._stallThreshold}`);
        telemetry.warning({
          group: 'track-warning-raised',
          name: 'track-stalled',
          payload: {
            trackSid,
            frameRate,
            threshold: this._stallThreshold,
            trackType: 'video'
          }
        });
      } else if (isStalled && frameRate >= this._resumeThreshold) {
        this._stalledTrackSids.delete(trackSid);
        this._log.debug(`Track ${trackSid} resumed: frame rate ${frameRate} above threshold ${this._resumeThreshold}`);
        telemetry.info({
          group: 'track-warning-cleared',
          name: 'track-stalled',
          payload: {
            trackSid,
            frameRate,
            threshold: this._resumeThreshold,
            trackType: 'video'
          }
        });
      }
    });
  }

  /**
   * Add A/V sync metrics to local track stats
   * @private
   * @param {Object} trackStats - The track stats from StatsReport
   * @param {Object} trackResponse - The original track response
   * @returns {Object} Augmented track stats with A/V sync metrics
   */
  _addLocalTrackMetrics(trackStats, trackResponse) {
    const {
      framesEncoded,
      packetsSent,
      totalEncodeTime,
      totalPacketSendDelay
    } = trackResponse;

    const augmentedTrackStats = Object.assign({}, trackStats);
    const key = `${trackStats.trackSid}+${trackStats.ssrc}`;
    const trackMovingAverageDeltas = this._movingAverageDeltas.get(key) || new Map();

    if (typeof totalEncodeTime === 'number' && typeof framesEncoded === 'number') {
      const trackAvgEncodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgEncodeDelay')
        || new MovingAverageDelta();
      trackAvgEncodeDelayMovingAverageDelta.putSample(totalEncodeTime * 1000, framesEncoded);
      augmentedTrackStats.avgEncodeDelay = Math.round(trackAvgEncodeDelayMovingAverageDelta.get());
      trackMovingAverageDeltas.set('avgEncodeDelay', trackAvgEncodeDelayMovingAverageDelta);
    }

    if (typeof totalPacketSendDelay === 'number' && typeof packetsSent === 'number') {
      const trackAvgPacketSendDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgPacketSendDelay')
        || new MovingAverageDelta();
      trackAvgPacketSendDelayMovingAverageDelta.putSample(totalPacketSendDelay * 1000, packetsSent);
      augmentedTrackStats.avgPacketSendDelay = Math.round(trackAvgPacketSendDelayMovingAverageDelta.get());
      trackMovingAverageDeltas.set('avgPacketSendDelay', trackAvgPacketSendDelayMovingAverageDelta);
    }

    this._movingAverageDeltas.set(key, trackMovingAverageDeltas);
    return augmentedTrackStats;
  }

  /**
   * Add A/V sync metrics to remote track stats
   * @private
   * @param {Object} trackStats - The track stats from StatsReport
   * @param {Object} trackResponse - The original track response
   * @returns {Object} Augmented track stats with A/V sync metrics
   */
  _addRemoteTrackMetrics(trackStats, trackResponse) {
    const {
      estimatedPlayoutTimestamp,
      framesDecoded,
      jitterBufferDelay,
      jitterBufferEmittedCount,
      totalDecodeTime
    } = trackResponse;

    const augmentedTrackStats = Object.assign({}, trackStats);
    const key = `${trackStats.trackSid}+${trackStats.ssrc}`;
    const trackMovingAverageDeltas = this._movingAverageDeltas.get(key) || new Map();

    if (typeof estimatedPlayoutTimestamp === 'number') {
      augmentedTrackStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
    }

    if (typeof framesDecoded === 'number' && typeof totalDecodeTime === 'number') {
      const trackAvgDecodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgDecodeDelay')
        || new MovingAverageDelta();
      trackAvgDecodeDelayMovingAverageDelta.putSample(totalDecodeTime * 1000, framesDecoded);
      augmentedTrackStats.avgDecodeDelay = Math.round(trackAvgDecodeDelayMovingAverageDelta.get());
      trackMovingAverageDeltas.set('avgDecodeDelay', trackAvgDecodeDelayMovingAverageDelta);
    }

    if (typeof jitterBufferDelay === 'number' && typeof jitterBufferEmittedCount === 'number') {
      const trackAvgJitterBufferDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgJitterBufferDelay')
        || new MovingAverageDelta();
      trackAvgJitterBufferDelayMovingAverageDelta.putSample(jitterBufferDelay * 1000, jitterBufferEmittedCount);
      augmentedTrackStats.avgJitterBufferDelay = Math.round(trackAvgJitterBufferDelayMovingAverageDelta.get());
      trackMovingAverageDeltas.set('avgJitterBufferDelay', trackAvgJitterBufferDelayMovingAverageDelta);
    }

    this._movingAverageDeltas.set(key, trackMovingAverageDeltas);
    return augmentedTrackStats;
  }

  /**
   * Clean up moving average delta entries for tracks that are no longer active
   * @private
   * @param {Object} report - The stats report with track stats arrays
   */
  _cleanupMovingAverageDeltas(report) {
    const keys = flatMap([
      'localAudioTrackStats',
      'localVideoTrackStats',
      'remoteAudioTrackStats',
      'remoteVideoTrackStats'
    ], prop => report[prop].map(({ ssrc, trackSid }) => `${trackSid}+${ssrc}`));

    const movingAverageDeltaKeysToBeRemoved = difference(
      Array.from(this._movingAverageDeltas.keys()),
      keys
    );

    movingAverageDeltaKeysToBeRemoved.forEach(key => this._movingAverageDeltas.delete(key));
  }

  /**
   * Publish stats-report event
   * @private
   * @param {number|string} id - Peer connection ID
   * @param {Object} response - StandardizedStatsResponse
   */
  _publishStatsReport(id, response) {
    // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
    // event instead of using StandardizedStatsResponse directly because
    // StatsReport will add zeros to properties that do not exist.
    const report = new StatsReport(id, response, true /* prepareForInsights */);

    // NOTE(mmalavalli): Since A/V sync metrics are not part of the StatsReport class,
    // we add them to the insights payload here.
    telemetry.info({
      group: 'quality',
      name: 'stats-report',
      payload: {
        audioTrackStats: report.remoteAudioTrackStats.map((trackStat, i) =>
          this._addRemoteTrackMetrics(trackStat, response.remoteAudioTrackStats[i])),
        localAudioTrackStats: report.localAudioTrackStats.map((trackStat, i) =>
          this._addLocalTrackMetrics(trackStat, response.localAudioTrackStats[i])),
        localVideoTrackStats: report.localVideoTrackStats.map((trackStat, i) =>
          this._addLocalTrackMetrics(trackStat, response.localVideoTrackStats[i])),
        peerConnectionId: report.peerConnectionId,
        videoTrackStats: report.remoteVideoTrackStats.map((trackStat, i) =>
          this._addRemoteTrackMetrics(trackStat, response.remoteVideoTrackStats[i]))
      }
    });

    this._cleanupMovingAverageDeltas(report);
  }

  /**
   * Publish active-ice-candidate-pair event
   * @private
   * @param {string|number} peerConnectionId - Peer connection ID
   * @param {Object} response - StandardizedStatsResponse
   */
  _publishActiveIceCandidatePair(peerConnectionId, response) {
    const activeIceCandidatePair = this._replaceNullsWithDefaults(
      response.activeIceCandidatePair,
      peerConnectionId
    );

    telemetry.info({
      group: 'quality',
      name: 'active-ice-candidate-pair',
      payload: activeIceCandidatePair
    });
  }

  /**
   * Replace null values in activeIceCandidatePair with defaults.
   *
   * NOTE(mmalavalli): null properties of the "active-ice-candidate-pair"
   * payload are assigned default values until the Insights gateway
   * accepts null values.
   *
   * @private
   * @param {Object} activeIceCandidatePair - The active ICE candidate pair
   * @param {string} peerConnectionId - The peer connection ID
   * @returns {Object} Active ICE candidate pair with null values replaced
   */
  _replaceNullsWithDefaults(activeIceCandidatePair, peerConnectionId) {
    activeIceCandidatePair = Object.assign({
      availableIncomingBitrate: 0,
      availableOutgoingBitrate: 0,
      bytesReceived: 0,
      bytesSent: 0,
      consentRequestsSent: 0,
      currentRoundTripTime: 0,
      lastPacketReceivedTimestamp: 0,
      lastPacketSentTimestamp: 0,
      nominated: false,
      peerConnectionId: peerConnectionId,
      priority: 0,
      readable: false,
      requestsReceived: 0,
      requestsSent: 0,
      responsesReceived: 0,
      responsesSent: 0,
      retransmissionsReceived: 0,
      retransmissionsSent: 0,
      state: 'failed',
      totalRoundTripTime: 0,
      transportId: '',
      writable: false
    }, filterObject(activeIceCandidatePair || {}, null));

    activeIceCandidatePair.localCandidate = Object.assign({
      candidateType: 'host',
      deleted: false,
      ip: '',
      port: 0,
      priority: 0,
      protocol: 'udp',
      url: ''
    }, filterObject(activeIceCandidatePair.localCandidate || {}, null));

    activeIceCandidatePair.remoteCandidate = Object.assign({
      candidateType: 'host',
      ip: '',
      port: 0,
      priority: 0,
      protocol: 'udp',
      url: ''
    }, filterObject(activeIceCandidatePair.remoteCandidate || {}, null));

    return activeIceCandidatePair;
  }

  /**
   * Cleanup all monitoring state
   */
  cleanup() {
    this._stopStatsCollection();

    this._movingAverageDeltas.clear();
    this._lastQualityLimitationReasonByTrackSid.clear();
    this._stalledTrackSids.clear();
  }
}

module.exports = StatsMonitor;
