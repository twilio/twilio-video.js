'use strict';

const { flatMap, guessBrowser, guessBrowserVersion } = require('./util');
const { getSdpFormat } = require('./util/sdp');

const guess = guessBrowser();
const guessVersion = guessBrowserVersion();
const isChrome = guess === 'chrome';
const isFirefox = guess === 'firefox';
const isSafari = guess === 'safari';

const chromeMajorVersion = isChrome ? guessVersion.major : null;


const CHROME_LEGACY_MAX_AUDIO_LEVEL = 32767;

/**
 * Helper function to find a specific stat from a report.
 * Browsers provide the stats report as a Map,
 * but Citrix provides stats report as an array.
 * @private
 */
function getStatById(report, id) {
  if (typeof report.get === 'function') {
    return report.get(id);
  }
  return report.find(s => s.id === id);
}

/**
 * Filter the RTCStatsReport to only include stats related to a specific track.
 * This function is designed for use with Citrix, where getStats(track) is not supported.
 * It includes specific logic to filter the statistics report returned by Citrix and should
 * only be used when getStats(track) fails.
 *
 * @param {RTCStatsReport|Array<RTCStats>} arrayOrMap - Full stats report or array of stats
 * @param {MediaStreamTrack} track - The track to filter by
 * @param {boolean} [isRemote=false] - Whether this is a remote track
 * @returns {RTCStatsReport} Filtered stats
 * @private
 */
function filterStatsByTrack(arrayOrMap, track, isRemote = false) {
  // Handle different input types
  let allStats;
  if (Array.isArray(arrayOrMap)) {
    allStats = new Map(arrayOrMap.map(stat => [stat.id || String(Math.random()), stat]));
  } else if (arrayOrMap instanceof Map) {
    allStats = arrayOrMap;
  } else if (typeof arrayOrMap === 'object' && arrayOrMap !== null) {
    // Handle object-style stats (non-standard)
    const statsMap = new Map();
    Object.keys(arrayOrMap).forEach(key => {
      statsMap.set(key, arrayOrMap[key]);
    });
    allStats = statsMap;
  } else {
    return new Map();
  }

  if (!allStats || !track) {
    return new Map();
  }

  const filteredReport = new Map();
  const trackId = track.id;
  const trackKind = track.kind;

  // Step 1: Find the primary track-specific stats
  let primaryStats = null;
  let primaryStatsId = null;
  let ssrc = null;

  // Find the primary stat for this track (inbound-rtp for remote, media-source for local)
  for (const [id, stat] of allStats) {
    // For remote tracks, find matching inbound-rtp with matching trackIdentifier
    if (isRemote && stat.type === 'inbound-rtp' && stat.trackIdentifier === trackId) {
      primaryStats = stat;
      primaryStatsId = id;
      ssrc = stat.ssrc;
      break;
    } else if (!isRemote && stat.type === 'media-source' && stat.trackIdentifier === trackId) {
      // For local tracks, find matching media-source with matching trackIdentifier
      primaryStats = stat;
      primaryStatsId = id;
      break;
    } else if (stat.type === 'track' && stat.trackIdentifier === trackId) {
      // Also check for track stats with matching trackIdentifier
      if (!primaryStats) {
        primaryStats = stat;
        primaryStatsId = id;
      }
    }
  }

  // If no primary stat was found using the trackId, try a more lenient approach
  if (!primaryStats) {
    // For remote tracks, try to find an inbound-rtp of the correct kind
    if (isRemote) {
      // Get all inbound-rtp stats of the right kind
      const candidateInbounds = [];
      for (const [id, stat] of allStats) {
        if (stat.type === 'inbound-rtp' && (stat.kind === trackKind || stat.mediaType === trackKind)) {
          candidateInbounds.push({ id, stat });
        }
      }

      // If there are multiple candidates, we need to be careful
      if (candidateInbounds.length === 1) {
        // Only one candidate, use it
        primaryStats = candidateInbounds[0].stat;
        primaryStatsId = candidateInbounds[0].id;
        ssrc = primaryStats.ssrc;
      } else if (candidateInbounds.length > 1) {
        // Multiple candidates - if we have the trackId, try to match by mid
        // otherwise just take the first one
        primaryStats = candidateInbounds[0].stat;
        primaryStatsId = candidateInbounds[0].id;
        ssrc = primaryStats.ssrc;
      }
    } else {
      // For local tracks, try to find a media-source of the correct kind
      for (const [id, stat] of allStats) {
        if (stat.type === 'media-source' && stat.kind === trackKind) {
          primaryStats = stat;
          primaryStatsId = id;
          break;
        }
      }
    }
  }

  // If we still didn't find a primary stat, return an empty report
  if (!primaryStats) {
    return filteredReport;
  }

  // Step 2: Add the primary stat
  filteredReport.set(primaryStatsId, primaryStats);

  // Step 3: Add related stats using direct references
  const directlyRelatedIds = new Set();

  // Track different types of related IDs
  if (isRemote) {
    // For remote tracks (inbound-rtp is primary)
    if (primaryStats.codecId) { directlyRelatedIds.add(primaryStats.codecId); }
    if (primaryStats.transportId) { directlyRelatedIds.add(primaryStats.transportId); }
    if (primaryStats.remoteId) { directlyRelatedIds.add(primaryStats.remoteId); }

    // Find remote-outbound-rtp based on ssrc
    if (ssrc) {
      for (const [id, stat] of allStats) {
        if (stat.type === 'remote-outbound-rtp' && stat.ssrc === ssrc) {
          directlyRelatedIds.add(id);
        }
      }
    }

    // Add codec, transport, and remote stats
    for (const relatedId of directlyRelatedIds) {
      if (allStats.has(relatedId)) {
        filteredReport.set(relatedId, allStats.get(relatedId));
      }
    }

    // Add the track stats if it exists
    for (const [id, stat] of allStats) {
      if (stat.type === 'track' && stat.trackIdentifier === trackId) {
        filteredReport.set(id, stat);
      }
    }
  } else {
    // For local tracks (media-source is primary)

    // Find outbound-rtp that references this media source
    for (const [id, stat] of allStats) {
      if (stat.type === 'outbound-rtp' && stat.mediaSourceId === primaryStatsId) {
        filteredReport.set(id, stat);

        // Add codec and transport
        if (stat.codecId) { directlyRelatedIds.add(stat.codecId); }
        if (stat.transportId) { directlyRelatedIds.add(stat.transportId); }

        // Find remote-inbound-rtp that references this outbound-rtp
        const outboundId = id;
        for (const [remoteId, remoteStat] of allStats) {
          if (remoteStat.type === 'remote-inbound-rtp' && remoteStat.localId === outboundId) {
            filteredReport.set(remoteId, remoteStat);
          }
        }
      }
    }

    // Add codec and transport stats
    for (const relatedId of directlyRelatedIds) {
      if (allStats.has(relatedId)) {
        filteredReport.set(relatedId, allStats.get(relatedId));
      }
    }
  }

  // Step 4: Add candidate pair and certificate info for context
  // This is useful information that applies to all tracks
  // but doesn't risk mixing data between tracks
  let selectedPairId = null;
  const transportIds = new Set();

  // Find all transport IDs referenced in our filtered stats
  for (const stat of filteredReport.values()) {
    if (stat.transportId) {
      transportIds.add(stat.transportId);
    }
  }

  // Add the transports
  for (const transportId of transportIds) {
    if (allStats.has(transportId)) {
      const transport = allStats.get(transportId);
      filteredReport.set(transportId, transport);

      // Track the selected candidate pair
      if (transport.selectedCandidatePairId) {
        selectedPairId = transport.selectedCandidatePairId;
      }

      // Add certificate info
      if (transport.localCertificateId && allStats.has(transport.localCertificateId)) {
        filteredReport.set(transport.localCertificateId, allStats.get(transport.localCertificateId));
      }
      if (transport.remoteCertificateId && allStats.has(transport.remoteCertificateId)) {
        filteredReport.set(transport.remoteCertificateId, allStats.get(transport.remoteCertificateId));
      }
    }
  }

  // Add only the selected candidate pair, not all candidate pairs
  if (selectedPairId && allStats.has(selectedPairId)) {
    const selectedPair = allStats.get(selectedPairId);
    filteredReport.set(selectedPairId, selectedPair);

    // Add the local and remote candidates for the selected pair
    if (selectedPair.localCandidateId && allStats.has(selectedPair.localCandidateId)) {
      filteredReport.set(selectedPair.localCandidateId, allStats.get(selectedPair.localCandidateId));
    }
    if (selectedPair.remoteCandidateId && allStats.has(selectedPair.remoteCandidateId)) {
      filteredReport.set(selectedPair.remoteCandidateId, allStats.get(selectedPair.remoteCandidateId));
    }
  }

  return filteredReport;
}

