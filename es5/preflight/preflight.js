'use strict';

var _require = require('../util/constants'),
    E = _require.typeErrors;

var _require2 = require('../util'),
    isNonArrayObject = _require2.isNonArrayObject;

var PreflightTest = require('./preflighttest');

/**
 * Test the connection to Twilio servers, and generate report for the connection.
 * This function uses token parameters supplied to establish a room connection
 * and generates a report on success. it can be used to verify end to end
 * connectivity. Tokens used for this api call should be associated with unique test room,
 * Test will join the room specified in the token. if room does not exist an ad-hoc room will
 * be created of the type specified in your <a href="https://www.twilio.com/console/video/configure"> console settings </a>
 *
 * @alias module:twilio-video.testPreflight
 * @param {string} publisherToken - The Access Token string for the participant. This participant will publish tracks.
 * @param {string} subscriberToken - The Access Token string for the participant. This participant will subscribe to tracks.
 * @param {PreflightOptions} [options] - Options to override the default behavior
 * @returns {PreflightTest} - a {@link PreflightTest} object that can be used to monitor the progress of the test
 * @example
 * var Video = require('twilio-video');
 * var publisherToken = getAccessToken('alice');
 * var subscriberToken = getAccessToken('bob');
 * var preflightTest = Video.testPreflight(publisherToken, subscriberToken);
 * preflightTest.on('completed', function(report) {
 *   console.log("Test completed in " + report.testTiming.duration + " milliseconds.");
 *   console.log(" It took " + report.networkTiming.connect.duration + " milliseconds to connect");
 *   console.log(" It took " + report.networkTiming.media.duration + " milliseconds to receive media");
 *   console.log(" Your network score was: " + report.stats.networkQuality); // only available for group rooms.
 * });
 *
 * preflightTest.on('failed', function(error) {
 *   console.log("Test failed:" + error);
 * });
 *
 * preflightTest.on('progress', function(progressState) {
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
 * @property {LogLevel|LogLevels} [logLevel='warn'] - Set the log verbosity
 *   of logging to console. Passing a {@link LogLevel} string will use the same
 *   level for all components. Pass a {@link LogLevels} to set specific log
 *   levels.
 */
module.exports = testPreflight;