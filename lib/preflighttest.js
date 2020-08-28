const { EventEmitter } = require('events');
const { waitForSometime } = require('./util');
const connect  = require('./connect');
const createLocalTracks = require('./createlocaltracks');
const TimeMeasurement = require('./util/timemeasurement');
const makeStat = require('./stats/makestat.js');
const SECOND = 1000;
const DEFAULT_TEST_DURATION = 5 * SECOND;

/**
 * A {@link PreflightTest} monitors progress of an ongoing preflight test. Instance of {@link PreflightTest}
 * is returned by calling {@link module:twilio-video.testPreflight}
 * @extends EventEmitter
 * @property {?RemoteParticipant} dominantSpeaker - The Dominant Speaker in the
 *   {@link Room}, if any
 * @emits PreflightTest#completed
 * @emits PreflightTest#failed
 * @emits PreflightTest#progress
 */
class PreflightTest extends EventEmitter {
  /**
   * Construct {@link PreflightTest}.
   * @hideconstructor
   * @param {string} publisherToken
   * @param {string} subscriberToken
   * @param {?object} [options={}]
   */
  constructor(publisherToken, subscriberToken, options) {
    super();
    runPreflightTest(publisherToken, subscriberToken, options, this);
  }

  /**
   * stops ongoing tests and emits error
   */
  stop() {
    this._stopped = true;
  }
}

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
  mediaStarted: 'mediaStarted'
};

function participantsConnected(room) {
  if (room.participants.size === 0) {
    return new Promise(resolve => room.once('participantConnected', resolve));
  }
  return Promise.resolve();
}

function listenForTrackStarted(room, n) {
  const deferred = {};
  const tracksStarted = [];
  deferred.promise = new Promise(resolve => {
    deferred.resolve = resolve;
  });
  const trackStartedCallback = track => {
    tracksStarted.push(track);
    if (tracksStarted.length === n) {
      deferred.resolve();
    }
  };
  room.on('trackStarted', trackStartedCallback);
  return {
    stop: () => room.removeListener('trackStarted', trackStartedCallback),
    trackStarted: () => deferred.promise
  };
}

