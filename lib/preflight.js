'use strict';

const { typeErrors: E } = require('./util/constants');
const {
  isNonArrayObject
} = require('./util');
const { EventEmitter } = require('events');
const  connect  = require('./connect');
// const { waitForSometime } = require('./util');
const createLocalTracks = require('./createlocaltracks');
// const SECOND = 1000;

/**
 * progress values that are sent by {@link PreflightTest#event:progress}
 * @enum {string}
 */
// eslint-disable-next-line
const PreFlightProgress = {
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

function runPreflightTest(publisherToken, subscriberToken, options, preflightTest) {
  let localTracks = null;
  let publisherRoom = null;
  let subscriberRoom = null;
  let trackStartListener = null;

  function participantsConnected(room) {
    if (room.participants.size === 0) {
      return new Promise(resolve => room.once('participantConnected', resolve));
    }
    return Promise.resolve();
  }

  function listenForTrackStartedEvents(room, n) {
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

  // resolves after n tracks are subscribed.
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

  const checkIfStopped = () => {
    if (preflightTest._stopped) {
      throw new Error('stopped');
    }
  };

  createLocalTracks()
    .then(tracks => {
      localTracks = tracks;
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.mediaAcquired);
      return connect(publisherToken, options);
    }).then(room => {
      publisherRoom = room;
      checkIfStopped();
      return connect(subscriberToken, Object.assign(options, { name: room.sid }));
    }).then(room => {
      subscriberRoom = room;
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.connected);
      // hook up for track started.
      trackStartListener = listenForTrackStartedEvents(subscriberRoom, 2);
      return participantsConnected(publisherRoom);
    }).then(() => {
      checkIfStopped();
      return participantsConnected(subscriberRoom);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.remoteConnected);
    }).then(() => {
      checkIfStopped();
      return publisherRoom.localParticipant.publishTracks(localTracks);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.mediaPublished);
    }).then(() => {
      checkIfStopped();
      return tracksSubscribed(subscriberRoom, 2);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.mediaSubscribed);
    }).then(() => {
      checkIfStopped();
      return trackStartListener.trackStarted();
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('progress', PreFlightProgress.mediaStarted);
    }).then(() => {
      checkIfStopped();
      preflightTest.emit('completed', 'report is not implemented yet');
    }).catch(error => {
      preflightTest.emit('error', error);
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
 * Preflight test has completed successfully.
 * @param {?PreflightTestReport} report - results of the test.
 * @event PreflightTest#completed
 */

/**
 * Preflight test has encountered a failed and is now stopped.
 * @param {TwilioError|Error} error - error object
 * @event PreflightTest#failed
 */

/**
 * Fired to indicate progress of the test
 * @param {PreFlightProgress} progress - indicates the status completed.
 * @event PreflightTest#progress
 */

/**
 * Tests the connection
 *   <br><br>
 *   This function uses the given tokens to establish a room connection
 *   and generates a report on success. it can be used to verify end to end
 *   connectivity,
 * @alias module:twilio-video.testPreflight
 * @param {string} publisherToken - The Access Token string for the participant. This participant will publish tracks.
 * @param {string} subscriberToken - The Access Token string for the participant. This participant will subscribe to tracks.
 * @param {PreflightOptions} [options] - Options to override the default behavior
 * @returns {PreflightTest} - This object can be used to monitor the progress.
 * @example
 * var Video = require('twilio-video');
 * var publisherToken = getAccessToken('alice');
 * var subscriberToken = getAccessToken('bob');
 * var preflightTest = Video.testPreflight(publisherToken, subscriberToken);
 * preflightTest.on('completed', function(report) {
 *   console.log(report);
 * });
 *
 * preflightTest.on('failed', function(error) {
 *   console.log(error);
 * });
 *
 * preflightTest.on('progress', function(progressState) {
 *  // "mediaAcquired", "connected", "remoteConnected", "mediaPublished", "mediaSubscribed", "mediaStarted"
 *   console.log(progressState);
 * });
 */
function testPreflight(publisherToken, subscriberToken, options) {
  if (typeof options === 'undefined') {
    options = {};
  }

  if (!isNonArrayObject(options)) {
    // eslint-disable-next-line new-cap
    throw E.INVALID_TYPE('options', 'PreflightOptions');
  }

  if (typeof publisherToken !== 'string') {
    // eslint-disable-next-line new-cap
    throw E.INVALID_TYPE('publisherToken', 'string');
  }

  if (typeof subscriberToken !== 'string') {
    // eslint-disable-next-line new-cap
    throw E.INVALID_TYPE('subscriberToken', 'string');
  }

  return new PreflightTest(publisherToken, subscriberToken, options);
}

/**
 * You may pass these options to {@link testPreflight} in order to override the
 * default behavior.
 * @typedef {object} PreflightOptions
 * @property {string} [region='gll'] - Preferred signaling region; By default, you will be connected to the
 *   nearest signaling server determined by latency based routing. Setting a value other
 *   than <code style="padding:0 0">gll</code> bypasses routing and guarantees that signaling traffic will be
 *   terminated in the region that you prefer. Please refer to this <a href="https://www.twilio.com/docs/video/ip-address-whitelisting#signaling-communication" target="_blank">table</a>
 *   for the list of supported signaling regions.
 * @property {Array<AudioCodec>} [preferredAudioCodecs=[]] - Preferred audio codecs;
 *  An empty array preserves the current audio codec preference order.
 * @property {Array<VideoCodec|VideoCodecSettings>} [preferredVideoCodecs=[]] -
 *  Preferred video codecs; An empty array preserves the current video codec
 *  preference order. If you want to set a preferred video codec on a Group Room,
 *  you will need to create the Room using the REST API and set the
 *  <code>VideoCodecs</code> property.
 *  See <a href="https://www.twilio.com/docs/api/video/rooms-resource#create-room">
 *  here</a> for more information.
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 */


module.exports = testPreflight;