/**
 * Get the standardized {@link RTCPeerConnection} statistics.
 * @param {RTCPeerConnection} peerConnection
 * @param {object} [options] - Used for testing
 * @returns {Promise.<StandardizedStatsResponse>}
 */
function getStats(peerConnection, options) {
  if (!(peerConnection && typeof peerConnection.getStats === 'function')) {
    return Promise.reject(new Error('Given PeerConnection does not support getStats'));
  }
  return _getStats(peerConnection, options);
}

/**
 * getStats() implementation.
 * @param {RTCPeerConnection} peerConnection
 * @param {object} [options] - Used for testing
 * @returns {Promise.<StandardizedStatsResponse>}
 */
function _getStats(peerConnection, options) {
  const localAudioTracks = getTracks(peerConnection, 'audio', 'local');
  const localVideoTracks = getTracks(peerConnection, 'video', 'local');
  const remoteAudioTracks = getTracks(peerConnection, 'audio');
  const remoteVideoTracks = getTracks(peerConnection, 'video');

  const statsResponse = {
    activeIceCandidatePair: null,
    localAudioTrackStats: [],
    localVideoTrackStats: [],
    remoteAudioTrackStats: [],
    remoteVideoTrackStats: []
  };

  const trackStatsPromises = flatMap([
    [localAudioTracks, 'localAudioTrackStats', false],
    [localVideoTracks, 'localVideoTrackStats', false],
    [remoteAudioTracks, 'remoteAudioTrackStats', true],
    [remoteVideoTracks, 'remoteVideoTrackStats', true]
  ], ([tracks, statsArrayName, isRemote]) => {
    return tracks.map(track => {
      return getTrackStats(peerConnection, track, Object.assign({ isRemote }, options)).then(trackStatsArray => {
        trackStatsArray.forEach(trackStats => {
          trackStats.trackId = track.id;
          statsResponse[statsArrayName].push(trackStats);
        });
      });
    });
  });

  return Promise.all(trackStatsPromises).then(() => {
    return getActiveIceCandidatePairStats(peerConnection, options);
  }).then(activeIceCandidatePairStatsReport => {
    statsResponse.activeIceCandidatePair = activeIceCandidatePairStatsReport;
    return statsResponse;
  });
}

