'use strict';

/**
 * @module twilio-video
 * @property {boolean} isSupported - true if the current browser is officially supported by twilio-video.js.
 * @property {string} version - current version of twilio-video.js.
 */
const version = require('../package.json').version;
const Video = {};

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
    value: require('./media/track/es5/localaudiotrack')
  },
  LocalDataTrack: {
    enumerable: true,
    value: require('./media/track/es5/localdatatrack')
  },
  LocalVideoTrack: {
    enumerable: true,
    value: require('./media/track/es5/localvideotrack')
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;
