'use strict';

const { EventEmitter } = require('events');
const { inherits } = require('util');
const WebSocket = require('ws');

const util = require('../../lib/util');

function Event(type) {
  this.type = type;
}

function MediaStream() {
  this.ended = false;
  this.id = util.makeUUID();
  this._tracks = new Set();
}

MediaStream.prototype.addTrack = function addTrack(track) {
  this._tracks.add(track);
};

MediaStream.prototype.clone = function clone() {
  return new MediaStream();
};

MediaStream.prototype.getTracks = function getTracks() {
  return Array.from(this._tracks);
};

MediaStream.prototype.getAudioTracks = function getAudioTracks() {
  return Array.from(this._tracks).filter(track => track.kind === 'audio');
};

MediaStream.prototype.getTrackById = function getTrackById(trackid) {
  return null;
};

MediaStream.prototype.getVideoTracks = function getVideoTracks() {
  return Array.from(this._tracks).filter(track => track.kind === 'video');
};

MediaStream.prototype.removeTrack = function removeTrack(track) {
  this._tracks.delete(track);
};

MediaStream.prototype.stop = function stop() {
};

const navigator = {
  userAgent: 'Node'
};

function getUserMedia(constraints, successCallback, errorCallback) {
  const mediaStream = new MediaStream();
  setTimeout(() => successCallback(mediaStream));
}

navigator.webkitGetUserMedia = getUserMedia;

function RTCDataChannel(label) {
  this.label = label;
  this.order = true;
  this.prototcol = '';
  this.id = RTCDataChannel.id++;
  this.readyState = 'connecting';
  this.bufferedAmount = 0;
  this.binaryType = 'blob';
  setTimeout(() => {
    this.readyState = 'open';
    if (this.onopen) {
      this.onopen();
    }
  });
}

RTCDataChannel.id = 0;

RTCDataChannel.prototype.send = function send(message) {
};

RTCDataChannel.prototype.close = function close() {
  this.readyState = 'closed';
  if (this.onclose) {
    this.onclose();
  }
};

const DUMMY_SDP = 'v=0\r\no=- 4676571761825475727 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio\r\na=msid-semantic: WMS EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq\r\nm=audio 1 RTP/SAVPF 111 103 104 0 8 106 105 13 126\r\nc=IN IP4 0.0.0.0\r\na=rtcp:1 IN IP4 0.0.0.0\r\na=ice-ufrag:YDUcqfaDo8TP7sAf\r\na=ice-pwd:6pBfcQxQqfHcUN90IcETG9ag\r\na=ice-options:google-ice\r\na=fingerprint:sha-256 C9:98:D1:85:C6:79:AF:26:76:80:28:B5:19:B3:65:DA:D6:E8:BC:29:6A:48:59:8C:13:06:6C:3B:D3:EE:86:01\r\na=setup:actpass\r\na=mid:audio\r\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\na=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\na=sendrecv\r\na=rtcp-mux\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10\r\na=rtpmap:103 ISAC/16000\r\na=rtpmap:104 ISAC/32000\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:106 CN/32000\r\na=rtpmap:105 CN/16000\r\na=rtpmap:13 CN/8000\r\na=rtpmap:126 telephone-event/8000\r\na=maxptime:60\r\na=ssrc:489352021 cname:aDhWDndkoIsLM2YP\r\na=ssrc:489352021 msid:EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq fabea357-f6cf-4967-aa7c-800bedf06927\r\na=ssrc:489352021 mslabel:EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq\r\na=ssrc:489352021 label:fabea357-f6cf-4967-aa7c-800bedf06927\r\n';

function RTCPeerConnection(configuration, constraints) {
  EventEmitter.call(this);
  this.iceConnectionState = 'completed';
  this.iceGatheringState = 'complete';
  this.localDescription = null;
  this.peerIdentity = null;
  this.remoteDescription = null;
  this.signalingState = 'stable';
}

inherits(RTCPeerConnection, EventEmitter);

RTCPeerConnection.prototype.addEventListener = RTCPeerConnection.prototype.addListener;

RTCPeerConnection.prototype.createOffer = function createOffer() {
  return Promise.resolve(new RTCSessionDescription({ type: 'offer', sdp: DUMMY_SDP }));
};

