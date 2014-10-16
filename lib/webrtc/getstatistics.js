/**
 * Collect any WebRTC statistics for the given {@link PeerConnection} and pass
 * them to an error-first callback.
 * @param {PeerConnection} peerConnection - The {@link PeerConnection}
 * @param {function} callback - The callback
 */
function getStatistics(peerConnection, callback) {
  var error = new Error('WebRTC statistics are unsupported');
  if (typeof peerConnection.getStats !== 'function') {
    callback(error);
  }
  var platform = require('./').detectedPlatform;
  switch (platform) {
    case 'Node':
    case 'Chrome':
      peerConnection.getStats(chainCallback(withStats, callback), callback);
      break;
    case 'Firefox':
      peerConnection.getStats(null, chainCallback(mozWithStats, callback), callback);
      break;
    default:
      callback(error);
  }
}

/**
 * Handle any WebRTC statistics for Google Chrome and pass them to an error-
 * first callback.
 * @param {RTCStatsResponse} response - WebRTC statistics for Google Chrome
 * @param {function} callback - The callback
 */
function withStats(response, callback) {
  var knownStats = [];
  var unknownStats = [];
  var results = response.result();
  results.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'googCandidatePair':
        processedReport = processCandidatePair(report);
        break;
      case 'ssrc':
        processedReport = processSSRC(report);
        break;
      // Unknown
      default:
        unknownStats.push(report);
    }
    if (processedReport) {
      knownStats.push(processedReport);
    }
  });
  if (knownStats.length === 0 || (knownStats = filterKnownStats(knownStats)).length === 0) {
    return callback(null, null);
  }
  var mergedStats = knownStats.reduceRight(function(mergedStat, knownStat) {
    for (var name in knownStat) {
      mergedStat[name] = knownStat[name];
    }
    return mergedStat;
  }, {});
  callback(null, mergedStats);
}

function processCandidatePair(report) {
  var knownStats = {};
  var unknownStats = {};
  var names = report.names();
  var timestamp = report.timestamp ? Math.floor(report.timestamp/1000) : null;
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var value = report.stat(name);
    switch (name) {
      // If the connection represented by this report is inactive, bail out.
      case 'googActiveConnection':
        if (value !== 'true') {
          return null;
        }
        break;
      // Rename "goog"-prefixed stats.
      case 'googLocalAddress':
        knownStats['localAddress'] = value;
        break;
      case 'googRemoteAddress':
        knownStats['remoteAddress'] = value;
        break;
      case 'googRtt':
        knownStats['rtt'] = Number(value);
        break;
      // Ignore empty stat names (annoying, I know).
      case '':
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  knownStats.timestamp = timestamp;
  return packageStats(knownStats, unknownStats);
}

function processSSRC(report) {
  var knownStats = {};
  var unknownStats = {};
  var names = report.names();
  var timestamp = report.timestamp ? Math.floor(report.timestamp/1000) : null;
  names.forEach(function(name) {
    var value = report.stat(name);
    switch (name) {
      // Rename "goog"-prefixed stats.
      case 'googCodecName':
        // Filter out the empty case.
        var codecName = value;
        if (codecName !== '') {
          knownStats['codecName'] = value;
        }
        break;
      case 'googJitterBufferMs':
        knownStats['googJitterBufferMs'] = Number(value);
        break;
      case 'googJitterReceived':
        // Filter out the -1 case.
        var jitterReceived = Number(value);
        if (jitterReceived !== -1) {
          knownStats['jitter'] = jitterReceived;
        }
        break;
      // Pass these stats through unmodified.
      case 'bytesReceived':
      case 'bytesSent':
      case 'packetsReceived':
      case 'packetsSent':
      case 'timestamp':
        knownStats[name] = Number(value);
        break;
      case 'packetsLost':
        // Filter out the -1 case.
        var packetsLost = Number(value);
        if (packetsLost !== -1) {
          knownStats[name] = packetsLost;
        }
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  });
  knownStats.timestamp = timestamp;
  return packageStats(knownStats, unknownStats);
}

/**
 * Handle any WebRTC statistics for Mozilla Firefox and pass them to an error-
 * first callback.
 * @param {RTCStatsReport} reports - WebRTC statistics for Mozilla Firefox
 * @param {function} callback - The callback
 */
function mozWithStats(reports, callback) {
  var knownStats = [];
  var unknownStats = []
  reports.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'inboundrtp':
        processedReport = processInbound(report);
        break;
      case 'outboundrtp':
        if (report.isRemote === false) {
          processedReport = processOutbound(report);
        }
        break;
      // Unknown
      default:
        unknownStats.push(report);
    }
    if (processedReport) {
      knownStats.push(processedReport);
    }
  });
  if (knownStats.length === 0 || (knownStats = filterKnownStats(knownStats)).length === 0) {
    return callback(null, null);
  }
  var mergedStats = knownStats.reduceRight(function(mergedStat, knownStat) {
    for (var name in knownStat) {
      mergedStat[name] = knownStat[name];
    }
    return mergedStat;
  }, {});
  callback(null, mergedStats);
}