/**
 * Generate the {@link StandardizedActiveIceCandidatePairStatsReport} for the
 * {@link RTCPeerConnection}.
 * @param {RTCPeerConnection} peerConnection
 * @param {object} [options]
 * @returns {Promise<StandardizedActiveIceCandidatePairStatsReport>}
 */
function getActiveIceCandidatePairStats(peerConnection, options = {}) {
  if (typeof options.testForChrome !== 'undefined' || isChrome
    || typeof options.testForSafari  !== 'undefined' || isSafari) {
    return peerConnection.getStats().then(
      standardizeChromeOrSafariActiveIceCandidatePairStats);
  }
  if (typeof options.testForFirefox !== 'undefined' || isFirefox) {
    return peerConnection.getStats().then(standardizeFirefoxActiveIceCandidatePairStats);
  }
  return Promise.reject(new Error('RTCPeerConnection#getStats() not supported'));
}

/**
 * Standardize the active RTCIceCandidate pair's statistics in Chrome or Safari.
 * @param {RTCStatsReport} stats
 * @returns {?StandardizedActiveIceCandidatePairStatsReport}
 */
function standardizeChromeOrSafariActiveIceCandidatePairStats(stats) {
  const activeCandidatePairStats = Array.from(stats.values()).find(
    ({ nominated, type }) => type === 'candidate-pair' && nominated
  );

  if (!activeCandidatePairStats) {
    return null;
  }

  const activeLocalCandidateStats = getStatById(stats, activeCandidatePairStats.localCandidateId);
  const activeRemoteCandidateStats = getStatById(stats, activeCandidatePairStats.remoteCandidateId);

  const standardizedCandidateStatsKeys = [
    { key: 'candidateType', type: 'string' },
    { key: 'ip', type: 'string' },
    { key: 'port', type: 'number' },
    { key: 'priority', type: 'number' },
    { key: 'protocol', type: 'string' },
    { key: 'url', type: 'string' }
  ];

  const standardizedLocalCandidateStatsKeys = standardizedCandidateStatsKeys.concat([
    { key: 'deleted', type: 'boolean' },
    { key: 'relayProtocol', type: 'string' }
  ]);

  const standatdizedLocalCandidateStatsReport = activeLocalCandidateStats
    ? standardizedLocalCandidateStatsKeys.reduce((report, { key, type }) => {
      report[key] = typeof activeLocalCandidateStats[key] === type
        ? activeLocalCandidateStats[key]
        : key === 'deleted' ? false : null;
      return report;
    }, {})
    : null;

  const standardizedRemoteCandidateStatsReport = activeRemoteCandidateStats
    ? standardizedCandidateStatsKeys.reduce((report, { key, type }) => {
      report[key] = typeof activeRemoteCandidateStats[key] === type
        ? activeRemoteCandidateStats[key]
        : null;
      return report;
    }, {})
    : null;

  return [
    { key: 'availableIncomingBitrate', type: 'number' },
    { key: 'availableOutgoingBitrate', type: 'number' },
    { key: 'bytesReceived', type: 'number' },
    { key: 'bytesSent', type: 'number' },
    { key: 'consentRequestsSent', type: 'number' },
    { key: 'currentRoundTripTime', type: 'number' },
    { key: 'lastPacketReceivedTimestamp', type: 'number' },
    { key: 'lastPacketSentTimestamp', type: 'number' },
    { key: 'nominated', type: 'boolean' },
    { key: 'priority', type: 'number' },
    { key: 'readable', type: 'boolean' },
    { key: 'requestsReceived', type: 'number' },
    { key: 'requestsSent', type: 'number' },
    { key: 'responsesReceived', type: 'number' },
    { key: 'responsesSent', type: 'number' },
    { key: 'retransmissionsReceived', type: 'number' },
    { key: 'retransmissionsSent', type: 'number' },
    { key: 'state', type: 'string', fixup: state => { return state === 'inprogress' ? 'in-progress' : state; } },
    { key: 'totalRoundTripTime', type: 'number' },
    { key: 'transportId', type: 'string' },
    { key: 'writable', type: 'boolean' }
  ].reduce((report, { key, type, fixup }) => {
    report[key] = typeof activeCandidatePairStats[key] === type
      ? (fixup ? fixup(activeCandidatePairStats[key]) : activeCandidatePairStats[key])
      : null;
    return report;
  }, {
    localCandidate: standatdizedLocalCandidateStatsReport,
    remoteCandidate: standardizedRemoteCandidateStatsReport
  });
}

/**
 * Standardize the active RTCIceCandidate pair's statistics in Firefox.
 * @param {RTCStatsReport} stats
 * @returns {?StandardizedActiveIceCandidatePairStatsReport}
 */
