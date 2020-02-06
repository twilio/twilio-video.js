'use strict';

const {
  LocalAudioTrack,
  LocalDataTrack,
  LocalVideoTrack
} = require('./media/track/es5');

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
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;
