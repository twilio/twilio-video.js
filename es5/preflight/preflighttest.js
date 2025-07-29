"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPreflight = exports.PreflightTest = void 0;
var constants_1 = require("../util/constants");
var timer_1 = require("./timer");
var mos_1 = require("./mos");
var getCombinedConnectionStats_1 = require("./getCombinedConnectionStats");
var getturncredentials_1 = require("./getturncredentials");
var makestat_1 = require("./makestat");
var syntheticaudio_1 = require("./syntheticaudio");
var syntheticvideo_1 = require("./syntheticvideo");
var index_1 = require("../util/index");
var WS_SERVER = require('../util/constants').WS_SERVER;
var Log = require('../util/log');
var EventEmitter = require('../eventemitter');
var MovingAverageDelta = require('../util/movingaveragedelta');
var EventObserver = require('../util/eventobserver');
var InsightsPublisher = require('../util/insightspublisher');
var _a = require('../util/sid'), createSID = _a.createSID, sessionSID = _a.sessionSID;
var _b = require('../util/twilio-video-errors'), SignalingConnectionTimeoutError = _b.SignalingConnectionTimeoutError, MediaConnectionError = _b.MediaConnectionError;
var SECOND = 1000;
var DEFAULT_TEST_DURATION = 10 * SECOND;
/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
var PreflightProgress = {
    /**
     * {@link PreflightTest} has successfully generated synthetic tracks
     */
    mediaAcquired: 'mediaAcquired',
    /**
     * {@link PreflightTest} has successfully connected to twilio server and obtained turn credentials
     */
    connected: 'connected',
    /**
     * SubscriberParticipant successfully subscribed to media tracks.
     */
    mediaSubscribed: 'mediaSubscribed',
    /**
     * Media flow was detected.
     */
    mediaStarted: 'mediaStarted',
    /**
     * Established DTLS connection. This is measured from RTCDtlsTransport `connecting` to `connected` state.
     * On Safari, Support for measuring this is missing, this event will be not be emitted on Safari.
     */
    dtlsConnected: 'dtlsConnected',
    /**
     * Established a PeerConnection, This is measured from PeerConnection `connecting` to `connected` state.
     * On Firefox, Support for measuring this is missing, this event will be not be emitted on Firefox.
     */
    peerConnectionConnected: 'peerConnectionConnected',
    /**
     * Established ICE connection. This is measured from ICE connection `checking` to `connected` state.
     */
    iceConnected: 'iceConnected'
};
function notEmpty(value) {
    return value !== null && typeof value !== 'undefined';
}
var nInstances = 0;
/**
 * A {@link PreflightTest} monitors progress of an ongoing preflight test.
 * <br><br>
 * Instance of {@link PreflightTest} is returned by calling {@link module:twilio-video.runPreflight}
 * @extends EventEmitter
 * @emits PreflightTest#completed
 * @emits PreflightTest#failed
 * @emits PreflightTest#progress
 */
