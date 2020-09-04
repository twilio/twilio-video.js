const { EventEmitter } = require('events');
const { waitForSometime } = require('../util');
const connect  = require('../connect');
const createLocalTracks = require('../createlocaltracks');
const TimeMeasurement = require('../util/timemeasurement');
const makeStat = require('../stats/makestat.js');
const SECOND = 1000;
const DEFAULT_TEST_DURATION = 10 * SECOND;

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

  options = Object.assign(options, {
    video: false,
    audio: false,
    networkQuality: true
  });

  const testTiming = new TimeMeasurement();
  let localTracks = null;
  let publisherRoom = null;
  let subscriberRoom = null;
  let trackStartListener = null;
  let connectTiming = null;
  let mediaTiming = null;

  function collectIceCandidates() {
    return Promise.resolve().then(() => {
      const pc = subscriberRoom._signaling._peerConnectionManager._peerConnections.values().next().value._peerConnection._peerConnection;
      return pc.getStats().then(stats => {
        return [...stats.values()].filter(stat => {
          return stat.type === 'local-candidate' || stat.type === 'remote-candidate';
        });
      });
    }).catch(() => {
      return [];
    });
  }

  function collectRTCStats(collectedStats) {
    return Promise.all([subscriberRoom, publisherRoom].map(room => room._signaling.getStats()))
      // eslint-disable-next-line consistent-return
      .then(([subscriberStats, publisherStats]) => {
        const subscriberStatValues = [...subscriberStats.values()];
        const publisherStatValues = [...publisherStats.values()];

        if (publisherStatValues.length > 0) {
          const { activeIceCandidatePair } = publisherStatValues[0];
          if (activeIceCandidatePair && typeof activeIceCandidatePair.availableOutgoingBitrate === 'number') {
            collectedStats.outgoingBitrate.push(activeIceCandidatePair.availableOutgoingBitrate);
          }
        }
        if (subscriberStatValues.length > 0) {
          const { activeIceCandidatePair, remoteAudioTrackStats, remoteVideoTrackStats } = subscriberStatValues[0];
          if (activeIceCandidatePair) {
            if (typeof activeIceCandidatePair.totalRoundTripTime === 'number') {
              collectedStats.rtt.push(activeIceCandidatePair.totalRoundTripTime * 1000);
            }
            if (typeof activeIceCandidatePair.availableIncomingBitrate === 'number') {
              collectedStats.incomingBitrate.push(activeIceCandidatePair.availableIncomingBitrate);
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
            collectedStats.jitter.push(remoteAudioTrackStats[0].jitter);
            packetsLost += remoteAudioTrackStats[0].packetsLost;
            packetsReceived += remoteAudioTrackStats[0].packetsReceived;
          }
          if (remoteVideoTrackStats && remoteVideoTrackStats[0]) {
            packetsLost += remoteVideoTrackStats[0].packetsLost;
            packetsReceived += remoteAudioTrackStats[0].packetsReceived;
          }
          collectedStats.packetLoss.push(packetsReceived ? packetsLost * 100 / packetsReceived : 0);
        }
      });
  }

  function generatePreflightReport(collectedStats) {
    testTiming.stop();
    const selectedIceCandidatePairStats = collectedStats.selectedIceCandidatePairStats;
    const isTurnRequired = selectedIceCandidatePairStats.localCandidate.candidateType === 'relay'
    || selectedIceCandidatePairStats.remoteCandidate.candidateType === 'relay';

    return {
      roomSid: subscriberRoom.sid,
      mediaRegion: subscriberRoom.mediaRegion,
      signalingRegion: subscriberRoom.localParticipant.signalingRegion,
      testTiming,
      networkTiming: {
        connect: connectTiming,
        media: mediaTiming,
      },
      stats: {
        jitter: makeStat(collectedStats.jitter),
        rtt: makeStat(collectedStats.rtt),
        outgoingBitrate: makeStat(collectedStats.outgoingBitrate),
        incomingBitrate: makeStat(collectedStats.incomingBitrate),
        packetLoss: makeStat(collectedStats.packetLoss),
        networkQuality: makeStat(collectedStats.networkQuality),
      },
      selectedIceCandidatePairStats,
      isTurnRequired,
      iceCandidateStats: collectedStats.iceCandidateStats
    };
  }

  function collectRTCStatsForDuration(duration, collectedStats = null) {
    const startTime = Date.now();
    const STAT_INTERVAL = 1000;
    if (collectedStats === null) {
      collectedStats = {
        jitter: [],
        rtt: [],
        outgoingBitrate: [],
        incomingBitrate: [],
        packetLoss: [],
        selectedIceCandidatePairStats: null,
        iceCandidateStats: [],
      };
    }
    return waitForSometime(STAT_INTERVAL).then(() => {
      return collectRTCStats(collectedStats).then(() => {
        const remainingDuration = duration - (Date.now() - startTime);
        return (remainingDuration > 0) ? collectRTCStatsForDuration(remainingDuration, collectedStats) : collectedStats;
      });
    }).then(() => {
      return collectIceCandidates().then(iceCandidates => {
        collectedStats.iceCandidateStats = iceCandidates;
        return collectedStats;
      });
    });
  }

  // @returns {Array<number>}
  function collectNetworkQualityForDuration(duration) {
    const networkQuality = [];
    const localParticipant = subscriberRoom.localParticipant;
    if (localParticipant.networkQualityLevel) {
      networkQuality.push(localParticipant.networkQualityLevel);
    }
    const networkQualityCallback = () => networkQuality.push(localParticipant.networkQualityLevel);
    localParticipant.addListener('networkQualityLevelChanged', networkQualityCallback);
    return waitForSometime(duration).then(() => {
      localParticipant.removeListener('networkQualityLevelChanged', networkQualityCallback);
      return networkQuality;
    });
  }

  function collectStatsForDuration(duration) {
    return Promise.all([
      collectNetworkQualityForDuration(duration),
      collectRTCStatsForDuration(duration),
    ]).then(([networkQuality, collectedStats]) => {
      collectedStats.networkQuality = networkQuality;
      return collectedStats;
    });
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
  function executePreflightStep(stepName, step) {
    const MAX_STEP_DURATION = testDuration + 10 * SECOND;
    if (preflightTest._stopped) {
      throw new Error('stopped');
    }

    if (subscriberRoom && subscriberRoom.state === 'disconnected') {
      throw new Error('subscriber disconnected unexpectedly');
    }

    if (publisherRoom && publisherRoom.state === 'disconnected') {
      throw new Error('publisher disconnected unexpectedly');
    }

    const stepPromise = Promise.resolve().then(step);
    let timer = null;
    const timeoutPromise = new Promise((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Timed out waiting for : ${stepName}`));
      }, MAX_STEP_DURATION);
    });
    return Promise.race([timeoutPromise, stepPromise]).finally(() => {
      clearTimeout(timer);
    });
  }

  return Promise.resolve()
    .then(() => {
      return executePreflightStep('acquire media', () => {
        return createLocalTracks();
      });
    }).then(tracks => {
      return executePreflightStep('connect publisher', () => {
        localTracks = tracks;
        preflightTest.emit('progress', PreflightProgress.mediaAcquired);
        return connect(publisherToken, options);
      });
    }).then(room => {
      return executePreflightStep('connect subscriber', () => {
        publisherRoom = room;
        connectTiming = new TimeMeasurement();
        mediaTiming = new TimeMeasurement();
        return connect(subscriberToken, Object.assign(options, { name: room.sid }));
      });
    }).then(room => {
      return executePreflightStep('publisher sees subscriber', () => {
        subscriberRoom = room;
        connectTiming.stop();
        preflightTest.emit('progress', PreflightProgress.connected);
        trackStartListener = listenForTrackStarted(subscriberRoom, 2);
        return participantsConnected(publisherRoom);
      });
    }).then(() => {
      return executePreflightStep('subscriber sees publisher', () => {
        return participantsConnected(publisherRoom);
      });
    }).then(() => {
      return executePreflightStep('validate rooms', () => {
        if (subscriberRoom.sid !== publisherRoom.sid) {
          throw new Error('wrong room tokens. Ensure that both token join to the same room');
        }
        if (subscriberRoom.participants.size !== 1) {
          throw new Error('unexpected participant found in the room');
        }
        preflightTest.emit('progress', PreflightProgress.remoteConnected);
      });
    }).then(() => {
      return executePreflightStep('publish tracks', () => {
        return publisherRoom.localParticipant.publishTracks(localTracks);
      });
    }).then(() => {
      return executePreflightStep('emit mediaPublished', () => {
        preflightTest.emit('progress', PreflightProgress.mediaPublished);
      });
    }).then(() => {
      return executePreflightStep('wait for tracks to be subscribed', () => {
        return tracksSubscribed(subscriberRoom, 2);
      });
    }).then(() => {
      return executePreflightStep('emit mediaSubscribed', () => {
        preflightTest.emit('progress', PreflightProgress.mediaSubscribed);
      });
    }).then(() => {
      return executePreflightStep('wait for tracks to start', () => {
        return trackStartListener.trackStarted();
      });
    }).then(() => {
      return executePreflightStep('emit mediaStarted', () => {
        mediaTiming.stop();
        preflightTest.emit('progress', PreflightProgress.mediaStarted);
      });
    }).then(() => {
      return executePreflightStep('collect stats', () => {
        return collectStatsForDuration(testDuration);
      });
    }).then(collectedStats => {
      return executePreflightStep('generate report', () => {
        return generatePreflightReport(collectedStats);
      });
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
 * @property {string} [signalingRegion] - Connected signaling region.
 * @property {string} [mediaRegion] - Connected media region (Group Room only).
 * @property {TimeMeasurement} [testTiming] - Time measurements of test run time.
 * @property {NetworkTiming} [networkTiming] - Network related time measurements.
 * @property {RTCStats} [stats] - RTC related stats captured during the test.
 * @property {boolean} [isTurnRequired] - is set to true if turn servers were used for the media.
 * @property {Array<RTCIceCandidateStats>} [iceCandidateStats] - List of gathered ice candidates.
 * @property {SelectedIceCandidatePairStats} selectedIceCandidatePairStats;
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


exports.PreflightTest = PreflightTest;
