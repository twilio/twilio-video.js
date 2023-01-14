'use strict';

const WebRTC = {};

Object.defineProperties(WebRTC, {
  getStats: {
    enumerable: true,
    value: require('./getstats')
  },
  getUserMedia: {
    enumerable: true,
    value: require('./getusermedia')
  },
  RTCPeerConnection: {
    enumerable: true,
    value: require('./rtcpeerconnection')
  }
});

module.exports = WebRTC;