function tracksSubscribed(room, n) {
  return new Promise(resolve => {
    const remoteParticipant = [...room.participants.values()][0];
    let tracksToWaitFor = n - remoteParticipant.tracks.size;
    if (tracksToWaitFor > 0) {
      remoteParticipant.on('trackSubscribed', () => {
        tracksToWaitFor--;
        if (tracksToWaitFor === 0) {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
}

function runPreflightTest(publisherToken, subscriberToken, options, preflightTest) {
  const testDuration = options.duration || DEFAULT_TEST_DURATION;
  delete options.duration; // duration is not a Video.connect option.

  options = Object.assign({
    region: 'gll',
    video: false,
    audio: false,
    networkQuality: true,
  }, options);

  const testTiming = new TimeMeasurement();
  let localTracks = null;
  let publisherRoom = null;
  let subscriberRoom = null;
  let trackStartListener = null;
  let connectTiming = null;
  let mediaTiming = null;

  const checkIfStopped = () => {
    if (preflightTest._stopped) {
      throw new Error('stopped');
    }
  };

  // collects stats at regular interval
  function collectStats(stats) {
    return subscriberRoom._signaling.getStats().then(responses => {
      const resp = [...responses.values()];
      if (resp.length > 0) {
        const { activeIceCandidatePair, remoteAudioTrackStats, remoteVideoTrackStats } = resp[0];
        if (activeIceCandidatePair) {
          // console.log('activeIceCandidatePair: ', activeIceCandidatePair);
          stats.rtt.push(activeIceCandidatePair.totalRoundTripTime);
          stats.outgoingBitrate.push(activeIceCandidatePair.availableOutgoingBitrate);
          stats.incomingBitrate.push(activeIceCandidatePair.availableIncomingBitrate);
        }

        let packetsLost = 0;
        let packetsReceived = 0;
        if (remoteAudioTrackStats && remoteAudioTrackStats[0]) {
          stats.jitter.push(remoteAudioTrackStats[0].jitter);
          packetsLost += remoteAudioTrackStats[0].packetsLost;
          packetsReceived += remoteAudioTrackStats[0].packetsReceived;
        }
        if (remoteVideoTrackStats && remoteVideoTrackStats[0]) {
          packetsLost += remoteVideoTrackStats[0].packetsLost;
          packetsReceived += remoteAudioTrackStats[0].packetsReceived;
        }
        stats.packetLoss.push(packetsReceived ? packetsLost * 100 / packetsReceived : 0);
      }
    });
  }

  function generatePreflightReport(stats) {
    stats.jitter = makeStat(stats.jitter);
    stats.rtt = makeStat(stats.rtt);
    stats.outgoingBitrate = makeStat(stats.outgoingBitrate);
    stats.incomingBitrate = makeStat(stats.incomingBitrate);
    stats.packetLoss = makeStat(stats.packetLoss);
    stats.networkQuality = makeStat(stats.networkQuality);
    return subscriberRoom.getStats()
      .then(subscriberStats => {
        testTiming.stop();
        return {
          testTiming,
          roomSid: subscriberRoom.sid,
          mediaRegion: subscriberRoom.mediaRegion,
          signalingRegion: subscriberRoom.signalingRegion,
          networkTiming: {
            connect: connectTiming,
            media: mediaTiming,
          },
          stats,
          // RTCStats stats;
          // Array<RTCIceCandidateStats> localIceCandidates;
          // RTCIceCandidateStats selectedLocalIceCandidate;
          // RTCIceCandidateStats selectedRemoteIceCandidate;
          ...subscriberStats
        };
      });
  }

  function collectStatsPeriodically(duration, stats) {
    const startTime = Date.now();
    const STAT_INTERVAL = 1000;
    const firstCall = !stats;
    let networkQualityCallback = null;
    const localParticipant = subscriberRoom.localParticipant;
    if (firstCall) {
      // initialize with empty stats and
      // hook up network quality callback.
      stats = {
        jitter: [],
        rtt: [],
        networkQuality: [],
        outgoingBitrate: [],
        incomingBitrate: [],
        packetLoss: [],
      };


      if (localParticipant.networkQualityLevel) {
        stats.networkQuality.push(localParticipant.networkQualityLevel);
      }
      networkQualityCallback = () => stats.networkQuality.push(localParticipant.networkQualityLevel);
      localParticipant.addListener('networkQualityLevelChanged', networkQualityCallback);
    }
    return collectStats(stats).then(() => {
      console.log('stats:', stats);
      const remainingDuration = duration - (Date.now() - startTime);
      if (remainingDuration > 0) {
        return waitForSometime(STAT_INTERVAL).then(() => {
          return collectStatsPeriodically(remainingDuration - 1000, stats);
        });
      }
      return stats;
    }).finally(() => {
      // un hook network quality monitor;
      if (networkQualityCallback) {
        localParticipant.removeListener('networkQualityLevelChanged', networkQualityCallback);
      }
    });
  }

  createLocalTracks()
    .then(tracks => {
      localTracks = tracks;
      checkIfStopped();
      preflightTest.emit('progress', PreflightProgress.mediaAcquired);
      return connect(publisherToken, options);
    }).then(room => {
      publisherRoom = room;
      checkIfStopped();
      connectTiming = new TimeMeasurement();
      mediaTiming = new TimeMeasurement();
      return connect(subscriberToken, Object.assign(options, { name: room.sid }));
    }).then(room => {
      subscriberRoom = room;
      connectTiming.stop();
      checkIfStopped();
      preflightTest.emit('progress', PreflightProgress.connected);
      // hook up for track started.
      trackStartListener = listenForTrackStarted(subscriberRoom, 2);
      return participantsConnected(publisherRoom);
    }).then(() => {
      checkIfStopped();
      return participantsConnected(subscriberRoom);
    }).then(() => {
      checkIfStopped();
      // assert that both participants are in same room,
      // and there are only two participants.
      if (subscriberRoom.sid !== publisherRoom.sid) {
        throw new Error('wrong room tokens. Ensure that both token join to the same room');
      }
      if (subscriberRoom.participants.size !== 1) {
        throw new Error('unexpected participant found in the room');
      }
      preflightTest.emit('progress', PreflightProgress.remoteConnected);
    }).then(() => {
      checkIfStopped();
      return publisherRoom.localParticipant.publishTracks(localTracks);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreflightProgress.mediaPublished);
    }).then(() => {
      checkIfStopped();
      return tracksSubscribed(subscriberRoom, 2);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreflightProgress.mediaSubscribed);
    }).then(() => {
      checkIfStopped();
      return trackStartListener.trackStarted();
    }).then(() => {
      checkIfStopped();
      mediaTiming.stop();
      preflightTest.emit('progress', PreflightProgress.mediaStarted);
    }).then(() => {
      return collectStatsPeriodically(testDuration);
    }).then(collectedStats => {
      checkIfStopped();
      return generatePreflightReport(collectedStats);
    }).then(report => {
      preflightTest.emit('completed', report);
    }).catch(error => {
      preflightTest.emit('failed', error);
    }).finally(() => {
      if (trackStartListener) {
        trackStartListener.stop();
        trackStartListener = null;
      }

      if (publisherRoom) {
        publisherRoom.disconnect();
        publisherRoom = null;
      }

      if (subscriberRoom) {
        subscriberRoom.disconnect();
        subscriberRoom = null;
      }

      if (localTracks) {
        localTracks.forEach(track => track.stop());
        localTracks = null;
      }
    });
}

/**
 * Represents network timing measurements captured during preflight test
 * @typedef {object} NetworkTiming
 * @property {TimeMeasurement} [connect] - Time to establish connection. This is measured from initiating a connection using `Video.connect()`
 *  up to when the connect promise resolves
 * @property {TimeMeasurement} [media] - Time to start media. This is measured from calling connect to remote media getting started.
 */

/**
 * Represents stats for a numerical metric.
 * @typedef {object} Stats
 * @property  {number} [average] - average value observed.
 * @property  {number} [max] - mix value observed.
 * @property  {number} [min] - min value observed.
 */

/**
 * Represents RTC related stats that were observed during preflight test
 * @typedef {object} RTCStats
 * @property {Stats} [jitter] - Packets delay variation on audio tracks
 * @property {Stats} [rtt] - Round trip time, to the server back to the client.
 * @property {Stats} [networkQuality] - network quality score (1 to 5), available only for group rooms
 * @property {Stats} [outgoingBitrate] - Outgoing bitrate in bits per second.
 * @property {Stats} [incomingBitrate] - Incoming bitrate in bits per second.
 * @property {Stats} [packetLoss] - Packet loss as a percent of total packets sent.
*/

/**
 * Represents report generated by {@link PreflightTest}.
 * @typedef {object} PreflightTestReport
 * @property {string} [roomSid] - Room sid.
 * @property {string} [signalingRegion] - Connected signaling region.
 * @property {string} [mediaRegion] - Connected media region (Group Room only).
 * @property {TimeMeasurement} [testTiming] - Time measurements of test run time.
 * @property {NetworkTiming} [networkTiming] - Network related time measurements.
 * @property {RTCStats} [stats] - RTC related stats captured during the test.
 * @property {Array<RTCIceCandidateStats>} [localIceCandidates] - List of gathered local candidates.
 * @property {RTCIceCandidateStats} [selectedLocalIceCandidate] - Selected local ice candidate.
 * @property {RTCIceCandidateStats} [selectedRemoteIceCandidate] - Selected remote ice candidate.
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
 * Fired to indicate progress of the test
 * @param {PreflightProgress} progress - indicates the status completed.
 * @event PreflightTest#progress
 */

exports.PreflightTest = PreflightTest;
