'use strict';

var _require = require('./media/track/es5'),
    LocalAudioTrack = _require.LocalAudioTrack,
    LocalDataTrack = _require.LocalDataTrack,
    LocalVideoTrack = _require.LocalVideoTrack;

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


var version = require('../package.json').version;
var Video = {};

Object.defineProperties(Video, {
  connect: {
    enumerable: true,
    value: require('./connect')
  },
  createLocalAudioTrack: {
    enumerable: true,
    value: require('./createlocaltrack').audio
  },
  createLocalTracks: {
    enumerable: true,
    value: require('./createlocaltracks')
  },
  createLocalVideoTrack: {
    enumerable: true,
    value: require('./createlocaltrack').video
  },
  isSupported: {
    enumerable: true,
    value: require('./util/support')()
  },
  LocalAudioTrack: {
    enumerable: true,
    value: LocalAudioTrack
  },
  LocalDataTrack: {
    enumerable: true,
    value: LocalDataTrack
  },
  LocalVideoTrack: {
    enumerable: true,
    value: LocalVideoTrack
  },
  Logger: {
    enumerable: true,
    value: require('loglevel')
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;