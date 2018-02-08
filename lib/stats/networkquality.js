'use strict';

var Log = require('../util/log');

var qualityLevels = 5;
var bandwidthAlpha = -0.24;
var bandwidthBeta = 10.2616;
var bandwidthThreshold = 0.8;
var packetLossAlpha = 0.75;
var packetLossBeta = 0.2659;
var latencyAlpha = 0.75;
var latencyBeta = 0.02812;

/**
 * @interface Result
 * @property {?number} timestamp
 * @property {?number} bytesSent
 * @property {?number} bytesReceived
 * @property {?number} actualOutgoingBitrate
 * @property {?number} actualIncomingBitrate
 * @property {?number} availableOutgoingBitrate
 * @property {?number} averageOutboundJitter
 * @property {?number} averageInboundJitter
 * @property {?number} averageOutboundFractionLost
 * @property {?number} averageInboundFractionLost
 * @property {?number} outboundBandwidthQualityLevel
 * @property {?number} inboundBandwidthQualityLevel
 * @property {?number} outboundPacketLossQualityLevel
 * @property {?number} inboundPacketLossQualityLevel
 * @property {?number} outboundLatencyQualityLevel
 * @property {?number} inboundLatencyQualityLevel
 * @property {?number} outboundQualityLevel
 * @property {?number} inboundQualityLevel
 * @property {?number} qualityLevel
 */

var nInstances = 0;

/**
 * Construct a {@link NetworkQuality}.
 * @class
 * @classdesc {@link NetworkQuality} computes {@link NetworkQualtiyLevel}s.
 * @param {Log} [log]
 */
function NetworkQuality(log) {
  Object.defineProperties(this, {
    _instanceId: {
      value: ++nInstances
    },
    _log: {
      value: log
        ? log.createLog('media', this)
        : new Log('media', this, { media: 'off' })
    },
    _transport: {
      value: null,
      writable: true
    }
  });
}

NetworkQuality.prototype.toString = function toString() {
  return '[NetworkQuality #' + this._instanceId + ']';
};

/**
 * @param {RTCStatsReport} report
 * @returns {Array<?number>} results
 */
