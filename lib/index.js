'use strict';

var version = require('../package').version;

function Video(accessManager, options) {
  return new Video.Client(accessManager, options);
}

Object.defineProperties(Video, {
  Client: {
    enumerable: true,
    value: require('./client')
  },
  getUserMedia: {
    enumerable: true,
    value: require('./webrtc/getusermedia')
  },
  LocalMedia: {
    enumerable: true,
    value: require('./media/localmedia')
  },
  version: {
    enumerable: true,
    value: version
  }
});

module.exports = Video;
