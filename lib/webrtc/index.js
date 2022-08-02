'use strict';

var stats = require('./getstats');

var WebRTC = {};

Object.defineProperties(WebRTC, {
  getStats: {
    enumerable: true,
    value: stats.getStats
  },
  getTrackStats: {
    enumerable: true,
    value: stats.getTrackStats
  },
  getUserMedia: {
    enumerable: true,
    value: require('./getusermedia')
  },
  MediaStream: {
    enumerable: true,
    value: require('./mediastream')
  },
  MediaStreamTrack: {
    enumerable: true,
    value: require('./mediastreamtrack')
  },
  RTCIceCandidate: {
    enumerable: true,
    value: require('./rtcicecandidate')
  },
  RTCPeerConnection: {
    enumerable: true,
    value: require('./rtcpeerconnection')
  },
  RTCSessionDescription: {
    enumerable: true,
    value: require('./rtcsessiondescription')
  }
});

module.exports = WebRTC;