var PreflightTest = /** @class */ (function (_super) {
    __extends(PreflightTest, _super);
    /**
     * Constructs {@link PreflightTest}.
     * @param {string} token
     * @param {?PreflightOptions} [options]
     */
    function PreflightTest(token, options) {
        var _this = _super.call(this) || this;
        _this._testTiming = new timer_1.Timer();
        _this._dtlsTiming = new timer_1.Timer();
        _this._iceTiming = new timer_1.Timer();
        _this._peerConnectionTiming = new timer_1.Timer();
        _this._mediaTiming = new timer_1.Timer();
        _this._connectTiming = new timer_1.Timer();
        _this._sentBytesMovingAverage = new MovingAverageDelta();
        _this._packetLossMovingAverage = new MovingAverageDelta();
        _this._progressEvents = [];
        _this._receivedBytesMovingAverage = new MovingAverageDelta();
        var internalOptions = options;
        var _a = internalOptions.environment, environment = _a === void 0 ? 'prod' : _a, _b = internalOptions.region, region = _b === void 0 ? 'gll' : _b, _c = internalOptions.duration, duration = _c === void 0 ? DEFAULT_TEST_DURATION : _c;
        // eslint-disable-next-line new-cap
        var wsServer = internalOptions.wsServer || WS_SERVER(environment, region);
        _this._log = new Log('default', _this, constants_1.DEFAULT_LOG_LEVEL, constants_1.DEFAULT_LOGGER_NAME);
        _this._testDuration = duration;
        _this._instanceId = nInstances++;
        _this._testTiming.start();
        _this._runPreflightTest(token, environment, wsServer);
        return _this;
    }
    PreflightTest.prototype.toString = function () {
        return "[Preflight #" + this._instanceId + "]";
    };
    /**
     * stops ongoing tests and emits error
     */
    PreflightTest.prototype.stop = function () {
        this._stopped = true;
    };
    PreflightTest.prototype._generatePreflightReport = function (collectedStats) {
        this._testTiming.stop();
        return {
            testTiming: this._testTiming.getTimeMeasurement(),
            networkTiming: {
                dtls: this._dtlsTiming.getTimeMeasurement(),
                ice: this._iceTiming.getTimeMeasurement(),
                peerConnection: this._peerConnectionTiming.getTimeMeasurement(),
                connect: this._connectTiming.getTimeMeasurement(),
                media: this._mediaTiming.getTimeMeasurement()
            },
            stats: {
                jitter: makestat_1.makeStat(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.jitter),
                rtt: makestat_1.makeStat(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.rtt),
                packetLoss: makestat_1.makeStat(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.packetLoss),
            },
            selectedIceCandidatePairStats: collectedStats ? collectedStats.selectedIceCandidatePairStats : null,
            iceCandidateStats: collectedStats ? collectedStats.iceCandidateStats : [],
            progressEvents: this._progressEvents,
            // NOTE(mpatwardhan): internal properties.
            mos: makestat_1.makeStat(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.mos),
        };
    };
    PreflightTest.prototype._executePreflightStep = function (stepName, step, timeoutError) {
        return __awaiter(this, void 0, void 0, function () {
            var MAX_STEP_DURATION, stepPromise, timer, timeoutPromise, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('Executing step: ', stepName);
                        MAX_STEP_DURATION = this._testDuration + 10 * SECOND;
                        if (this._stopped) {
                            throw new Error('stopped');
                        }
                        stepPromise = Promise.resolve().then(step);
                        timer = null;
                        timeoutPromise = new Promise(function (_resolve, reject) {
                            timer = setTimeout(function () {
                                reject(timeoutError || new Error(stepName + " timeout."));
                            }, MAX_STEP_DURATION);
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, Promise.race([timeoutPromise, stepPromise])];
                    case 2:
                        result = _a.sent();
                        return [2 /*return*/, result];
                    case 3:
                        if (timer !== null) {
                            clearTimeout(timer);
                        }
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    PreflightTest.prototype._collectNetworkTimings = function (pc) {
        var _this = this;
        return new Promise(function (resolve) {
            var dtlsTransport;
            pc.addEventListener('iceconnectionstatechange', function () {
                if (pc.iceConnectionState === 'checking') {
                    _this._iceTiming.start();
                }
                if (pc.iceConnectionState === 'connected') {
                    _this._iceTiming.stop();
                    _this._updateProgress(PreflightProgress.iceConnected);
                    if (!dtlsTransport || dtlsTransport && dtlsTransport.state === 'connected') {
                        resolve();
                    }
                }
            });
            // firefox does not support connectionstatechange.
            pc.addEventListener('connectionstatechange', function () {
                if (pc.connectionState === 'connecting') {
                    _this._peerConnectionTiming.start();
                }
                if (pc.connectionState === 'connected') {
                    _this._peerConnectionTiming.stop();
                    _this._updateProgress(PreflightProgress.peerConnectionConnected);
                }
            });
            // Safari does not expose sender.transport.
            var senders = pc.getSenders();
            var transport = senders.map(function (sender) { return sender.transport; }).find(notEmpty);
            if (typeof transport !== 'undefined') {
                dtlsTransport = transport;
                dtlsTransport.addEventListener('statechange', function () {
                    if (dtlsTransport.state === 'connecting') {
                        _this._dtlsTiming.start();
                    }
                    if (dtlsTransport.state === 'connected') {
                        _this._dtlsTiming.stop();
                        _this._updateProgress(PreflightProgress.dtlsConnected);
                        if (pc.iceConnectionState === 'connected') {
                            resolve();
                        }
                    }
                });
            }
        });
    };
    PreflightTest.prototype._setupInsights = function (_a) {
        var token = _a.token, _b = _a.environment, environment = _b === void 0 ? constants_1.DEFAULT_ENVIRONMENT : _b, _c = _a.realm, realm = _c === void 0 ? constants_1.DEFAULT_REALM : _c;
        var eventPublisherOptions = {};
        var eventPublisher = new InsightsPublisher(token, constants_1.SDK_NAME, constants_1.SDK_VERSION, environment, realm, eventPublisherOptions);
        // event publisher requires room sid/participant sid. supply fake ones.
        eventPublisher.connect('PREFLIGHT_ROOM_SID', 'PREFLIGHT_PARTICIPANT');
        var eventObserver = new EventObserver(eventPublisher, Date.now(), this._log);
        // eslint-disable-next-line no-undefined
        var undefinedValue = undefined;
        return {
            reportToInsights: function (_a) {
                var _b, _c;
                var report = _a.report;
                var jitterStats = report.stats.jitter || undefinedValue;
                var rttStats = report.stats.rtt || undefinedValue;
                var packetLossStats = report.stats.packetLoss || undefinedValue;
                var mosStats = report.mos || undefinedValue;
                // stringify important info from ice candidates.
                var candidateTypeToProtocols = new Map();
                report.iceCandidateStats.forEach(function (candidateStats) {
                    if (candidateStats.candidateType && candidateStats.protocol) {
                        var protocols = candidateTypeToProtocols.get(candidateStats.candidateType) || [];
                        if (protocols.indexOf(candidateStats.protocol) < 0) {
                            protocols.push(candidateStats.protocol);
                        }
                        candidateTypeToProtocols.set(candidateStats.candidateType, protocols);
                    }
                });
                var iceCandidateStats = JSON.stringify(Object.fromEntries(candidateTypeToProtocols));
                var insightsReport = {
                    name: 'report',
                    group: 'preflight',
                    level: report.error ? 'error' : 'info',
                    payload: {
                        sessionSID: sessionSID,
                        preflightSID: createSID('PF'),
                        progressEvents: JSON.stringify(report.progressEvents),
                        testTiming: report.testTiming,
                        dtlsTiming: report.networkTiming.dtls,
                        iceTiming: report.networkTiming.ice,
                        peerConnectionTiming: report.networkTiming.peerConnection,
                        connectTiming: report.networkTiming.connect,
                        mediaTiming: report.networkTiming.media,
                        selectedLocalCandidate: (_b = report.selectedIceCandidatePairStats) === null || _b === void 0 ? void 0 : _b.localCandidate,
                        selectedRemoteCandidate: (_c = report.selectedIceCandidatePairStats) === null || _c === void 0 ? void 0 : _c.remoteCandidate,
                        iceCandidateStats: iceCandidateStats,
                        jitterStats: jitterStats,
                        rttStats: rttStats,
                        packetLossStats: packetLossStats,
                        mosStats: mosStats,
                        error: report.error
                    }
                };
                eventObserver.emit('event', insightsReport);
                setTimeout(function () { return eventPublisher.disconnect(); }, 2000);
            }
        };
    };
    PreflightTest.prototype._runPreflightTest = function (token, environment, wsServer) {
        return __awaiter(this, void 0, void 0, function () {
            var localTracks, pcs, reportToInsights, elements_1, iceServers, senderPC_1, receiverPC_1, remoteTracks_1, collectedStats_1, report, error_1, preflightReport;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        localTracks = [];
                        pcs = [];
                        reportToInsights = this._setupInsights({ token: token, environment: environment }).reportToInsights;
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, 9, 10]);
                        elements_1 = [];
                        return [4 /*yield*/, this._executePreflightStep('Acquire media', function () { return [syntheticaudio_1.syntheticAudio(), syntheticvideo_1.syntheticVideo({ width: 640, height: 480 })]; })];
                    case 2:
                        localTracks = _a.sent();
                        this._updateProgress(PreflightProgress.mediaAcquired);
                        this.emit('debug', { localTracks: localTracks });
                        this._connectTiming.start();
                        return [4 /*yield*/, this._executePreflightStep('Get turn credentials', function () { return getturncredentials_1.getTurnCredentials(token, wsServer); }, new SignalingConnectionTimeoutError())];
                    case 3:
                        iceServers = _a.sent();
                        this._connectTiming.stop();
                        this._updateProgress(PreflightProgress.connected);
                        senderPC_1 = new RTCPeerConnection({ iceServers: iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
                        receiverPC_1 = new RTCPeerConnection({ iceServers: iceServers, bundlePolicy: 'max-bundle' });
                        pcs.push(senderPC_1);
                        pcs.push(receiverPC_1);
                        this._mediaTiming.start();
                        return [4 /*yield*/, this._executePreflightStep('Setup Peer Connections', function () { return __awaiter(_this, void 0, void 0, function () {
                                var remoteTracksPromise, offer, updatedOffer, answer;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            senderPC_1.addEventListener('icecandidate', function (event) { return event.candidate && receiverPC_1.addIceCandidate(event.candidate); });
                                            receiverPC_1.addEventListener('icecandidate', function (event) { return event.candidate && senderPC_1.addIceCandidate(event.candidate); });
                                            localTracks.forEach(function (track) { return senderPC_1.addTrack(track); });
                                            remoteTracksPromise = new Promise(function (resolve) {
                                                var remoteTracks = [];
                                                receiverPC_1.addEventListener('track', function (event) {
                                                    remoteTracks.push(event.track);
                                                    if (remoteTracks.length === localTracks.length) {
                                                        resolve(remoteTracks);
                                                    }
                                                });
                                            });
                                            return [4 /*yield*/, senderPC_1.createOffer()];
                                        case 1:
                                            offer = _a.sent();
                                            updatedOffer = offer;
                                            return [4 /*yield*/, senderPC_1.setLocalDescription(updatedOffer)];
                                        case 2:
                                            _a.sent();
                                            return [4 /*yield*/, receiverPC_1.setRemoteDescription(updatedOffer)];
                                        case 3:
                                            _a.sent();
                                            return [4 /*yield*/, receiverPC_1.createAnswer()];
                                        case 4:
                                            answer = _a.sent();
                                            return [4 /*yield*/, receiverPC_1.setLocalDescription(answer)];
                                        case 5:
                                            _a.sent();
                                            return [4 /*yield*/, senderPC_1.setRemoteDescription(answer)];
                                        case 6:
                                            _a.sent();
                                            return [4 /*yield*/, this._collectNetworkTimings(senderPC_1)];
                                        case 7:
                                            _a.sent();
                                            return [2 /*return*/, remoteTracksPromise];
                                    }
                                });
                            }); }, new MediaConnectionError())];
                    case 4:
                        remoteTracks_1 = _a.sent();
                        this.emit('debug', { remoteTracks: remoteTracks_1 });
                        remoteTracks_1.forEach(function (track) {
                            track.addEventListener('ended', function () { return _this._log.warn(track.kind + ':ended'); });
                            track.addEventListener('mute', function () { return _this._log.warn(track.kind + ':muted'); });
                            track.addEventListener('unmute', function () { return _this._log.warn(track.kind + ':unmuted'); });
                        });
                        this._updateProgress(PreflightProgress.mediaSubscribed);
                        return [4 /*yield*/, this._executePreflightStep('Wait for tracks to start', function () {
                                return new Promise(function (resolve) {
                                    var element = document.createElement('video');
                                    element.autoplay = true;
                                    element.playsInline = true;
                                    element.muted = true;
                                    element.srcObject = new MediaStream(remoteTracks_1);
                                    elements_1.push(element);
                                    _this.emit('debugElement', element);
                                    element.oncanplay = resolve;
                                });
                            }, new MediaConnectionError())];
                    case 5:
                        _a.sent();
                        this._mediaTiming.stop();
                        this._updateProgress(PreflightProgress.mediaStarted);
                        return [4 /*yield*/, this._executePreflightStep('Collect stats for duration', function () { return _this._collectRTCStatsForDuration(_this._testDuration, initCollectedStats(), senderPC_1, receiverPC_1); })];
                    case 6:
                        collectedStats_1 = _a.sent();
                        return [4 /*yield*/, this._executePreflightStep('Generate report', function () { return _this._generatePreflightReport(collectedStats_1); })];
                    case 7:
                        report = _a.sent();
                        reportToInsights({ report: report });
                        this.emit('completed', report);
                        return [3 /*break*/, 10];
                    case 8:
                        error_1 = _a.sent();
                        preflightReport = this._generatePreflightReport();
                        reportToInsights({ report: __assign(__assign({}, preflightReport), { error: error_1 === null || error_1 === void 0 ? void 0 : error_1.toString() }) });
                        this.emit('failed', error_1, preflightReport);
                        return [3 /*break*/, 10];
                    case 9:
                        pcs.forEach(function (pc) { return pc.close(); });
                        localTracks.forEach(function (track) { return track.stop(); });
                        return [7 /*endfinally*/];
                    case 10: return [2 /*return*/];
                }
            });
        });
    };
    PreflightTest.prototype._collectRTCStats = function (collectedStats, senderPC, receiverPC) {
        return __awaiter(this, void 0, void 0, function () {
            var combinedStats, timestamp, bytesSent, bytesReceived, packets, packetsLost, roundTripTime, jitter, selectedIceCandidatePairStats, iceCandidateStats, hasLastData, fractionPacketLost, percentPacketsLost, score;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, getCombinedConnectionStats_1.getCombinedConnectionStats({ publisher: senderPC, subscriber: receiverPC })];
                    case 1:
                        combinedStats = _a.sent();
                        timestamp = combinedStats.timestamp, bytesSent = combinedStats.bytesSent, bytesReceived = combinedStats.bytesReceived, packets = combinedStats.packets, packetsLost = combinedStats.packetsLost, roundTripTime = combinedStats.roundTripTime, jitter = combinedStats.jitter, selectedIceCandidatePairStats = combinedStats.selectedIceCandidatePairStats, iceCandidateStats = combinedStats.iceCandidateStats;
                        hasLastData = collectedStats.jitter.length > 0;
                        collectedStats.jitter.push(jitter);
                        collectedStats.rtt.push(roundTripTime);
                        this._sentBytesMovingAverage.putSample(bytesSent, timestamp);
                        this._receivedBytesMovingAverage.putSample(bytesReceived, timestamp);
                        this._packetLossMovingAverage.putSample(packetsLost, packets);
                        if (hasLastData) {
                            // convert BytesMovingAverage which is in bytes/millisecond to bits/second
                            collectedStats.outgoingBitrate.push(this._sentBytesMovingAverage.get() * 1000 * 8);
                            collectedStats.incomingBitrate.push(this._receivedBytesMovingAverage.get() * 1000 * 8);
                            fractionPacketLost = this._packetLossMovingAverage.get();
                            percentPacketsLost = Math.min(100, fractionPacketLost * 100);
                            collectedStats.packetLoss.push(percentPacketsLost);
                            score = mos_1.calculateMOS(roundTripTime, jitter, fractionPacketLost);
                            collectedStats.mos.push(score);
                        }
                        if (!collectedStats.selectedIceCandidatePairStats) {
                            collectedStats.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
                        }
                        if (collectedStats.iceCandidateStats.length === 0) {
                            collectedStats.iceCandidateStats = iceCandidateStats;
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    PreflightTest.prototype._collectRTCStatsForDuration = function (duration, collectedStats, senderPC, receiverPC) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, STAT_INTERVAL, remainingDuration;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        STAT_INTERVAL = Math.min(1000, duration);
                        return [4 /*yield*/, index_1.waitForSometime(STAT_INTERVAL)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this._collectRTCStats(collectedStats, senderPC, receiverPC)];
                    case 2:
                        _a.sent();
                        remainingDuration = duration - (Date.now() - startTime);
                        if (!(remainingDuration > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, this._collectRTCStatsForDuration(remainingDuration, collectedStats, senderPC, receiverPC)];
                    case 3:
                        collectedStats = _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, collectedStats];
                }
            });
        });
    };
    PreflightTest.prototype._updateProgress = function (name) {
        var duration = Date.now() - this._testTiming.getTimeMeasurement().start;
        this._progressEvents.push({ duration: duration, name: name });
        this.emit('progress', name);
    };
    return PreflightTest;
}(EventEmitter));
exports.PreflightTest = PreflightTest;
function initCollectedStats() {
    return {
        mos: [],
        jitter: [],
        rtt: [],
        outgoingBitrate: [],
        incomingBitrate: [],
        packetLoss: [],
        selectedIceCandidatePairStats: null,
        iceCandidateStats: [],
    };
}
/**
 * Represents network timing measurements captured during preflight test
 * @typedef {object} NetworkTiming
 * @property {TimeMeasurement} [connect] - Time to establish signaling connection and acquire turn credentials
 * @property {TimeMeasurement} [media] - Time to start media. This is measured from calling connect to remote media getting started.
 * @property {TimeMeasurement} [dtls] - Time to establish dtls connection. This is measured from RTCDtlsTransport `connecting` to `connected` state. (Not available on Safari)
 * @property {TimeMeasurement} [ice] - Time to establish ice connectivity. This is measured from ICE connection `checking` to `connected` state.
 * @property {TimeMeasurement} [peerConnection] - Time to establish peer connectivity. This is measured from PeerConnection `connecting` to `connected` state. (Not available on Firefox)
 */
