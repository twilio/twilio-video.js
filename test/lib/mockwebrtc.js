'use strict';

const { EventEmitter } = require('events');
const WebSocket = require('ws');

const util = require('../../es5/util');

function Event(type) {
  this.type = type;
}

class MediaStream {
  constructor() {
    this.ended = false;
    this.id = util.makeUUID();
    this._tracks = new Set();
  }

  addTrack(track) {
    this._tracks.add(track);
  }

  clone() {
    return new MediaStream();
  }

  getTracks() {
    return Array.from(this._tracks);
  }

  getAudioTracks() {
    return Array.from(this._tracks).filter(track => track.kind === 'audio');
  }

  getTrackById() {
    return null;
  }

  getVideoTracks() {
    return Array.from(this._tracks).filter(track => track.kind === 'video');
  }

  removeTrack(track) {
    this._tracks.delete(track);
  }

  stop() {
  }
}

const navigator = {
  userAgent: 'Node'
};

function getUserMedia() {
  return Promise.resolve(new MediaStream());
}

navigator.mediaDevices = { getUserMedia };

class RTCDataChannel {
  constructor(label) {
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

  send() {
  }

  close() {
    this.readyState = 'closed';
    if (this.onclose) {
      this.onclose();
    }
  }
}

RTCDataChannel.id = 0;

const DUMMY_SDP = 'v=0\r\no=- 4676571761825475727 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=group:BUNDLE audio\r\na=msid-semantic: WMS EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq\r\nm=audio 1 RTP/SAVPF 111 103 104 0 8 106 105 13 126\r\nc=IN IP4 0.0.0.0\r\na=rtcp:1 IN IP4 0.0.0.0\r\na=ice-ufrag:YDUcqfaDo8TP7sAf\r\na=ice-pwd:6pBfcQxQqfHcUN90IcETG9ag\r\na=ice-options:google-ice\r\na=fingerprint:sha-256 C9:98:D1:85:C6:79:AF:26:76:80:28:B5:19:B3:65:DA:D6:E8:BC:29:6A:48:59:8C:13:06:6C:3B:D3:EE:86:01\r\na=setup:actpass\r\na=mid:audio\r\na=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r\na=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\na=sendrecv\r\na=rtcp-mux\r\na=rtpmap:111 opus/48000/2\r\na=fmtp:111 minptime=10\r\na=rtpmap:103 ISAC/16000\r\na=rtpmap:104 ISAC/32000\r\na=rtpmap:0 PCMU/8000\r\na=rtpmap:8 PCMA/8000\r\na=rtpmap:106 CN/32000\r\na=rtpmap:105 CN/16000\r\na=rtpmap:13 CN/8000\r\na=rtpmap:126 telephone-event/8000\r\na=maxptime:60\r\na=ssrc:489352021 cname:aDhWDndkoIsLM2YP\r\na=ssrc:489352021 msid:EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq fabea357-f6cf-4967-aa7c-800bedf06927\r\na=ssrc:489352021 mslabel:EMeI3G202R6Q6h3SNWynn4aSHT8JbeeYozwq\r\na=ssrc:489352021 label:fabea357-f6cf-4967-aa7c-800bedf06927\r\nm=video 9 UDP/TLS/RTP/SAVPF 96 97 102 122 127 121 125 107 108 109 124 120 39 40 45 46 98 99 100 101 123 119 114 115 116\r\nc=IN IP4 0.0.0.0\r\na=rtcp:9 IN IP4 0.0.0.0\r\na=ice-ufrag:aLOD\r\na=ice-pwd:UBm8xWRYf28rcW4iS6XARgMe\r\na=ice-options:trickle\r\na=fingerprint:sha-256 73:BB:6E:13:D8:96:2B:85:28:5D:86:1C:6B:3D:B2:07:3D:CA:B0:B9:15:2E:CD:1B:18:19:FE:10:46:20:8C:28\r\na=setup:actpass\r\na=mid:2\r\na=extmap:1 urn:ietf:params:rtp-hdrext:toffset\r\na=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r\na=extmap:3 urn:3gpp:video-orientation\r\na=extmap:4 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r\na=extmap:5 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r\na=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r\na=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r\na=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/color-space\r\na=extmap:9 urn:ietf:params:rtp-hdrext:sdes:mid\r\na=extmap:10 urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id\r\na=extmap:11 urn:ietf:params:rtp-hdrext:sdes:repaired-rtp-stream-id\r\na=sendrecv\r\na=msid:- 26b2e231-3961-41c5-809d-c0506fc95d5d\r\na=rtcp-mux\r\na=rtcp-rsize\r\na=rtpmap:96 VP8/90000\r\na=rtcp-fb:96 goog-remb\r\na=rtcp-fb:96 transport-cc\r\na=rtcp-fb:96 ccm fir\r\na=rtcp-fb:96 nack\r\na=rtcp-fb:96 nack pli\r\na=rtpmap:97 rtx/90000\r\na=fmtp:97 apt=96\r\na=rtpmap:102 H264/90000\r\na=rtcp-fb:102 goog-remb\r\na=rtcp-fb:102 transport-cc\r\na=rtcp-fb:102 ccm fir\r\na=rtcp-fb:102 nack\r\na=rtcp-fb:102 nack pli\r\na=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r\na=rtpmap:122 rtx/90000\r\na=fmtp:122 apt=102\r\na=rtpmap:127 H264/90000\r\na=rtcp-fb:127 goog-remb\r\na=rtcp-fb:127 transport-cc\r\na=rtcp-fb:127 ccm fir\r\na=rtcp-fb:127 nack\r\na=rtcp-fb:127 nack pli\r\na=fmtp:127 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42001f\r\na=rtpmap:121 rtx/90000\r\na=fmtp:121 apt=127\r\na=rtpmap:125 H264/90000\r\na=rtcp-fb:125 goog-remb\r\na=rtcp-fb:125 transport-cc\r\na=rtcp-fb:125 ccm fir\r\na=rtcp-fb:125 nack\r\na=rtcp-fb:125 nack pli\r\na=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r\na=rtpmap:107 rtx/90000\r\na=fmtp:107 apt=125\r\na=rtpmap:108 H264/90000\r\na=rtcp-fb:108 goog-remb\r\na=rtcp-fb:108 transport-cc\r\na=rtcp-fb:108 ccm fir\r\na=rtcp-fb:108 nack\r\na=rtcp-fb:108 nack pli\r\na=fmtp:108 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f\r\na=rtpmap:109 rtx/90000\r\na=fmtp:109 apt=108\r\na=rtpmap:124 H264/90000\r\na=rtcp-fb:124 goog-remb\r\na=rtcp-fb:124 transport-cc\r\na=rtcp-fb:124 ccm fir\r\na=rtcp-fb:124 nack\r\na=rtcp-fb:124 nack pli\r\na=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d001f\r\na=rtpmap:120 rtx/90000\r\na=fmtp:120 apt=124\r\na=rtpmap:39 H264/90000\r\na=rtcp-fb:39 goog-remb\r\na=rtcp-fb:39 transport-cc\r\na=rtcp-fb:39 ccm fir\r\na=rtcp-fb:39 nack\r\na=rtcp-fb:39 nack pli\r\na=fmtp:39 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=4d001f\r\na=rtpmap:40 rtx/90000\r\na=fmtp:40 apt=39\r\na=rtpmap:45 AV1/90000\r\na=rtcp-fb:45 goog-remb\r\na=rtcp-fb:45 transport-cc\r\na=rtcp-fb:45 ccm fir\r\na=rtcp-fb:45 nack\r\na=rtcp-fb:45 nack pli\r\na=rtpmap:46 rtx/90000\r\na=fmtp:46 apt=45\r\na=rtpmap:98 VP9/90000\r\na=rtcp-fb:98 goog-remb\r\na=rtcp-fb:98 transport-cc\r\na=rtcp-fb:98 ccm fir\r\na=rtcp-fb:98 nack\r\na=rtcp-fb:98 nack pli\r\na=fmtp:98 profile-id=0\r\na=rtpmap:99 rtx/90000\r\na=fmtp:99 apt=98\r\na=rtpmap:100 VP9/90000\r\na=rtcp-fb:100 goog-remb\r\na=rtcp-fb:100 transport-cc\r\na=rtcp-fb:100 ccm fir\r\na=rtcp-fb:100 nack\r\na=rtcp-fb:100 nack pli\r\na=fmtp:100 profile-id=2\r\na=rtpmap:101 rtx/90000\r\na=fmtp:101 apt=100\r\na=rtpmap:123 H264/90000\r\na=rtcp-fb:123 goog-remb\r\na=rtcp-fb:123 transport-cc\r\na=rtcp-fb:123 ccm fir\r\na=rtcp-fb:123 nack\r\na=rtcp-fb:123 nack pli\r\na=fmtp:123 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=64001f\r\na=rtpmap:119 rtx/90000\r\na=fmtp:119 apt=123\r\na=rtpmap:114 red/90000\r\na=rtpmap:115 rtx/90000\r\na=fmtp:115 apt=114\r\na=rtpmap:116 ulpfec/90000\r\na=ssrc-group:FID 1570350979 3208838993\r\na=ssrc:1570350979 cname:lfYM2Lp8YompCFRl\r\na=ssrc:1570350979 msid:- 26b2e231-3961-41c5-809d-c0506fc95d5d\r\na=ssrc:3208838993 cname:lfYM2Lp8YompCFRl\r\na=ssrc:3208838993 msid:- 26b2e231-3961-41c5-809d-c0506fc95d5d\r\n';

class RTCSessionDescription {
  constructor(init) {
    init = init || {};
    this.type = init.type || 'offer';
    this.sdp = init.sdp || DUMMY_SDP;
  }

