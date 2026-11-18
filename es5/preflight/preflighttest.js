"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreflightTest = void 0;
exports.runPreflight = runPreflight;
const tslib_1 = require("tslib");
const constants_1 = require("../util/constants");
const timer_1 = require("./timer");
const mos_1 = require("./mos");
const getCombinedConnectionStats_1 = require("./getCombinedConnectionStats");
const getturncredentials_1 = require("./getturncredentials");
const makestat_1 = require("./makestat");
const syntheticaudio_1 = require("./syntheticaudio");
const syntheticvideo_1 = require("./syntheticvideo");
const index_1 = require("../util/index");
const { WS_SERVER } = require('../util/constants');
const Log = require('../util/log');
const EventEmitter = require('../eventemitter');
const MovingAverageDelta = require('../util/movingaveragedelta');
const EventObserver = require('../util/eventobserver');
const InsightsPublisher = require('../util/insightspublisher');
const { createSID, sessionSID } = require('../util/sid');
const { SignalingConnectionTimeoutError, MediaConnectionError } = require('../util/twilio-video-errors');
const SECOND = 1000;
const DEFAULT_TEST_DURATION = 10 * SECOND;
/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
const PreflightProgress = {
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
let nInstances = 0;
/**
 * A {@link PreflightTest} monitors progress of an ongoing preflight test.
 * <br><br>
 * Instance of {@link PreflightTest} is returned by calling {@link module:twilio-video.runPreflight}
 * @extends EventEmitter
 * @emits PreflightTest#completed
 * @emits PreflightTest#failed
 * @emits PreflightTest#progress
 */
class PreflightTest extends EventEmitter {
    /**
     * Constructs {@link PreflightTest}.
     * @param {string} token
     * @param {?PreflightOptions} [options]
     */
    constructor(token, options) {
        super();
        this._testTiming = new timer_1.Timer();
        this._dtlsTiming = new timer_1.Timer();
        this._iceTiming = new timer_1.Timer();
        this._peerConnectionTiming = new timer_1.Timer();
        this._mediaTiming = new timer_1.Timer();
        this._connectTiming = new timer_1.Timer();
        this._sentBytesMovingAverage = new MovingAverageDelta();
        this._packetLossMovingAverage = new MovingAverageDelta();
        this._progressEvents = [];
        this._receivedBytesMovingAverage = new MovingAverageDelta();
        const internalOptions = options;
        const { environment = 'prod', region = 'gll', duration = DEFAULT_TEST_DURATION } = internalOptions;
        // eslint-disable-next-line new-cap
        const wsServer = internalOptions.wsServer || WS_SERVER(environment, region);
        this._log = new Log('default', this, constants_1.DEFAULT_LOG_LEVEL, constants_1.DEFAULT_LOGGER_NAME);
        this._testDuration = duration;
        this._instanceId = nInstances++;
        this._testTiming.start();
        this._runPreflightTest(token, environment, wsServer);
    }
    toString() {
        return `[Preflight #${this._instanceId}]`;
    }
    /**
     * stops ongoing tests and emits error
     */
    stop() {
        this._stopped = true;
    }
    _generatePreflightReport(collectedStats) {
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
                jitter: (0, makestat_1.makeStat)(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.jitter),
                rtt: (0, makestat_1.makeStat)(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.rtt),
                packetLoss: (0, makestat_1.makeStat)(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.packetLoss),
            },
            selectedIceCandidatePairStats: collectedStats ? collectedStats.selectedIceCandidatePairStats : null,
            iceCandidateStats: collectedStats ? collectedStats.iceCandidateStats : [],
            progressEvents: this._progressEvents,
            // NOTE(mpatwardhan): internal properties.
            mos: (0, makestat_1.makeStat)(collectedStats === null || collectedStats === void 0 ? void 0 : collectedStats.mos),
        };
    }
    _executePreflightStep(stepName, step, timeoutError) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            this._log.debug('Executing step: ', stepName);
            const MAX_STEP_DURATION = this._testDuration + 10 * SECOND;
            if (this._stopped) {
                throw new Error('stopped');
            }
            const stepPromise = Promise.resolve().then(step);
            let timer = null;
            const timeoutPromise = new Promise((_resolve, reject) => {
                timer = setTimeout(() => {
                    reject(timeoutError || new Error(`${stepName} timeout.`));
                }, MAX_STEP_DURATION);
            });
            try {
                const result = yield Promise.race([timeoutPromise, stepPromise]);
                return result;
            }
            finally {
                if (timer !== null) {
                    clearTimeout(timer);
                }
            }
        });
    }
    _collectNetworkTimings(pc) {
        return new Promise(resolve => {
            let dtlsTransport;
            pc.addEventListener('iceconnectionstatechange', () => {
                if (pc.iceConnectionState === 'checking') {
                    this._iceTiming.start();
                }
                if (pc.iceConnectionState === 'connected') {
                    this._iceTiming.stop();
                    this._updateProgress(PreflightProgress.iceConnected);
                    if (!dtlsTransport || dtlsTransport && dtlsTransport.state === 'connected') {
                        resolve();
                    }
                }
            });
            // firefox does not support connectionstatechange.
            pc.addEventListener('connectionstatechange', () => {
                if (pc.connectionState === 'connecting') {
                    this._peerConnectionTiming.start();
                }
                if (pc.connectionState === 'connected') {
                    this._peerConnectionTiming.stop();
                    this._updateProgress(PreflightProgress.peerConnectionConnected);
                }
            });
            // Safari does not expose sender.transport.
            let senders = pc.getSenders();
            let transport = senders.map(sender => sender.transport).find(notEmpty);
            if (typeof transport !== 'undefined') {
                dtlsTransport = transport;
                dtlsTransport.addEventListener('statechange', () => {
                    if (dtlsTransport.state === 'connecting') {
                        this._dtlsTiming.start();
                    }
                    if (dtlsTransport.state === 'connected') {
                        this._dtlsTiming.stop();
                        this._updateProgress(PreflightProgress.dtlsConnected);
                        if (pc.iceConnectionState === 'connected') {
                            resolve();
                        }
                    }
                });
            }
        });
    }
    _setupInsights({ token, environment = constants_1.DEFAULT_ENVIRONMENT, realm = constants_1.DEFAULT_REALM }) {
        const eventPublisherOptions = {};
        const eventPublisher = new InsightsPublisher(token, constants_1.SDK_NAME, constants_1.SDK_VERSION, environment, realm, eventPublisherOptions);
        // event publisher requires room sid/participant sid. supply fake ones.
        eventPublisher.connect('PREFLIGHT_ROOM_SID', 'PREFLIGHT_PARTICIPANT');
        const eventObserver = new EventObserver(eventPublisher, Date.now(), this._log);
        // eslint-disable-next-line no-undefined
        const undefinedValue = undefined;
        return {
            reportToInsights: ({ report }) => {
                var _a, _b;
                const jitterStats = report.stats.jitter || undefinedValue;
                const rttStats = report.stats.rtt || undefinedValue;
                const packetLossStats = report.stats.packetLoss || undefinedValue;
                const mosStats = report.mos || undefinedValue;
                // stringify important info from ice candidates.
                const candidateTypeToProtocols = new Map();
                report.iceCandidateStats.forEach(candidateStats => {
                    if (candidateStats.candidateType && candidateStats.protocol) {
                        let protocols = candidateTypeToProtocols.get(candidateStats.candidateType) || [];
                        if (protocols.indexOf(candidateStats.protocol) < 0) {
                            protocols.push(candidateStats.protocol);
                        }
                        candidateTypeToProtocols.set(candidateStats.candidateType, protocols);
                    }
                });
                const iceCandidateStats = JSON.stringify(Object.fromEntries(candidateTypeToProtocols));
                const insightsReport = {
                    name: 'report',
                    group: 'preflight',
                    level: report.error ? 'error' : 'info',
                    payload: {
                        sessionSID,
                        preflightSID: createSID('PF'),
                        progressEvents: JSON.stringify(report.progressEvents),
                        testTiming: report.testTiming,
                        dtlsTiming: report.networkTiming.dtls,
                        iceTiming: report.networkTiming.ice,
                        peerConnectionTiming: report.networkTiming.peerConnection,
                        connectTiming: report.networkTiming.connect,
                        mediaTiming: report.networkTiming.media,
                        selectedLocalCandidate: (_a = report.selectedIceCandidatePairStats) === null || _a === void 0 ? void 0 : _a.localCandidate,
                        selectedRemoteCandidate: (_b = report.selectedIceCandidatePairStats) === null || _b === void 0 ? void 0 : _b.remoteCandidate,
                        iceCandidateStats,
                        jitterStats,
                        rttStats,
                        packetLossStats,
                        mosStats,
                        error: report.error
                    }
                };
                eventObserver.emit('event', insightsReport);
                setTimeout(() => eventPublisher.disconnect(), 2000);
            }
        };
    }
    _runPreflightTest(token, environment, wsServer) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            let localTracks = [];
            let pcs = [];
            const { reportToInsights } = this._setupInsights({ token, environment });
            try {
                let elements = [];
                localTracks = yield this._executePreflightStep('Acquire media', () => [(0, syntheticaudio_1.syntheticAudio)(), (0, syntheticvideo_1.syntheticVideo)({ width: 640, height: 480 })]);
                this._updateProgress(PreflightProgress.mediaAcquired);
                this.emit('debug', { localTracks });
                this._connectTiming.start();
                let iceServers = yield this._executePreflightStep('Get turn credentials', () => (0, getturncredentials_1.getTurnCredentials)(token, wsServer), new SignalingConnectionTimeoutError());
                this._connectTiming.stop();
                this._updateProgress(PreflightProgress.connected);
                const senderPC = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
                const receiverPC = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
                pcs.push(senderPC);
                pcs.push(receiverPC);
                this._mediaTiming.start();
                const remoteTracks = yield this._executePreflightStep('Setup Peer Connections', () => tslib_1.__awaiter(this, void 0, void 0, function* () {
                    senderPC.addEventListener('icecandidate', (event) => event.candidate && receiverPC.addIceCandidate(event.candidate));
                    receiverPC.addEventListener('icecandidate', (event) => event.candidate && senderPC.addIceCandidate(event.candidate));
                    localTracks.forEach(track => senderPC.addTrack(track));
                    const remoteTracksPromise = new Promise(resolve => {
                        let remoteTracks = [];
                        receiverPC.addEventListener('track', event => {
                            remoteTracks.push(event.track);
                            if (remoteTracks.length === localTracks.length) {
                                resolve(remoteTracks);
                            }
                        });
                    });
                    const offer = yield senderPC.createOffer();
                    const updatedOffer = offer;
                    yield senderPC.setLocalDescription(updatedOffer);
                    yield receiverPC.setRemoteDescription(updatedOffer);
                    const answer = yield receiverPC.createAnswer();
                    yield receiverPC.setLocalDescription(answer);
                    yield senderPC.setRemoteDescription(answer);
                    yield this._collectNetworkTimings(senderPC);
                    return remoteTracksPromise;
                }), new MediaConnectionError());
                this.emit('debug', { remoteTracks });
                remoteTracks.forEach(track => {
                    track.addEventListener('ended', () => this._log.warn(track.kind + ':ended'));
                    track.addEventListener('mute', () => this._log.warn(track.kind + ':muted'));
                    track.addEventListener('unmute', () => this._log.warn(track.kind + ':unmuted'));
                });
                this._updateProgress(PreflightProgress.mediaSubscribed);
                yield this._executePreflightStep('Wait for tracks to start', () => {
                    return new Promise(resolve => {
                        const element = document.createElement('video');
                        element.autoplay = true;
                        element.playsInline = true;
                        element.muted = true;
                        element.srcObject = new MediaStream(remoteTracks);
                        elements.push(element);
                        this.emit('debugElement', element);
                        element.oncanplay = resolve;
                    });
                }, new MediaConnectionError());
                this._mediaTiming.stop();
                this._updateProgress(PreflightProgress.mediaStarted);
                const collectedStats = yield this._executePreflightStep('Collect stats for duration', () => this._collectRTCStatsForDuration(this._testDuration, initCollectedStats(), senderPC, receiverPC));
                const report = yield this._executePreflightStep('Generate report', () => this._generatePreflightReport(collectedStats));
                reportToInsights({ report });
                this.emit('completed', report);
            }
            catch (error) {
                const preflightReport = this._generatePreflightReport();
                reportToInsights({ report: Object.assign(Object.assign({}, preflightReport), { error: error === null || error === void 0 ? void 0 : error.toString() }) });
                this.emit('failed', error, preflightReport);
            }
            finally {
                pcs.forEach(pc => pc.close());
                localTracks.forEach(track => track.stop());
            }
        });
    }
    _collectRTCStats(collectedStats, senderPC, receiverPC) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const combinedStats = yield (0, getCombinedConnectionStats_1.getCombinedConnectionStats)({ publisher: senderPC, subscriber: receiverPC });
            const { timestamp, bytesSent, bytesReceived, packets, packetsLost, roundTripTime, jitter, selectedIceCandidatePairStats, iceCandidateStats } = combinedStats;
            const hasLastData = collectedStats.jitter.length > 0;
            collectedStats.jitter.push(jitter);
            collectedStats.rtt.push(roundTripTime);
            this._sentBytesMovingAverage.putSample(bytesSent, timestamp);
            this._receivedBytesMovingAverage.putSample(bytesReceived, timestamp);
            this._packetLossMovingAverage.putSample(packetsLost, packets);
            if (hasLastData) {
                // convert BytesMovingAverage which is in bytes/millisecond to bits/second
                collectedStats.outgoingBitrate.push(this._sentBytesMovingAverage.get() * 1000 * 8);
                collectedStats.incomingBitrate.push(this._receivedBytesMovingAverage.get() * 1000 * 8);
                const fractionPacketLost = this._packetLossMovingAverage.get();
                const percentPacketsLost = Math.min(100, fractionPacketLost * 100);
                collectedStats.packetLoss.push(percentPacketsLost);
                const score = (0, mos_1.calculateMOS)(roundTripTime, jitter, fractionPacketLost);
                collectedStats.mos.push(score);
            }
            if (!collectedStats.selectedIceCandidatePairStats) {
                collectedStats.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
            }
            if (collectedStats.iceCandidateStats.length === 0) {
                collectedStats.iceCandidateStats = iceCandidateStats;
            }
        });
    }
    _collectRTCStatsForDuration(duration, collectedStats, senderPC, receiverPC) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            const STAT_INTERVAL = Math.min(1000, duration);
            yield (0, index_1.waitForSometime)(STAT_INTERVAL);
            yield this._collectRTCStats(collectedStats, senderPC, receiverPC);
            const remainingDuration = duration - (Date.now() - startTime);
            if (remainingDuration > 0) {
                collectedStats = yield this._collectRTCStatsForDuration(remainingDuration, collectedStats, senderPC, receiverPC);
            }
            return collectedStats;
        });
    }
    _updateProgress(name) {
        const duration = Date.now() - this._testTiming.getTimeMeasurement().start;
        this._progressEvents.push({ duration, name });
        this.emit('progress', name);
    }
}
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
function runPreflight(token, options = {}) {
    const preflight = new PreflightTest(token, options);
    return preflight;
}
//# sourceMappingURL=preflighttest.js.map