function processOutbound(report) {
  var knownStats = {};
  var unknownStats = {};
  for (var name in report) {
    var value = report[name];
    switch (name) {
      // Convert to UNIX timestamp.
      case 'timestamp':
          knownStats[name] = Math.floor(value/1000);
      // Pass these stats through unmodified.
      case 'bytesSent':
      case 'packetsSent':
        knownStats[name] = value;
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  return packageStats(knownStats, unknownStats);
}

function processInbound(report) {
  var knownStats = {};
  var unknownStats = {};
  for (var name in report) {
    var value = report[name];
    switch (name) {
      // Rename "moz"-prefixed stats.
      case 'mozRtt':
        knownStats['rtt'] = value;
        break;
      // Convert to UNIX timestamp.
      case 'timestamp':
        knownStats[name] = Math.floor(value/1000);
        break;
      // Convert to milliseconds.
      case 'jitter':
        knownStats[name] = value * 1000;
        break;
      // Pass these stats through unmodified.
      case 'bytesReceived':
      case 'packetsLost':
      case 'packetsReceived':
        knownStats[name] = value;
        break;
      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  return packageStats(knownStats, unknownStats);
}

/**
 * Given two objects containing known and unknown WebRTC statistics, include
 * each in an object keyed by "known" or "unkown" if they are non-empty. If
 * both are empty, return null.
 * @param {?object} knownStats - Known WebRTC statistics
 * @param {?object} unknownStats - Unkown WebRTC statistics
 * @returns ?object
 */
function packageStats(knownStats, unknownStats) {
  var stats = null;
  if (!empty(knownStats)) {
    stats = stats || {};
    stats.known = knownStats;
  }
  if (!empty(unknownStats)) {
    stats = stats || {};
    stats.unknown = unknownStats;
  }
  return stats;
}

/**
 * Given a list of objects containing known and/or unknown WebRTC statistics,
 * return only the known statistics.
 * @param {Array} stats - A list of objects containing known and/or unknown
 *                        WebRTC statistics
 * @returns Array
 */
function filterKnownStats(stats) {
  var knownStats = [];
  for (var i = 0; i < stats.length; i++) {
    var stat = stats[i];
    if (stat.known) {
      knownStats.push(stat.known);
    }
  }
  return knownStats;
}

/**
 * Check if an object is "empty" in the sense that it contains no keys.
 * @param {?object} obj - The object to check
 * @returns boolean
 */
function empty(obj) {
  if (!obj) {
    return true;
  }
  for (var key in obj) {
    return false;
  }
  return true;
}

/**
 * Given a function that takes a callback as its final argument, fix that final
 * argument to the provided callback.
 * @param {function} function - The function
 * @param {function} callback - The callback
 * @returns function
 */
function chainCallback(func, callback) {
  return function() {
    var args = Array.prototype.slice.call(arguments);
    args.push(callback);
    return func.apply(null, args);
  };
}

module.exports = getStatistics;