NetworkQuality.prototype.compute = function compute(report) {
  var timestamp = null; // Unix timestamp
  var bytesSent = null; // bytes
  var bytesReceived = null; // bytes
  var actualOutgoingBitrate = null; // bps
  var actualIncomingBitrate = null; // bps
  var availableOutgoingBitrate = null; // bps
  var availableIncomingBitrate = null; // bps
  var currentRoundTripTime = null; // s

  // TODO(mroberts): We may be able to assume a single RTCTransportStats
  // instance, but what happens if we perform an ICE restart?
  var lastTransport = this._transport;
  var transportId = lastTransport ? lastTransport.id : null;
  var transport = getRTCTransportStats(report, transportId);
  if (transport) {
    this._transport = transport;
    if (lastTransport) {
      if (transport.timestamp <= lastTransport.timestamp) {
        this._log.warn('RTCTransportStats\' `timestamp` is less than or ' +
          'equal to the previous RTCTransportStats\' `timestamp`; are the ' +
          'RTCStatsReports out of order?');
        return null;
      }
      if (typeof transport.bytesSent === 'number') {
        bytesSent = transport.bytesSent;
        if (typeof lastTransport.bytesSent === 'number') {
          actualOutgoingBitrate
            = (bytesSent * 8 - lastTransport.bytesSent * 8)
            / (transport.timestamp - lastTransport.timestamp);
        }
      }
      if (typeof transport.bytesReceived === 'number') {
        bytesReceived = transport.bytesReceived;
        if (typeof lastTransport.bytesReceived === 'number') {
          actualIncomingBitrate
            = (bytesReceived * 8 - lastTransport.bytesReceived * 8)
            / (transport.timestamp - lastTransport.timestamp);
        }
      }
    } else {
      bytesSent = transport.bytesSent;
      bytesReceived = transport.bytesReceived;
    }

    // NOTE(mroberts): Convert to s
    timestamp = transport.timestamp / 1000;

    var iceCandidatePair = report.get(transport.selectedCandidatePairId);
    if (iceCandidatePair) {
      if (typeof iceCandidatePair.availableOutgoingBitrate === 'number') {
        availableOutgoingBitrate = iceCandidatePair.availableOutgoingBitrate;
      } else if (typeof iceCandidatePair.availableIncomingBitrate === 'number') {
        this._log.warn(
          'RTCIceCandidatePairStats\' `availableOutgoingBitrate` is ' +
          'missing; using `availableIncomingBitrate` instead');
        availableOutgoingBitrate = iceCandidatePair.availableIncomingBitrate;
      }

      if (typeof iceCandidatePair.availableIncomingBitrate === 'number') {
        availableIncomingBitrate = iceCandidatePair.availableIncomingBitrate;
      } else if (typeof iceCandidatePair.availableOutgoingBitrate === 'number') {
        this._log.warn(
          'RTCIceCandidatePairStats\' `availableIncomingBitrate` is ' +
          'missing; using `availableOutgoingBitrate` instead');
        availableIncomingBitrate = iceCandidatePair.availableOutgoingBitrate;
      }

      if (typeof iceCandidatePair.currentRoundTripTime === 'number') {
        currentRoundTripTime = iceCandidatePair.currentRoundTripTime;
      } else {
        this._log.warn('RTCIceCandidatePairStats\' `currentRoundTripTime` is ' +
          'missing');
      }
    } else {
      this._log.warn('RTCIceCandidatePairStats is missing');
    }
  } else {
    this._log.warn('RTCTransportStats is missing');
    return null;
  }

  var averageOutboundInboundJitter = computeAverageJitter(this._log, report);
  var averageOutboundJitter = averageOutboundInboundJitter.averageOutboundJitter;
  var averageInboundJitter = averageOutboundInboundJitter.averageInboundJitter;

  var averageOutboundInboundFractionLost = computeAverageFractionLost(this._log, report);
  var averageOutboundFractionLost = averageOutboundInboundFractionLost.averageOutboundFractionLost;
  var averageInboundFractionLost = averageOutboundInboundFractionLost.averageInboundFractionLost;

  var outboundBandwidthQualityLevel = computeBandwidthQualityLevel(
    actualOutgoingBitrate, availableOutgoingBitrate);
  var inboundBandwidthQualityLevel = computeBandwidthQualityLevel(
    actualIncomingBitrate, availableIncomingBitrate);

  var outboundPacketLossQualityLevel = computePacketLossQualityLevel(
    averageOutboundFractionLost);
  var inboundPacketLossQualityLevel = computePacketLossQualityLevel(
    averageInboundFractionLost);

  var outboundLatencyQualityLevel = computeLatencyQualityLevel(
    currentRoundTripTime, averageOutboundJitter);
  var inboundLatencyQualityLevel = computeLatencyQualityLevel(
    currentRoundTripTime, averageInboundJitter);

  var outboundQualityLevel = min(
    outboundBandwidthQualityLevel,
    outboundPacketLossQualityLevel,
    outboundLatencyQualityLevel);
  var inboundQualityLevel = min(
    inboundBandwidthQualityLevel,
    inboundPacketLossQualityLevel,
    inboundLatencyQualityLevel);

  var qualityLevel = min(outboundQualityLevel, inboundQualityLevel);

  return {
    timestamp: timestamp,
    bytesSent: bytesSent,
    bytesReceived: bytesReceived,
    actualOutgoingBitrate: actualOutgoingBitrate,
    actualIncomingBitrate: actualIncomingBitrate,
    availableOutgoingBitrate: availableOutgoingBitrate,
    availableIncomingBitrate: availableIncomingBitrate,
    currentRoundTripTime: currentRoundTripTime,
    averageOutboundJitter: averageOutboundJitter,
    averageInboundJitter: averageInboundJitter,
    averageOutboundFractionLost: averageOutboundFractionLost,
    averageInboundFractionLost: averageInboundFractionLost,
    outboundBandwidthQualityLevel: outboundBandwidthQualityLevel,
    inboundBandwidthQualityLevel: inboundBandwidthQualityLevel,
    outboundPacketLossQualityLevel: outboundPacketLossQualityLevel,
    inboundPacketLossQualityLevel: inboundPacketLossQualityLevel,
    outboundLatencyQualityLevel: outboundLatencyQualityLevel,
    inboundLatencyQualityLevel: inboundLatencyQualityLevel,
    outboundQualityLevel: outboundQualityLevel,
    inboundQualityLevel: inboundQualityLevel,
    qualityLevel: qualityLevel
  };
};