RTCPeerConnection.prototype.createAnswer = function createAnswer() {
  return Promise.resolve(new RTCSessionDescription({ type: 'answer', sdp: DUMMY_SDP }));
};

RTCPeerConnection.prototype.removeEventListener = RTCPeerConnection.prototype.removeListener;

RTCPeerConnection.prototype.setLocalDescription = function setLocalDescription(description) {
  return new Promise(resolve => {
    this.localDescription = new RTCSessionDescription(description);
    setTimeout(() => {
      resolve();
      if (this.onicecandidate) {
        this.onicecandidate({ candidate: null });
        this.emit('icecandidate', { candidate: null });
      }
    });
  });
};

RTCPeerConnection.prototype.setRemoteDescription = function setRemoteDescription(description) {
  return new Promise(resolve => {
    this.remoteDescription = new RTCSessionDescription(description);
    setTimeout(() => {
      resolve();
    });
  });
};

RTCPeerConnection.prototype.updateIce = function updateIce(configuration, constraints) {
};

RTCPeerConnection.prototype.addIceCandidate = function addIceCandidate() {
  return Promise.resolve();
};

RTCPeerConnection.prototype.getConfiguration = function getConfiguration() {
};

RTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
  return [];
};

RTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
  return [];
};

RTCPeerConnection.prototype.getStreamById = function getStreamById() {
};

RTCPeerConnection.prototype.addStream = function addStream() {
};

RTCPeerConnection.prototype.removeStream = function removeStream() {
};

RTCPeerConnection.prototype.close = function close() {
};

RTCPeerConnection.prototype.createDataChannel = function createDataChannel(label, dataChannelDict) {
  return new RTCDataChannel(label);
};

RTCPeerConnection.prototype.createDTMFSender = function createDTMFSender() {
};

RTCPeerConnection.prototype.getState = function getState() {
};

RTCPeerConnection.prototype.setIdentityProvider = function setIdentityProvider() {
};

RTCPeerConnection.prototype.getIdentityAssertion = function getIdentityAssertion() {
};

RTCPeerConnection.prototype.getStats = function getStats() {
  return Promise.resolve([]);
};

function RTCSessionDescription(init) {
  init = init || {};
  this.type = init.type || 'offer';
  this.sdp = init.sdp || DUMMY_SDP;
}

RTCSessionDescription.prototype.toJSON = function toJSON() {
  return {
    type: this.type,
    sdp: this.sdp
  };
};

function attachMediaStream() {
}

function URL() {
}

function createObjectURL(blob) {
  return new URL();
}

function revokeObjectURL(blob) {
}

URL.createObjectURL = createObjectURL;

URL.revokeObjectURL = revokeObjectURL;

function mockWebRTC(_global) {
  _global = _global || global;
  const _window = _global.window = _global;
  _window.addEventListener = function addEventListener(){};
  _global.Event = Event;
  _global.WebSocket = WebSocket;
  _global.navigator = navigator;
  _global.webkitMediaStream = MediaStream;
  _global.MediaStream = MediaStream;
  _global.RTCDataChannel = RTCDataChannel;
  _global.RTCPeerConnection = RTCPeerConnection;
  _global.RTCSessionDescription = RTCSessionDescription;
  _global.attachMediaStream = attachMediaStream;
  _global.URL = URL;
  _global.location = {
    protocol: 'https',
    host: 'bar'
  };
  return _global;
}

module.exports = mockWebRTC;
module.exports.WebSocket = WebSocket;
module.exports.MediaStream = MediaStream;
module.exports.webkitMediaStream = MediaStream;
module.exports.getUserMedia = getUserMedia;
module.exports.navigator = navigator;
module.exports.RTCDataChannel = RTCDataChannel;
module.exports.DUMMY_SDP = DUMMY_SDP;
module.exports.RTCPeerConnection = RTCPeerConnection;
module.exports.RTCSessionDescription = RTCSessionDescription;
module.exports.attachMediaStream = attachMediaStream;
module.exports.URL = URL;
module.exports.createObjectURL = createObjectURL;
module.exports.revokeObjectURL = revokeObjectURL;
