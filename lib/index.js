'use strict';

var version = require('../package').version;

function Rooms(accessManager, options) {
  return new Rooms.Client(accessManager, options);
}

Object.defineProperties(Rooms, {
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

module.exports = Rooms;