function standardizeFirefoxActiveIceCandidatePairStats(stats) {
  const activeCandidatePairStats = Array.from(stats.values()).find(
    ({ nominated, type }) => type === 'candidate-pair' && nominated
  );

  if (!activeCandidatePairStats) {
    return null;
  }

  const activeLocalCandidateStats = getStatById(stats, activeCandidatePairStats.localCandidateId);
  const activeRemoteCandidateStats = getStatById(stats, activeCandidatePairStats.remoteCandidateId);

  const standardizedCandidateStatsKeys = [
    { key: 'candidateType', type: 'string' },
    { key: 'ip', ffKeys: ['address', 'ipAddress'], type: 'string' },
    { key: 'port', ffKeys: ['portNumber'], type: 'number' },
    { key: 'priority', type: 'number' },
    { key: 'protocol', ffKeys: ['transport'], type: 'string' },
    { key: 'url', type: 'string' }
  ];

  const standardizedLocalCandidateStatsKeys = standardizedCandidateStatsKeys.concat([
    { key: 'deleted', type: 'boolean' },
    { key: 'relayProtocol', type: 'string' }
  ]);

  const candidateTypes = {
    host: 'host',
    peerreflexive: 'prflx',
    relayed: 'relay',
    serverreflexive: 'srflx'
  };

  const standatdizedLocalCandidateStatsReport = activeLocalCandidateStats
    ? standardizedLocalCandidateStatsKeys.reduce((report, { ffKeys, key, type }) => {
      const localStatKey = ffKeys && ffKeys.find(key => key in activeLocalCandidateStats) || key;
      report[key] = typeof activeLocalCandidateStats[localStatKey] === type
        ? localStatKey === 'candidateType'
          ? candidateTypes[activeLocalCandidateStats[localStatKey]] || activeLocalCandidateStats[localStatKey]
          : activeLocalCandidateStats[localStatKey]
        : localStatKey === 'deleted' ? false : null;
      return report;
    }, {})
    : null;

  const standardizedRemoteCandidateStatsReport = activeRemoteCandidateStats
    ? standardizedCandidateStatsKeys.reduce((report, { ffKeys, key, type }) => {
      const remoteStatKey = ffKeys && ffKeys.find(key => key in activeRemoteCandidateStats) || key;
      report[key] = typeof activeRemoteCandidateStats[remoteStatKey] === type
        ? remoteStatKey === 'candidateType'
          ? candidateTypes[activeRemoteCandidateStats[remoteStatKey]] || activeRemoteCandidateStats[remoteStatKey]
          : activeRemoteCandidateStats[remoteStatKey]
        : null;
      return report;
    }, {})
    : null;

  return [
    { key: 'availableIncomingBitrate', type: 'number' },
    { key: 'availableOutgoingBitrate', type: 'number' },
    { key: 'bytesReceived', type: 'number' },
    { key: 'bytesSent', type: 'number' },
    { key: 'consentRequestsSent', type: 'number' },
    { key: 'currentRoundTripTime', type: 'number' },
    { key: 'lastPacketReceivedTimestamp', type: 'number' },
    { key: 'lastPacketSentTimestamp', type: 'number' },
    { key: 'nominated', type: 'boolean' },
    { key: 'priority', type: 'number' },
    { key: 'readable', type: 'boolean' },
    { key: 'requestsReceived', type: 'number' },
    { key: 'requestsSent', type: 'number' },
    { key: 'responsesReceived', type: 'number' },
    { key: 'responsesSent', type: 'number' },
    { key: 'retransmissionsReceived', type: 'number' },
    { key: 'retransmissionsSent', type: 'number' },
    { key: 'state', type: 'string' },
    { key: 'totalRoundTripTime', type: 'number' },
    { key: 'transportId', type: 'string' },
    { key: 'writable', type: 'boolean' }
  ].reduce((report, { key, type }) => {
    report[key] = typeof activeCandidatePairStats[key] === type
      ? activeCandidatePairStats[key]
      : null;
    return report;
  }, {
    localCandidate: standatdizedLocalCandidateStatsReport,
    remoteCandidate: standardizedRemoteCandidateStatsReport
  });
}

/**
 * Get local/remote audio/video MediaStreamTracks.
 * @param {RTCPeerConnection} peerConnection - The RTCPeerConnection
 * @param {string} kind - 'audio' or 'video'
 * @param {string} [localOrRemote] - 'local' or 'remote'
 * @returns {Array<MediaStreamTrack>}
 */
function getTracks(peerConnection, kind, localOrRemote) {
  const getSendersOrReceivers = localOrRemote === 'local' ? 'getSenders' : 'getReceivers';
  if (peerConnection[getSendersOrReceivers]) {
    return peerConnection[getSendersOrReceivers]()
      .map(({ track }) => track)
      .filter(track => track && track.kind === kind);
  }
  const getStreams = localOrRemote === 'local' ? 'getLocalStreams' : 'getRemoteStreams';
  const getTracks = kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';
  return flatMap(peerConnection[getStreams](), stream => stream[getTracks]());
}

/**
 * Determine if a track is remote by examining the PeerConnection's receivers.
 * This function is designed for use with Citrix, where getStats(track) is not supported.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @returns {boolean} True if the track is a remote track
 * @private
 */
function isRemoteTrack(peerConnection, track) {
  if (!peerConnection || !track) {
    return false;
  }

  // Check if the track belongs to any receiver (remote)
  if (peerConnection.getReceivers) {
    const receivers = peerConnection.getReceivers();
    for (const receiver of receivers) {
      if (receiver.track && receiver.track.id === track.id) {
        return true;
      }
    }
  }

  // Check remote streams if getReceivers is not available
  if (peerConnection.getRemoteStreams) {
    const remoteStreams = peerConnection.getRemoteStreams();
    for (const stream of remoteStreams) {
      const tracks = stream.getTracks();
      for (const remoteTrack of tracks) {
        if (remoteTrack.id === track.id) {
          return true;
        }
      }
    }
  }

  // The track is not in any remote source, so it's likely local
  return false;
}

/**
 * Get the standardized statistics for a particular MediaStreamTrack.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @param {object} [options] - Used for testing
 * @returns {Promise.<Array<StandardizedTrackStatsReport>>}
 */
