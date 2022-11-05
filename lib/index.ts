/**
 * @module twilio-video
 * @property {boolean} isSupported - true if the current browser is officially
 *   supported by twilio-video.js; In this context, "supported" means that
 *   twilio-video.js has been extensively tested with this browser; This
 *   <a href="https://www.twilio.com/docs/video/javascript#supported-browsers" target="_blank">table</a>
 *   specifies the list of officially supported browsers.
 *
 * @property {object} Logger - The <a href="https://www.npmjs.com/package/loglevel" target="_blank">loglevel</a>
 *    module used by the SDK. Use this object to access the internal loggers and perform actions as defined by the
 *   <a href="https://www.npmjs.com/package/loglevel" target="_blank">loglevel</a> APIs.
 *   See [connect](#.connect) for examples.
 *
 * @property {string} version - current version of twilio-video.js.
 */

import { createLocalAudioTrack, createLocalVideoTrack } from './createlocaltrack';
import { connect } from './connect';
import { createLocalTracks } from './createlocaltracks';
import { runPreflight } from './preflight/preflighttest';

export { createLocalAudioTrack, createLocalVideoTrack } from './createlocaltrack';
export { connect } from './connect';
export { createLocalTracks } from './createlocaltracks';
export { runPreflight } from './preflight/preflighttest';
export const { LocalAudioTrack, LocalDataTrack, LocalVideoTrack } = require('./media/track/es5');
export const Logger = require('./vendor/loglevel');
export const isSupported = require('./util/support')();
export const { version } = require('../package.json');

export default {
  LocalAudioTrack,
  LocalDataTrack,
  LocalVideoTrack,
  Logger,
  connect,
  createLocalAudioTrack,
  createLocalTracks,
  createLocalVideoTrack,
  isSupported,
  runPreflight,
  version,
};
