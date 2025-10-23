'use strict';
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
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
var StatsReport = require('../stats/statsreport');
var MovingAverageDelta = require('../util/movingaveragedelta');
var _a = require('../util'), filterObject = _a.filterObject, flatMap = _a.flatMap, difference = _a.difference;
var telemetry = require('./telemetry');
/**
 * StatsMonitor analyzes WebRTC statistics and publishes insights events.
 * @internal
 */
var StatsMonitor = /** @class */ (function () {
    /**
     * Create a StatsMonitor
     * @param {Object} statsSource - An object that provides getStats() method
     * @param {Log} log - Logger instance
     * @param {Object} [options] - Configuration options
     * @param {number} [options.publishIntervalMs=10000] - Interval for publishing stats reports
     * @param {number} [options.collectionIntervalMs=1000] - Interval for collecting stats
     */
    function StatsMonitor(statsSource, log, options) {
        if (options === void 0) { options = {}; }
        if (!statsSource || typeof statsSource.getStats !== 'function') {
            throw new Error('StatsMonitor requires a stats source with getStats() method');
        }
        if (!log) {
            throw new Error('StatsMonitor requires a log instance');
        }
        this._statsSource = statsSource;
        this._log = log;
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
    StatsMonitor.prototype._initializeState = function () {
        this._movingAverageDeltas = new Map();
        this._interval = null;
        this._statsCollectionCount = 0;
        this._iceCandidatePublishToggle = false;
        this._hasSeenActivePair = false;
        this._lastNetworkType = null;
        this._lastQualityLimitationReasonByTrackSid = new Map();
        this._stalledTrackSids = new Set();
    };
    /**
     * Start periodic stats collection and analysis
     * @private
     */
    StatsMonitor.prototype._startStatsCollection = function () {
        var _this = this;
        if (this._interval) {
            this._log.warn('StatsMonitor already started');
            return;
        }
        this._interval = setInterval(function () { return __awaiter(_this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._collectAndAnalyzeStats()];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        }); }, this._collectionIntervalMs);
        this._log.debug('StatsMonitor started');
    };
    /**
     * Stop stats collection
     * @private
     */
    StatsMonitor.prototype._stopStatsCollection = function () {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        this._log.debug('StatsMonitor stopped');
    };
    /**
     * Collect stats and analyze them
     * @private
     */
    StatsMonitor.prototype._collectAndAnalyzeStats = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stats, shouldPublishStatsReport, shouldPublishIceCandidate, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 2, , 3]);
                        return [4 /*yield*/, this._statsSource.getStats()];
                    case 1:
                        stats = _b.sent();
                        this._statsCollectionCount++;
                        shouldPublishStatsReport = (this._statsCollectionCount % this._collectionsPerPublish) === 0;
                        if (shouldPublishStatsReport) {
                            this._iceCandidatePublishToggle = !this._iceCandidatePublishToggle;
                        }
                        shouldPublishIceCandidate = shouldPublishStatsReport && this._iceCandidatePublishToggle;
                        this._analyzeStats(stats, shouldPublishStatsReport, shouldPublishIceCandidate);
                        return [3 /*break*/, 3];
                    case 2:
                        _a = _b.sent();
                        return [3 /*break*/, 3];
                    case 3: return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Analyze WebRTC stats and publish insights
     * @private
     * @param {Map|Array} stats - Map or Array of StandardizedStatsResponse objects
     * @param {boolean} shouldPublishStatsReport - Whether to publish stats-report events this cycle
     * @param {boolean} shouldPublishIceCandidate - Whether to publish ICE candidate pair this cycle
     */
    StatsMonitor.prototype._analyzeStats = function (stats, shouldPublishStatsReport, shouldPublishIceCandidate) {
        var _this = this;
        if (!stats || (stats instanceof Map && stats.size === 0) || (Array.isArray(stats) && stats.length === 0)) {
            return;
        }
        stats.forEach(function (response, id) {
            _this._checkNetworkTypeChanges(response);
            _this._checkQualityLimitations(response.localVideoTrackStats);
            _this._checkTrackStalls(response.remoteVideoTrackStats);
            if (shouldPublishStatsReport) {
                _this._publishStatsReport(id, response);
                if (shouldPublishIceCandidate) {
                    _this._publishActiveIceCandidatePair(id, response);
                }
            }
        });
    };
    /**
     * Check for network type changes from active ICE candidate pair
     * @private
     * @param {Object} response - StandardizedStatsResponse
     */
    StatsMonitor.prototype._checkNetworkTypeChanges = function (response) {
        var activeIceCandidatePair = response.activeIceCandidatePair;
        if (!activeIceCandidatePair || !activeIceCandidatePair.localCandidate) {
            return;
        }
        var networkType = activeIceCandidatePair.localCandidate.networkType || 'unknown';
        if (!this._hasSeenActivePair) {
            this._hasSeenActivePair = true;
            this._lastNetworkType = networkType;
            telemetry.network.typeChanged(networkType);
            return;
        }
        if (this._lastNetworkType !== networkType) {
            this._log.debug("Network type changed: ".concat(this._lastNetworkType, " -> ").concat(networkType));
            this._lastNetworkType = networkType;
            telemetry.network.typeChanged(networkType);
        }
    };
    /**
     * Check for quality limitation reason changes
     * @private
     * @param {Array} localVideoTrackStats - Local video track statistics
     */
    StatsMonitor.prototype._checkQualityLimitations = function (localVideoTrackStats) {
        var _this = this;
        if (!Array.isArray(localVideoTrackStats)) {
            return;
        }
        localVideoTrackStats.forEach(function (_a) {
            var trackSid = _a.trackSid, qualityLimitationReason = _a.qualityLimitationReason;
            if (!trackSid || typeof qualityLimitationReason !== 'string') {
                return;
            }
            var lastReason = _this._lastQualityLimitationReasonByTrackSid.get(trackSid);
            if (lastReason !== qualityLimitationReason) {
                _this._log.debug("Quality limitation reason changed for track ".concat(trackSid, ": ").concat(lastReason || 'none', " -> ").concat(qualityLimitationReason));
                _this._lastQualityLimitationReasonByTrackSid.set(trackSid, qualityLimitationReason);
                telemetry.quality.limitationChanged(trackSid, qualityLimitationReason);
            }
        });
    };
    /**
     * Check for track stalls (low frame rates)
     * @private
     * @param {Array} remoteVideoTrackStats - Remote video track statistics
     */
    StatsMonitor.prototype._checkTrackStalls = function (remoteVideoTrackStats) {
        var _this = this;
        if (!Array.isArray(remoteVideoTrackStats)) {
            return;
        }
        remoteVideoTrackStats.forEach(function (_a) {
            var trackSid = _a.trackSid, frameRateReceived = _a.frameRateReceived;
            if (frameRateReceived === undefined) {
                return;
            }
            var frameRate = (typeof frameRateReceived === 'number' && !isNaN(frameRateReceived)) ? frameRateReceived : 0;
            var isStalled = _this._stalledTrackSids.has(trackSid);
            if (!isStalled && frameRate < _this._stallThreshold) {
                _this._stalledTrackSids.add(trackSid);
                _this._log.debug("Track ".concat(trackSid, " stalled: frame rate ").concat(frameRate, " below threshold ").concat(_this._stallThreshold));
                telemetry.track.stalled(trackSid, frameRate, _this._stallThreshold);
            }
            else if (isStalled && frameRate >= _this._resumeThreshold) {
                _this._stalledTrackSids.delete(trackSid);
                _this._log.debug("Track ".concat(trackSid, " resumed: frame rate ").concat(frameRate, " above threshold ").concat(_this._resumeThreshold));
                telemetry.track.resumed(trackSid, frameRate, _this._resumeThreshold);
            }
        });
    };
    /**
     * Add A/V sync metrics to local track stats
     * @private
     * @param {Object} trackStats - The track stats from StatsReport
     * @param {Object} trackResponse - The original track response
     * @returns {Object} Augmented track stats with A/V sync metrics
     */
    StatsMonitor.prototype._addLocalTrackMetrics = function (trackStats, trackResponse) {
        var framesEncoded = trackResponse.framesEncoded, packetsSent = trackResponse.packetsSent, totalEncodeTime = trackResponse.totalEncodeTime, totalPacketSendDelay = trackResponse.totalPacketSendDelay;
        var augmentedTrackStats = Object.assign({}, trackStats);
        var key = "".concat(trackStats.trackSid, "+").concat(trackStats.ssrc);
        var trackMovingAverageDeltas = this._movingAverageDeltas.get(key) || new Map();
        if (typeof totalEncodeTime === 'number' && typeof framesEncoded === 'number') {
            var trackAvgEncodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgEncodeDelay')
                || new MovingAverageDelta();
            trackAvgEncodeDelayMovingAverageDelta.putSample(totalEncodeTime * 1000, framesEncoded);
            augmentedTrackStats.avgEncodeDelay = Math.round(trackAvgEncodeDelayMovingAverageDelta.get());
            trackMovingAverageDeltas.set('avgEncodeDelay', trackAvgEncodeDelayMovingAverageDelta);
        }
        if (typeof totalPacketSendDelay === 'number' && typeof packetsSent === 'number') {
            var trackAvgPacketSendDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgPacketSendDelay')
                || new MovingAverageDelta();
            trackAvgPacketSendDelayMovingAverageDelta.putSample(totalPacketSendDelay * 1000, packetsSent);
            augmentedTrackStats.avgPacketSendDelay = Math.round(trackAvgPacketSendDelayMovingAverageDelta.get());
            trackMovingAverageDeltas.set('avgPacketSendDelay', trackAvgPacketSendDelayMovingAverageDelta);
        }
        this._movingAverageDeltas.set(key, trackMovingAverageDeltas);
        return augmentedTrackStats;
    };
    /**
     * Add A/V sync metrics to remote track stats
     * @private
     * @param {Object} trackStats - The track stats from StatsReport
     * @param {Object} trackResponse - The original track response
     * @returns {Object} Augmented track stats with A/V sync metrics
     */
    StatsMonitor.prototype._addRemoteTrackMetrics = function (trackStats, trackResponse) {
        var estimatedPlayoutTimestamp = trackResponse.estimatedPlayoutTimestamp, framesDecoded = trackResponse.framesDecoded, jitterBufferDelay = trackResponse.jitterBufferDelay, jitterBufferEmittedCount = trackResponse.jitterBufferEmittedCount, totalDecodeTime = trackResponse.totalDecodeTime;
        var augmentedTrackStats = Object.assign({}, trackStats);
        var key = "".concat(trackStats.trackSid, "+").concat(trackStats.ssrc);
        var trackMovingAverageDeltas = this._movingAverageDeltas.get(key) || new Map();
        if (typeof estimatedPlayoutTimestamp === 'number') {
            augmentedTrackStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
        }
        if (typeof framesDecoded === 'number' && typeof totalDecodeTime === 'number') {
            var trackAvgDecodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgDecodeDelay')
                || new MovingAverageDelta();
            trackAvgDecodeDelayMovingAverageDelta.putSample(totalDecodeTime * 1000, framesDecoded);
            augmentedTrackStats.avgDecodeDelay = Math.round(trackAvgDecodeDelayMovingAverageDelta.get());
            trackMovingAverageDeltas.set('avgDecodeDelay', trackAvgDecodeDelayMovingAverageDelta);
        }
        if (typeof jitterBufferDelay === 'number' && typeof jitterBufferEmittedCount === 'number') {
            var trackAvgJitterBufferDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgJitterBufferDelay')
                || new MovingAverageDelta();
            trackAvgJitterBufferDelayMovingAverageDelta.putSample(jitterBufferDelay * 1000, jitterBufferEmittedCount);
            augmentedTrackStats.avgJitterBufferDelay = Math.round(trackAvgJitterBufferDelayMovingAverageDelta.get());
            trackMovingAverageDeltas.set('avgJitterBufferDelay', trackAvgJitterBufferDelayMovingAverageDelta);
        }
        this._movingAverageDeltas.set(key, trackMovingAverageDeltas);
        return augmentedTrackStats;
    };
    /**
     * Clean up moving average delta entries for tracks that are no longer active
     * @private
     * @param {Object} report - The stats report with track stats arrays
     */
    StatsMonitor.prototype._cleanupMovingAverageDeltas = function (report) {
        var _this = this;
        var keys = flatMap([
            'localAudioTrackStats',
            'localVideoTrackStats',
            'remoteAudioTrackStats',
            'remoteVideoTrackStats'
        ], function (prop) { return report[prop].map(function (_a) {
            var ssrc = _a.ssrc, trackSid = _a.trackSid;
            return "".concat(trackSid, "+").concat(ssrc);
        }); });
        var movingAverageDeltaKeysToBeRemoved = difference(Array.from(this._movingAverageDeltas.keys()), keys);
        movingAverageDeltaKeysToBeRemoved.forEach(function (key) { return _this._movingAverageDeltas.delete(key); });
    };
    /**
     * Publish stats-report event
     * @private
     * @param {number|string} id - Peer connection ID
     * @param {Object} response - StandardizedStatsResponse
     */
    StatsMonitor.prototype._publishStatsReport = function (id, response) {
        var _this = this;
        // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
        // event instead of using StandardizedStatsResponse directly because
        // StatsReport will add zeros to properties that do not exist.
        var report = new StatsReport(id, response, true /* prepareForInsights */);
        // NOTE(mmalavalli): Since A/V sync metrics are not part of the StatsReport class,
        // we add them to the insights payload here.
        telemetry.quality.statsReport({
            audioTrackStats: report.remoteAudioTrackStats.map(function (trackStat, i) {
                return _this._addRemoteTrackMetrics(trackStat, response.remoteAudioTrackStats[i]);
            }),
            localAudioTrackStats: report.localAudioTrackStats.map(function (trackStat, i) {
                return _this._addLocalTrackMetrics(trackStat, response.localAudioTrackStats[i]);
            }),
            localVideoTrackStats: report.localVideoTrackStats.map(function (trackStat, i) {
                return _this._addLocalTrackMetrics(trackStat, response.localVideoTrackStats[i]);
            }),
            peerConnectionId: report.peerConnectionId,
            videoTrackStats: report.remoteVideoTrackStats.map(function (trackStat, i) {
                return _this._addRemoteTrackMetrics(trackStat, response.remoteVideoTrackStats[i]);
            })
        });
        this._cleanupMovingAverageDeltas(report);
    };
    /**
     * Publish active-ice-candidate-pair event
     * @private
     * @param {string|number} peerConnectionId - Peer connection ID
     * @param {Object} response - StandardizedStatsResponse
     */
    StatsMonitor.prototype._publishActiveIceCandidatePair = function (peerConnectionId, response) {
        var activeIceCandidatePair = this._replaceNullsWithDefaults(response.activeIceCandidatePair, peerConnectionId);
        telemetry.quality.iceCandidatePair(activeIceCandidatePair);
    };
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
    StatsMonitor.prototype._replaceNullsWithDefaults = function (activeIceCandidatePair, peerConnectionId) {
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
    };
    /**
     * Cleanup all monitoring state
     */
    StatsMonitor.prototype.cleanup = function () {
        this._stopStatsCollection();
        this._movingAverageDeltas.clear();
        this._lastQualityLimitationReasonByTrackSid.clear();
        this._stalledTrackSids.clear();
    };
    return StatsMonitor;
}());
module.exports = StatsMonitor;
//# sourceMappingURL=statsmonitor.js.map