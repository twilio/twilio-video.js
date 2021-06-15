import { LocalAudioTrackStats, LocalVideoTrackStats, StatsReport } from '../../tsdef/types';
import { PreflightOptions, PreflightReportTrackStats, PreflightTestReport, RTCIceCandidateStats, SelectedIceCandidatePairStats } from '../../tsdef/PreflightTypes';
import { RTCStats, getTurnCredentials } from './getTurnCredentials';
import { createAudioTrack, createVideoTrack } from './synthetic';
import { TimeMeasurementImpl } from './TimeMeasurementImpl';
import { calculateMOS } from './mos';
import { makeStat } from './makeStat';

const Log = require('../util/log');
const { DEFAULT_LOGGER_NAME, DEFAULT_LOG_LEVEL } = require('../util/constants');
const EventEmitter = require('../eventemitter');
const { waitForSometime } = require('../util');
const SECOND = 1000;
const DEFAULT_TEST_DURATION = 10 * SECOND;
const {
  getStats: getStatistics,
  RTCPeerConnection: DefaultRTCPeerConnection
} = require('@twilio/webrtc');

const log = new Log('default', 'preflight', DEFAULT_LOG_LEVEL, DEFAULT_LOGGER_NAME);

/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
// eslint-disable-next-line
const PreflightProgress = {
  /**
   * Preflight test {@link PreflightTest} has successfully acquired media
   */
  mediaAcquired: 'mediaAcquired',

  /**
   * Preflight test {@link PreflightTest} has successfully connected both participants
   * to the room.
   */
  connected: 'connected',

  /**
   * Preflight test {@link PreflightTest} sees both participants discovered each other
   */
  remoteConnected: 'remoteConnected',

  /**
   * publisherParticipant successfully published media tracks
   */
  mediaPublished: 'mediaPublished',

  /**
   * subscriberParticipant successfully subscribed to media tracks.
   */
  mediaSubscribed: 'mediaSubscribed',

  /**
   * media flow was detected.
   */
  mediaStarted: 'mediaStarted',

  /**
   * established DTLS connection. This is measured from RTCDtlsTransport `connecting` to `connected` state.
   */
  dtlsConnected: 'dtlsConnected',

  /**
   * established a PeerConnection, This is measured from PeerConnection `connecting` to `connected` state.
   */
  peerConnectionConnected: 'peerConnectionConnected',

  /**
   * established ICE connection. This is measured from ICE connection `checking` to `connected` state.
   */
  iceConnected: 'iceConnected'

};

declare interface InternalPreflightTestReport extends PreflightTestReport {
  localAudio: PreflightReportTrackStats,
  localVideo: PreflightReportTrackStats
}

declare interface PreflightTrackStats {
  mos: number[],
  jitter: number[],
  rtt: number[],
  packetLoss: number[]
}