/**
 * Represents stats for a numerical metric.
 * @typedef {object} Stats
 * @property  {number} [average] - Average value observed.
 * @property  {number} [max] - Max value observed.
 * @property  {number} [min] - Min value observed.
 */
/**
 * Represents stats for a numerical metric.
 * @typedef {object} SelectedIceCandidatePairStats
 * @property  {RTCIceCandidateStats} [localCandidate] - Selected local ice candidate
 * @property  {RTCIceCandidateStats} [remoteCandidate] - Selected local ice candidate
 */
/**
 * Represents RTC related stats that were observed during preflight test
 * @typedef {object} PreflightReportStats
 * @property {Stats} [jitter] - Packet delay variation in seconds
 * @property {Stats} [rtt] - Round trip time, to the server back to the client in milliseconds.
 * @property {Stats} [packetLoss] - Packet loss as a percent of total packets sent.
*/
/**
 * A {@link PreflightProgress} event with timing information.
 * @typedef {object} ProgressEvent
 * @property {number} [duration] - The duration of the event, measured from the start of the test.
 * @property {string} [name] - The {@link PreflightProgress} event name.
 */
/**
 * Represents report generated by {@link PreflightTest}.
 * @typedef {object} PreflightTestReport
 * @property {TimeMeasurement} [testTiming] - Time measurements of test run time.
 * @property {NetworkTiming} [networkTiming] - Network related time measurements.
 * @property {PreflightReportStats} [stats] - RTC related stats captured during the test.
 * @property {Array<RTCIceCandidateStats>} [iceCandidateStats] - List of gathered ice candidates.
 * @property {SelectedIceCandidatePairStats} selectedIceCandidatePairStats - Stats for the ice candidates that were used for the connection.
 * @property {Array<ProgressEvent>} [progressEvents] - {@link ProgressEvent} events detected during the test.
 * Use this information to determine which steps were completed and which ones were not.
 */
