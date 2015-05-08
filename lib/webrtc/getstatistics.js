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
  var trackStats = [];
  var transportStats = null;

  var knownStats = [];
  var unknownStats = [];

  var results = response.result();
  var timestamp = null;

  results.forEach(function(report) {
    var processedReport = null;
    switch (report.type) {
      case 'googCandidatePair':
        processedReport = processCandidatePair(report);
        if (processedReport) {
          // console.log('Dropping unknown transport stats', processedReport['unknown']);
          transportStats = transportStats || processedReport['known'];
        }
        break;
      case 'ssrc':
        processedReport = processSSRC(report);
        // console.log('Dropping unknown track stats', processedReport['unknown']);
        trackStats.push(processedReport['known']);
        break;
      default:
        unknownStats.push(report);
    }
    if (processedReport && processedReport['known'] && 'timestamp' in processedReport['known']) {
      timestamp = timestamp || processedReport['known']['timestamp'];
      delete processedReport['known']['timestamp'];
    }
  });
  stats = {
    'timestamp': timestamp,
    'tracks': trackStats,
    'transport': transportStats
  };
  callback(null, stats);
}

function processCandidatePair(report) {
  var transportStats = {};
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

      case 'googChannelId':
        transportStats['connection'] = value;
        break;

      case 'googLocalAddress':
        if (value.split) {
          var address = value.split(':');
          setProp(transportStats, 'local', 'address', address[0]);
          setProp(transportStats, 'local', 'port', Number(address[1]));
        }
        break;

      case 'googLocalCandidateType':
        setProp(transportStats, 'local', 'type', value);
        break;

      case 'googRemoteAddress':
        if (value.split) {
          var address = value.split(':');
          setProp(transportStats, 'remote', 'address', address[0]);
          setProp(transportStats, 'remote', 'port', Number(address[1]));
        }
        break;

      case 'googRemoteCandidateType':
        setProp(transportStats, 'remote', 'type', value);
        break;

      case 'googRtt':
        transportStats['rtt'] = Number(value);
        break;

      // Ignore empty stat names (annoying, I know).
      case '':
        break;

      // Unknown
      default:
        unknownStats[name] = value;
    }
  }
  transportStats['timestamp'] = timestamp;
  return packageStats(transportStats, unknownStats);
}