  toJSON() {
    return {
      type: this.type,
      sdp: this.sdp
    };
  }
}

class RTCRtpTransceiver {
  constructor() {

  }
  get currentDirection() {
    return 'foo';
  }
}

class RTCRtpSender {
}

RTCRtpSender.getCapabilities = function getCapabilities(kind) {
  return {
    audio: {
      codecs: [
        { mimeType: 'audio/opus' },
        { mimeType: 'audio/ISAC' },
        { mimeType: 'audio/PCMU' },
        { mimeType: 'audio/PCMA' },
        { mimeType: 'audio/G722' }
      ]
    },
    video: {
      codecs: [
        { mimeType: 'video/VP8' },
        { mimeType: 'video/H264' }
      ]
    }
  }[kind];
};

class RTCPeerConnection extends EventEmitter {
  constructor() {
    super();
    this.iceConnectionState = 'completed';
    this.iceGatheringState = 'complete';
    this.localDescription = null;
    this.peerIdentity = null;
    this.remoteDescription = null;
    this.signalingState = 'stable';
  }

  addTransceiver() {

  }

  createOffer() {
    return Promise.resolve(new RTCSessionDescription({ type: 'offer', sdp: DUMMY_SDP }));
  }

  createAnswer() {
    return Promise.resolve(new RTCSessionDescription({ type: 'answer', sdp: DUMMY_SDP }));
  }

