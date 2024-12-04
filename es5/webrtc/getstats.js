'use strict';
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var _a = require('./util'), flatMap = _a.flatMap, guessBrowser = _a.guessBrowser, guessBrowserVersion = _a.guessBrowserVersion;
var getSdpFormat = require('./util/sdp').getSdpFormat;
var guess = guessBrowser();
var guessVersion = guessBrowserVersion();
var isChrome = guess === 'chrome';
var isFirefox = guess === 'firefox';
var isSafari = guess === 'safari';
var chromeMajorVersion = isChrome ? guessVersion.major : null;
var CHROME_LEGACY_MAX_AUDIO_LEVEL = 32767;
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
    var localAudioTracks = getTracks(peerConnection, 'audio', 'local');
    var localVideoTracks = getTracks(peerConnection, 'video', 'local');
    var remoteAudioTracks = getTracks(peerConnection, 'audio');
    var remoteVideoTracks = getTracks(peerConnection, 'video');
    var statsResponse = {
        activeIceCandidatePair: null,
        localAudioTrackStats: [],
        localVideoTrackStats: [],
        remoteAudioTrackStats: [],
        remoteVideoTrackStats: []
    };
    var trackStatsPromises = flatMap([
        [localAudioTracks, 'localAudioTrackStats', false],
        [localVideoTracks, 'localVideoTrackStats', false],
        [remoteAudioTracks, 'remoteAudioTrackStats', true],
        [remoteVideoTracks, 'remoteVideoTrackStats', true]
    ], function (_a) {
        var _b = __read(_a, 3), tracks = _b[0], statsArrayName = _b[1], isRemote = _b[2];
        return tracks.map(function (track) {
            return getTrackStats(peerConnection, track, Object.assign({ isRemote: isRemote }, options)).then(function (trackStatsArray) {
                trackStatsArray.forEach(function (trackStats) {
                    trackStats.trackId = track.id;
                    statsResponse[statsArrayName].push(trackStats);
                });
            });
        });
    });
    return Promise.all(trackStatsPromises).then(function () {
        return getActiveIceCandidatePairStats(peerConnection, options);
    }).then(function (activeIceCandidatePairStatsReport) {
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
function getActiveIceCandidatePairStats(peerConnection, options) {
    if (options === void 0) { options = {}; }
    if (typeof options.testForChrome !== 'undefined' || isChrome
        || typeof options.testForSafari !== 'undefined' || isSafari) {
        return peerConnection.getStats().then(standardizeChromeOrSafariActiveIceCandidatePairStats);
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
    var activeCandidatePairStats = Array.from(stats.values()).find(function (_a) {
        var nominated = _a.nominated, type = _a.type;
        return type === 'candidate-pair' && nominated;
    });
    if (!activeCandidatePairStats) {
        return null;
    }
    var activeLocalCandidateStats = stats.get(activeCandidatePairStats.localCandidateId);
    var activeRemoteCandidateStats = stats.get(activeCandidatePairStats.remoteCandidateId);
    var standardizedCandidateStatsKeys = [
        { key: 'candidateType', type: 'string' },
        { key: 'ip', type: 'string' },
        { key: 'port', type: 'number' },
        { key: 'priority', type: 'number' },
        { key: 'protocol', type: 'string' },
        { key: 'url', type: 'string' }
    ];
    var standardizedLocalCandidateStatsKeys = standardizedCandidateStatsKeys.concat([
        { key: 'deleted', type: 'boolean' },
        { key: 'relayProtocol', type: 'string' }
    ]);
    var standatdizedLocalCandidateStatsReport = activeLocalCandidateStats
        ? standardizedLocalCandidateStatsKeys.reduce(function (report, _a) {
            var key = _a.key, type = _a.type;
            report[key] = typeof activeLocalCandidateStats[key] === type
                ? activeLocalCandidateStats[key]
                : key === 'deleted' ? false : null;
            return report;
        }, {})
        : null;
    var standardizedRemoteCandidateStatsReport = activeRemoteCandidateStats
        ? standardizedCandidateStatsKeys.reduce(function (report, _a) {
            var key = _a.key, type = _a.type;
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
        { key: 'state', type: 'string', fixup: function (state) { return state === 'inprogress' ? 'in-progress' : state; } },
        { key: 'totalRoundTripTime', type: 'number' },
        { key: 'transportId', type: 'string' },
        { key: 'writable', type: 'boolean' }
    ].reduce(function (report, _a) {
        var key = _a.key, type = _a.type, fixup = _a.fixup;
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
    var activeCandidatePairStats = Array.from(stats.values()).find(function (_a) {
        var nominated = _a.nominated, type = _a.type;
        return type === 'candidate-pair' && nominated;
    });
    if (!activeCandidatePairStats) {
        return null;
    }
    var activeLocalCandidateStats = stats.get(activeCandidatePairStats.localCandidateId);
    var activeRemoteCandidateStats = stats.get(activeCandidatePairStats.remoteCandidateId);
    var standardizedCandidateStatsKeys = [
        { key: 'candidateType', type: 'string' },
        { key: 'ip', ffKeys: ['address', 'ipAddress'], type: 'string' },
        { key: 'port', ffKeys: ['portNumber'], type: 'number' },
        { key: 'priority', type: 'number' },
        { key: 'protocol', ffKeys: ['transport'], type: 'string' },
        { key: 'url', type: 'string' }
    ];
    var standardizedLocalCandidateStatsKeys = standardizedCandidateStatsKeys.concat([
        { key: 'deleted', type: 'boolean' },
        { key: 'relayProtocol', type: 'string' }
    ]);
    var candidateTypes = {
        host: 'host',
        peerreflexive: 'prflx',
        relayed: 'relay',
        serverreflexive: 'srflx'
    };
    var standatdizedLocalCandidateStatsReport = activeLocalCandidateStats
        ? standardizedLocalCandidateStatsKeys.reduce(function (report, _a) {
            var ffKeys = _a.ffKeys, key = _a.key, type = _a.type;
            var localStatKey = ffKeys && ffKeys.find(function (key) { return key in activeLocalCandidateStats; }) || key;
            report[key] = typeof activeLocalCandidateStats[localStatKey] === type
                ? localStatKey === 'candidateType'
                    ? candidateTypes[activeLocalCandidateStats[localStatKey]] || activeLocalCandidateStats[localStatKey]
                    : activeLocalCandidateStats[localStatKey]
                : localStatKey === 'deleted' ? false : null;
            return report;
        }, {})
        : null;
    var standardizedRemoteCandidateStatsReport = activeRemoteCandidateStats
        ? standardizedCandidateStatsKeys.reduce(function (report, _a) {
            var ffKeys = _a.ffKeys, key = _a.key, type = _a.type;
            var remoteStatKey = ffKeys && ffKeys.find(function (key) { return key in activeRemoteCandidateStats; }) || key;
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
    ].reduce(function (report, _a) {
        var key = _a.key, type = _a.type;
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
    var getSendersOrReceivers = localOrRemote === 'local' ? 'getSenders' : 'getReceivers';
    if (peerConnection[getSendersOrReceivers]) {
        return peerConnection[getSendersOrReceivers]()
            .map(function (_a) {
            var track = _a.track;
            return track;
        })
            .filter(function (track) { return track && track.kind === kind; });
    }
    var getStreams = localOrRemote === 'local' ? 'getLocalStreams' : 'getRemoteStreams';
    var getTracks = kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';
    return flatMap(peerConnection[getStreams](), function (stream) { return stream[getTracks](); });
}
/**
 * Get the standardized statistics for a particular MediaStreamTrack.
 * @param {RTCPeerConnection} peerConnection
 * @param {MediaStreamTrack} track
 * @param {object} [options] - Used for testing
 * @returns {Promise.<Array<StandardizedTrackStatsReport>>}
 */
function getTrackStats(peerConnection, track, options) {
    if (options === void 0) { options = {}; }
    if (typeof options.testForChrome !== 'undefined' || isChrome) {
        return chromeOrSafariGetTrackStats(peerConnection, track, options);
    }
    if (typeof options.testForFirefox !== 'undefined' || isFirefox) {
        return firefoxGetTrackStats(peerConnection, track, options);
    }
    if (typeof options.testForSafari !== 'undefined' || isSafari) {
        if (typeof options.testForSafari !== 'undefined' || getSdpFormat() === 'unified') {
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
    if (chromeMajorVersion && chromeMajorVersion < 67) {
        return new Promise(function (resolve, reject) {
            peerConnection.getStats(function (response) {
                resolve([standardizeChromeLegacyStats(response, track)]);
            }, null, reject);
        });
    }
    return peerConnection.getStats(track).then(function (response) {
        return standardizeChromeOrSafariStats(response, options);
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
    return peerConnection.getStats(track).then(function (response) {
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
    var ssrcReport = response.result().find(function (report) {
        return report.type === 'ssrc' && report.stat('googTrackId') === track.id;
    });
    var standardizedStats = {};
    if (ssrcReport) {
        standardizedStats.timestamp = Math.round(Number(ssrcReport.timestamp));
        standardizedStats = ssrcReport.names().reduce(function (stats, name) {
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
 * @param {RTCStatsResponse} response
 * @param {object} options - Used for testing
 * @returns {Array<StandardizedTrackStatsReport>}
 */
function standardizeChromeOrSafariStats(response, _a) {
    var _b = _a.simulateExceptionWhileStandardizingStats, simulateExceptionWhileStandardizingStats = _b === void 0 ? false : _b;
    if (simulateExceptionWhileStandardizingStats) {
        throw new Error('Error while gathering stats');
    }
    var inbound = null;
    // NOTE(mpatwardhan): We should expect more than one "outbound-rtp" stats for a
    // VP8 simulcast MediaStreamTrack.
    var outbound = [];
    var remoteInbound = null;
    var remoteOutbound = null;
    var track = null;
    var codec = null;
    var localMedia = null;
    response.forEach(function (stat) {
        var type = stat.type;
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
    var isRemote = track ? track.remoteSource : !localMedia;
    var mainSources = isRemote ? [inbound] : outbound;
    var stats = [];
    var remoteSource = isRemote ? remoteOutbound : remoteInbound; // remote rtp stats
    mainSources.forEach(function (source) {
        var standardizedStats = {};
        var statSources = [
            source,
            localMedia,
            track,
            codec,
            remoteSource && remoteSource.ssrc === source.ssrc ? remoteSource : null, // remote rtp stats
        ];
        function getStatValue(name) {
            var sourceFound = statSources.find(function (statSource) {
                return statSource && typeof statSource[name] !== 'undefined';
            }) || null;
            return sourceFound ? sourceFound[name] : null;
        }
        var ssrc = getStatValue('ssrc');
        if (typeof ssrc === 'number') {
            standardizedStats.ssrc = String(ssrc);
        }
        var timestamp = getStatValue('timestamp');
        standardizedStats.timestamp = Math.round(timestamp);
        var mimeType = getStatValue('mimeType');
        if (typeof mimeType === 'string') {
            mimeType = mimeType.split('/');
            standardizedStats.codecName = mimeType[mimeType.length - 1];
        }
        var roundTripTime = getStatValue('roundTripTime');
        if (typeof roundTripTime === 'number') {
            standardizedStats.roundTripTime = Math.round(roundTripTime * 1000);
        }
        var jitter = getStatValue('jitter');
        if (typeof jitter === 'number') {
            standardizedStats.jitter = Math.round(jitter * 1000);
        }
        var frameWidth = getStatValue('frameWidth');
        if (typeof frameWidth === 'number') {
            if (isRemote) {
                standardizedStats.frameWidthReceived = frameWidth;
            }
            else {
                standardizedStats.frameWidthSent = frameWidth;
                standardizedStats.frameWidthInput = track ? track.frameWidth : localMedia.width;
            }
        }
        var frameHeight = getStatValue('frameHeight');
        if (typeof frameHeight === 'number') {
            if (isRemote) {
                standardizedStats.frameHeightReceived = frameHeight;
            }
            else {
                standardizedStats.frameHeightSent = frameHeight;
                standardizedStats.frameHeightInput = track ? track.frameHeight : localMedia.height;
            }
        }
        var framesPerSecond = getStatValue('framesPerSecond');
        if (typeof framesPerSecond === 'number') {
            standardizedStats[isRemote ? 'frameRateReceived' : 'frameRateSent'] = framesPerSecond;
        }
        var bytesReceived = getStatValue('bytesReceived');
        if (typeof bytesReceived === 'number') {
            standardizedStats.bytesReceived = bytesReceived;
        }
        var bytesSent = getStatValue('bytesSent');
        if (typeof bytesSent === 'number') {
            standardizedStats.bytesSent = bytesSent;
        }
        var packetsLost = getStatValue('packetsLost');
        if (typeof packetsLost === 'number') {
            standardizedStats.packetsLost = packetsLost;
        }
        var packetsReceived = getStatValue('packetsReceived');
        if (typeof packetsReceived === 'number') {
            standardizedStats.packetsReceived = packetsReceived;
        }
        var packetsSent = getStatValue('packetsSent');
        if (typeof packetsSent === 'number') {
            standardizedStats.packetsSent = packetsSent;
        }
        var audioLevel = getStatValue('audioLevel');
        if (typeof audioLevel === 'number') {
            audioLevel = Math.round(audioLevel * CHROME_LEGACY_MAX_AUDIO_LEVEL);
            if (isRemote) {
                standardizedStats.audioOutputLevel = audioLevel;
            }
            else {
                standardizedStats.audioInputLevel = audioLevel;
            }
        }
        var totalPacketSendDalay = getStatValue('totalPacketSendDelay');
        if (typeof totalPacketSendDalay === 'number') {
            standardizedStats.totalPacketSendDelay = totalPacketSendDalay;
        }
        var totalEncodeTime = getStatValue('totalEncodeTime');
        if (typeof totalEncodeTime === 'number') {
            standardizedStats.totalEncodeTime = totalEncodeTime;
        }
        var framesEncoded = getStatValue('framesEncoded');
        if (typeof framesEncoded === 'number') {
            standardizedStats.framesEncoded = framesEncoded;
        }
        var estimatedPlayoutTimestamp = getStatValue('estimatedPlayoutTimestamp');
        if (typeof estimatedPlayoutTimestamp === 'number') {
            standardizedStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
        }
        var totalDecodeTime = getStatValue('totalDecodeTime');
        if (typeof totalDecodeTime === 'number') {
            standardizedStats.totalDecodeTime = totalDecodeTime;
        }
        var framesDecoded = getStatValue('framesDecoded');
        if (typeof framesDecoded === 'number') {
            standardizedStats.framesDecoded = framesDecoded;
        }
        var jitterBufferDelay = getStatValue('jitterBufferDelay');
        if (typeof jitterBufferDelay === 'number') {
            standardizedStats.jitterBufferDelay = jitterBufferDelay;
        }
        var jitterBufferEmittedCount = getStatValue('jitterBufferEmittedCount');
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
function standardizeFirefoxStats(response, _a) {
    if (response === void 0) { response = new Map(); }
    var isRemote = _a.isRemote, _b = _a.simulateExceptionWhileStandardizingStats, simulateExceptionWhileStandardizingStats = _b === void 0 ? false : _b;
    if (simulateExceptionWhileStandardizingStats) {
        throw new Error('Error while gathering stats');
    }
    // NOTE(mroberts): If getStats is called on a closed RTCPeerConnection,
    // Firefox returns undefined instead of an RTCStatsReport. We workaround this
    // here. See the following bug for more details:
    //
    //   https://bugzilla.mozilla.org/show_bug.cgi?id=1377225
    //
    var inbound = null;
    var outbound = null;
    // NOTE(mmalavalli): Starting from Firefox 63, RTC{Inbound, Outbound}RTPStreamStats.isRemote
    // will be deprecated, followed by its removal in Firefox 66. Also, trying to
    // access members of the remote RTC{Inbound, Outbound}RTPStreamStats without
    // using RTCStatsReport.get(remoteId) will trigger console warnings. So, we
    // no longer depend on "isRemote", and we call RTCStatsReport.get(remoteId)
    // to access the remote RTC{Inbound, Outbound}RTPStreamStats.
    //
    // Source: https://blog.mozilla.org/webrtc/getstats-isremote-65/
    //
    response.forEach(function (stat) {
        var isRemote = stat.isRemote, remoteId = stat.remoteId, type = stat.type;
        if (isRemote) {
            return;
        }
        switch (type) {
            case 'inbound-rtp':
                inbound = stat;
                outbound = response.get(remoteId);
                break;
            case 'outbound-rtp':
                outbound = stat;
                inbound = response.get(remoteId);
                break;
        }
    });
    var first = isRemote ? inbound : outbound;
    var second = isRemote ? outbound : inbound;
    function getStatValue(name) {
        if (first && typeof first[name] !== 'undefined') {
            return first[name];
        }
        if (second && typeof second[name] !== 'undefined') {
            return second[name];
        }
        return null;
    }
    var standardizedStats = {};
    var timestamp = getStatValue('timestamp');
    standardizedStats.timestamp = Math.round(timestamp);
    var ssrc = getStatValue('ssrc');
    if (typeof ssrc === 'number') {
        standardizedStats.ssrc = String(ssrc);
    }
    var bytesSent = getStatValue('bytesSent');
    if (typeof bytesSent === 'number') {
        standardizedStats.bytesSent = bytesSent;
    }
    var packetsLost = getStatValue('packetsLost');
    if (typeof packetsLost === 'number') {
        standardizedStats.packetsLost = packetsLost;
    }
    var packetsSent = getStatValue('packetsSent');
    if (typeof packetsSent === 'number') {
        standardizedStats.packetsSent = packetsSent;
    }
    var roundTripTime = getStatValue('roundTripTime');
    if (typeof roundTripTime === 'number') {
        // roundTripTime is double - measured in seconds.
        // https://www.w3.org/TR/webrtc-stats/#dom-rtcremoteinboundrtpstreamstats-roundtriptime
        // cover it to milliseconds (and make it integer)
        standardizedStats.roundTripTime = Math.round(roundTripTime * 1000);
    }
    var jitter = getStatValue('jitter');
    if (typeof jitter === 'number') {
        standardizedStats.jitter = Math.round(jitter * 1000);
    }
    var frameRateSent = getStatValue('framerateMean');
    if (typeof frameRateSent === 'number') {
        standardizedStats.frameRateSent = Math.round(frameRateSent);
    }
    var bytesReceived = getStatValue('bytesReceived');
    if (typeof bytesReceived === 'number') {
        standardizedStats.bytesReceived = bytesReceived;
    }
    var packetsReceived = getStatValue('packetsReceived');
    if (typeof packetsReceived === 'number') {
        standardizedStats.packetsReceived = packetsReceived;
    }
    var frameRateReceived = getStatValue('framerateMean');
    if (typeof frameRateReceived === 'number') {
        standardizedStats.frameRateReceived = Math.round(frameRateReceived);
    }
    var totalPacketSendDalay = getStatValue('totalPacketSendDelay');
    if (typeof totalPacketSendDalay === 'number') {
        standardizedStats.totalPacketSendDelay = totalPacketSendDalay;
    }
    var totalEncodeTime = getStatValue('totalEncodeTime');
    if (typeof totalEncodeTime === 'number') {
        standardizedStats.totalEncodeTime = totalEncodeTime;
    }
    var framesEncoded = getStatValue('framesEncoded');
    if (typeof framesEncoded === 'number') {
        standardizedStats.framesEncoded = framesEncoded;
    }
    var estimatedPlayoutTimestamp = getStatValue('estimatedPlayoutTimestamp');
    if (typeof estimatedPlayoutTimestamp === 'number') {
        standardizedStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
    }
    var totalDecodeTime = getStatValue('totalDecodeTime');
    if (typeof totalDecodeTime === 'number') {
        standardizedStats.totalDecodeTime = totalDecodeTime;
    }
    var framesDecoded = getStatValue('framesDecoded');
    if (typeof framesDecoded === 'number') {
        standardizedStats.framesDecoded = framesDecoded;
    }
    var jitterBufferDelay = getStatValue('jitterBufferDelay');
    if (typeof jitterBufferDelay === 'number') {
        standardizedStats.jitterBufferDelay = jitterBufferDelay;
    }
    var jitterBufferEmittedCount = getStatValue('jitterBufferEmittedCount');
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
//# sourceMappingURL=getstats.js.map