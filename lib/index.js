'use strict';

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
  LocalAudioTrack: {
    enumerable: true,
    value: require('./media/track/localaudiotrack')
  },
  LocalVideoTrack: {
    enumerable: true,
    value: require('./media/track/localvideotrack')
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;