/**
 * @param {number} alpha
 * @param {number} beta
 * @param {number} input
 * @returns {number} output
 */
function computeLevel(alpha, beta, input) {
  return clamp(
    0,
    qualityLevels,
    qualityLevels + (1 - Math.floor(Math.pow(input, alpha) * beta)));
}

/**
 * @param {Log} log
 * @param {RTCInboundRTPStreamStats} inboundStat
 * @returns {?number} jitter
 */
function computeInboundJitter(log, inboundStat) {
  if (typeof inboundStat.jitter === 'number') {
    return inboundStat.jitter;
  }
  log.warn('RTCInboundRTPStreamStats is missing `jitter`');
  return null;
}

/**
 * @param {Log} log
 * @param {RTCInboundRTPStreamStats} inboundStat
 * @returns {?number} fractionLost
 */
function computeInboundFractionLost(log, inboundStat) {
  if (typeof inboundStat.fractionLost === 'number') {
    return inboundStat.fractionLost;
  }
  log.warn('RTCInboundRTPStreamStats is missing `fractionLost`');
  return null;
}

/**
 * @param {Log} log
 * @param {RTCStatsReport} report
 * @param {RTCOutboundRTPStreamStats} outboundStats
 * @param {?number} defaultJitter
 * @returns {?number} jitter
 */
function computeOutboundJitter(log, report, outboundStats, defaultJitter) {
  var remoteInboundStats = report.get(outboundStats.remoteId);
  if (!remoteInboundStats) {
    if (defaultJitter === null) {
      log.warn('RTCRemoteInboundRTPStreamStats is missing and no default ' +
        '`jitter` available');
      return null;
    }
    log.warn('RTCRemoteInboundRTPStreamStats is missing; falling back ' +
      'to default `jitter`');
    return defaultJitter;
  }
  if (typeof remoteInboundStats.jitter === 'number') {
    return remoteInboundStats.jitter;
  } else if (defaultJitter === null) {
    log.warn('RTCRemoteInboundRTPStreamStats is missing `jitter` ' +
      'and no default `jitter` available');
    return null;
  }
  log.warn('RTCRemoteInboundRTPStreamStats is missing `jitter`; falling ' +
    'back to default `jitter`');
  return defaultJitter;
}

/**
 * @param {Log} log
 * @param {RTCStatsReport} report
 * @param {RTCOutboundRTPStreamStats} outboundStats
 * @param {?number} defaultFrationLost
 * @returns {?number} fractionLost
 */
function computeOutboundFractionLost(log, report, outboundStats, defaultFractionLost) {
  var remoteInboundStats = report.get(outboundStats.remoteId);
  if (!remoteInboundStats) {
    if (defaultFractionLost === null) {
      log.warn('RTCRemoteInboundRTPStreamStats is missing and no default ' +
        '`fractionLost` available');
      return null;
    }
    log.warn('RTCRemoteInboundRTPStreamStats is missing; falling back ' +
      'to default `fractionLost`');
    return defaultFractionLost;
  }
  if (typeof remoteInboundStats.fractionLost === 'number') {
    return remoteInboundStats.fractionLost;
  } else if (defaultFractionLost === null) {
    log.warn('RTCRemoteInboundRTPStreamStats is missing `fractionLost` ' +
      'and no default `fractionLost` available');
    return null;
  }
  log.warn('RTCRemoteInboundRTPStreamStats is missing `fractionLost`; falling ' +
    'back to default `fractionLost`');
  return defaultFractionLost;
}

/**
 * @param {Log} log
 * @param {RTCStatsReport} report
 * @returns {{ averageOutboundFractionLost: number, averageInboundFractionLost: number }}
 */
