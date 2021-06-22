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
exports.runPreflight = exports.PreflightTest = void 0;
var constants_1 = require("../util/constants");
var getturncredentials_1 = require("./getturncredentials");
var mos_1 = require("./mos");
var synthetic_1 = require("./synthetic");
var timer_1 = require("./timer");
var makestat_1 = require("./makestat");
var Log = require('../util/log');
var EventEmitter = require('../eventemitter');
var _a = require('@twilio/webrtc'), DefaultRTCPeerConnection = _a.RTCPeerConnection, getStatistics = _a.getStats;
var MovingAverageDelta = require('../util/movingaveragedelta');
var util_1 = require("../util");
var SECOND = 1000;
var DEFAULT_TEST_DURATION = 10 * SECOND;
/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
var PreflightProgress;
(function (PreflightProgress) {
    /**
     * Preflight test {@link PreflightTest} has successfully acquired media
     */
    PreflightProgress["mediaAcquired"] = "mediaAcquired";
    /**
     * Preflight test {@link PreflightTest} has successfully connected both participants
     * to the room.
     */
    PreflightProgress["connected"] = "connected";
    /**
     * Preflight test {@link PreflightTest} sees both participants discovered each other
     */
    PreflightProgress["remoteConnected"] = "remoteConnected";
    /**
     * subscriberParticipant successfully subscribed to media tracks.
     */
    PreflightProgress["mediaSubscribed"] = "mediaSubscribed";
    /**
     * media flow was detected.
     */
    PreflightProgress["mediaStarted"] = "mediaStarted";
    /**
     * established DTLS connection. This is measured from RTCDtlsTransport `connecting` to `connected` state.
     */
    PreflightProgress["dtlsConnected"] = "dtlsConnected";
    /**
     * established a PeerConnection, This is measured from PeerConnection `connecting` to `connected` state.
     */
    PreflightProgress["peerConnectionConnected"] = "peerConnectionConnected";
    /**
     * established ICE connection. This is measured from ICE connection `checking` to `connected` state.
     */
    PreflightProgress["iceConnected"] = "iceConnected";
})(PreflightProgress || (PreflightProgress = {}));
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
        _this._receivedBytesMovingAverage = new MovingAverageDelta();
        _this._log = new Log('default', _this, constants_1.DEFAULT_LOG_LEVEL, constants_1.DEFAULT_LOGGER_NAME);
        _this._testDuration = options.duration || DEFAULT_TEST_DURATION;
        _this._instanceId = nInstances++;
        _this._testTiming.start();
        _this._runPreflightTest(token, options);
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
        var selectedIceCandidatePairStats = collectedStats.selectedIceCandidatePairStats;
        var mos = makestat_1.makeStat(collectedStats.localAudio.mos.concat(collectedStats.localVideo.mos));
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
                mos: mos,
                jitter: makestat_1.makeStat(collectedStats.jitter),
                rtt: makestat_1.makeStat(collectedStats.rtt),
                outgoingBitrate: makestat_1.makeStat(collectedStats.outgoingBitrate),
                incomingBitrate: makestat_1.makeStat(collectedStats.incomingBitrate),
                packetLoss: makestat_1.makeStat(collectedStats.packetLoss),
            },
            qualityScore: mos_1.mosToScore(mos === null || mos === void 0 ? void 0 : mos.average),
            selectedIceCandidatePairStats: selectedIceCandidatePairStats,
            iceCandidateStats: collectedStats.iceCandidateStats
        };
    };
    PreflightTest.prototype._executePreflightStep = function (stepName, step) {
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
                                reject(new Error("Timed out waiting for : " + stepName));
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
    PreflightTest.prototype._trackNetworkTimings = function (pc) {
        var _this = this;
        pc.addEventListener('iceconnectionstatechange', function () {
            if (pc.iceConnectionState === 'checking') {
                _this._iceTiming.start();
            }
            if (pc.iceConnectionState === 'connected') {
                _this._iceTiming.stop();
                _this.emit('progress', PreflightProgress.iceConnected);
            }
        });
        // firefox does not support connectionstatechange.
        pc.addEventListener('connectionstatechange', function () {
            if (pc.connectionState === 'connecting') {
                _this._peerConnectionTiming.start();
            }
            if (pc.connectionState === 'connected') {
                _this._peerConnectionTiming.stop();
                _this.emit('progress', PreflightProgress.peerConnectionConnected);
            }
        });
        // Safari does not expose sender.transport.
        var senders = pc.getSenders();
        var transport = senders.map(function (sender) { return sender.transport; }).find(notEmpty);
        if (typeof transport !== 'undefined') {
            var dtlsTransport_1 = transport;
            dtlsTransport_1.addEventListener('statechange', function () {
                if (dtlsTransport_1.state === 'connecting') {
                    _this._dtlsTiming.start();
                }
                if (dtlsTransport_1.state === 'connected') {
                    _this._dtlsTiming.stop();
                    _this.emit('progress', PreflightProgress.dtlsConnected);
                }
            });
        }
    };
    PreflightTest.prototype._runPreflightTest = function (token, options) {
        return __awaiter(this, void 0, void 0, function () {
            var localTracks, pcs, elements_1, iceServers, senderPC_1, receiverPC_1, remoteTracks_1, collectedStats_1, report, error_1;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        localTracks = [];
                        pcs = [];
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 8, 9, 10]);
                        elements_1 = [];
                        return [4 /*yield*/, this._executePreflightStep('Acquire media', function () { return [synthetic_1.createAudioTrack(), synthetic_1.createVideoTrack({ width: 1920, height: 1080 })]; })];
                    case 2:
                        localTracks = _a.sent();
                        this.emit('progress', PreflightProgress.mediaAcquired);
                        this._connectTiming.start();
                        return [4 /*yield*/, this._executePreflightStep('Get turn credentials', function () { return getturncredentials_1.getTurnCredentials(token, options); })];
                    case 3:
                        iceServers = _a.sent();
                        this._connectTiming.stop();
                        this.emit('progress', PreflightProgress.connected);
                        senderPC_1 = new DefaultRTCPeerConnection({ iceServers: iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
                        receiverPC_1 = new DefaultRTCPeerConnection({ iceServers: iceServers, bundlePolicy: 'max-bundle' });
                        pcs.push(senderPC_1);
                        pcs.push(receiverPC_1);
                        this._mediaTiming.start();
                        return [4 /*yield*/, this._executePreflightStep('Setup Peer Connections', function () { return __awaiter(_this, void 0, void 0, function () {
                                var remoteTracksPromise, offer, updatedOffer, answer, updatedAnswer;
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
                                            updatedAnswer = answer;
                                            return [4 /*yield*/, receiverPC_1.setLocalDescription(updatedAnswer)];
                                        case 5:
                                            _a.sent();
                                            return [4 /*yield*/, senderPC_1.setRemoteDescription(updatedAnswer)];
                                        case 6:
                                            _a.sent();
                                            this._trackNetworkTimings(senderPC_1);
                                            return [2 /*return*/, remoteTracksPromise];
                                    }
                                });
                            }); })];
                    case 4:
                        remoteTracks_1 = _a.sent();
                        this.emit('debug', { remoteTracks: remoteTracks_1 });
                        remoteTracks_1.forEach(function (track) {
                            track.addEventListener('ended', function () { return _this._log.warn(track.kind + ':ended'); });
                            track.addEventListener('mute', function () { return _this._log.warn(track.kind + ':muted'); });
                            track.addEventListener('unmute', function () { return _this._log.warn(track.kind + ':unmuted'); });
                        });
                        this.emit('progress', PreflightProgress.mediaSubscribed);
                        return [4 /*yield*/, this._executePreflightStep('wait for tracks to start', function () {
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
                            })];
                    case 5:
                        _a.sent();
                        this._mediaTiming.stop();
                        this.emit('progress', PreflightProgress.mediaStarted);
                        return [4 /*yield*/, this._executePreflightStep('collect stats for duration', function () { return _this._collectRTCStatsForDuration(_this._testDuration, initCollectedStats(), senderPC_1, receiverPC_1); })];
                    case 6:
                        collectedStats_1 = _a.sent();
                        return [4 /*yield*/, this._executePreflightStep('generate report', function () { return _this._generatePreflightReport(collectedStats_1); })];
                    case 7:
                        report = _a.sent();
                        this.emit('completed', report);
                        return [3 /*break*/, 10];
                    case 8:
                        error_1 = _a.sent();
                        this.emit('failed', error_1);
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
            var _a, subscriberStats, publisherStats, activeIceCandidatePair, bytesSent, timestamp, activeIceCandidatePair, remoteAudioTrackStats, remoteVideoTrackStats, bytesReceived, timestamp, currentRoundTripTime, packetsLost, packetsReceived, remoteAudioTrack, remoteVideoTrack;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.all([receiverPC, senderPC].map(function (pc) { return getStatsForPC(pc); }))];
                    case 1:
                        _a = __read.apply(void 0, [_b.sent(), 2]), subscriberStats = _a[0], publisherStats = _a[1];
                        {
                            // Note: we compute Mos only for publisherStats.
                            //  subscriberStats does not have all parameters to compute MoS
                            collectMOSData(publisherStats, collectedStats);
                            activeIceCandidatePair = publisherStats.activeIceCandidatePair;
                            if (activeIceCandidatePair) {
                                bytesSent = activeIceCandidatePair.bytesSent, timestamp = activeIceCandidatePair.timestamp;
                                if (bytesSent && timestamp) {
                                    this._sentBytesMovingAverage.putSample(bytesSent, timestamp);
                                    collectedStats.outgoingBitrate.push(this._sentBytesMovingAverage.get());
                                }
                            }
                        }
                        {
                            activeIceCandidatePair = subscriberStats.activeIceCandidatePair, remoteAudioTrackStats = subscriberStats.remoteAudioTrackStats, remoteVideoTrackStats = subscriberStats.remoteVideoTrackStats;
                            if (activeIceCandidatePair) {
                                bytesReceived = activeIceCandidatePair.bytesReceived, timestamp = activeIceCandidatePair.timestamp;
                                if (bytesReceived && timestamp) {
                                    this._receivedBytesMovingAverage.putSample(bytesReceived, timestamp);
                                    collectedStats.incomingBitrate.push(this._receivedBytesMovingAverage.get());
                                }
                                currentRoundTripTime = activeIceCandidatePair.currentRoundTripTime;
                                if (typeof currentRoundTripTime === 'number') {
                                    collectedStats.rtt.push(currentRoundTripTime * 1000);
                                }
                                if (!collectedStats.selectedIceCandidatePairStats) {
                                    collectedStats.selectedIceCandidatePairStats = {
                                        localCandidate: activeIceCandidatePair.localCandidate,
                                        remoteCandidate: activeIceCandidatePair.remoteCandidate
                                    };
                                }
                            }
                            packetsLost = 0;
                            packetsReceived = 0;
                            if (remoteAudioTrackStats && remoteAudioTrackStats[0]) {
                                remoteAudioTrack = remoteAudioTrackStats[0];
                                if (remoteAudioTrack.jitter !== null) {
                                    collectedStats.jitter.push(remoteAudioTrack.jitter);
                                }
                                if (remoteAudioTrack.packetsLost !== null) {
                                    packetsLost += remoteAudioTrack.packetsLost;
                                }
                                if (remoteAudioTrack.packetsReceived !== null) {
                                    packetsReceived += remoteAudioTrack.packetsReceived;
                                }
                            }
                            if (remoteVideoTrackStats && remoteVideoTrackStats[0]) {
                                remoteVideoTrack = remoteVideoTrackStats[0];
                                if (remoteVideoTrack.packetsLost !== null) {
                                    packetsLost += remoteVideoTrack.packetsLost;
                                }
                                if (remoteVideoTrack.packetsReceived !== null) {
                                    packetsReceived += remoteVideoTrack.packetsReceived;
                                }
                            }
                            collectedStats.packetLoss.push(packetsReceived ? packetsLost * 100 / packetsReceived : 0);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    PreflightTest.prototype._collectRTCStatsForDuration = function (duration, collectedStats, senderPC, receiverPC) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, STAT_INTERVAL, remainingDuration, stats;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        STAT_INTERVAL = Math.min(1000, duration);
                        return [4 /*yield*/, util_1.waitForSometime(STAT_INTERVAL)];
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
                        return [3 /*break*/, 6];
                    case 4: return [4 /*yield*/, receiverPC.getStats()];
                    case 5:
                        stats = _a.sent();
                        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                        // @ts-ignore: stats does have a values method.
                        collectedStats.iceCandidateStats = Array.from(stats.values()).filter(function (stat) { return stat.type === 'local-candidate' || stat.type === 'remote-candidate'; });
                        _a.label = 6;
                    case 6: return [2 /*return*/, collectedStats];
                }
            });
        });
    };
    return PreflightTest;
}(EventEmitter));
exports.PreflightTest = PreflightTest;
function getStatsForPC(pc) {
    return getStatistics(pc);
}
function collectMOSDataForTrack(srcTrackStats, targetTrackStats) {
    if (srcTrackStats) {
        var jitter = srcTrackStats.jitter, roundTripTime = srcTrackStats.roundTripTime, packetsLost = srcTrackStats.packetsLost, packetsSent = srcTrackStats.packetsSent;
        if (typeof srcTrackStats.roundTripTime === 'number') {
            targetTrackStats.rtt.push(srcTrackStats.roundTripTime * 1000);
        }
        if (typeof srcTrackStats.jitter === 'number') {
            targetTrackStats.jitter.push(srcTrackStats.jitter);
        }
        var totalPackets = packetsSent;
        if (totalPackets) {
            var fractionLost = (packetsLost || 0) / totalPackets;
            targetTrackStats.packetLoss.push(fractionLost);
            if (typeof roundTripTime === 'number' && typeof jitter === 'number' && roundTripTime > 0) {
                var score = mos_1.calculateMOS(roundTripTime, jitter, fractionLost);
                targetTrackStats.mos.push(score);
            }
        }
    }
}
function collectMOSData(publisherStats, collectedStats) {
    var localAudioTrackStats = publisherStats.localAudioTrackStats, localVideoTrackStats = publisherStats.localVideoTrackStats;
    localAudioTrackStats.forEach(function (trackStats) { return collectMOSDataForTrack(trackStats, collectedStats.localAudio); });
    localVideoTrackStats.forEach(function (trackStats) { return collectMOSDataForTrack(trackStats, collectedStats.localVideo); });
}
function initCollectedStats() {
    return {
        jitter: [],
        localAudio: {
            mos: [],
            jitter: [],
            rtt: [],
            packetLoss: []
        },
        localVideo: {
            mos: [],
            jitter: [],
            rtt: [],
            packetLoss: []
        },
        remoteAudio: {
            mos: [],
            jitter: [],
            rtt: [],
            packetLoss: []
        },
        remoteVideo: {
            mos: [],
            jitter: [],
            rtt: [],
            packetLoss: []
        },
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
 * @property {TimeMeasurement} [dtls] - Time to establish dtls connection. This is measured from RTCDtlsTransport `connecting` to `connected` state.
 * @property {TimeMeasurement} [ice] - Time to establish ice connectivity. This is measured from ICE connection `checking` to `connected` state.
 * @property {TimeMeasurement} [peerConnection] - Time to establish peer connectivity. This is measured from PeerConnection `connecting` to `connected` state.
 */
/**
 * Represents stats for a numerical metric.
 * @typedef {object} Stats
 * @property  {number} [average] - average value observed.
 * @property  {number} [max] - max value observed.
 * @property  {number} [min] - min value observed.
 */
/**
 * Represents stats for a numerical metric.
 * @typedef {object} SelectedIceCandidatePairStats
 * @property  {RTCIceCandidateStats} [localCandidate] - selected local ice candidate
 * @property  {RTCIceCandidateStats} [remoteCandidate] - selected local ice candidate
 */
/**
 * Represents RTC related stats that were observed during preflight test
 * @typedef {object} PreflightReportStats
 * @property {Stats} [jitter] - Packet delay variation
 * @property {Stats} [rtt] - Round trip time, to the server back to the client in milliseconds.
 * @property {Stats} [mos] - mos score (1 to 5)
 * @property {Stats} [outgoingBitrate] - Outgoing bitrate in bits per second.
 * @property {Stats} [incomingBitrate] - Incoming bitrate in bits per second.
 * @property {Stats} [packetLoss] - Packet loss as a percent of total packets sent.
*/
/**
 * Represents report generated by {@link PreflightTest}.
 * @typedef {object} PreflightTestReport
 * @property {number} [qualityScore] - a score between 0 to 5 indicating the estimated quality of connection.
 *   A score of 5 estimates an excellent network.
 * @property {TimeMeasurement} [testTiming] - Time measurements of test run time.
 * @property {NetworkTiming} [networkTiming] - Network related time measurements.
 * @property {PreflightReportStats} [stats] - RTC related stats captured during the test.
 * @property {Array<RTCIceCandidateStats>} [iceCandidateStats] - List of gathered ice candidates.
 * @property {SelectedIceCandidatePairStats} selectedIceCandidatePairStats - stats for the ice candidates that were used for the connection.
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
 * @param {PreflightTestReport} report - results of the test.
 * @event PreflightTest#completed
 */
/**
 * Preflight test has encountered a failed and is now stopped.
 * @param {TwilioError|Error} error - error object
 * @event PreflightTest#failed
 */
/**
 * Emitted to indicate progress of the test
 * @param {PreflightProgress} progress - indicates the status completed.
 * @event PreflightTest#progress
 */
/**
 * @method
 * @name runPreflight
 * @description Run a preflight test. This method will start a test to check the quality of network connection.
 * @memberof module:twilio-video
 * @param {string} token - The Access Token string
 * @param {PreflightOptions} options - options for the test
 * @returns {PreflightTest} preflightTest - an instance to be used to monitor progress of the test.
 * @example
 * var { runPreflight } = require('twilio-video');
 * var preflight = runPreflight();
 * preflightTest.on('progress', progress => {
 *   console.log('preflight progress:', progress);
 * });
 *
 * preflightTest.on('failed', error => {
 *   console.error('preflight error:', error);
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