declare interface PreflightStats {
  localAudio: PreflightTrackStats,
  localVideo: PreflightTrackStats,
  remoteAudio: PreflightTrackStats,
  remoteVideo: PreflightTrackStats,
  jitter: number[], // TODO: is this needed?
  rtt: number[],
  outgoingBitrate: number[],
  incomingBitrate: number[],
  packetLoss: number[],
  selectedIceCandidatePairStats: SelectedIceCandidatePairStats | null,
  iceCandidateStats: RTCIceCandidateStats[],
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && typeof value !== 'undefined';
}

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

  private _testTiming = new TimeMeasurementImpl();
  private _dtlsTiming = new TimeMeasurementImpl();
  private _iceTiming = new TimeMeasurementImpl();
  private _peerConnectionTiming = new TimeMeasurementImpl();
  private _mediaTiming = new TimeMeasurementImpl();
  private _connectTiming = new TimeMeasurementImpl();
  /**
   * Constructs {@link PreflightTest}.
   * @param {string} token
   * @param {?PreflightOptions} [options]
   */
  constructor(token: string, options: PreflightOptions) {
    super();

    this.testDuration = options.duration || DEFAULT_TEST_DURATION;
    delete options.duration; // duration is not a Video.connect option.

    options = Object.assign(options, {
      preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }]
    });

    this._testTiming.start();
    this.runPreflightTest(token, options);
  }

  /**
   * stops ongoing tests and emits error
   */
  stop():void {
    this._stopped = true;
  }


  private generatePreflightReport(collectedStats: PreflightStats) : InternalPreflightTestReport  {
    // const { subscriber, publisher } = collectedStats;
    this._testTiming.stop();
    const selectedIceCandidatePairStats = collectedStats.selectedIceCandidatePairStats;
    const audioMos = makeStat(collectedStats.localAudio.mos);
    const videoMos = makeStat(collectedStats.localVideo.mos);
    const mos = makeStat(collectedStats.localAudio.mos.concat(collectedStats.localVideo.mos));
    return {
      preflightSID: 'todo',
      sessionSID: 'todo',
      testTiming: this._testTiming.getTimeMeasurement(),
      networkTiming: {
        dtls: this._dtlsTiming.getTimeMeasurement(),
        ice: this._iceTiming.getTimeMeasurement(),
        peerConnection: this._peerConnectionTiming.getTimeMeasurement(),
        connect: this._connectTiming.getTimeMeasurement(),
        media: this._mediaTiming.getTimeMeasurement()
      },
      localAudio: {
        mos: audioMos,
        jitter: makeStat(collectedStats.localAudio.jitter),
        rtt: makeStat(collectedStats.localAudio.rtt),
        packetLoss: makeStat(collectedStats.localAudio.packetLoss),
        outgoingBitrate: null, // TODO
        incomingBitrate: null, // TODO
      },
      localVideo: {
        mos: videoMos,
        jitter: makeStat(collectedStats.localVideo.jitter),
        rtt: makeStat(collectedStats.localVideo.rtt),
        packetLoss: makeStat(collectedStats.localVideo.packetLoss),
        outgoingBitrate: null, // TODO
        incomingBitrate: null, // TODO
      },
      stats: {
        mos,
        jitter: makeStat(collectedStats.jitter),
        rtt: makeStat(collectedStats.rtt),
        outgoingBitrate: makeStat(collectedStats.outgoingBitrate),
        incomingBitrate: makeStat(collectedStats.incomingBitrate),
        packetLoss: makeStat(collectedStats.packetLoss),
      },
      qualityScore: 0, // TODO
      selectedIceCandidatePairStats,
      iceCandidateStats: collectedStats.iceCandidateStats
    };
  }

  /**
   * returns a promise to executes given step
   * rejects the return promise if
   * a) preflight is stopped.
   * b) subscriber or publisher disconnects
   * c) step does not complete in reasonable time.
   * @param {function} step - function to execute
   * @param {string} stepName - name for the step
   */
  private async executePreflightStep<T>(stepName: string, step: () => T|Promise<T>) : Promise<T> {
    log.debug('Executing step: ', stepName);
    const MAX_STEP_DURATION = this.testDuration + 10 * SECOND;
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

  private trackNetworkTimings(pc: RTCPeerConnection) {
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
      dtlsTransport.addEventListener('statechange', ev => {
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

  private async runPreflightTest(token: string, options: PreflightOptions) {
    let localTracks: MediaStreamTrack[] = [];
    let pcs: RTCPeerConnection[] = [];
    try {
      let elements = [];
      localTracks = await this.executePreflightStep('acquire media', () => [createAudioTrack(), createVideoTrack({ width: 1920, height: 1080 })]);
      this.emit('progress', PreflightProgress.mediaAcquired);

      this._connectTiming.start();
      let iceServers = await this.executePreflightStep('connect', () => getTurnCredentials(token, options));
      this._connectTiming.stop();
      this.emit('progress', PreflightProgress.connected);

      const senderPC: RTCPeerConnection = new DefaultRTCPeerConnection({ iceServers, iceTransportPolicy: 'relay', bundlePolicy: 'max-bundle' });
      const receiverPC: RTCPeerConnection = new DefaultRTCPeerConnection({ iceServers, bundlePolicy: 'max-bundle' });
      pcs.push(senderPC);
      pcs.push(receiverPC);

      this._mediaTiming.start();
      const remoteTracks = await this.executePreflightStep('Setup Peer Connections', async () => {
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
        // const updatedOffer = updateSDP(offer);
        const updatedOffer = offer;
        await senderPC.setLocalDescription(updatedOffer);
        await receiverPC.setRemoteDescription(updatedOffer);

        const answer = await receiverPC.createAnswer();
        // const updatedAnswer = updateSDP(answer);
        const updatedAnswer = answer;
        await receiverPC.setLocalDescription(updatedAnswer);
        await senderPC.setRemoteDescription(updatedAnswer);
        this.trackNetworkTimings(senderPC);

        return remoteTracksPromise;
      });
      this.emit('progress', PreflightProgress.mediaSubscribed);


      await this.executePreflightStep('wait for tracks to start', () => {
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

      const collectedStats = await this.executePreflightStep('collect stats for duration',
        () => collectRTCStatsForDuration({ duration: this.testDuration, collectedStats: initCollectedStats(), senderPC, receiverPC }));

      const report = await this.executePreflightStep('generate report', () => this.generatePreflightReport(collectedStats));
      this.emit('completed', report);

    } catch (error) {
      this.emit('failed', error);
    } finally {
      pcs.forEach(pc => pc.close());
      localTracks.forEach(track => track.stop());
    }
  }

}


interface InternalStatsReport extends StatsReport {
  activeIceCandidatePair: {
    availableOutgoingBitrate?: number;
    availableIncomingBitrate?: number;
    currentRoundTripTime?: number;
    localCandidate: RTCIceCandidateStats;
    remoteCandidate: RTCIceCandidateStats;
  }
}

function getStatsForPC(pc: RTCPeerConnection): Promise<InternalStatsReport> {
  return getStatistics(pc);
}

function collectMOSDataForTrack(srcTrackStats: LocalAudioTrackStats | LocalVideoTrackStats, targetTrackStats: PreflightTrackStats, name : 'localAudio' | 'localVideo') {
  if (srcTrackStats) {
    const { jitter, roundTripTime, packetsLost, packetsSent } =  srcTrackStats;

    if (typeof srcTrackStats.roundTripTime === 'number') {
      targetTrackStats.rtt.push(srcTrackStats.roundTripTime * 1000);
    }
    if (typeof srcTrackStats.jitter === 'number') {
      targetTrackStats.jitter.push(srcTrackStats.jitter);
    }

    const totalPackets = packetsSent;

    if (totalPackets) {
      const fractionLost = (packetsLost || 0) / totalPackets;
      targetTrackStats.packetLoss.push(fractionLost);
      if (typeof roundTripTime === 'number' && typeof jitter === 'number' && roundTripTime > 0) {
        const score = calculateMOS(roundTripTime, jitter, fractionLost);
        log.debug(name, { score, roundTripTime, jitter, totalPackets, packetsLost, fractionLost });
        targetTrackStats.mos.push(score);
      }
    }
  }
}

function collectMOSData(publisherStats: StatsReport, collectedStats: PreflightStats) {
  const { localAudioTrackStats,  localVideoTrackStats } = publisherStats;
  log.debug('audioTracks:', localAudioTrackStats.length);
  log.debug('videoTracks:', localVideoTrackStats.length);
  localAudioTrackStats.forEach(trackStats => collectMOSDataForTrack(trackStats, collectedStats.localAudio, 'localAudio'));
  localVideoTrackStats.forEach(trackStats => collectMOSDataForTrack(trackStats, collectedStats.localVideo, 'localVideo'));
}

function collectRTCStats({ collectedStats, senderPC, receiverPC }: { collectedStats: PreflightStats; senderPC: RTCPeerConnection; receiverPC: RTCPeerConnection; }) {
  return Promise.all([receiverPC, senderPC].map(pc => getStatsForPC(pc)))
    // eslint-disable-next-line consistent-return
    .then(([subscriberStats, publisherStats]) => {
      {
        // Note: we compute Mos only for publisherStats.
        //  subscriberStats does not have all parameters to compute MoS
        collectMOSData(publisherStats, collectedStats);
        const { activeIceCandidatePair } = publisherStats;
        if (activeIceCandidatePair && typeof activeIceCandidatePair.availableOutgoingBitrate === 'number') {
          collectedStats.outgoingBitrate.push(activeIceCandidatePair.availableOutgoingBitrate);
        }
      }
      {

        const { activeIceCandidatePair, remoteAudioTrackStats, remoteVideoTrackStats } = subscriberStats;
        if (activeIceCandidatePair) {
          const { currentRoundTripTime, availableIncomingBitrate } =  activeIceCandidatePair;
          if (typeof currentRoundTripTime === 'number') {
            collectedStats.rtt.push(currentRoundTripTime * 1000);
          }
          if (typeof availableIncomingBitrate === 'number') {
            collectedStats.incomingBitrate.push(availableIncomingBitrate);
          }

          if (!collectedStats.selectedIceCandidatePairStats) {
            collectedStats.selectedIceCandidatePairStats = {
              localCandidate: activeIceCandidatePair.localCandidate,
              remoteCandidate: activeIceCandidatePair.remoteCandidate
            };
          }
        }

        let packetsLost = 0;
        let packetsReceived = 0;
        if (remoteAudioTrackStats && remoteAudioTrackStats[0]) {
          const remoteAudioTrack = remoteAudioTrackStats[0];
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
          const remoteVideoTrack = remoteVideoTrackStats[0];
          if (remoteVideoTrack.packetsLost !== null) {
            packetsLost += remoteVideoTrack.packetsLost;
          }
          if (remoteVideoTrack.packetsReceived !== null) {
            packetsReceived += remoteVideoTrack.packetsReceived;
          }
        }
        collectedStats.packetLoss.push(packetsReceived ? packetsLost * 100 / packetsReceived : 0);
      }
    });
}


function initCollectedStats() : PreflightStats {
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

async function collectRTCStatsForDuration({ duration, collectedStats, senderPC, receiverPC }:
  { duration: number; collectedStats: PreflightStats; senderPC: RTCPeerConnection; receiverPC: RTCPeerConnection; }): Promise<PreflightStats> {
  const startTime = Date.now();

  // take a sample every 1000ms.
  const STAT_INTERVAL = Math.min(1000, duration);

  await waitForSometime(STAT_INTERVAL);

  await collectRTCStats({ collectedStats, senderPC, receiverPC });

  const remainingDuration = duration - (Date.now() - startTime);

  if (remainingDuration > 0) {
    collectedStats = await collectRTCStatsForDuration({ duration: remainingDuration, collectedStats, senderPC, receiverPC });
  } else {
    const stats = await receiverPC.getStats();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore: stats does have a values method.
    collectedStats.iceCandidateStats = Array.from(stats.values()).filter((stat: RTCStats) => stat.type === 'local-candidate' || stat.type === 'remote-candidate');
  }
  return collectedStats;
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
 * @property  {number} [max] - mix value observed.
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
 * @typedef {object} RTCStats
 * @property {Stats} [jitter] - Packets delay variation on audio tracks
 * @property {Stats} [rtt] - Round trip time, to the server back to the client in milliseconds.
 * @property {Stats} [networkQuality] - network quality score (1 to 5), available only for group rooms
 * @property {Stats} [outgoingBitrate] - Outgoing bitrate in bits per second.
 * @property {Stats} [incomingBitrate] - Incoming bitrate in bits per second.
 * @property {Stats} [packetLoss] - Packet loss as a percent of total packets sent.
*/

/**
 * Represents report generated by {@link PreflightTest}.
 * @typedef {object} PreflightTestReport
 * @property {string} [roomSid] - Room sid.
 * @property {string} [mediaRegion] - Connected media region (Group Room only).
 * @property {TimeMeasurement} [testTiming] - Time measurements of test run time.
 * @property {NetworkTiming} [networkTiming] - Network related time measurements.
 * @property {RTCStats} [stats] - RTC related stats captured during the test.
 * @property {Array<RTCIceCandidateStats>} [iceCandidateStats] - List of gathered ice candidates.
 * @property {SelectedIceCandidatePairStats} selectedIceCandidatePairStats;
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
 * @property {Array<AudioCodec>} [preferredAudioCodecs=[]] - Preferred audio codecs;
 *  An empty array preserves the current audio codec preference order.
 * @property {Array<VideoCodec|VideoCodecSettings>} [preferredVideoCodecs=[]] -
 *  Preferred video codecs; An empty array preserves the current video codec
 *  preference order. If you want to set a preferred video codec on a Group Room,
 *  you will need to create the Room using the REST API and set the
 *  <code>VideoCodecs</code> property.
 *  See <a href="https://www.twilio.com/docs/api/video/rooms-resource#create-room">
 *  here</a> for more information.
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
 * @description Run a {@link Preflight} test.
 * @memberof module:twilio-video
 * @param {string} token - The Access Token string
 * @param {PreflightOptions} options - options for the test
 * @example
 * var { runPreflight } = require('twilio-video');
 * var preflight = runPreflight();
 * preflightTest.on('progress', progress => {
 *   console.log('preflight progress:', progress);
 * });
 *
 * preflightTest.on('failed', (error: Error) => {
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