function getTrackStats(peerConnection, track, options = {}) {
  if (typeof options.testForChrome !== 'undefined' || isChrome) {
    return chromeOrSafariGetTrackStats(peerConnection, track, options);
  }
  if (typeof options.testForFirefox  !== 'undefined' || isFirefox) {
    return firefoxGetTrackStats(peerConnection, track, options);
  }
  if (typeof options.testForSafari  !== 'undefined' || isSafari) {
    if (typeof options.testForSafari  !== 'undefined' || getSdpFormat() === 'unified') {
      return chromeOrSafariGetTrackStats(peerConnection, track, options);
    }
    // NOTE(syerrapragada): getStats() is not supported on
    // Safari versions where plan-b is the SDP format
    // due to this bug: https://bugs.webkit.org/show_bug.cgi?id=192601
    return Promise.reject(new Error([
      'getStats() is not supported on this version of Safari',
      'due to this bug: https://bugs.webkit.org/show_bug.cgi?id=192601'
    ].join(' ')));
  }
  return Promise.reject(new Error('RTCPeerConnection#getStats() not supported'));
}


/**
 * Get the standardized statistics for a particular MediaStreamTrack in Chrome or Safari.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @param {object} options - Used for testing
 * @returns {Promise.<Array<StandardizedTrackStatsReport>>}
 */
function chromeOrSafariGetTrackStats(peerConnection, track, options) {
  const log = options.log;
  if (chromeMajorVersion && chromeMajorVersion < 67) {
    return new Promise((resolve, reject) => {
      peerConnection.getStats(response => {
        resolve([standardizeChromeLegacyStats(response, track)]);
      }, null, reject);
    });
  }

  return peerConnection.getStats(track)
    .then(response => {
      log.info('getStats by track successful');
      return standardizeChromeOrSafariStats(response, options);
    })
    .catch(() => {
      // NOTE(lrivas): Citrix doesn't support track-specific getStats,
      // so this workaround tries getting all stats and filtering by track.
      log.warn('getStats by track failed. Getting default stats');
      return peerConnection.getStats()
        .then(stats => {
          log.info('getStats by default successful');
          const isRemote = isRemoteTrack(peerConnection, track);
          log.info(`Starting filtering stats for ${isRemote ? 'remote' : 'local'} track`);
          const filteredStats = filterStatsByTrack(stats, track, isRemote);
          log.info(`Completed filtering stats for ${isRemote ? 'remote' : 'local'} track`);
          return standardizeChromeOrSafariStats(filteredStats, options);
        });
    });
}

/**
 * Get the standardized statistics for a particular MediaStreamTrack in Firefox.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @param {object} options
 * @returns {Promise.<Array<StandardizedTrackStatsReport>>}
 */
function firefoxGetTrackStats(peerConnection, track, options) {
  return peerConnection.getStats(track).then(response => {
    return [standardizeFirefoxStats(response, options)];
  });
}
/**
 * Standardize the MediaStreamTrack's legacy statistics in Chrome.
 * @param {RTCStatsResponse} response
 * @param {MediaStreamTrack} track
 * @returns {StandardizedTrackStatsReport}
 */
function standardizeChromeLegacyStats(response, track) {
  const ssrcReport = response.result().find(report => {
    return report.type === 'ssrc' && report.stat('googTrackId') === track.id;
  });

  let standardizedStats = {};

  if (ssrcReport) {
    standardizedStats.timestamp = Math.round(Number(ssrcReport.timestamp));
    standardizedStats = ssrcReport.names().reduce((stats, name) => {
      switch (name) {
        case 'googCodecName':
          stats.codecName = ssrcReport.stat(name);
          break;
        case 'googRtt':
          stats.roundTripTime = Number(ssrcReport.stat(name));
          break;
        case 'googJitterReceived':
          stats.jitter = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthInput':
          stats.frameWidthInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightInput':
          stats.frameHeightInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthSent':
          stats.frameWidthSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightSent':
          stats.frameHeightSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameWidthReceived':
          stats.frameWidthReceived = Number(ssrcReport.stat(name));
          break;
        case 'googFrameHeightReceived':
          stats.frameHeightReceived = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateInput':
          stats.frameRateInput = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateSent':
          stats.frameRateSent = Number(ssrcReport.stat(name));
          break;
        case 'googFrameRateReceived':
          stats.frameRateReceived = Number(ssrcReport.stat(name));
          break;
        case 'ssrc':
          stats[name] = ssrcReport.stat(name);
          break;
        case 'bytesReceived':
        case 'bytesSent':
        case 'packetsLost':
        case 'packetsReceived':
        case 'packetsSent':
        case 'audioInputLevel':
        case 'audioOutputLevel':
          stats[name] = Number(ssrcReport.stat(name));
          break;
      }

      return stats;
    }, standardizedStats);
  }

  return standardizedStats;
}

/**
 * Standardize the MediaStreamTrack's statistics in Chrome or Safari.
 * @param {RTCStatsReport} response
 * @param {object} options - Used for testing
 * @returns {Array<StandardizedTrackStatsReport>}
 */
