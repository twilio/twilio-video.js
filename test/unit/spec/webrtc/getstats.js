'use strict';

var assert = require('assert');
var FakeMediaStream = require('../../../lib/fakemediastream').FakeMediaStream;
var FakeMediaStreamTrack = require('../../../lib/fakemediastream').FakeMediaStreamTrack;
var FakeRTCPeerConnection = require('../../../lib/fakestats').FakeRTCPeerConnection;
var getStats = require('../../../../lib/webrtc/getstats');

describe('getStats', function() {
  it('should reject the promise if RTCPeerConnection is not specified', () => {
    return new Promise((resolve, reject) => {
      getStats().then(reject).catch(error => {
        try {
          assert.equal(error.message, 'Given PeerConnection does not support getStats');
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });

  it('should reject the promise if RTCPeerConnection is null', () => {
    return new Promise((resolve, reject) => {
      getStats(null).then(reject).catch(error => {
        try {
          assert.equal(error.message, 'Given PeerConnection does not support getStats');
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });

  it('should reject the promise if RTCPeerConnection does not have a getStats() method', () => {
    return new Promise((resolve, reject) => {
      getStats({}).then(reject).catch(error => {
        try {
          assert.equal(error.message, 'Given PeerConnection does not support getStats');
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });

  it('should reject the promise if getStats() is not supported', () => {
    return new Promise((resolve, reject) => {
      var peerConnection = new FakeRTCPeerConnection();
      var localStream = new FakeMediaStream();

      localStream.addTrack(new FakeMediaStreamTrack('audio'));
      peerConnection._addLocalStream(localStream);

      getStats(peerConnection).then(reject).catch(error => {
        try {
          assert.equal(error.message, 'RTCPeerConnection#getStats() not supported');
          resolve();
        } catch(e) {
          reject(e);
        }
      });
    });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Chrome', () => {
    var options = {
      chromeFakeStats: {
        googCodecName: 'codec',
        googRtt: 1,
        googJitterReceived: 5,
        googFrameWidthInput: 160,
        googFrameHeightInput: 120,
        googFrameWidthSent: 320,
        googFrameHeightSent: 240,
        googFrameWidthReceived: 640,
        googFrameHeightReceived: 480,
        googFrameRateInput: 30,
        googFrameRateSent: 29,
        googFrameRateReceived: 25,
        googJitterBufferMs: 44,
        ssrc: 'foo',
        bytesReceived: 99,
        bytesSent: 101,
        packetsLost: 0,
        packetsReceived: 434,
        packetsSent: 900,
        audioInputLevel: 80,
        audioOutputLevel: 65
      }
    };
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    return getStats(peerConnection, { testForChrome: true })
      .then(response => {
        assert.equal(response.localAudioTrackStats.length, 1);
        assert.equal(response.localVideoTrackStats.length, 1);
        assert.equal(response.remoteAudioTrackStats.length, 1);
        assert.equal(response.remoteVideoTrackStats.length, 1);

        response.localAudioTrackStats.concat(response.localVideoTrackStats)
          .concat(response.remoteAudioTrackStats)
          .concat(response.remoteVideoTrackStats)
          .forEach(report => {
            assert(report.trackId);
            assert(report.timestamp);
            assert.equal(report.codecName, options.chromeFakeStats.googCodecName);
            assert.equal(report.roundTripTime, options.chromeFakeStats.googRtt * 1000);
            assert.equal(report.jitter, options.chromeFakeStats.googJitterReceived);
            assert.equal(report.frameWidthInput, options.chromeFakeStats.googFrameWidthInput);
            assert.equal(report.frameHeightInput, options.chromeFakeStats.googFrameHeightInput);
            assert.equal(report.frameWidthSent, options.chromeFakeStats.googFrameWidthSent);
            assert.equal(report.frameHeightSent, options.chromeFakeStats.googFrameHeightSent);
            assert.equal(report.frameWidthReceived, options.chromeFakeStats.googFrameWidthReceived);
            assert.equal(report.frameHeightReceived, options.chromeFakeStats.googFrameHeightReceived);
            assert.equal(report.frameRateInput, options.chromeFakeStats.googFrameRateInput);
            assert.equal(report.frameRateSent, options.chromeFakeStats.googFrameRateSent);
            assert.equal(report.frameRateReceived, options.chromeFakeStats.googFrameRateReceived);
            assert.equal(report.ssrc, options.chromeFakeStats.ssrc);
            assert.equal(report.bytesReceived, options.chromeFakeStats.bytesReceived);
            assert.equal(report.bytesSent, options.chromeFakeStats.bytesSent);
            assert.equal(report.packetsLost, options.chromeFakeStats.packetsLost);
            assert.equal(report.packetsReceived, options.chromeFakeStats.packetsReceived);
            assert.equal(report.packetsSent, options.chromeFakeStats.packetsSent);
            assert.equal(report.audioInputLevel, options.chromeFakeStats.audioInputLevel);
            assert.equal(report.audioOutputLevel, options.chromeFakeStats.audioOutputLevel);
          });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Firefox (outbound)', () => {
    var options = {
      firefoxFakeStats: {
        outbound_rtcp_media_0: {
          timestamp: 12345,
          type: 'inboundrtp',
          isRemote: true,
          ssrc: 'foo',
          bytesReceived: 100,
          packetsLost: 10,
          packetsReceived: 25,
          jitter: 0.03,
          mozRtt: 2
        },
        outbound_rtp_media_0: {
          timestamp: 67890,
          type: 'outboundrtp',
          isRemote: false,
          ssrc: 'foo',
          bytesSent: 45,
          packetsSent: 50,
          frameRateMean: 28.84
        }
      }
    };
    var fakeInbound = options.outbound_rtcp_media_0;
    var fakeOutbound = options.outbound_rtp_media_0;
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    getStats(peerConnection, { testForFirefox: true })
      .then(response => {
        assert.equal(response.localAudioTrackStats.length, 1);
        assert.equal(response.localVideoTrackStats.length, 1);
        assert.equal(response.remoteAudioTrackStats.length, 1);
        assert.equal(response.remoteVideoTrackStats.length, 1);

        response.localAudioTrackStats.concat(response.localVideoTrackStats)
          .concat(response.remoteAudioTrackStats)
          .concat(response.remoteVideoTrackStats)
          .forEach(report => {
            assert(report.trackId);
            assert(report.timestamp);
            assert.equal(report.frameRateSent, Math.round(fakeOutbound.frameRateMean));
            assert.equal(report.ssrc, fakeOutbound.ssrc);
            assert.equal(report.bytesSent, fakeOutbound.bytesSent);
            assert.equal(report.packetsSent, fakeOutbound.packetsSent);
            assert.equal(report.bytesReceived, fakeInbound.bytesReceived);
            assert.equal(report.packetsReceived, fakeInbound.packetsReceived);
            assert.equal(report.packetsLost, fakeInbound.packetsLost);
            assert.equal(report.jitter, fakeInbound.jitter);
            assert.equal(report.roundTripTime, fakeInbound.mozRtt * 1000);
          });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Firefox (inbound)', () => {
    var options = {
      firefoxFakeStats: {
        inbound_rtcp_media_0: {
          timestamp: 12345,
          type: 'outboundrtp',
          isRemote: true,
          ssrc: 'foo',
          bytesSent: 100,
          packetsSent: 25
        },
        inbound_rtp_media_0: {
          timestamp: 67890,
          type: 'inboundrtp',
          isRemote: false,
          ssrc: 'foo',
          bytesReceived: 45,
          packetsReceived: 50,
          packetsLost: 5,
          jitter: 0.05,
          frameRateMean: 20.45
        }
      }
    };
    var fakeInbound = options.inbound_rtp_media_0;
    var fakeOutbound = options.inbound_rtcp_media_0;
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    getStats(peerConnection, { testForFirefox: true })
      .then(response => {
        assert.equal(response.localAudioTrackStats.length, 1);
        assert.equal(response.localVideoTrackStats.length, 1);
        assert.equal(response.remoteAudioTrackStats.length, 1);
        assert.equal(response.remoteVideoTrackStats.length, 1);

        response.localAudioTrackStats.concat(response.localVideoTrackStats)
          .concat(response.remoteAudioTrackStats)
          .concat(response.remoteVideoTrackStats)
          .forEach(report => {
            assert(report.trackId);
            assert(report.timestamp);
            assert.equal(report.frameRateReceived, Math.round(fakeInbound.frameRateMean));
            assert.equal(report.ssrc, fakeInbound.ssrc);
            assert.equal(report.bytesReceived, fakeInbound.bytesReceived);
            assert.equal(report.packetsReceived, fakeInbound.packetsReceived);
            assert.equal(report.packetsLost, fakeInbound.packetsLost);
            assert.equal(report.jitter, fakeInbound.jitter);
            assert.equal(report.bytesSent, fakeOutbound.bytesSent);
            assert.equal(report.packetsSent, fakeInbound.packetsSent);
          });
      });
  });
});