function processSSRC(report) {
  var trackStats = {};
  var unknownStats = {};
  var names = report.names();

  var direction = null;
  var media = null;
  var timestamp = report.timestamp ? Math.floor(report.timestamp/1000) : null;

  names.forEach(function(name) {
    var value = report.stat(name);
    switch (name) {

      case 'audioInputLevel':
        media = 'audio';
        setProp(trackStats, 'audio', 'inlvl', Number(value));
        break;

      case 'audioOutputLevel':
        media = 'audio';
        setProp(trackStats, 'audio', 'outlvl', Number(value));
        break;

      case 'bytesReceived':
        direction = 'receiving';
        setProp(trackStats, 'bytes', 'recv', Number(value));
        break;

      case 'bytesSent':
        direction = 'sending';
        setProp(trackStats, 'bytes', 'sent', Number(value));
        break;

      case 'googCodecName':
        // Filter out the empty case.
        var codecName = value;
        if (codecName !== '') {
          trackStats['codecName'] = value;
        }
        break;

      case 'googFrameHeightReceived':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'height_recv', Number(value));
        break;

      case 'googFrameHeightSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'height_sent', Number(value));
        break;

      case 'googFrameWidthReceived':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'width_recv', Number(value));
        break;

      case 'googFrameWidthSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'width_sent', Number(value));
        break;

      case 'googFrameRateDecoded':
        direction = 'receiving';
        media = 'video';
        setProp(trackStats, 'video', 'fps_recv', Number(value));
        break;

      case 'googFrameRateSent':
        direction = 'sending';
        media = 'video';
        setProp(trackStats, 'video', 'fps_sent', Number(value));
        break;

      case 'googJitterBufferMs':
        trackStats['googJitterBufferMs'] = Number(value);
        break;

      case 'googJitterReceived':
        // Filter out the -1 case.
        var jitterReceived = Number(value);
        if (jitterReceived !== -1) {
          trackStats['jitter'] = jitterReceived;
        }
        break;

      case 'googRtt':
        // Filter out the -1 case.
        var rtt = Number(value);
        if (rtt !== -1) {
          trackStats['rtt'] = rtt;
        }
        break;

      case 'packetsLost':
        direction = 'sending';
        // Filter out the -1 case.
        var packetsLost = Number(value);
        if (packetsLost !== -1) {
          setProp(trackStats, 'packets', 'lost', Number(value));
        }
        break;

      case 'packetsReceived':
        direction = 'receiving';
        setProp(trackStats, 'packets', 'recv', Number(value));
        break;

      case 'packetsSent':
        direction = 'sending';
        setProp(trackStats, 'packets', 'sent', Number(value));
        break;

      case 'ssrc':
        trackStats[name] = value;
        break;

      case 'transportId':
        trackStats['connection'] = value;
        break;

      // Unknown
      default:
        unknownStats[name] = value;
    }
  });
  if (direction) {
    trackStats['direction'] = direction;
  }
  if (media) {
    trackStats['media'] = media;
  }
  trackStats['timestamp'] = timestamp;
  return packageStats(trackStats, unknownStats);
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

  var localCandidates = { };
  var remoteCandidates = { };
  var activePair;

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
      case 'candidatepair':
        var activeId = activePair && activePair.componentId;
        // We can only send one candidate pair, and some browsers have separate pairs
        // for each track. We're favoring the video stream here for consistency.
        if (report.selected && !(activeId && activeId.indexOf('video') !== -1)) {
          activePair = report;
        }
        break;
      case 'localcandidate':
        localCandidates[report.id] = report;
        break;
      case 'remotecandidate':
        remoteCandidates[report.id] = report;
        break;
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

  var localCandidate = localCandidates[activePair.localCandidateId];
  var remoteCandidate = remoteCandidates[activePair.remoteCandidateId];

  var transport = {
    local: {
      address: localCandidate.ipAddress,
      port: localCandidate.portNumber,
      type: localCandidate.candidateType === 'host' ? 'local' : localCandidate.candidateType
    },
    remote: {
      address: remoteCandidate.ipAddress,
      port: remoteCandidate.portNumber,
      type: remoteCandidate.candidateType === 'host' ? 'local' : remoteCandidate.candidateType
    }
  };

  var sample = {
    timestamp: timestamp,
    tracks: knownStats.map(convertToGatewayFormat),
    transport: transport
  };

  callback(null, sample);
}

function processOutbound(report) {
  var knownStats = { direction: 'sending' };
  var unknownStats = {};
  for (var name in report) {
    var value = report[name];
    switch (name) {
      // Convert to UNIX timestamp.
      case 'timestamp':
        knownStats[name] = Math.floor(value/1000);
        break;
      case 'mediaType':
        knownStats['media'] = value;
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
  var knownStats = { direction: 'receiving' };
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
      case 'mediaType':
        knownStats['media'] = value;
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
    stats['known'] = knownStats;
  }
  if (!empty(unknownStats)) {
    stats = stats || {};
    stats['unknown'] = unknownStats;
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
    media: stats.media,
    direction: stats.direction,
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

function setProp() {
  var args = [].slice.call(arguments, 0);
  var obj = args[0];
  var keys = args.slice(1, args.length-1);
  var value = args[args.length-1];

  var focus = obj;
  keys.forEach(function(key, i) {
    var val = i == keys.length-1 ? value : {};
    focus = focus[key] = focus[key] || val;
  });
  return obj;
}

module.exports = getStatistics;
