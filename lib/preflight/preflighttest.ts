import { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } from '../util/constants';
import { PreflightOptions, PreflightTestReport, RTCIceCandidateStats, SelectedIceCandidatePairStats } from '../../tsdef/PreflightTypes';
import { calculateMOS, mosToScore } from './mos';
import { createAudioTrack, createVideoTrack } from './synthetic';
import { StatsReport } from '../../tsdef/types';
import { Timer } from './timer';
import { getCombinedConnectionStats } from './getCombinedConnectionStats';
import { getTurnCredentials } from './getturncredentials';
import { makeStat } from './makestat';
import { waitForSometime } from '../util';

const Log = require('../util/log');
const EventEmitter = require('../eventemitter');
const MovingAverageDelta = require('../util/movingaveragedelta');

const SECOND = 1000;
const DEFAULT_TEST_DURATION = 10 * SECOND;

/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
enum PreflightProgress {
  /**
   * Preflight test {@link PreflightTest} has successfully acquired media
   */
  mediaAcquired = 'mediaAcquired',

  /**
   * Preflight test {@link PreflightTest} has successfully connected both participants
   * to the room.
   */
  connected = 'connected',

  /**
   * Preflight test {@link PreflightTest} sees both participants discovered each other
   */
  remoteConnected = 'remoteConnected',

  /**
   * subscriberParticipant successfully subscribed to media tracks.
   */
  mediaSubscribed = 'mediaSubscribed',

  /**
   * media flow was detected.
   */
  mediaStarted = 'mediaStarted',

  /**
   * established DTLS connection. This is measured from RTCDtlsTransport `connecting` to `connected` state.
   */
  dtlsConnected = 'dtlsConnected',

  /**
   * established a PeerConnection, This is measured from PeerConnection `connecting` to `connected` state.
   */
  peerConnectionConnected = 'peerConnectionConnected',

  /**
   * established ICE connection. This is measured from ICE connection `checking` to `connected` state.
   */
  iceConnected = 'iceConnected'
}

declare interface PreflightStats {
  jitter: number[],
  rtt: number[],
  outgoingBitrate: number[],
  incomingBitrate: number[],
  packetLoss: number[], // fraction of packets lost.
  mos: number[],
  selectedIceCandidatePairStats: SelectedIceCandidatePairStats | null,
  iceCandidateStats: RTCIceCandidateStats[],
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
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
export class PreflightTest extends EventEmitter {

  private _testTiming = new Timer();
  private _dtlsTiming = new Timer();
  private _iceTiming = new Timer();
  private _peerConnectionTiming = new Timer();
  private _mediaTiming = new Timer();
  private _connectTiming = new Timer();
  private _sentBytesMovingAverage = new MovingAverageDelta();
  private _packetLossMovingAverage = new MovingAverageDelta();
  private _receivedBytesMovingAverage = new MovingAverageDelta();
  private _log: typeof Log;
  private _testDuration: number;
  private _instanceId: number;

  /**
   * Constructs {@link PreflightTest}.
   * @param {string} token
   * @param {?PreflightOptions} [options]
   */
  constructor(token: string, options: PreflightOptions) {
    super();
    this._log = new Log('default', this, DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);
    this._testDuration = options.duration || DEFAULT_TEST_DURATION;
    this._instanceId = nInstances++;

    this._testTiming.start();
    this._runPreflightTest(token, options);
  }

  toString(): string {
    return `[Preflight #${this._instanceId}]`;
  }

  /**
   * stops ongoing tests and emits error
   */
  stop():void {
    this._stopped = true;
  }

