'use strict';

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
    value: require('./localtrackses6').LocalAudioTrack
  },
  LocalDataTrack: {
    enumerable: true,
    value: require('./localtrackses6').LocalDataTrack
  },
  LocalVideoTrack: {
    enumerable: true,
    value: require('./localtrackses6').LocalVideoTrack
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;
