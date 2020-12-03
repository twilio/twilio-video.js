'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('../eventemitter');

var _require = require('../util'),
    waitForSometime = _require.waitForSometime;

var connect = require('../connect');
var TimeMeasurement = require('../util/timemeasurement');
var makeStat = require('../stats/makestat.js');

var _require2 = require('./synthetic'),
    createAudioTrack = _require2.createAudioTrack,
    createVideoTrack = _require2.createVideoTrack;

var LocalAudioTrack = require('../media/track/es5/localaudiotrack');
var LocalVideoTrack = require('../media/track/es5/localvideotrack');
var SECOND = 1000;
var DEFAULT_TEST_DURATION = 10 * SECOND;

/**
 * A {@link PreflightTest} monitors progress of an ongoing preflight test.
 * <br><br>
 * Instance of {@link PreflightTest} is returned by calling {@link module:twilio-video.testPreflight}
 * @extends EventEmitter
 * @emits PreflightTest#completed
 * @emits PreflightTest#failed
 * @emits PreflightTest#progress
 */

var PreflightTest = function (_EventEmitter) {
  _inherits(PreflightTest, _EventEmitter);

  /**
   * Constructs {@link PreflightTest}.
   * @param {string} publisherToken
   * @param {string} subscriberToken
   * @param {?PreflightOptions} [options]
   */
  function PreflightTest(publisherToken, subscriberToken, options) {
    _classCallCheck(this, PreflightTest);

    var _this = _possibleConstructorReturn(this, (PreflightTest.__proto__ || Object.getPrototypeOf(PreflightTest)).call(this));

    runPreflightTest(publisherToken, subscriberToken, options, _this);
    return _this;
  }

  /**
   * stops ongoing tests and emits error
   */


  _createClass(PreflightTest, [{
    key: 'stop',
    value: function stop() {
      this._stopped = true;
    }
  }]);

  return PreflightTest;
}(EventEmitter);

/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
// eslint-disable-next-line


var PreflightProgress = {
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
    return new Promise(function (resolve) {
      return room.once('participantConnected', resolve);
    });
  }
  return Promise.resolve();
}

function listenForTrackStarted(room, n) {
  var deferred = {};
  var tracksStarted = [];
  deferred.promise = new Promise(function (resolve) {
    deferred.resolve = resolve;
  });
  var trackStartedCallback = function trackStartedCallback(track) {
    tracksStarted.push(track);
    if (tracksStarted.length === n) {
      deferred.resolve();
    }
  };
  room.on('trackStarted', trackStartedCallback);
  return {
    stop: function stop() {
      return room.removeListener('trackStarted', trackStartedCallback);
    },
    trackStarted: function trackStarted() {
      return deferred.promise;
    }
  };
}