  private _generatePreflightReport(collectedStats: PreflightStats) : PreflightTestReport  {
    this._testTiming.stop();
    const mos = makeStat(collectedStats.mos);
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
        mos,
        jitter: makeStat(collectedStats.jitter),
        rtt: makeStat(collectedStats.rtt),
        outgoingBitrate: makeStat(collectedStats.outgoingBitrate),
        incomingBitrate: makeStat(collectedStats.incomingBitrate),
        packetLoss: makeStat(collectedStats.packetLoss),
      },
      qualityScore: mos ? mosToScore(mos.average) : 0,
      selectedIceCandidatePairStats: collectedStats.selectedIceCandidatePairStats,
      iceCandidateStats: collectedStats.iceCandidateStats
    };
  }

  private async _executePreflightStep<T>(stepName: string, step: () => T|Promise<T>) : Promise<T> {
    this._log.debug('Executing step: ', stepName);
    const MAX_STEP_DURATION = this._testDuration + 10 * SECOND;
    if (this._stopped) {
      throw new Error('stopped');
    }

    const stepPromise = Promise.resolve().then(step);
    let timer: number | null = null;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for : ${stepName}`));
      }, MAX_STEP_DURATION) as unknown as number;
    });
    try {
      const result = await Promise.race([timeoutPromise, stepPromise]);
      return result as T;
    } finally {
      if (timer !== null) {
        clearTimeout(timer);
      }
    }
  }

  private _trackNetworkTimings(pc: RTCPeerConnection) {
    pc.addEventListener('iceconnectionstatechange', () => {
      if (pc.iceConnectionState === 'checking') {
        this._iceTiming.start();
      }
      if (pc.iceConnectionState === 'connected') {
        this._iceTiming.stop();
        this.emit('progress', PreflightProgress.iceConnected);
      }
    });

    // firefox does not support connectionstatechange.
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connecting') {
        this._peerConnectionTiming.start();
      }
      if (pc.connectionState === 'connected') {
        this._peerConnectionTiming.stop();
        this.emit('progress', PreflightProgress.peerConnectionConnected);
      }
    });

    // Safari does not expose sender.transport.
    let senders = pc.getSenders();
    let transport = senders.map(sender => sender.transport).find(notEmpty);
    if (typeof transport !== 'undefined') {
      const dtlsTransport = transport as RTCDtlsTransport;
      dtlsTransport.addEventListener('statechange', () => {
        if (dtlsTransport.state === 'connecting') {
          this._dtlsTiming.start();
        }
        if (dtlsTransport.state === 'connected') {
          this._dtlsTiming.stop();
          this.emit('progress', PreflightProgress.dtlsConnected);
        }
      });
    }
  }

  private async _runPreflightTest(token: string, options: PreflightOptions) {
    let localTracks: MediaStreamTrack[] = [];
    let pcs: RTCPeerConnection[] = [];
    try {
      let elements = [];
      localTracks = await this._executePreflightStep('Acquire media', () => [createAudioTrack(), createVideoTrack({ width: 1920, height: 1080 })]);
      this.emit('progress', PreflightProgress.mediaAcquired);
      this.emit('debug', { remoteTracks: localTracks });

      this._connectTiming.start();
      let iceServers = await this._executePreflightStep('Get turn credentials', () => getTurnCredentials(token, options));
      this._connectTiming.stop();
      this.emit('progress', PreflightProgress.connected);

      const senderPC: RTCPeerConnection = new RTCPeerConnection({ iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
      const receiverPC: RTCPeerConnection = new RTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
      pcs.push(senderPC);
      pcs.push(receiverPC);

      this._mediaTiming.start();
      const remoteTracks = await this._executePreflightStep('Setup Peer Connections', async () => {
        senderPC.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => event.candidate && receiverPC.addIceCandidate(event.candidate));
        receiverPC.addEventListener('icecandidate', (event: RTCPeerConnectionIceEvent) => event.candidate && senderPC.addIceCandidate(event.candidate));

        localTracks.forEach(track => senderPC.addTrack(track));

        const remoteTracksPromise: Promise<MediaStreamTrack[]> = new Promise(resolve => {
          let remoteTracks: MediaStreamTrack[] = [];
          receiverPC.addEventListener('track', event => {
            remoteTracks.push(event.track);
            if (remoteTracks.length === localTracks.length) {
              resolve(remoteTracks);
            }
          });
        });

        const offer = await senderPC.createOffer();
        const updatedOffer = offer;
        await senderPC.setLocalDescription(updatedOffer);
        await receiverPC.setRemoteDescription(updatedOffer);

        const answer = await receiverPC.createAnswer();
        const updatedAnswer = answer;
        await receiverPC.setLocalDescription(updatedAnswer);
        await senderPC.setRemoteDescription(updatedAnswer);
        this._trackNetworkTimings(senderPC);

        return remoteTracksPromise;
      });
      this.emit('debug', { remoteTracks });
      remoteTracks.forEach(track => {
        track.addEventListener('ended', () => this._log.warn(track.kind + ':ended'));
        track.addEventListener('mute', () => this._log.warn(track.kind + ':muted'));
        track.addEventListener('unmute', () => this._log.warn(track.kind + ':unmuted'));
      });
      this.emit('progress', PreflightProgress.mediaSubscribed);

      await this._executePreflightStep('wait for tracks to start', () => {
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
      });
      this._mediaTiming.stop();
      this.emit('progress', PreflightProgress.mediaStarted);

      const collectedStats = await this._executePreflightStep('collect stats for duration',
        () => this._collectRTCStatsForDuration(this._testDuration, initCollectedStats(), senderPC, receiverPC));

      const report = await this._executePreflightStep('generate report', () => this._generatePreflightReport(collectedStats));
      this.emit('completed', report);

    } catch (error) {
      this.emit('failed', error);
    } finally {
      pcs.forEach(pc => pc.close());
      localTracks.forEach(track => track.stop());
    }
  }

  private async _collectRTCStats(collectedStats: PreflightStats, senderPC: RTCPeerConnection, receiverPC: RTCPeerConnection) {
    const combinedStats = await getCombinedConnectionStats({ publisher: senderPC, subscriber: receiverPC });
    const { timestamp, bytesSent, bytesReceived, packets, packetsLost, roundTripTime, jitter, selectedIceCandidatePairStats, iceCandidateStats } = combinedStats;
    const hasLastData = collectedStats.jitter.length > 0;
    collectedStats.jitter.push(jitter);
    collectedStats.rtt.push(roundTripTime);

    this._sentBytesMovingAverage.putSample(bytesSent, timestamp);
    this._receivedBytesMovingAverage.putSample(bytesReceived, timestamp);
    this._packetLossMovingAverage.putSample(packetsLost, packets);
    if (hasLastData) {
      collectedStats.outgoingBitrate.push(this._sentBytesMovingAverage.get());
      collectedStats.incomingBitrate.push(this._receivedBytesMovingAverage.get());
      const fractionPacketLost = this._packetLossMovingAverage.get();
      const percentPacketsLost = Math.min(100, fractionPacketLost * 100);

      collectedStats.packetLoss.push(percentPacketsLost);

      const score = calculateMOS(roundTripTime, jitter, fractionPacketLost);
      collectedStats.mos.push(score);
    }

    if (!collectedStats.selectedIceCandidatePairStats) {
      collectedStats.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
    }

    if (!collectedStats.iceCandidateStats) {
      collectedStats.iceCandidateStats = iceCandidateStats;
    }
  }

  private async _collectRTCStatsForDuration(duration: number, collectedStats: PreflightStats, senderPC: RTCPeerConnection, receiverPC: RTCPeerConnection) : Promise<PreflightStats> {
    const startTime = Date.now();

    // take a sample every 1000ms.
    const STAT_INTERVAL = Math.min(1000, duration);

    await waitForSometime(STAT_INTERVAL);

    await this._collectRTCStats(collectedStats, senderPC, receiverPC);

    const remainingDuration = duration - (Date.now() - startTime);

    if (remainingDuration > 0) {
      collectedStats = await this._collectRTCStatsForDuration(remainingDuration, collectedStats, senderPC, receiverPC);
    }
    return collectedStats;
  }
}


export interface InternalStatsReport extends StatsReport {
  activeIceCandidatePair: {
    timestamp: number;
    bytesSent: number;
    bytesReceived: number;
    availableOutgoingBitrate?: number;
    availableIncomingBitrate?: number;
    currentRoundTripTime?: number;
    localCandidate: RTCIceCandidateStats;
    remoteCandidate: RTCIceCandidateStats;
  }
}

function initCollectedStats() : PreflightStats {
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
export function runPreflight(token: string, options: PreflightOptions = {}): PreflightTest {
  const preflight = new PreflightTest(token, options);
  return preflight;
}