function standardizeChromeOrSafariStats(response, { simulateExceptionWhileStandardizingStats = false }) {
  if (simulateExceptionWhileStandardizingStats) {
    throw new Error('Error while gathering stats');
  }
  let inbound = null;

  // NOTE(mpatwardhan): We should expect more than one "outbound-rtp" stats for a
  // VP8 simulcast MediaStreamTrack.
  const outbound = [];

  let remoteInbound = null;
  let remoteOutbound = null;
  let track = null;
  let codec = null;
  let localMedia = null;

  response.forEach(stat => {
    const { type } = stat;
    switch (type) {
      case 'inbound-rtp':
        inbound = stat;
        break;
      case 'outbound-rtp':
        outbound.push(stat);
        break;
      case 'media-source':
        localMedia = stat;
        break;
      case 'track':
        track = stat;
        break;
      case 'codec':
        codec = stat;
        break;
      case 'remote-inbound-rtp':
        remoteInbound = stat;
        break;
      case 'remote-outbound-rtp':
        remoteOutbound = stat;
        break;
    }
  });

  const isRemote = track ? track.remoteSource : !localMedia;
  const mainSources = isRemote ? [inbound] : outbound;
  const stats = [];
  const remoteSource = isRemote ? remoteOutbound : remoteInbound; // remote rtp stats

  mainSources.forEach(source => {
    const standardizedStats = {};
    const statSources = [
      source, // local rtp stats
      localMedia,
      track,
      codec,
      remoteSource && remoteSource.ssrc === source.ssrc ? remoteSource : null, // remote rtp stats
    ];

    function getStatValue(name) {
      const sourceFound = statSources.find(statSource => {
        return statSource && typeof statSource[name] !== 'undefined';
      }) || null;

      return sourceFound ? sourceFound[name] : null;
    }

    const ssrc = getStatValue('ssrc');
    if (typeof ssrc === 'number') {
      standardizedStats.ssrc = String(ssrc);
    }

    const timestamp = getStatValue('timestamp');
    standardizedStats.timestamp = Math.round(timestamp);

    let mimeType = getStatValue('mimeType');
    if (typeof mimeType === 'string') {
      mimeType = mimeType.split('/');
      standardizedStats.codecName = mimeType[mimeType.length - 1];
    }

    const roundTripTime = getStatValue('roundTripTime');
    if (typeof roundTripTime === 'number') {
      standardizedStats.roundTripTime = Math.round(roundTripTime * 1000);
    }

    const jitter = getStatValue('jitter');
    if (typeof jitter === 'number') {
      standardizedStats.jitter = Math.round(jitter * 1000);
    }

    const frameWidth = getStatValue('frameWidth');
    if (typeof frameWidth === 'number') {
      if (isRemote) {
        standardizedStats.frameWidthReceived = frameWidth;
      } else {
        standardizedStats.frameWidthSent = frameWidth;
        standardizedStats.frameWidthInput = track ? track.frameWidth : localMedia.width;
      }
    }

    const frameHeight = getStatValue('frameHeight');
    if (typeof frameHeight === 'number') {
      if (isRemote) {
        standardizedStats.frameHeightReceived = frameHeight;
      } else {
        standardizedStats.frameHeightSent = frameHeight;
        standardizedStats.frameHeightInput = track ? track.frameHeight : localMedia.height;
      }
    }

    const framesPerSecond = getStatValue('framesPerSecond');
    if (typeof framesPerSecond === 'number') {
      standardizedStats[isRemote ? 'frameRateReceived' : 'frameRateSent'] = framesPerSecond;
    }

    const bytesReceived = getStatValue('bytesReceived');
    if (typeof bytesReceived === 'number') {
      standardizedStats.bytesReceived = bytesReceived;
    }

    const bytesSent = getStatValue('bytesSent');
    if (typeof bytesSent === 'number') {
      standardizedStats.bytesSent = bytesSent;
    }

    const packetsLost = getStatValue('packetsLost');
    if (typeof packetsLost === 'number') {
      standardizedStats.packetsLost = packetsLost;
    }

    const packetsReceived = getStatValue('packetsReceived');
    if (typeof packetsReceived === 'number') {
      standardizedStats.packetsReceived = packetsReceived;
    }

    const packetsSent = getStatValue('packetsSent');
    if (typeof packetsSent === 'number') {
      standardizedStats.packetsSent = packetsSent;
    }

    let audioLevel = getStatValue('audioLevel');
    if (typeof audioLevel === 'number') {
      audioLevel = Math.round(audioLevel * CHROME_LEGACY_MAX_AUDIO_LEVEL);
      if (isRemote) {
        standardizedStats.audioOutputLevel = audioLevel;
      } else {
        standardizedStats.audioInputLevel = audioLevel;
      }
    }

    const totalPacketSendDalay = getStatValue('totalPacketSendDelay');
    if (typeof totalPacketSendDalay === 'number') {
      standardizedStats.totalPacketSendDelay = totalPacketSendDalay;
    }

    const totalEncodeTime = getStatValue('totalEncodeTime');
    if (typeof totalEncodeTime === 'number') {
      standardizedStats.totalEncodeTime = totalEncodeTime;
    }

    const framesEncoded = getStatValue('framesEncoded');
    if (typeof framesEncoded === 'number') {
      standardizedStats.framesEncoded = framesEncoded;
    }

    const estimatedPlayoutTimestamp = getStatValue('estimatedPlayoutTimestamp');
    if (typeof estimatedPlayoutTimestamp === 'number') {
      standardizedStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
    }

    const totalDecodeTime = getStatValue('totalDecodeTime');
    if (typeof totalDecodeTime === 'number') {
      standardizedStats.totalDecodeTime = totalDecodeTime;
    }

    const framesDecoded = getStatValue('framesDecoded');
    if (typeof framesDecoded === 'number') {
      standardizedStats.framesDecoded = framesDecoded;
    }

    const jitterBufferDelay = getStatValue('jitterBufferDelay');
    if (typeof jitterBufferDelay === 'number') {
      standardizedStats.jitterBufferDelay = jitterBufferDelay;
    }

    const jitterBufferEmittedCount = getStatValue('jitterBufferEmittedCount');
    if (typeof jitterBufferEmittedCount === 'number') {
      standardizedStats.jitterBufferEmittedCount = jitterBufferEmittedCount;
    }

    stats.push(standardizedStats);
  });

  return stats;
}

/**
 * Standardize the MediaStreamTrack's statistics in Firefox.
 * @param {RTCStatsReport} response
 * @param {object} options - Used for testing
 * @returns {StandardizedTrackStatsReport}
 */