function computeAverageFractionLost(log, report) {
  var localTrackStatsIds = getLocalTrackStatsIds(report);
  var outboundStats = getOutboundStats(report, localTrackStatsIds);

  var remoteTrackStatsIds = getRemoteTrackStatsIds(report);
  var inboundStats = getInboundStats(report, remoteTrackStatsIds);

  var inboundFractionLosts = inboundStats.map(computeInboundFractionLost.bind(null, log));
  var maxInboundFractionLost = max.apply(null, inboundFractionLosts);

  // NOTE(mroberts): We're being very conservative here in using the maximum
  // inbound `fractionLost` as the default `fractionLost` when missing from
  // outbound stats.
  var outboundFractionLosts = outboundStats.map(outboundStat =>
    computeOutboundFractionLost(log, report, outboundStat, maxInboundFractionLost));

  var averageInboundFractionLost = average(inboundFractionLosts);
  var averageOutboundFractionLost = average(outboundFractionLosts);
  return {
    averageInboundFractionLost: averageInboundFractionLost,
    averageOutboundFractionLost: averageOutboundFractionLost
  };
}

/**
 * @param {Log} log
 * @param {RTCStatsReport} report
 * @returns {{ averageOutboundJitter: number, averageInboundJitter: number }}
 */
function computeAverageJitter(log, report) {
  var localTrackStatsIds = getLocalTrackStatsIds(report);
  var outboundStats = getOutboundStats(report, localTrackStatsIds);

  var remoteTrackStatsIds = getRemoteTrackStatsIds(report);
  var inboundStats = getInboundStats(report, remoteTrackStatsIds);

  var inboundJitters = inboundStats.map(computeInboundJitter.bind(null, log));
  var maxInboundJitter = max.apply(null, inboundJitters);

  // NOTE(mroberts): We're being very conservative here in using the maximum
  // inbound `jitter` as the default `jitter` when missing from
  // outbound stats.
  var outboundJitters = outboundStats.map(outboundStat =>
    computeOutboundJitter(log, report, outboundStat, maxInboundJitter));

  var averageInboundJitter = average(inboundJitters);
  var averageOutboundJitter = average(outboundJitters);
  return {
    averageInboundJitter: averageInboundJitter,
    averageOutboundJitter: averageOutboundJitter
  };
}

/**
 * @param {?number} actualBitrate - bps
 * @param {?number} availableBitrate - bps
 * @returns {?number} bandwidthQualityLevel - 0–5
 */
function computeBandwidthQualityLevel(actualBitrate, availableBitrate) {
  if (actualBitrate === null || availableBitrate === null) {
    return null;
  }
  return actualBitrate / availableBitrate < bandwidthThreshold
    ? qualityLevels
    // NOTE(mroberts): Convert to kbps
    : computeLevel(bandwidthAlpha, bandwidthBeta, actualBitrate / 8 / 1000);
}

/**
 * @param {?number} fractionLost
 * @returns {?number} packetLossQualityLevel - 0–5
 */
function computePacketLossQualityLevel(fractionLost) {
  return fractionLost === null
    ? null
    : computeLevel(packetLossAlpha, packetLossBeta, fractionLost);
}

/**
 * @param {?number} currentRoundTripTime - s
 * @param {?number} averageJitter - s
 * @returns {?number} latencyQualityLevel
 */
function computeLatencyQualityLevel(currentRoundTripTime, averageJitter) {
  return currentRoundTripTime === null || averageJitter === null
    ? null
    // NOTE(mroberts): Convert to ms
    : computeLevel(latencyAlpha, latencyBeta, (currentRoundTripTime + averageJitter) * 1000);
}

/**
 * @param {RTCStatsReport} report
 * @param {?string} id
 * @returns {?RTCTransportStats} transport
 */
function getRTCTransportStats(report, id) {
  return Array.from(report.values()).find(function(stats) {
    if (stats.type !== 'transport') {
      return false;
    }
    if (!id) {
      return true;
    }
    return stats.id === id;
  });
}

/**
 * This function returns the Set of RTCStats IDs corresponding to
 * MediaStreamTracks which are not ended, not detached, and currently being
 * sent. These are not MediaStreamTrack IDs.
 * @param {RTCStatsReport} report
 * @returns {Set<string>} localTrackStatsIds
 */
