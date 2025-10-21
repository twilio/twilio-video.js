'use strict';

const MovingAverageDelta = require('../util/movingaveragedelta');
const { flatMap, difference } = require('../util');

/**
 * MovingAverageMetrics manages moving average calculations for WebRTC track metrics.
 * This utility tracks metrics per track (identified by trackSid + ssrc) and calculates
 * moving averages for A/V sync metrics like encode delay, decode delay, etc.
 *
 * NOTE(mmalavalli): Since A/V sync metrics are not part of the public StatsReport class,
 * we add them only for reporting purposes to Insights.
 *
 * @example
 * const metrics = new MovingAverageMetrics();
 *
 * // Add metrics for local tracks
 * const augmentedStats = metrics.addLocalTrackMetrics(trackStats, trackResponse);
 *
 * // Add metrics for remote tracks
 * const augmentedStats = metrics.addRemoteTrackMetrics(trackStats, trackResponse);
 *
 * // Cleanup old tracks
 * metrics.cleanup(activeTrackKeys);
 */
class MovingAverageMetrics {
  constructor() {
    this._movingAverageDeltas = new Map();
  }

  /**
   * Add A/V sync metrics to local track stats
   * @param {Object} trackStats - The track stats from StatsReport
   * @param {Object} trackResponse - The original track response
   * @returns {Object} Augmented track stats with A/V sync metrics
   */
  addLocalTrackMetrics(trackStats, trackResponse) {
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
   * @param {Object} trackStats - The track stats from StatsReport
   * @param {Object} trackResponse - The original track response
   * @returns {Object} Augmented track stats with A/V sync metrics
   */
  addRemoteTrackMetrics(trackStats, trackResponse) {
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
   * Clean up moving average delta entries for tracks that are no longer active.
   *
   * NOTE(mmalavalli): Clean up entries for Tracks that are no longer published or subscribed to.
   *
   * @param {Object} report - The stats report with track stats arrays
   */
  cleanupFromReport(report) {
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
   * Clear all tracked metrics
   */
  clear() {
    this._movingAverageDeltas.clear();
  }
}

module.exports = MovingAverageMetrics;