function standardizeFirefoxStats(response = new Map(), { isRemote, simulateExceptionWhileStandardizingStats = false }) {
  if (simulateExceptionWhileStandardizingStats) {
    throw new Error('Error while gathering stats');
  }
  // NOTE(mroberts): If getStats is called on a closed RTCPeerConnection,
  // Firefox returns undefined instead of an RTCStatsReport. We workaround this
  // here. See the following bug for more details:
  //
  //   https://bugzilla.mozilla.org/show_bug.cgi?id=1377225
  //

  let inbound = null;
  let outbound = null;

  // NOTE(mmalavalli): Starting from Firefox 63, RTC{Inbound, Outbound}RTPStreamStats.isRemote
  // will be deprecated, followed by its removal in Firefox 66. Also, trying to
  // access members of the remote RTC{Inbound, Outbound}RTPStreamStats without
  // using RTCStatsReport.get(remoteId) will trigger console warnings. So, we
  // no longer depend on "isRemote", and we call RTCStatsReport.get(remoteId)
  // to access the remote RTC{Inbound, Outbound}RTPStreamStats.
  //
  // Source: https://blog.mozilla.org/webrtc/getstats-isremote-65/
  //
  response.forEach(stat => {
    const { isRemote, remoteId, type } = stat;
    if (isRemote) {
      return;
    }
    switch (type) {
      case 'inbound-rtp':
        inbound = stat;
        outbound = getStatById(response, remoteId);
        break;
      case 'outbound-rtp':
        outbound = stat;
        inbound = getStatById(response, remoteId);
        break;
    }
  });

  const first = isRemote ? inbound : outbound;
  const second = isRemote ? outbound : inbound;

  function getStatValue(name) {
    if (first && typeof first[name] !== 'undefined') {
      return first[name];
    }
    if (second && typeof second[name] !== 'undefined') {
      return second[name];
    }
    return null;
  }

  const standardizedStats = {};
  const timestamp = getStatValue('timestamp');
  standardizedStats.timestamp = Math.round(timestamp);

  const ssrc = getStatValue('ssrc');
  if (typeof ssrc === 'number') {
    standardizedStats.ssrc = String(ssrc);
  }

  const bytesSent = getStatValue('bytesSent');
  if (typeof bytesSent === 'number') {
    standardizedStats.bytesSent = bytesSent;
  }

  const packetsLost = getStatValue('packetsLost');
  if (typeof packetsLost === 'number') {
    standardizedStats.packetsLost = packetsLost;
  }

  const packetsSent = getStatValue('packetsSent');
  if (typeof packetsSent === 'number') {
    standardizedStats.packetsSent = packetsSent;
  }

  const roundTripTime = getStatValue('roundTripTime');
  if (typeof roundTripTime === 'number') {
    // roundTripTime is double - measured in seconds.
    // https://www.w3.org/TR/webrtc-stats/#dom-rtcremoteinboundrtpstreamstats-roundtriptime
    // cover it to milliseconds (and make it integer)
    standardizedStats.roundTripTime = Math.round(roundTripTime * 1000);
  }

  const jitter = getStatValue('jitter');
  if (typeof jitter === 'number') {
    standardizedStats.jitter = Math.round(jitter * 1000);
  }

  const frameRateSent = getStatValue('framerateMean');
  if (typeof frameRateSent === 'number') {
    standardizedStats.frameRateSent = Math.round(frameRateSent);
  }

  const bytesReceived = getStatValue('bytesReceived');
  if (typeof bytesReceived === 'number') {
    standardizedStats.bytesReceived = bytesReceived;
  }

  const packetsReceived = getStatValue('packetsReceived');
  if (typeof packetsReceived === 'number') {
    standardizedStats.packetsReceived = packetsReceived;
  }

  const frameRateReceived = getStatValue('framerateMean');
  if (typeof frameRateReceived === 'number') {
    standardizedStats.frameRateReceived = Math.round(frameRateReceived);
  }

  const totalPacketSendDalay = getStatValue('totalPacketSendDelay');
  if (typeof totalPacketSendDalay === 'number') {
    standardizedStats.totalPacketSendDelay = totalPacketSendDalay;
  }

  const totalEncodeTime = getStatValue('totalEncodeTime');
  if (typeof totalEncodeTime === 'number') {
    standardizedStats.totalEncodeTime = totalEncodeTime;
  }

  const framesEncoded = getStatValue('framesEncoded');
  if (typeof framesEncoded === 'number') {
    standardizedStats.framesEncoded = framesEncoded;
  }

  const estimatedPlayoutTimestamp = getStatValue('estimatedPlayoutTimestamp');
  if (typeof estimatedPlayoutTimestamp === 'number') {
    standardizedStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
  }

  const totalDecodeTime = getStatValue('totalDecodeTime');
  if (typeof totalDecodeTime === 'number') {
    standardizedStats.totalDecodeTime = totalDecodeTime;
  }

  const framesDecoded = getStatValue('framesDecoded');
  if (typeof framesDecoded === 'number') {
    standardizedStats.framesDecoded = framesDecoded;
  }

  const jitterBufferDelay = getStatValue('jitterBufferDelay');
  if (typeof jitterBufferDelay === 'number') {
    standardizedStats.jitterBufferDelay = jitterBufferDelay;
  }

  const jitterBufferEmittedCount = getStatValue('jitterBufferEmittedCount');
  if (typeof jitterBufferEmittedCount === 'number') {
    standardizedStats.jitterBufferEmittedCount = jitterBufferEmittedCount;
  }

  return standardizedStats;
}

