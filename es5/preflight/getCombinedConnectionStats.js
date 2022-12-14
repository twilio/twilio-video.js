"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCombinedConnectionStats = void 0;
function getStatValues(report, statName, kind, reportTypes) {
    var results = [];
    report.forEach(function (stat) {
        if ((reportTypes.length === 0 || reportTypes.includes(stat.type)) &&
            (kind.length === 0 || kind.includes(stat.kind)) &&
            typeof stat[statName] === 'number') {
            results.push(stat[statName]);
        }
    });
    return results;
}
function getCombinedConnectionStats(_a) {
    var publisher = _a.publisher, subscriber = _a.subscriber;
    return __awaiter(this, void 0, void 0, function () {
        var _b, publisherStats, subscriberStats, timestamps, timestamp, jitter, packets, packetsLost, trackRoundTripTime, currentRoundTripTime, roundTripTime, bytesSent, bytesReceived, selectedIceCandidatePairStats, iceCandidateStats;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0: return [4 /*yield*/, Promise.all([publisher, subscriber].map(function (pc) { return pc.getStats(); }))];
                case 1:
                    _b = __read.apply(void 0, [_c.sent(), 2]), publisherStats = _b[0], subscriberStats = _b[1];
                    timestamps = getStatValues(subscriberStats, 'timestamp', ['audio'], ['inbound-rtp']);
                    timestamp = timestamps.length > 0 ? timestamps[0] : 0;
                    jitter = getStatValues(subscriberStats, 'jitter', ['audio'], ['inbound-rtp']).reduce(function (a, b) { return Math.max(a, b); }, 0);
                    packets = getStatValues(subscriberStats, 'packetsReceived', ['audio', 'video'], ['inbound-rtp']).reduce(function (a, b) { return a + b; }, 0);
                    packetsLost = getStatValues(subscriberStats, 'packetsLost', ['audio', 'video'], ['inbound-rtp']).reduce(function (a, b) { return a + b; }, 0);
                    trackRoundTripTime = getStatValues(publisherStats, 'roundTripTime', ['audio', 'video'], ['remote-inbound-rtp']).reduce(function (a, b) { return Math.max(a, b); }, 0);
                    currentRoundTripTime = getStatValues(subscriberStats, 'currentRoundTripTime', [], ['candidate-pair']).reduce(function (a, b) { return Math.max(a, b); }, 0);
                    roundTripTime = (currentRoundTripTime || trackRoundTripTime) * 1000;
                    bytesSent = getStatValues(publisherStats, 'bytesSent', [], ['candidate-pair']).reduce(function (a, b) { return a + b; }, 0);
                    bytesReceived = getStatValues(subscriberStats, 'bytesReceived', [], ['candidate-pair']).reduce(function (a, b) { return a + b; }, 0);
                    selectedIceCandidatePairStats = extractSelectedActiveCandidatePair(subscriberStats);
                    iceCandidateStats = [];
                    subscriberStats.forEach(function (stat) {
                        if (stat.type === 'local-candidate' || stat.type === 'remote-candidate') {
                            iceCandidateStats.push(makeStandardCandidateStats(stat));
                        }
                    });
                    return [2 /*return*/, { timestamp: timestamp, jitter: jitter, packets: packets, packetsLost: packetsLost, roundTripTime: roundTripTime, bytesSent: bytesSent, bytesReceived: bytesReceived, selectedIceCandidatePairStats: selectedIceCandidatePairStats, iceCandidateStats: iceCandidateStats }];
            }
        });
    });
}
exports.getCombinedConnectionStats = getCombinedConnectionStats;
function makeStandardCandidateStats(input) {
    var standardizedCandidateStatsKeys = [
        { key: 'transportId', type: 'string' },
        { key: 'candidateType', type: 'string' },
        { key: 'port', altKeys: ['portNumber'], type: 'number' },
        { key: 'address', altKeys: ['ip', 'ipAddress'], type: 'string' },
        { key: 'priority', type: 'number' },
        { key: 'protocol', altKeys: ['transport'], type: 'string' },
        { key: 'url', type: 'string' },
        { key: 'relayProtocol', type: 'string' },
    ];
    return standardizedCandidateStatsKeys.reduce(function (report, keyInfo) {
        var keysToLookFor = [keyInfo.key];
        if (keyInfo.altKeys) {
            keysToLookFor = keysToLookFor.concat(keyInfo.altKeys);
        }
        var key = keysToLookFor.find(function (key) { return key in input; });
        if (key && typeof input[key] === keyInfo.type) {
            report[keyInfo.key] = input[key];
        }
        return report;
    }, {});
}
function extractSelectedActiveCandidatePair(stats) {
    var selectedCandidatePairId = null;
    var candidatePairs = [];
    stats.forEach(function (stat) {
        if (stat.type === 'transport' && stat.selectedCandidatePairId) {
            selectedCandidatePairId = stat.selectedCandidatePairId;
        }
        else if (stat.type === 'candidate-pair') {
            candidatePairs.push(stat);
        }
    });
    var activeCandidatePairStatsFound = candidatePairs.find(function (pair) {
        // Firefox
        return pair.selected ||
            // Spec-compliant way
            (selectedCandidatePairId && pair.id === selectedCandidatePairId);
    });
    if (!activeCandidatePairStatsFound) {
        return null;
    }
    var activeCandidatePairStats = activeCandidatePairStatsFound;
    var activeLocalCandidateStats = stats.get(activeCandidatePairStats.localCandidateId);
    var activeRemoteCandidateStats = stats.get(activeCandidatePairStats.remoteCandidateId);
    if (!activeLocalCandidateStats || !activeRemoteCandidateStats) {
        return null;
    }
    return {
        localCandidate: makeStandardCandidateStats(activeLocalCandidateStats),
        remoteCandidate: makeStandardCandidateStats(activeRemoteCandidateStats)
    };
}
//# sourceMappingURL=getCombinedConnectionStats.js.map