/**
 * You may pass these options to {@link module:twilio-video.testPreflight} in order to override the
 * default behavior.
 * @typedef {object} PreflightOptions
 * @property {string} [region='gll'] - Preferred signaling region; By default, you will be connected to the
 *   nearest signaling server determined by latency based routing. Setting a value other
 *   than <code style="padding:0 0">gll</code> bypasses routing and guarantees that signaling traffic will be
 *   terminated in the region that you prefer. Please refer to this <a href="https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication" target="_blank">table</a>
 *   for the list of supported signaling regions.
 * @property {number} [duration=10000] - number of milliseconds to run test for.
 *   once connected test will run for this duration before generating the stats report.
 */
/**
 * Preflight test has completed successfully.
 * @param {PreflightTestReport} report - Results of the test.
 * @event PreflightTest#completed
 */
/**
 * Preflight test has encountered a failure and is now stopped.
 * @param {TwilioError|Error} error - A TwilioError or a DOMException.
 * Possible TwilioErrors include Signaling and Media related errors which can be found
 * <a href="https://www.twilio.com/docs/video/build-js-video-application-recommendations-and-best-practices#connection-errors" target="_blank">here</a>.
 * @param {PreflightTestReport} report - Partial results gathered during the test. Use this information to help determine the cause of failure.
 * @event PreflightTest#failed
 */
/**
 * Emitted to indicate progress of the test
 * @param {PreflightProgress} progress - Indicates the status completed.
 * @event PreflightTest#progress
 */
/**
 * @method
 * @name runPreflight
 * @description Run a preflight test. This method will start a test to check the quality of network connection.
 * @memberof module:twilio-video
 * @param {string} token - The Access Token string
 * @param {PreflightOptions} options - Options for the test
 * @returns {PreflightTest} preflightTest - An instance to be used to monitor progress of the test.
 * @example
 * var { runPreflight } = require('twilio-video');
 * var preflight = runPreflight(token, preflightOptions);
 * preflightTest.on('progress', progress => {
 *   console.log('preflight progress:', progress);
 * });
 *
 * preflightTest.on('failed', (error, report) => {
 *   console.error('preflight error:', error, report);
 * });
 *
 * preflightTest.on('completed', report => {
 *   console.log('preflight completed:', report));
 * });
*/
function runPreflight(token, options) {
    if (options === void 0) { options = {}; }
    var preflight = new PreflightTest(token, options);
    return preflight;
}
exports.runPreflight = runPreflight;
//# sourceMappingURL=preflighttest.js.map