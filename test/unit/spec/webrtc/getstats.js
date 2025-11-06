/* eslint-disable camelcase */
'use strict';

var assert = require('assert');
var { FakeMediaStream, FakeMediaStreamTrack } = require('../../../lib/webrtc/fakemediastream');
const { capitalize } = require('../../../lib/util');
var { FakeRTCPeerConnection } = require('../../../lib/webrtc/fakestats');
var getStats = require('../../../../lib/webrtc/getstats');

/**
 * Fake logger for testing with empty info, warn, and error methods.
 */
class FakeLogger {
  info() {}
  warn() {}
  error() {}
}

describe('getStats', function() {
  it('should reject the promise if RTCPeerConnection is not specified', () => {
    return new Promise((resolve, reject) => {
      getStats().then(reject).catch(error => {
        try {
          assert.equal(error.message, 'Given PeerConnection does not support getStats');
          resolve();
        } catch (e) {
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
        } catch (e) {
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
        } catch (e) {
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
        } catch (e) {
          reject(e);
        }
      });
    });
  });

  ['chrome', 'firefox', 'safari'].forEach(browser => {
    it(`should reject the promise if an exception is raised while standardizing the stats (${browser})`, async () => {
      const peerConnection = new FakeRTCPeerConnection({ [`${browser}FakeStats`]: [] });
      const localStream = new FakeMediaStream();
      let error;

      localStream.addTrack(new FakeMediaStreamTrack('audio'));
      peerConnection._addLocalStream(localStream);

      try {
        await getStats(peerConnection, {
          [`testFor${capitalize(browser)}`]: true,
          simulateExceptionWhileStandardizingStats: true
        });
      } catch (e) {
        error = e;
      } finally {
        assert(error instanceof Error);
      }
    });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Chrome (inbound)', () => {
    var options = {
      chromeFakeStats: new Map(Object.entries({
        RTCInboundRTPVideoStream_3692393529: {
          bytesReceived: 30011,
          codecId: 'RTCCodec_video0_Inbound_96',
          decoderImplementation: 'libvpx',
          estimatedPlayoutTimestamp: 3848581138504,
          firCount: 0,
          frameHeight: 360,
          frameWidth: 640,
          framesDecoded: 43,
          framesDropped: 0,
          framesPerSecond: null,
          framesReceived: 43,
          headerBytesReceived: 920,
          id: 'RTCInboundRTPVideoStream_2569502525',
          jitter: 0.005,
          jitterBufferDelay: 1.129,
          jitterBufferEmittedCount: 42,
          keyFramesDecoded: 2,
          kind: 'video',
          lastPacketReceivedTimestamp: 1639592338412,
          mediaType: 'video',
          nackCount: 0,
          packetsLost: 0,
          packetsReceived: 46,
          pliCount: 0,
          qpSum: 3999,
          ssrc: 2569502525,
          timestamp: 1639592338598.977,
          totalDecodeTime: 0.019,
          totalInterFrameDelay: 1.7410000000000003,
          totalSquaredInterFrameDelay: 0.07349900000000002,
          trackId: 'RTCMediaStreamTrack_receiver_35',
          transportId: 'RTCTransport_0_1',
          type: 'inbound-rtp'
        },
        RTCMediaStreamTrack_receiver_35: {
          audioLevel: 0.1,
          detached: false,
          ended: false,
          frameHeight: 360,
          frameWidth: 640,
          framesDecoded: 43,
          framesDropped: 0,
          framesReceived: 43,
          id: 'RTCMediaStreamTrack_receiver_35',
          jitterBufferDelay: 1.129,
          jitterBufferEmittedCount: 42,
          kind: 'video',
          remoteSource: true,
          timestamp: 1639592338598.977,
          trackIdentifier: '67b4e5d0-a942-4ddc-a7af-0d33958e6d32',
          type: 'track'
        },
        RTCCodec_audio_Inbound_109: {
          clockRate: 48000,
          id: 'RTCCodec_audio_Inbound_109',
          mimeType: 'audio/opus',
          payloadType: 109,
          timestamp: 1543604205208.696,
          type: 'codec'
        }
      }))
    };
    var fakeInboundStat = options.chromeFakeStats.get('RTCInboundRTPVideoStream_3692393529');
    var fakeTrackStat = options.chromeFakeStats.get('RTCMediaStreamTrack_receiver_35');
    var fakeCodecStat = options.chromeFakeStats.get('RTCCodec_audio_Inbound_109');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    return getStats(peerConnection, { testForChrome: true, log: new FakeLogger() })
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
            assert.equal(report.codecName, fakeCodecStat.mimeType.split('/')[1]);
            assert.equal(report.jitter, Math.round(fakeInboundStat.jitter * 1000));
            assert.equal(report.frameWidthReceived, fakeTrackStat.frameWidth);
            assert.equal(report.frameHeightReceived, fakeTrackStat.frameHeight);
            assert.equal(report.frameRateReceived, fakeInboundStat.framesPerSecond);
            assert.equal(report.ssrc, fakeInboundStat.ssrc);
            assert.equal(report.bytesReceived, fakeInboundStat.bytesReceived);
            assert.equal(report.bytesSent, fakeInboundStat.bytesSent);
            assert.equal(report.packetsLost, fakeInboundStat.packetsLost);
            assert.equal(report.packetsReceived, fakeInboundStat.packetsReceived);
            assert.equal(report.packetsSent, fakeInboundStat.packetsSent);
            assert.equal(report.audioOutputLevel, normalizeAudioLevel(fakeTrackStat.audioLevel));
            assert.equal(report.estimatedPlayoutTimestamp, fakeInboundStat.estimatedPlayoutTimestamp);
            assert.equal(report.framesDecoded, fakeInboundStat.framesDecoded);
            assert.equal(report.jitterBufferDelay, fakeInboundStat.jitterBufferDelay);
            assert.equal(report.jitterBufferEmittedCount, fakeInboundStat.jitterBufferEmittedCount);
            assert.equal(report.totalDecodeTime, fakeInboundStat.totalDecodeTime);
          });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Chrome (outbound)', () => {
    var options = {
      chromeFakeStats: new Map(Object.entries({
        RTCOutboundRTPVideoStream_4003256843: {
          bytesSent: 425592592,
          frameHeight: 540,
          frameWidth: 960,
          codecId: 'RTCCodec_video_Outbound_120',
          firCount: 0,
          framesEncoded: 34221,
          framesPerSecond: 20,
          id: 'RTCOutboundRTPVideoStream_4003256843',
          isRemote: false,
          mediaType: 'video',
          nackCount: 0,
          packetsSent: 371331,
          pliCount: 0,
          qpSum: 572871,
          ssrc: 4003256843,
          timestamp: 1543604170954.952,
          totalEncodeTime: 15000,
          totalPacketSendDelay: 7.25,
          trackId: 'RTCMediaStreamTrack_sender_3',
          transportId: 'RTCTransport_audio_1',
          type: 'outbound-rtp'
        },
        RTCMediaStreamTrack_sender_3: {
          detached: false,
          ended: false,
          frameHeight: 720,
          frameWidth: 1280,
          framesSent: 34221,
          hugeFramesSent: 73,
          id: 'RTCMediaStreamTrack_sender_3',
          kind: 'video',
          remoteSource: false,
          timestamp: 1543604170954.952,
          trackIdentifier: 'ffdd22d1-4fab-4042-969d-a568aabeb614',
          type: 'track'
        },
        RTCCodec_video_Outbound_120: {
          clockRate: 90000,
          id: 'RTCCodec_video_Outbound_120',
          mimeType: 'video/VP8',
          payloadType: 120,
          timestamp: 1543604170954.952,
          type: 'codec',
        },
        RTCAudioSource_5: {
          audioLevel: 0.1,
          echoReturnLoss: -30,
          echoReturnLossEnhancement: 0.17551203072071075,
          id: 'RTCAudioSource_5',
          kind: 'audio',
          timestamp: 1639587143779.948,
          totalAudioEnergy: 0.01288983591403498,
          totalSamplesDuration: 2.2199999999999966,
          trackIdentifier: '59d95667-882c-4138-808f-615f021b2fb1',
          type: 'media-source',
        }
      }))
    };
    var fakeOutboundStat = options.chromeFakeStats.get('RTCOutboundRTPVideoStream_4003256843');
    var fakeTrackStat = options.chromeFakeStats.get('RTCMediaStreamTrack_sender_3');
    var fakeLocalAudioStat = options.chromeFakeStats.get('RTCAudioSource_5');
    var fakeCodecStat = options.chromeFakeStats.get('RTCCodec_video_Outbound_120');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    return getStats(peerConnection, { testForChrome: true, log: new FakeLogger() })
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
            assert.equal(report.codecName, fakeCodecStat.mimeType.split('/')[1]);
            assert.equal(report.frameWidthSent, fakeOutboundStat.frameWidth);
            assert.equal(report.frameHeightSent, fakeOutboundStat.frameHeight);
            assert.equal(report.frameWidthInput, fakeTrackStat.frameWidth);
            assert.equal(report.frameHeightInput, fakeTrackStat.frameHeight);
            assert.equal(report.frameRateSent, fakeOutboundStat.framesPerSecond);
            assert.equal(report.ssrc, String(fakeOutboundStat.ssrc));
            assert.equal(report.bytesSent, fakeOutboundStat.bytesSent);
            assert.equal(report.bytesSent, fakeOutboundStat.bytesSent);
            assert.equal(report.packetsLost, fakeOutboundStat.packetsLost);
            assert.equal(report.packetsReceived, fakeOutboundStat.packetsReceived);
            assert.equal(report.packetsSent, fakeOutboundStat.packetsSent);
            assert.equal(report.audioInputLevel, normalizeAudioLevel(fakeLocalAudioStat.audioLevel));
            assert.equal(report.framesEncoded, fakeOutboundStat.framesEncoded);
            assert.equal(report.totalEncodeTime, fakeOutboundStat.totalEncodeTime);
            assert.equal(report.totalPacketSendDelay, fakeOutboundStat.totalPacketSendDelay);
          });
      });
  });

  it('should resolve the returned Promise with a StandardizedStatsResponse for VP8 simulcast scenario (outbound)', () => {
    var options = {
      chromeFakeStats: new Map(Object.entries({
        RTCOutboundRTPVideoStream_4003256843: {
          bytesSent: 425592592,
          codecId: 'RTCCodec_video_Outbound_120',
          frameHeight: 480,
          frameWidth: 640,
          firCount: 0,
          framesEncoded: 34221,
          framesPerSecond: 23,
          id: 'RTCOutboundRTPVideoStream_4003256843',
          isRemote: false,
          mediaType: 'video',
          nackCount: 0,
          packetsSent: 371331,
          pliCount: 0,
          qpSum: 572871,
          ssrc: 4003256843,
          timestamp: 1543604170954.952,
          totalEncodeTime: 15000,
          totalPacketSendDelay: 7.25,
          trackId: 'RTCMediaStreamTrack_sender_3',
          transportId: 'RTCTransport_audio_1',
          type: 'outbound-rtp'
        },
        RTCOutboundRTPVideoStream_4003256844: {
          bytesSent: 100,
          codecId: 'RTCCodec_video_Outbound_120',
          frameHeight: 540,
          frameWidth: 960,
          firCount: 0,
          framesEncoded: 34221,
          framesPerSecond: 22,
          id: 'RTCOutboundRTPVideoStream_4003256843',
          isRemote: false,
          mediaType: 'video',
          nackCount: 0,
          packetsSent: 10,
          pliCount: 0,
          qpSum: 572871,
          ssrc: 4003256844,
          timestamp: 1543604170954.952,
          totalEncodeTime: 12000,
          totalPacketSendDelay: 8.25,
          trackId: 'RTCMediaStreamTrack_sender_3',
          transportId: 'RTCTransport_audio_1',
          type: 'outbound-rtp'
        },
        RTCMediaStreamTrack_sender_3: {
          detached: false,
          ended: false,
          frameHeight: 720,
          frameWidth: 1280,
          framesSent: 34221,
          hugeFramesSent: 73,
          id: 'RTCMediaStreamTrack_sender_3',
          kind: 'video',
          remoteSource: false,
          timestamp: 1543604170954.952,
          trackIdentifier: 'ffdd22d1-4fab-4042-969d-a568aabeb614',
          type: 'track'
        },
        RTCCodec_video_Outbound_120: {
          clockRate: 90000,
          id: 'RTCCodec_video_Outbound_120',
          mimeType: 'video/VP8',
          payloadType: 120,
          timestamp: 1543604170954.952,
          type: 'codec',
        },
        RTCAudioSource_5: {
          audioLevel: 0.1,
          echoReturnLoss: -30,
          echoReturnLossEnhancement: 0.17551203072071075,
          id: 'RTCAudioSource_5',
          kind: 'audio',
          timestamp: 1639587143779.948,
          totalAudioEnergy: 0.01288983591403498,
          totalSamplesDuration: 2.2199999999999966,
          trackIdentifier: '59d95667-882c-4138-808f-615f021b2fb1',
          type: 'media-source',
        }
      }))
    };
    var fakeTrackStat = options.chromeFakeStats.get('RTCMediaStreamTrack_sender_3');
    var fakeLocalAudioStat = options.chromeFakeStats.get('RTCAudioSource_5');
    var fakeCodecStat = options.chromeFakeStats.get('RTCCodec_video_Outbound_120');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);

    return getStats(peerConnection, { testForChrome: true, log: new FakeLogger() })
      .then(response => {
        assert.equal(response.localVideoTrackStats.length, 2);

        response.localVideoTrackStats.forEach(report => {
          var fakeOutboundStat = options.chromeFakeStats.get('RTCOutboundRTPVideoStream_' + report.ssrc);
          assert(report.trackId);
          assert(report.timestamp);
          assert.equal(report.codecName, fakeCodecStat.mimeType.split('/')[1]);
          assert.equal(report.frameWidthSent, fakeOutboundStat.frameWidth);
          assert.equal(report.frameHeightSent, fakeOutboundStat.frameHeight);
          assert.equal(report.frameWidthInput, fakeTrackStat.frameWidth);
          assert.equal(report.frameHeightInput, fakeTrackStat.frameHeight);
          assert.equal(report.frameRateSent, fakeOutboundStat.framesPerSecond);
          assert.equal(report.ssrc, String(fakeOutboundStat.ssrc));
          assert.equal(report.bytesSent, fakeOutboundStat.bytesSent);
          assert.equal(report.bytesSent, fakeOutboundStat.bytesSent);
          assert.equal(report.packetsLost, fakeOutboundStat.packetsLost);
          assert.equal(report.packetsReceived, fakeOutboundStat.packetsReceived);
          assert.equal(report.packetsSent, fakeOutboundStat.packetsSent);
          assert.equal(report.audioInputLevel, normalizeAudioLevel(fakeLocalAudioStat.audioLevel));
          assert.equal(report.framesEncoded, fakeOutboundStat.framesEncoded);
          assert.equal(report.totalEncodeTime, fakeOutboundStat.totalEncodeTime);
          assert.equal(report.totalPacketSendDelay, fakeOutboundStat.totalPacketSendDelay);
        });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Firefox (outbound)', () => {
    var options = {
      firefoxFakeStats: new Map(Object.entries({
        outbound_rtcp_media_0: {
          timestamp: 12345,
          type: 'inbound-rtp',
          isRemote: true,
          remoteId: 'outbound_rtp_media_0',
          ssrc: 200,
          bytesReceived: 100,
          packetsLost: 10,
          packetsReceived: 25,
          jitter: 0.03,
          roundTripTime: 2
        },
        outbound_rtp_media_0: {
          timestamp: 67890,
          type: 'outbound-rtp',
          isRemote: false,
          remoteId: 'outbound_rtcp_media_0',
          ssrc: 200,
          bytesSent: 45,
          packetsSent: 50,
          framesPerSecond: 28,
          framesEncoded: 5000,
          totalEncodeTime: 16.25,
          totalPacketSendDelay: 1.52
        }
      }))
    };
    var fakeInbound = options.firefoxFakeStats.get('outbound_rtcp_media_0');
    var fakeOutbound = options.firefoxFakeStats.get('outbound_rtp_media_0');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    return getStats(peerConnection, { testForFirefox: true })
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
            assert.equal(report.frameRateSent, fakeOutbound.framesPerSecond);
            assert.equal(report.ssrc, String(fakeOutbound.ssrc));
            assert.equal(report.bytesSent, fakeOutbound.bytesSent);
            assert.equal(report.packetsSent, fakeOutbound.packetsSent);
            assert.equal(report.bytesReceived, fakeInbound.bytesReceived);
            assert.equal(report.packetsReceived, fakeInbound.packetsReceived);
            assert.equal(report.packetsLost, fakeInbound.packetsLost);
            assert.equal(report.jitter, Math.round(fakeInbound.jitter * 1000));
            assert.equal(report.roundTripTime, Math.round(fakeInbound.roundTripTime * 1000));
            assert.equal(report.framesEncoded, fakeOutbound.framesEncoded);
            assert.equal(report.totalEncodeTime, fakeOutbound.totalEncodeTime);
            assert.equal(report.totalPacketSendDelay, fakeOutbound.totalPacketSendDelay);
          });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Firefox (inbound)', () => {
    var options = {
      firefoxFakeStats: new Map(Object.entries({
        inbound_rtcp_media_0: {
          timestamp: 12345,
          type: 'outbound-rtp',
          isRemote: true,
          remoteId: 'inbound_rtp_media_0',
          ssrc: 200,
          bytesSent: 100,
          packetsSent: 25
        },
        inbound_rtp_media_0: {
          timestamp: 67890,
          type: 'inbound-rtp',
          isRemote: false,
          remoteId: 'inbound_rtcp_media_0',
          ssrc: 200,
          bytesReceived: 45,
          packetsReceived: 50,
          packetsLost: 5,
          jitter: 0.05,
          framesPerSecond: null,
          estimatedPlayoutTimestamp: 1234123412,
          framesDecoded: 4343,
          jitterBufferDelay: 0.2,
          jitterBufferEmittedCount: 1221,
          totalDecodeTime: 25.2
        }
      }))
    };
    var fakeInbound = options.firefoxFakeStats.get('inbound_rtp_media_0');
    var fakeOutbound = options.firefoxFakeStats.get('inbound_rtcp_media_0');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();
    var remoteStream = new FakeMediaStream();

    localStream.addTrack(new FakeMediaStreamTrack('audio'));
    localStream.addTrack(new FakeMediaStreamTrack('video'));
    remoteStream.addTrack(new FakeMediaStreamTrack('audio'));
    remoteStream.addTrack(new FakeMediaStreamTrack('video'));
    peerConnection._addLocalStream(localStream);
    peerConnection._addRemoteStream(remoteStream);

    return getStats(peerConnection, { testForFirefox: true })
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
            assert.equal(report.frameRateReceived, fakeInbound.framesPerSecond);
            assert.equal(report.ssrc, String(fakeInbound.ssrc));
            assert.equal(report.bytesReceived, fakeInbound.bytesReceived);
            assert.equal(report.packetsReceived, fakeInbound.packetsReceived);
            assert.equal(report.packetsLost, fakeInbound.packetsLost);
            assert.equal(report.jitter, Math.round(fakeInbound.jitter * 1000));
            assert.equal(report.bytesSent, fakeOutbound.bytesSent);
            assert.equal(report.packetsSent, fakeOutbound.packetsSent);
            assert.equal(report.estimatedPlayoutTimestamp, fakeInbound.estimatedPlayoutTimestamp);
            assert.equal(report.framesDecoded, fakeInbound.framesDecoded);
            assert.equal(report.jitterBufferDelay, fakeInbound.jitterBufferDelay);
            assert.equal(report.jitterBufferEmittedCount, fakeInbound.jitterBufferEmittedCount);
            assert.equal(report.totalDecodeTime, fakeInbound.totalDecodeTime);
          });
      });
  });

  it('should resolve the promise with a StandardizedStatsResponse in Safari (outbound)', () => {
    var options = {
      safariFakeStats: new Map(Object.entries({
        RTCOutboundRTPVideoStream_968656041: {
          id: 'RTCOutboundRTPVideoStream_968656041',
          timestamp: 1544153890580,
          type: 'outbound-rtp',
          codecId: 'RTCCodec_OutboundVideo_96',
          firCount: 0,
          isRemote: false,
          mediaTrackId: 'RTCMediaStreamTrack_sender_24',
          mediaType: 'video',
          nackCount: 0,
          pliCount: 0,
          qpSum: 0,
          sliCount: 0,
          ssrc: 968656041,
          transportId: 'RTCTransport_audio_1',
          bytesSent: 601215,
          framesEncoded: 150,
          framesPerSecond: 30,
          packetsSent: 736,
          targetBitrate: 0,
          totalEncodeTime: 12.5,
          totalPacketSendDelay: 5.4
        },
        RTCMediaStreamTrack_sender_24: {
          id: 'RTCMediaStreamTrack_sender_24',
          timestamp: 1544153890580,
          type: 'track',
          detached: false,
          echoReturnLoss: 0,
          echoReturnLossEnhancement: 0,
          ended: false,
          frameHeight: 360,
          frameWidth: 640,
          framesCorrupted: 0,
          framesDecoded: 0,
          framesDropped: 0,
          framesReceived: 0,
          framesSent: 150,
          fullFramesLost: 0,
          partialFramesLost: 0,
          remoteSource: false,
          trackIdentifier: '344d4c27-bad4-4b74-85db-b983ff33140f'
        },

      }))
    };
    var fakeOutbound = options.safariFakeStats.get('RTCOutboundRTPVideoStream_968656041');
    var fakeTrack = options.safariFakeStats.get('RTCMediaStreamTrack_sender_24');
    var peerConnection = new FakeRTCPeerConnection(options);
    var localStream = new FakeMediaStream();

    var fakeMediaStreamTrack = new FakeMediaStreamTrack('video');
    fakeTrack.trackIdentifier = fakeMediaStreamTrack.id;
    localStream.addTrack(fakeMediaStreamTrack);
    peerConnection._addLocalStream(localStream);

    return getStats(peerConnection, { testForSafari: true, log: new FakeLogger() })
      .then(response => {
        assert.equal(response.localAudioTrackStats.length, 0);
        assert.equal(response.localVideoTrackStats.length, 1);
        assert.equal(response.remoteAudioTrackStats.length, 0);
        assert.equal(response.remoteVideoTrackStats.length, 0);

        response.localAudioTrackStats.concat(response.localVideoTrackStats)
          .concat(response.remoteAudioTrackStats)
          .concat(response.remoteVideoTrackStats)
          .forEach(report => {
            assert(report.trackId);
            assert(report.timestamp);
            assert.equal(report.ssrc, String(fakeOutbound.ssrc));
            assert.equal(report.bytesSent, fakeOutbound.bytesSent);
            assert.equal(report.packetsSent, fakeOutbound.packetsSent);
            assert.equal(report.framesEncoded, fakeOutbound.framesEncoded);
            assert.equal(report.frameRateSent, fakeOutbound.framesPerSecond);
            assert.equal(report.totalEncodeTime, fakeOutbound.totalEncodeTime);
            assert.equal(report.totalPacketSendDelay, fakeOutbound.totalPacketSendDelay);
          });
      });
  });

  describe('Active RTCIceCandidate pair stats', () => {
    context('should be present in StandardizedStatsResponse for', () => {
      it('chrome', async () => {
        const options = {
          chromeFakeStats: new Map(Object.entries({
            'RTCIceCandidatePair_4OFKCmYa_Mi4ThK96': {
              'id': 'RTCIceCandidatePair_4OFKCmYa_Mi4ThK96',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
              'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
              'state': 'waiting',
              'priority': 395789001576824300,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 0,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_4OFKCmYa_Y0FHsxUI': {
              'id': 'RTCIceCandidatePair_4OFKCmYa_Y0FHsxUI',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
              'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
              'state': 'in-progress',
              'priority': 9114723795305643000,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 2,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_4OFKCmYa_gvROlq28': {
              'id': 'RTCIceCandidatePair_4OFKCmYa_gvROlq28',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
              'remoteCandidateId': 'RTCIceCandidate_gvROlq28',
              'state': 'waiting',
              'priority': 35501031387184640,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 0,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_4OFKCmYa_tHHbudxA': {
              'id': 'RTCIceCandidatePair_4OFKCmYa_tHHbudxA',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
              'remoteCandidateId': 'RTCIceCandidate_tHHbudxA',
              'state': 'succeeded',
              'priority': 9115005270282354000,
              'nominated': true,
              'writable': true,
              'bytesSent': 215408,
              'bytesReceived': 888722,
              'totalRoundTripTime': 0.009,
              'currentRoundTripTime': 0.002,
              'availableOutgoingBitrate': 412653,
              'availableIncomingBitrate': 2202487,
              'requestsReceived': 1,
              'requestsSent': 3,
              'responsesReceived': 5,
              'responsesSent': 1,
              'consentRequestsSent': 4
            },
            'RTCIceCandidatePair_4OFKCmYa_xoscBzk6': {
              'id': 'RTCIceCandidatePair_4OFKCmYa_xoscBzk6',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_4OFKCmYa',
              'remoteCandidateId': 'RTCIceCandidate_xoscBzk6',
              'state': 'waiting',
              'priority': 7241260435179978000,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 0,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_LbWBxqvW_Mi4ThK96': {
              'id': 'RTCIceCandidatePair_LbWBxqvW_Mi4ThK96',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_LbWBxqvW',
              'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
              'state': 'in-progress',
              'priority': 395789001576693250,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 5,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_LbWBxqvW_Y0FHsxUI': {
              'id': 'RTCIceCandidatePair_LbWBxqvW_Y0FHsxUI',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_LbWBxqvW',
              'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
              'state': 'in-progress',
              'priority': 9114723795305512000,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 5,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_LbWBxqvW_gvROlq28': {
              'id': 'RTCIceCandidatePair_LbWBxqvW_gvROlq28',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_LbWBxqvW',
              'remoteCandidateId': 'RTCIceCandidate_gvROlq28',
              'state': 'in-progress',
              'priority': 35501031387053570,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 3,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_LbWBxqvW_tHHbudxA': {
              'id': 'RTCIceCandidatePair_LbWBxqvW_tHHbudxA',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_LbWBxqvW',
              'remoteCandidateId': 'RTCIceCandidate_tHHbudxA',
              'state': 'in-progress',
              'priority': 9114756780654461000,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 5,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_LbWBxqvW_xoscBzk6': {
              'id': 'RTCIceCandidatePair_LbWBxqvW_xoscBzk6',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_LbWBxqvW',
              'remoteCandidateId': 'RTCIceCandidate_xoscBzk6',
              'state': 'in-progress',
              'priority': 7241260435179847000,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 5,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_ZLdcoED5_Mi4ThK96': {
              'id': 'RTCIceCandidatePair_ZLdcoED5_Mi4ThK96',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_ZLdcoED5',
              'remoteCandidateId': 'RTCIceCandidate_Mi4ThK96',
              'state': 'in-progress',
              'priority': 179616215402823680,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 4,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_ZLdcoED5_Y0FHsxUI': {
              'id': 'RTCIceCandidatePair_ZLdcoED5_Y0FHsxUI',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_ZLdcoED5',
              'remoteCandidateId': 'RTCIceCandidate_Y0FHsxUI',
              'state': 'failed',
              'priority': 179616219462894080,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 0,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_ZLdcoED5_gvROlq28': {
              'id': 'RTCIceCandidatePair_ZLdcoED5_gvROlq28',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_ZLdcoED5',
              'remoteCandidateId': 'RTCIceCandidate_gvROlq28',
              'state': 'in-progress',
              'priority': 35501027226304510,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 3,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_ZLdcoED5_tHHbudxA': {
              'id': 'RTCIceCandidatePair_ZLdcoED5_tHHbudxA',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_ZLdcoED5',
              'remoteCandidateId': 'RTCIceCandidate_tHHbudxA',
              'state': 'failed',
              'priority': 179616219463025150,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 1,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidatePair_ZLdcoED5_xoscBzk6': {
              'id': 'RTCIceCandidatePair_ZLdcoED5_xoscBzk6',
              'timestamp': 1543863871950.097,
              'type': 'candidate-pair',
              'transportId': 'RTCTransport_audio_1',
              'localCandidateId': 'RTCIceCandidate_ZLdcoED5',
              'remoteCandidateId': 'RTCIceCandidate_xoscBzk6',
              'state': 'in-progress',
              'priority': 179616218590494720,
              'nominated': false,
              'writable': false,
              'bytesSent': 0,
              'bytesReceived': 0,
              'totalRoundTripTime': 0,
              'requestsReceived': 0,
              'requestsSent': 5,
              'responsesReceived': 0,
              'responsesSent': 0,
              'consentRequestsSent': 0
            },
            'RTCIceCandidate_4OFKCmYa': {
              'id': 'RTCIceCandidate_4OFKCmYa',
              'timestamp': 1543864837237.473,
              'type': 'local-candidate',
              'transportId': 'RTCTransport_audio_1',
              'isRemote': false,
              'networkType': 'wifi',
              'ip': '10.30.64.129',
              'port': 62172,
              'protocol': 'udp',
              'candidateType': 'host',
              'priority': 2122260223,
              'deleted': false
            },
            'RTCIceCandidate_tHHbudxA': {
              'id': 'RTCIceCandidate_tHHbudxA',
              'timestamp': 1543864842882.538,
              'type': 'remote-candidate',
              'transportId': 'RTCTransport_audio_1',
              'isRemote': true,
              'ip': '10.30.64.129',
              'port': 51185,
              'protocol': 'udp',
              'candidateType': 'host',
              'priority': 2122252543,
              'deleted': false
            }
          }))
        };
        const peerConnection = new FakeRTCPeerConnection(options);
        const { activeIceCandidatePair } = await getStats(peerConnection, { testForChrome: true, log: new FakeLogger() });

        const expectedActiveIceCandidatePair = Array.from(options.chromeFakeStats.values()).find(stat => {
          return stat.nominated;
        });
        const expectedActiveLocalCandidate = options.chromeFakeStats.get(expectedActiveIceCandidatePair.localCandidateId);
        const expectedActiveRemoteCandidate = options.chromeFakeStats.get(expectedActiveIceCandidatePair.remoteCandidateId);

        [
          'availableIncomingBitrate',
          'availableOutgoingBitrate',
          'bytesReceived',
          'bytesSent',
          'consentRequestsSent',
          'currentRoundTripTime',
          'lastPacketReceivedTimestamp',
          'lastPacketSentTimestamp',
          'nominated',
          'priority',
          'readable',
          'requestsReceived',
          'requestsSent',
          'responsesReceived',
          'responsesSent',
          'retransmissionsReceived',
          'retransmissionsSent',
          'state',
          'totalRoundTripTime',
          'transportId',
          'writable'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair[key], typeof expectedActiveIceCandidatePair[key] !== 'undefined'
            ? expectedActiveIceCandidatePair[key]
            : null);
        });

        [
          'candidateType',
          'deleted',
          'ip',
          'port',
          'priority',
          'protocol',
          'relayProtocol',
          'url'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair.localCandidate[key], typeof expectedActiveLocalCandidate[key] !== 'undefined'
            ? expectedActiveLocalCandidate[key]
            : null);
        });

        [
          'candidateType',
          'ip',
          'port',
          'priority',
          'protocol',
          'url'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair.remoteCandidate[key], typeof expectedActiveRemoteCandidate[key] !== 'undefined'
            ? expectedActiveRemoteCandidate[key]
            : null);
        });
      });

      it('firefox', async () => {
        const options = {
          firefoxFakeStats: new Map(Object.entries({
            'Gmx9': {
              id: 'Gmx9',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 591211,
              bytesSent: 591293,
              lastPacketReceivedTimestamp: 1525115247973,
              lastPacketSentTimestamp: 1525115247974,
              localCandidateId: 'kvar',
              nominated: true,
              priority: 9.1150052702823e+18,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: true,
              state: 'succeeded',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            '9NHy': {
              id: '9NHy',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 0,
              bytesSent: 0,
              lastPacketReceivedTimestamp: 0,
              lastPacketSentTimestamp: 0,
              localCandidateId: 'eN95',
              nominated: false,
              priority: 9.1147237953056e+18,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: false,
              state: 'cancelled',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            'Aouc': {
              id: 'Aouc',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 0,
              bytesSent: 0,
              lastPacketReceivedTimestamp: 0,
              lastPacketSentTimestamp: 0,
              localCandidateId: 'QjMi',
              nominated: false,
              priority: 3.9607047655352e+17,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: false,
              state: 'cancelled',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            '6cOO': {
              id: '6cOO',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 0,
              bytesSent: 0,
              lastPacketReceivedTimestamp: 0,
              lastPacketSentTimestamp: 0,
              localCandidateId: 'kCOL',
              nominated: false,
              priority: 3.9578900157681e+17,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: false,
              state: 'cancelled',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            'EwbO': {
              id: 'EwbO',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 0,
              bytesSent: 0,
              lastPacketReceivedTimestamp: 0,
              lastPacketSentTimestamp: 0,
              localCandidateId: 'LsHZ',
              nominated: false,
              priority: 3.578250636388e+16,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: false,
              state: 'cancelled',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            'zTSk': {
              id: 'zTSk',
              timestamp: 1525115247978,
              type: 'candidate-pair',
              bytesReceived: 0,
              bytesSent: 0,
              lastPacketReceivedTimestamp: 0,
              lastPacketSentTimestamp: 0,
              localCandidateId: 'SwDB',
              nominated: false,
              priority: 3.5501031387169e+16,
              readable: true,
              remoteCandidateId: 'xLZB',
              selected: false,
              state: 'cancelled',
              transportId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              writable: true
            },
            'wJIN': {
              id: 'wJIN',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'host',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '10.20.64.226',
              mozLocalTransport: 'udp',
              portNumber: 63538,
              transport: 'udp'
            },
            'tbSN': {
              id: 'tbSN',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'serverreflexive',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '12.203.65.40',
              mozLocalTransport: 'udp',
              portNumber: 38924,
              transport: 'udp'
            },
            'QjMi': {
              id: 'QjMi',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'relayed',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '34.203.250.88',
              mozLocalTransport: 'udp',
              portNumber: 20479,
              transport: 'udp'
            },
            'eN95': {
              id: 'eN95',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'host',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '192.168.209.150',
              mozLocalTransport: 'udp',
              portNumber: 61844,
              transport: 'udp'
            },
            'kvar': {
              id: 'kvar',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'serverreflexive',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '107.20.226.156',
              mozLocalTransport: 'udp',
              portNumber: 61844,
              transport: 'udp'
            },
            'kCOL': {
              id: 'kCOL',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'relayed',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '34.203.250.88',
              mozLocalTransport: 'udp',
              portNumber: 18838,
              transport: 'udp'
            },
            'VFPG': {
              id: 'VFPG',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'host',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '10.20.64.226',
              mozLocalTransport: 'tcp',
              portNumber: 53403,
              transport: 'tcp'
            },
            'LsHZ': {
              id: 'LsHZ',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'relayed',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '34.203.250.88',
              mozLocalTransport: 'tls',
              portNumber: 14806,
              transport: 'udp'
            },
            '8fuV': {
              id: '8fuV',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'host',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '192.168.209.150',
              mozLocalTransport: 'tcp',
              portNumber: 58132,
              transport: 'tcp'
            },
            'SwDB': {
              id: 'SwDB',
              timestamp: 1525115247978,
              type: 'localcandidate',
              candidateType: 'relayed',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '34.203.250.88',
              mozLocalTransport: 'tls',
              portNumber: 21154,
              transport: 'udp'
            },
            'xLZB': {
              id: 'xLZB',
              timestamp: 1525115247978,
              type: 'remotecandidate',
              candidateType: 'host',
              componentId: '0-1525115182222480 (id=6442450948 url=https://simpler-signaling.appspot.com/) aLevel=0',
              ipAddress: '10.20.64.226',
              portNumber: 53508,
              transport: 'udp'
            }
          }))
        };

        const peerConnection = new FakeRTCPeerConnection(options);
        const { activeIceCandidatePair } = await getStats(peerConnection, { testForFirefox: true });

        const expectedActiveIceCandidatePair = Array.from(options.firefoxFakeStats.values()).find(stat => {
          return stat.nominated;
        });
        const expectedActiveLocalCandidate = options.firefoxFakeStats.get(expectedActiveIceCandidatePair.localCandidateId);
        const expectedActiveRemoteCandidate = options.firefoxFakeStats.get(expectedActiveIceCandidatePair.remoteCandidateId);

        [
          'availableIncomingBitrate',
          'availableOutgoingBitrate',
          'bytesReceived',
          'bytesSent',
          'consentRequestsSent',
          'currentRoundTripTime',
          'lastPacketReceivedTimestamp',
          'lastPacketSentTimestamp',
          'nominated',
          'priority',
          'readable',
          'requestsReceived',
          'requestsSent',
          'responsesReceived',
          'responsesSent',
          'retransmissionsReceived',
          'retransmissionsSent',
          'state',
          'totalRoundTripTime',
          'transportId',
          'writable'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair[key], typeof expectedActiveIceCandidatePair[key] !== 'undefined'
            ? expectedActiveIceCandidatePair[key]
            : null);
        });

        [
          ['candidateType'],
          ['deleted'],
          ['ip', 'ipAddress'],
          ['port', 'portNumber'],
          ['priority'],
          ['protocol', 'transport'],
          ['relayProtocol'],
          ['url']
        ].forEach(([key, ffKey]) => {
          if (key === 'candidateType') {
            assert.equal(activeIceCandidatePair.localCandidate.candidateType, {
              host: 'host',
              peerreflexive: 'prflx',
              relayed: 'relay',
              serverreflexive: 'srflx'
            }[expectedActiveLocalCandidate.candidateType]);
            return;
          }
          assert.equal(activeIceCandidatePair.localCandidate[key], typeof expectedActiveLocalCandidate[ffKey || key] !== 'undefined'
            ? expectedActiveLocalCandidate[ffKey || key]
            : key === 'deleted' ? false : null);
        });

        [
          ['candidateType'],
          ['ip', 'ipAddress'],
          ['port', 'portNumber'],
          ['priority'],
          ['protocol', 'transport'],
          ['url']
        ].forEach(([key, ffKey]) => {
          if (key === 'candidateType') {
            assert.equal(activeIceCandidatePair.remoteCandidate.candidateType, {
              host: 'host',
              peerreflexive: 'prflx',
              relayed: 'relay',
              serverreflexive: 'srflx'
            }[expectedActiveRemoteCandidate.candidateType]);
            return;
          }
          assert.equal(activeIceCandidatePair.remoteCandidate[key], typeof expectedActiveRemoteCandidate[ffKey || key] !== 'undefined'
            ? expectedActiveRemoteCandidate[ffKey || key]
            : null);
        });
      });

      it('safari', async () => {
        const options = {
          safariFakeStats: new Map(Object.entries({
            RTCIceCandidatePair_Izz_OUDUFHO1: {
              id: 'RTCIceCandidatePair_Izz_OUDUFHO1',
              timestamp: 1544547877980,
              type: 'candidate-pair',
              availableOutgoingBitrate: 2885390,
              bytesReceived: 11786869,
              bytesSent: 9570568,
              currentRoundTripTime: 0.001,
              localCandidateId: 'RTCIceCandidate_Izz',
              nominated: true,
              priority: 9079290933588934000,
              remoteCandidateId: 'RTCIceCandidate_OUDUFHO1',
              requestsReceived: 24,
              requestsSent: 1,
              responsesReceived: 24,
              responsesSent: 24,
              state: 'succeeded',
              totalRoundTripTime: 0.131,
              transportId: 'RTCTransport_audio_1',
              writable: true
            },
            RTCIceCandidate_Izz: {
              id: 'RTCIceCandidate_Izz',
              timestamp: 1544547877980,
              type: 'local-candidate',
              candidateType: 'host',
              deleted: false,
              port: 57605,
              priority: 2113937151,
              protocol: 'udp',
              transportId: 'RTCTransport_audio_1'
            },
            RTCIceCandidate_OUDUFHO1: {
              id: 'RTCIceCandidate_OUDUFHO1',
              timestamp: 1544547877980,
              type: 'remote-candidate',
              candidateType: 'host',
              deleted: false,
              port: 61091,
              priority: 2122260223,
              protocol: 'udp',
              transportId: 'RTCTransport_audio_1'
            }
          }))
        };
        const peerConnection = new FakeRTCPeerConnection(options);
        const { activeIceCandidatePair } = await getStats(peerConnection, { testForSafari: true });

        const expectedActiveIceCandidatePair = Array.from(options.safariFakeStats.values()).find(stat => {
          return stat.nominated;
        });
        const expectedActiveLocalCandidate = options.safariFakeStats.get(expectedActiveIceCandidatePair.localCandidateId);
        const expectedActiveRemoteCandidate = options.safariFakeStats.get(expectedActiveIceCandidatePair.remoteCandidateId);

        [
          'availableIncomingBitrate',
          'availableOutgoingBitrate',
          'bytesReceived',
          'bytesSent',
          'consentRequestsSent',
          'currentRoundTripTime',
          'lastPacketReceivedTimestamp',
          'lastPacketSentTimestamp',
          'nominated',
          'priority',
          'readable',
          'requestsReceived',
          'requestsSent',
          'responsesReceived',
          'responsesSent',
          'retransmissionsReceived',
          'retransmissionsSent',
          'state',
          'totalRoundTripTime',
          'transportId',
          'writable'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair[key], typeof expectedActiveIceCandidatePair[key] !== 'undefined'
            ? expectedActiveIceCandidatePair[key]
            : null);
        });

        [
          'candidateType',
          'deleted',
          'ip',
          'port',
          'priority',
          'protocol',
          'relayProtocol',
          'url'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair.localCandidate[key], typeof expectedActiveLocalCandidate[key] !== 'undefined'
            ? expectedActiveLocalCandidate[key]
            : null);
        });

        [
          'candidateType',
          'ip',
          'port',
          'priority',
          'protocol',
          'url'
        ].forEach(key => {
          assert.equal(activeIceCandidatePair.remoteCandidate[key], typeof expectedActiveRemoteCandidate[key] !== 'undefined'
            ? expectedActiveRemoteCandidate[key]
            : null);
        });
      });

      it('translates state=inprogress to state=in-progress', async () => {
        const options = {
          safariFakeStats: new Map(Object.entries({
            RTCIceCandidatePair_Izz_OUDUFHO1: {
              id: 'RTCIceCandidatePair_Izz_OUDUFHO1',
              timestamp: 1544547877980,
              type: 'candidate-pair',
              availableOutgoingBitrate: 2885390,
              bytesReceived: 11786869,
              bytesSent: 9570568,
              currentRoundTripTime: 0.001,
              localCandidateId: 'RTCIceCandidate_Izz',
              nominated: true,
              priority: 9079290933588934000,
              remoteCandidateId: 'RTCIceCandidate_OUDUFHO1',
              requestsReceived: 24,
              requestsSent: 1,
              responsesReceived: 24,
              responsesSent: 24,
              state: 'inprogress',
              totalRoundTripTime: 0.131,
              transportId: 'RTCTransport_audio_1',
              writable: true
            }
          }))
        };
        const peerConnection = new FakeRTCPeerConnection(options);
        const { activeIceCandidatePair } = await getStats(peerConnection, { testForSafari: true });

        assert.equal(activeIceCandidatePair.state, 'in-progress');
      });
    });
  });
});

function normalizeAudioLevel(level) {
  return Math.round(level * 32767);
}