  setLocalDescription(description) {
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
  }

  setRemoteDescription(description) {
    return new Promise(resolve => {
      this.remoteDescription = new RTCSessionDescription(description);
      setTimeout(() => {
        resolve();
      });
    });
  }

  updateIce() {
  }

  addIceCandidate() {
    return Promise.resolve();
  }

  getConfiguration() {
  }

  getLocalStreams() {
    return [];
  }

  getRemoteStreams() {
    return [];
  }

  getStreamById() {
  }

  addStream() {
  }

  removeStream() {
  }

  close() {
  }

  createDataChannel(label) {
    return new RTCDataChannel(label);
  }

  createDTMFSender() {
  }

  getState() {
  }

  setIdentityProvider() {
  }

  getIdentityAssertion() {
  }

  getStats() {
    return Promise.resolve([]);
  }

  addEventListener() {
    return this.addListener(...arguments);
  }

  removeEventListener() {
    return this.removeListener(...arguments);
  }
}

function attachMediaStream() {
}

function URL() {
}

function createObjectURL() {
  return new URL();
}

function revokeObjectURL() {
}

URL.createObjectURL = createObjectURL;

URL.revokeObjectURL = revokeObjectURL;

function mockWebRTC(_global) {
  _global = _global || global;
  const _window = _global.window = _global;
  _window.addEventListener = function addEventListener() {};
  _global.Event = Event;
  _global.WebSocket = WebSocket;
  _global.navigator = navigator;
  _global.webkitMediaStream = MediaStream;
  _global.MediaStream = MediaStream;
  _global.RTCDataChannel = RTCDataChannel;
  _global.RTCRtpSender = RTCRtpSender;
  _global.RTCRtpTransceiver = RTCRtpTransceiver;
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
module.exports.RTCRtpSender = RTCRtpSender;
module.exports.RTCRtpTransceiver = RTCRtpTransceiver;
module.exports.DUMMY_SDP = DUMMY_SDP;
module.exports.RTCPeerConnection = RTCPeerConnection;
module.exports.RTCSessionDescription = RTCSessionDescription;
module.exports.attachMediaStream = attachMediaStream;
module.exports.URL = URL;
module.exports.createObjectURL = createObjectURL;
module.exports.revokeObjectURL = revokeObjectURL;