function tracksSubscribed(room, n) {
  return new Promise(function (resolve) {
    var remoteParticipant = [].concat(_toConsumableArray(room.participants.values()))[0];
    var tracksToWaitFor = n - remoteParticipant.tracks.size;
    if (tracksToWaitFor > 0) {
      remoteParticipant.on('trackSubscribed', function () {
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
  var testDuration = options.duration || DEFAULT_TEST_DURATION;
  delete options.duration; // duration is not a Video.connect option.

  options = Object.assign(options, {
    video: false,
    audio: false,
    preflight: true,
    networkQuality: true
  });

  var testTiming = new TimeMeasurement();
  var localTracks = null;
  var publisherRoom = null;
  var subscriberRoom = null;
  var trackStartListener = null;
  var connectTiming = null;
  var mediaTiming = null;

  function collectIceCandidates() {
    return Promise.resolve().then(function () {
      var pc = subscriberRoom._signaling._peerConnectionManager._peerConnections.values().next().value._peerConnection._peerConnection;
      return pc.getStats().then(function (stats) {
        return [].concat(_toConsumableArray(stats.values())).filter(function (stat) {
          return stat.type === 'local-candidate' || stat.type === 'remote-candidate';
        });
      });
    }).catch(function () {
      return [];
    });
  }

  function collectRTCStats(collectedStats) {
    return Promise.all([subscriberRoom, publisherRoom].map(function (room) {
      return room._signaling.getStats();
    }))
    // eslint-disable-next-line consistent-return
    .then(function (_ref) {
      var _ref2 = _slicedToArray(_ref, 2),
          subscriberStats = _ref2[0],
          publisherStats = _ref2[1];

      var subscriberStatValues = [].concat(_toConsumableArray(subscriberStats.values()));
      var publisherStatValues = [].concat(_toConsumableArray(publisherStats.values()));

      if (publisherStatValues.length > 0) {
        var activeIceCandidatePair = publisherStatValues[0].activeIceCandidatePair;

        if (activeIceCandidatePair && typeof activeIceCandidatePair.availableOutgoingBitrate === 'number') {
          collectedStats.outgoingBitrate.push(activeIceCandidatePair.availableOutgoingBitrate);
        }
      }
      if (subscriberStatValues.length > 0) {
        var _subscriberStatValues = subscriberStatValues[0],
            _activeIceCandidatePair = _subscriberStatValues.activeIceCandidatePair,
            remoteAudioTrackStats = _subscriberStatValues.remoteAudioTrackStats,
            remoteVideoTrackStats = _subscriberStatValues.remoteVideoTrackStats;

        if (_activeIceCandidatePair) {
          if (typeof _activeIceCandidatePair.currentRoundTripTime === 'number') {
            collectedStats.rtt.push(_activeIceCandidatePair.currentRoundTripTime * 1000);
          }
          if (typeof _activeIceCandidatePair.availableIncomingBitrate === 'number') {
            collectedStats.incomingBitrate.push(_activeIceCandidatePair.availableIncomingBitrate);
          }

          if (!collectedStats.selectedIceCandidatePairStats) {
            collectedStats.selectedIceCandidatePairStats = {
              localCandidate: _activeIceCandidatePair.localCandidate,
              remoteCandidate: _activeIceCandidatePair.remoteCandidate
            };
          }
        }

        var packetsLost = 0;
        var packetsReceived = 0;
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
    var selectedIceCandidatePairStats = collectedStats.selectedIceCandidatePairStats;
    var isTurnRequired = selectedIceCandidatePairStats.localCandidate.candidateType === 'relay' || selectedIceCandidatePairStats.remoteCandidate.candidateType === 'relay';

    return {
      roomSid: subscriberRoom.sid,
      mediaRegion: subscriberRoom.mediaRegion,
      signalingRegion: subscriberRoom.localParticipant.signalingRegion,
      testTiming: testTiming.toJSON(),
      networkTiming: {
        connect: connectTiming.toJSON(),
        media: mediaTiming.toJSON()
      },
      stats: {
        jitter: makeStat(collectedStats.jitter),
        rtt: makeStat(collectedStats.rtt),
        outgoingBitrate: makeStat(collectedStats.outgoingBitrate),
        incomingBitrate: makeStat(collectedStats.incomingBitrate),
        packetLoss: makeStat(collectedStats.packetLoss),
        networkQuality: makeStat(collectedStats.networkQuality)
      },
      selectedIceCandidatePairStats: selectedIceCandidatePairStats,
      isTurnRequired: isTurnRequired,
      iceCandidateStats: collectedStats.iceCandidateStats
    };
  }

  function collectRTCStatsForDuration(duration) {
    var collectedStats = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    var startTime = Date.now();
    var STAT_INTERVAL = 1000;
    if (collectedStats === null) {
      collectedStats = {
        jitter: [],
        rtt: [],
        outgoingBitrate: [],
        incomingBitrate: [],
        packetLoss: [],
        selectedIceCandidatePairStats: null,
        iceCandidateStats: []
      };
    }
    return waitForSometime(STAT_INTERVAL).then(function () {
      return collectRTCStats(collectedStats).then(function () {
        var remainingDuration = duration - (Date.now() - startTime);
        return remainingDuration > 0 ? collectRTCStatsForDuration(remainingDuration, collectedStats) : collectedStats;
      });
    }).then(function () {
      return collectIceCandidates().then(function (iceCandidates) {
        collectedStats.iceCandidateStats = iceCandidates;
        return collectedStats;
      });
    });
  }

  // @returns {Array<number>}
  function collectNetworkQualityForDuration(duration) {
    var networkQuality = [];
    var localParticipant = subscriberRoom.localParticipant;
    if (localParticipant.networkQualityLevel) {
      networkQuality.push(localParticipant.networkQualityLevel);
    }
    var networkQualityCallback = function networkQualityCallback() {
      return networkQuality.push(localParticipant.networkQualityLevel);
    };
    localParticipant.addListener('networkQualityLevelChanged', networkQualityCallback);
    return waitForSometime(duration).then(function () {
      localParticipant.removeListener('networkQualityLevelChanged', networkQualityCallback);
      return networkQuality;
    });
  }

  function collectStatsForDuration(duration) {
    return Promise.all([collectNetworkQualityForDuration(duration), collectRTCStatsForDuration(duration)]).then(function (_ref3) {
      var _ref4 = _slicedToArray(_ref3, 2),
          networkQuality = _ref4[0],
          collectedStats = _ref4[1];

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
    var MAX_STEP_DURATION = testDuration + 10 * SECOND;
    if (preflightTest._stopped) {
      throw new Error('stopped');
    }

    if (subscriberRoom && subscriberRoom.state === 'disconnected') {
      throw new Error('subscriber disconnected unexpectedly');
    }

    if (publisherRoom && publisherRoom.state === 'disconnected') {
      throw new Error('publisher disconnected unexpectedly');
    }

    var stepPromise = Promise.resolve().then(step);
    var timer = null;
    var timeoutPromise = new Promise(function (_resolve, reject) {
      timer = setTimeout(function () {
        reject(new Error('Timed out waiting for : ' + stepName));
      }, MAX_STEP_DURATION);
    });
    return Promise.race([timeoutPromise, stepPromise]).finally(function () {
      clearTimeout(timer);
    });
  }

  return Promise.resolve().then(function () {
    return executePreflightStep('acquire media', function () {
      return [new LocalAudioTrack(createAudioTrack(), { workaroundWebKitBug1208516: false, workaroundWebKitBug180748: false }), new LocalVideoTrack(createVideoTrack(), { workaroundWebKitBug1208516: false, workaroundSilentLocalVideo: false })];
    });
  }).then(function (tracks) {
    return executePreflightStep('connect publisher', function () {
      localTracks = tracks;
      preflightTest.emit('progress', PreflightProgress.mediaAcquired);
      return connect(publisherToken, options);
    });
  }).then(function (room) {
    return executePreflightStep('connect subscriber', function () {
      publisherRoom = room;
      connectTiming = new TimeMeasurement();
      mediaTiming = new TimeMeasurement();
      return connect(subscriberToken, Object.assign(options, { name: room.sid }));
    });
  }).then(function (room) {
    return executePreflightStep('publisher sees subscriber', function () {
      subscriberRoom = room;
      connectTiming.stop();
      preflightTest.emit('progress', PreflightProgress.connected);
      trackStartListener = listenForTrackStarted(subscriberRoom, 2);
      return participantsConnected(publisherRoom);
    });
  }).then(function () {
    return executePreflightStep('subscriber sees publisher', function () {
      return participantsConnected(publisherRoom);
    });
  }).then(function () {
    return executePreflightStep('validate rooms', function () {
      if (subscriberRoom.sid !== publisherRoom.sid) {
        throw new Error('Incorrect room tokens. Ensure that both tokens connect to the same room.');
      }
      if (subscriberRoom.participants.size !== 1) {
        throw new Error('Unexpected participant found in the room. Ensure that the room has no participants in it.');
      }
      preflightTest.emit('progress', PreflightProgress.remoteConnected);
    });
  }).then(function () {
    return executePreflightStep('publish tracks', function () {
      return publisherRoom.localParticipant.publishTracks(localTracks);
    });
  }).then(function () {
    return executePreflightStep('emit mediaPublished', function () {
      preflightTest.emit('progress', PreflightProgress.mediaPublished);
    });
  }).then(function () {
    return executePreflightStep('wait for tracks to be subscribed', function () {
      return tracksSubscribed(subscriberRoom, 2);
    });
  }).then(function () {
    return executePreflightStep('emit mediaSubscribed', function () {
      preflightTest.emit('progress', PreflightProgress.mediaSubscribed);
    });
  }).then(function () {
    return executePreflightStep('wait for tracks to start', function () {
      return trackStartListener.trackStarted();
    });
  }).then(function () {
    return executePreflightStep('emit mediaStarted', function () {
      mediaTiming.stop();
      preflightTest.emit('progress', PreflightProgress.mediaStarted);
    });
  }).then(function () {
    return executePreflightStep('collect stats', function () {
      return collectStatsForDuration(testDuration);
    });
  }).then(function (collectedStats) {
    return executePreflightStep('generate report', function () {
      return generatePreflightReport(collectedStats);
    });
  }).then(function (report) {
    preflightTest.emit('completed', report);
  }).catch(function (error) {
    preflightTest.emit('failed', error);
  }).finally(function () {
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
      localTracks.forEach(function (track) {
        return track.stop();
      });
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

module.exports = PreflightTest;