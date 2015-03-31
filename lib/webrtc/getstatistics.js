/**
 * Collect any WebRTC statistics for the given {@link PeerConnection} and pass
 * them to an error-first callback.
 * @param {PeerConnection} peerConnection - The {@link PeerConnection}
 * @param {function} callback - The callback
 */
function getStatistics(peerConnection, callback) {
  var error = new Error('WebRTC statistics are unsupported');
  if (peerConnection == null || typeof navigator === 'undefined' || typeof peerConnection.getStats !== 'function') {
    callback(error);
  } else if (navigator.webkitGetUserMedia) {
    peerConnection.getStats(chainCallback(withStats, callback), callback);
  } else if (navigator.mozGetUserMedia) {
    peerConnection.getStats(null, chainCallback(mozWithStats, callback), callback);
  } else {
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
  var timestamp = null;
  results.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'googCandidatePair':
        // processedReport = processCandidatePair(report);
        break;
      case 'ssrc':
        processedReport = processSSRC(report);
        break;
      // Unknown
      default:
        unknownStats.push(report);
    }
    if (processedReport) {
      timestamp = timestamp || processedReport.known.timestamp;
      delete processedReport.known.timestamp;
      knownStats.push(processedReport);
    }
  });
  if (knownStats.length === 0 || (knownStats = filterKnownStats(knownStats)).length === 0) {
    return callback(null, { timestamp: timestamp, ssrcs: [] });
  }
  var mergedStats = knownStats.reduceRight(function(mergedStat, knownStat) {
    mergedStat.ssrcs.push(convertToGatewayFormat(knownStat));
    return mergedStat;
  }, { timestamp: timestamp, ssrcs: [] });
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
      case 'googRtt':
        knownStats['rtt'] = Number(value);
        break;
      case 'googFrameRateDecoded':
      case 'googFrameRateSent':
        knownStats['fps'] = Number(value);
        break;
      case 'googFrameWidthReceived':
      case 'googFrameWidthSent':
        knownStats['width'] = Number(value);
        break;
      case 'googFrameHeightReceived':
      case 'googFrameHeightSent':
        knownStats['height'] = Number(value);
        break;
      // Pass these stats through unmodified.
      case 'bytesReceived':
      case 'bytesSent':
      case 'packetsReceived':
      case 'packetsSent':
      case 'timestamp':
      case 'audioInputLevel':
      case 'audioOutputLevel':
        knownStats[name] = Number(value);
        break;
      case 'packetsLost':
        // Filter out the -1 case.
        var packetsLost = Number(value);
        if (packetsLost !== -1) {
          knownStats[name] = packetsLost;
        }
        break;
      case 'ssrc':
        knownStats[name] = value;
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
  var timestamp = null;
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
      timestamp = timestamp || processedReport.known.timestamp;
      delete processedReport.known.timestamp;
      knownStats.push(processedReport);
    }
  });
  if (knownStats.length === 0 || (knownStats = filterKnownStats(knownStats)).length === 0) {
    return callback(null, { timestamp: timestamp, ssrcs: [] });
  }
  var mergedStats = knownStats.reduceRight(function(mergedStat, knownStat) {
    mergedStat.ssrcs.push(convertToGatewayFormat(knownStat));
    return mergedStat;
  }, { timestamp: timestamp, ssrcs: [] });
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
        break;
      // Pass these stats through unmodified.
      case 'bytesSent':
      case 'packetsSent':
      case 'ssrc':
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
      case 'framerateMean':
        knownStats['fps'] = Math.round(value);
        break;
      // Pass these stats through unmodified.
      case 'bytesReceived':
      case 'packetsLost':
      case 'packetsReceived':
      case 'ssrc':
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

function convertToGatewayFormat(stats) {
  var formatted = {
    ssrc: stats.ssrc,
    codecName: stats.codecName,
    packets: {
      lost: stats.packetsLost,
      recvtot: stats.packetsReceived,
      senttot: stats.packetsSent
    },
    bytes: {
      recvtot: stats.bytesReceived,
      senttot: stats.bytesSent
    },
    jitter: stats.jitter,
    rtt: stats.rtt
  };
  if ('audioInputLevel' in stats || 'audioOutputLevel' in stats) {
    formatted.audio = {
      inlvl: stats.audioInputLevel,
      outlvl: stats.audioOutputLevel
    };
  }
  if ('fps' in stats || 'width' in stats || 'height' in stats) {
    formatted.video = {
      fps: stats.fps,
      width: stats.width,
      height: stats.height
    };
  }
  return formatted;
}

module.exports = getStatistics;
