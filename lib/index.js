'use strict';

var version = require('../package').version;
var Video = {};

Object.defineProperties(Video, {
  connect: {
    enumerable: true,
    value: require('./connect')
  },
  createLocalTracks: {
    enumerable: true,
    value: require('./createlocaltracks')
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