/**
 * Standardized RTCIceCandidate statistics.
 * @typedef {object} StandardizedIceCandidateStatsReport
 * @property {'host'|'prflx'|'relay'|'srflx'} candidateType
 * @property {string} ip
 * @property {number} port
 * @property {number} priority
 * @property {'tcp'|'udp'} protocol
 * @property {string} url
 */

/**
 * Standardized local RTCIceCandidate statistics.
 * @typedef {StandardizedIceCandidateStatsReport} StandardizedLocalIceCandidateStatsReport
 * @property {boolean} [deleted=false]
 * @property {'tcp'|'tls'|'udp'} relayProtocol
 */

/**
 * Standardized active RTCIceCandidate pair statistics.
 * @typedef {object} StandardizedActiveIceCandidatePairStatsReport
 * @property {number} availableIncomingBitrate
 * @property {number} availableOutgoingBitrate
 * @property {number} bytesReceived
 * @property {number} bytesSent
 * @property {number} consentRequestsSent
 * @property {number} currentRoundTripTime
 * @property {number} lastPacketReceivedTimestamp
 * @property {number} lastPacketSentTimestamp
 * @property {StandardizedLocalIceCandidateStatsReport} localCandidate
 * @property {boolean} nominated
 * @property {number} priority
 * @property {boolean} readable
 * @property {StandardizedIceCandidateStatsReport} remoteCandidate
 * @property {number} requestsReceived
 * @property {number} requestsSent
 * @property {number} responsesReceived
 * @property {number} responsesSent
 * @property {number} retransmissionsReceived
 * @property {number} retransmissionsSent
 * @property {'frozen'|'waiting'|'in-progress'|'failed'|'succeeded'} state
 * @property {number} totalRoundTripTime
 * @property {string} transportId
 * @property {boolean} writable
 */

/**
 * Standardized {@link RTCPeerConnection} statistics.
 * @typedef {Object} StandardizedStatsResponse
 * @property {StandardizedActiveIceCandidatePairStatsReport} activeIceCandidatePair - Stats for active ICE candidate pair
 * @property Array<StandardizedTrackStatsReport> localAudioTrackStats - Stats for local audio MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> localVideoTrackStats - Stats for local video MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> remoteAudioTrackStats - Stats for remote audio MediaStreamTracks
 * @property Array<StandardizedTrackStatsReport> remoteVideoTrackStats - Stats for remote video MediaStreamTracks
 */

/**
 * Standardized MediaStreamTrack statistics.
 * @typedef {Object} StandardizedTrackStatsReport
 * @property {string} trackId - MediaStreamTrack ID
 * @property {string} ssrc - SSRC of the MediaStreamTrack
 * @property {number} timestamp - The Unix timestamp in milliseconds
 * @property {string} [codecName] - Name of the codec used to encode the MediaStreamTrack's media
 * @property {number} [roundTripTime] - Round trip time in milliseconds
 * @property {number} [jitter] - Jitter in milliseconds
 * @property {number} [frameWidthInput] - Width in pixels of the local video MediaStreamTrack's captured frame
 * @property {number} [frameHeightInput] - Height in pixels of the local video MediaStreamTrack's captured frame
 * @property {number} [frameWidthSent] - Width in pixels of the local video MediaStreamTrack's encoded frame
 * @property {number} [frameHeightSent] - Height in pixels of the local video MediaStreamTrack's encoded frame
 * @property {number} [frameWidthReceived] - Width in pixels of the remote video MediaStreamTrack's received frame
 * @property {number} [frameHeightReceived] - Height in pixels of the remote video MediaStreamTrack's received frame
 * @property {number} [frameRateInput] - Captured frames per second of the local video MediaStreamTrack
 * @property {number} [frameRateSent] - Frames per second of the local video MediaStreamTrack's encoded video
 * @property {number} [frameRateReceived] - Frames per second of the remote video MediaStreamTrack's received video
 * @property {number} [bytesReceived] - Number of bytes of the remote MediaStreamTrack's media received
 * @property {number} [bytesSent] - Number of bytes of the local MediaStreamTrack's media sent
 * @property {number} [packetsLost] - Number of packets of the MediaStreamTrack's media lost
 * @property {number} [packetsReceived] - Number of packets of the remote MediaStreamTrack's media received
 * @property {number} [packetsSent] - Number of packets of the local MediaStreamTrack's media sent
 * @property {number} [totalPacketSendDelay] - The total number of seconds that the local MediaStreamTrack's packets
 *  have spent buffered locally before being sent over the network
 * @property {number} [totalEncodeTime] - The total number of seconds spent on encoding the local MediaStreamTrack's frames
 * @property {number} [framesEncoded] - The total number of frames of the local MediaStreamTrack that have been encoded sor far
 * @property {number} [estimatedPlayoutTimestamp] - The estimated playout time of the remote MediaStreamTrack
 * @property {number} [totalDecodeTime] - The total number of seconds spent on decoding the remote MediaStreamTrack's frames
 * @property {number} [framesDecoded] - The total number of frames of the remote MediaStreamTrack that have been decoded sor far
 * @property {number} [jitterBufferDelay] - The sum of the time, in seconds, each audio sample or a video frame of the remote
 *   MediaStreamTrack takes from the time the first packet is received by the jitter buffer to the time it exits the jitter buffer
 * @property {number} [jitterBufferEmittedCount] - The total number of audio samples or video frames that have come out of the jitter buffer
 * @property {AudioLevel} [audioInputLevel] - The {@link AudioLevel} of the local audio MediaStreamTrack
 * @property {AudioLevel} [audioOutputLevel] - The {@link AudioLevel} of the remote video MediaStreamTrack
 */

module.exports = getStats;