function getLocalTrackStatsIds(report) {
  return Array.from(report.values()).reduce(function(localTrackStatsIds, stats) {
    if (stats.type !== 'track' || stats.ended || stats.detached || stats.remoteSource) {
      return localTrackStatsIds;
    }
    return localTrackStatsIds.add(stats.id);
  }, new Set());
}

/**
 * This function returns the Set of RTCStats IDs corresponding to
 * MediaStreamTracks which are not ended, not detached, and currently being
 * received. These are not MediaStreamTrack IDs.
 * @param {RTCStatsReport} report
 * @returns {Set<string>} remoteTrackStatsIds
 */
function getRemoteTrackStatsIds(report) {
  return Array.from(report.values()).reduce(function(remoteTrackStatsIds, stats) {
    if (stats.type !== 'track' || stats.ended || stats.detached || !stats.remoteSource) {
      return remoteTrackStatsIds;
    }
    return remoteTrackStatsIds.add(stats.id);
  }, new Set());
}

/**
 * This function returns an Array of RTCOutboundRTPStreamStats corresponding to
 * the MediaStreamTracks identified by the RTCStats IDs in the Set.
 * @param {RTCStatsReport} report
 * @param {Set<string>} localTrackStatsIds
 * @returns {Array<RTCOutboundRTPStreamStats>} outboundStats
 */
function getOutboundStats(report, localTrackStatsIds) {
  return Array.from(report.values()).reduce(function(outboundStats, stats) {
    if (stats.type !== 'outbound-rtp' || !localTrackStatsIds.has(stats.trackId)) {
      return outboundStats;
    }
    return outboundStats.concat(stats);
  }, []);
}

/**
 * This function returns an Array of RTCInboundRTPStreamStats corresponding to
 * the MediaStreamTracks identified by the RTCStats IDs in the Set.
 * @param {RTCStatsReport} report
 * @param {Set<string>} remoteTrackStatsIds
 * @returns {Array<RTCInboundRTPStreamStats>} inboundStats
 */
function getInboundStats(report, remoteTrackStatsIds) {
  return Array.from(report.values()).reduce(function(inboundStats, stats) {
    if (stats.type !== 'inbound-rtp' || !remoteTrackStatsIds.has(stats.trackId)) {
      return inboundStats;
    }
    return inboundStats.concat(stats);
  }, []);
}

/**
 * Clamp an integer between `low` and `high`.
 * @param {number} low
 * @param {number} high
 * @param {number} number
 * @returns {number} clamped
 */
function clamp(low, high, number) {
  return Math.floor(Math.min(high, Math.max(low, number)));
}

/**
 * A null-compatible average function.
 * @param {Array<?number>} numbersOrNulls
 * @returns {?number} average
 */
function average(numbersOrNulls) {
  var numbers = numbersOrNulls.filter(function(number) {
    return number !== null;
  });
  return numbers.length
    ? numbers.reduce(function(sum, number) {
        return sum + number;
      }) / numbers.length
    : null;
}

/**
 * A variadic, null-compatible maximum function.
 * @param {?number...} numbersOrNulls
 * @returns {?number} maxNumberOrNull
 */
function max() {
  var numbersOrNulls = [].slice.call(arguments);
  return numbersOrNulls.reduce(function(maxNumberOrNull, numberOrNull) {
    if (numberOrNull === null) {
      return maxNumberOrNull;
    } else if (maxNumberOrNull === null) {
      return numberOrNull;
    }
    return Math.max(maxNumberOrNull, numberOrNull);
  }, null);
}

/**
 * A variadic, null-compatible minimum function.
 * @param {?number...} numbersOrNulls
 * @returns {?number} minNumberOrNull
 */
function min() {
  var numbersOrNulls = [].slice.call(arguments);
  return numbersOrNulls.reduce(function(minNumberOrNull, numberOrNull) {
    if (numberOrNull === null) {
      return minNumberOrNull;
    } else if (minNumberOrNull === null) {
      return numberOrNull;
    }
    return Math.min(minNumberOrNull, numberOrNull);
  }, null);
}

module.exports = NetworkQuality;
