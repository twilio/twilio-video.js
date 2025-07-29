/* eslint-disable no-use-before-define */
'use strict';

const assert = require('assert');
const { RTCSessionDescription } = require('../../../../../lib/webrtc');

const workaround = require('../../../../../lib/util/sdp/issue8329');

const { a } = require('../../../../lib/util');

describe('Issue 8329', function() {
  ['offer', 'answer', 'pranswer'].forEach(testWithSdp);

  describe('when an m=application section is included', () => {
    it('still works', () => {
      const input = new RTCSessionDescription({ type: 'offer', sdp: validSdp2 });
      const output = workaround(input).sdp;
      assert(!output.match(/\r\n\r\n/));
    });
  });

  describe('when PT conflicts occur between different codecs', () => {
    it('resolves conflicts by reassigning PTs', () => {
      const input = new RTCSessionDescription({ type: 'offer', sdp: chromeSafariConflictSdp });
      const output = workaround(input);

      // Check that the output is valid and doesn't have PT conflicts
      const videoSection = output.sdp.match(/m=video[\s\S]*?(?=m=|$)/)[0];
      const rtpmapLines = videoSection.match(/^a=rtpmap:\d+ /gm) || [];
      const pts = rtpmapLines.map(line => line.match(/^a=rtpmap:(\d+)/)[1]);

      // All PTs should be unique
      const uniquePts = [...new Set(pts)];
      assert.equal(pts.length, uniquePts.length, 'All payload types should be unique');

      // Should contain both VP8 and H264 codecs
      assert(videoSection.includes('VP8/90000'), 'Should contain VP8 codec');
      assert(videoSection.includes('H264/90000'), 'Should contain H264 codec');
    });
  });

  [
    ['RTCSessionDescription', descriptionInit => new RTCSessionDescription(descriptionInit)],
    ['RTCSessionDescriptionInit', descriptionInit => descriptionInit]
  ].forEach(([descriptionType, makeDescription]) => {
    describe(`when the workaround is called with a "rollback" ${descriptionType}`, () => {
      it('returns a new RTCSessionDescription with the same type', () => {
        var input = makeDescription({ type: 'rollback' });
        // NOTE(mroberts): Our mock RTCSessionDescription adds an SDP property,
        // so we delete it. Maybe we can improve the mock in the future.
        if (input.sdp) {
          delete input.sdp;
        }
        var output = workaround(input);
        assert.equal(output.type, input.type);
        // NOTE(mroberts): Our mock RTCSessionDescription makes this difficult,
        // too.
        // assert(!('sdp' in output));
      });
    });
  });
});

function testWithSdp(type) {
  [
    ['RTCSessionDescription', descriptionInit => new RTCSessionDescription(descriptionInit)],
    ['RTCSessionDescriptionInit', descriptionInit => descriptionInit]
  ].forEach(([descriptionType, makeDescription]) => {
    describe(`when the workaround is called with ${a(type)} "${type}" ${descriptionType}`, () => {
      describe('containing a valid SDP', () => {
        it('returns a new RTCSessionDescription with the same type and SDP', () => {
          var input = makeDescription({ type, sdp: validSdp1 });
          var output = workaround(input);
          assert(output instanceof RTCSessionDescription);
          assert.equal(output.type, input.type);
          assert.equal(output.sdp, input.sdp);
        });
      });

      describe('containinig an invalid SDP', () => {
        it('returns a new RTCSessionDescription with the same type and its SDP fixed', () => {
          var input = makeDescription({ type, sdp: invalidSdp });
          var output = workaround(input);
          assert.equal(output.type, input.type);
          assert.equal(output.sdp, validSdp1);
        });
      });
    });
  });
}

const validSdp1 = `v=0
o=- 1383886063091371403 4 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS
m=audio 49703 UDP/TLS/RTP/SAVPF 111 9 0 8 126 103 104 106 105 13 110 112 113
c=IN IP4 192.168.208.174
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:2568661926 1 udp 2122260223 192.168.208.174 49703 typ host generation 0 network-id 2 network-cost 50
a=candidate:3363271197 1 udp 2122194687 10.20.69.9 55398 typ host generation 0 network-id 1 network-cost 10
a=ice-ufrag:h4eP
a=ice-pwd:nHSwR6Awi3ZPx3ogqR1K8dYw
a=ice-options:trickle
a=fingerprint:sha-256 4B:49:AB:F1:4F:2C:FE:63:FE:67:A4:2C:77:6D:CA:7C:0F:9F:08:E9:76:1A:D4:0D:AE:61:36:42:3C:C8:B3:F6
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=recvonly
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:126 telephone-event/8000
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
m=video 9 UDP/TLS/RTP/SAVPF 120 121 126 97 99 101 102 123 125 124 122
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:h4eP
a=ice-pwd:nHSwR6Awi3ZPx3ogqR1K8dYw
a=ice-options:trickle
a=fingerprint:sha-256 4B:49:AB:F1:4F:2C:FE:63:FE:67:A4:2C:77:6D:CA:7C:0F:9F:08:E9:76:1A:D4:0D:AE:61:36:42:3C:C8:B3:F6
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:120 VP8/90000
a=rtcp-fb:120 ccm fir
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 goog-remb
a=rtpmap:121 VP9/90000
a=rtcp-fb:121 ccm fir
a=rtcp-fb:121 nack
a=rtcp-fb:121 nack pli
a=rtcp-fb:121 goog-remb
a=rtpmap:126 H264/90000
a=rtcp-fb:126 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 goog-remb
a=fmtp:126 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=120
a=rtpmap:101 rtx/90000
a=rtpmap:102 red/90000
a=rtpmap:123 rtx/90000
a=fmtp:123 apt=102
a=rtpmap:125 ulpfec/90000
a=rtpmap:124 H264/90000
a=rtcp-fb:124 ccm fir
a=rtcp-fb:124 nack
a=rtcp-fb:124 nack pli
a=rtcp-fb:124 goog-remb
a=rtcp-fb:124 transport-cc
a=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=420032
a=rtpmap:122 rtx/90000
a=fmtp:122 apt=124
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=126
a=fmtp:101 apt=121
`.split('\n').join('\r\n');

const invalidSdp = `v=0
o=- 1383886063091371403 4 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS
m=audio 49703 UDP/TLS/RTP/SAVPF 111 9 0 8 126 103 104 106 105 13 110 112 113
c=IN IP4 192.168.208.174
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:2568661926 1 udp 2122260223 192.168.208.174 49703 typ host generation 0 network-id 2 network-cost 50
a=candidate:3363271197 1 udp 2122194687 10.20.69.9 55398 typ host generation 0 network-id 1 network-cost 10
a=ice-ufrag:h4eP
a=ice-pwd:nHSwR6Awi3ZPx3ogqR1K8dYw
a=ice-options:trickle
a=fingerprint:sha-256 4B:49:AB:F1:4F:2C:FE:63:FE:67:A4:2C:77:6D:CA:7C:0F:9F:08:E9:76:1A:D4:0D:AE:61:36:42:3C:C8:B3:F6
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=recvonly
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:126 telephone-event/8000
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
m=video 9 UDP/TLS/RTP/SAVPF 120 121 126 97 99 101 102 123 125 124 122
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:h4eP
a=ice-pwd:nHSwR6Awi3ZPx3ogqR1K8dYw
a=ice-options:trickle
a=fingerprint:sha-256 4B:49:AB:F1:4F:2C:FE:63:FE:67:A4:2C:77:6D:CA:7C:0F:9F:08:E9:76:1A:D4:0D:AE:61:36:42:3C:C8:B3:F6
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:14 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:120 VP8/90000
a=rtcp-fb:120 ccm fir
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 goog-remb
a=rtpmap:121 VP9/90000
a=rtcp-fb:121 ccm fir
a=rtcp-fb:121 nack
a=rtcp-fb:121 nack pli
a=rtcp-fb:121 goog-remb
a=rtpmap:121 rtx/90000
a=fmtp:121 apt=120
a=rtpmap:126 H264/90000
a=rtcp-fb:126 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 goog-remb
a=fmtp:126 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=120
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=121
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=127
a=rtpmap:102 red/90000
a=rtpmap:123 rtx/90000
a=fmtp:123 apt=102
a=rtpmap:125 ulpfec/90000
a=rtpmap:124 H264/90000
a=rtcp-fb:124 ccm fir
a=rtcp-fb:124 nack
a=rtcp-fb:124 nack pli
a=rtcp-fb:124 goog-remb
a=rtcp-fb:124 transport-cc
a=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=420032
a=rtpmap:122 rtx/90000
a=fmtp:122 apt=124
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
`.split('\n').join('\r\n');

const validSdp2 = `v=0
o=- 8292539660770801868 4 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video data
a=msid-semantic: WMS dfdd4512-4dae-4576-89cd-50bd1063bd73
m=audio 41506 UDP/TLS/RTP/SAVPF 111 9 0 8 126 103 104 106 105 13 110 112 113
c=IN IP4 34.203.250.117
a=rtcp:9 IN IP4 0.0.0.0
a=candidate:1310399025 1 udp 2122260223 10.20.69.74 49657 typ host generation 0 network-id 1 network-cost 10
a=candidate:4072865177 1 udp 2122194687 192.168.209.22 63664 typ host generation 0 network-id 2 network-cost 50
a=candidate:3880031716 1 udp 1686052607 12.203.65.40 16862 typ srflx raddr 10.20.69.74 rport 49657 generation 0 network-id 1 network-cost 10
a=candidate:10020545 1 tcp 1518280447 10.20.69.74 9 typ host tcptype active generation 0 network-id 1 network-cost 10
a=candidate:3158376809 1 tcp 1518214911 192.168.209.22 9 typ host tcptype active generation 0 network-id 2 network-cost 50
a=candidate:1045414410 1 udp 1685987071 107.20.226.156 63664 typ srflx raddr 192.168.209.22 rport 63664 generation 0 network-id 2 network-cost 50
a=candidate:9688782 1 udp 41885695 34.203.250.117 41506 typ relay raddr 12.203.65.40 rport 16862 generation 0 network-id 1 network-cost 10
a=candidate:1350657867 1 udp 8265471 34.203.250.117 26944 typ relay raddr 107.20.226.156 rport 60999 generation 0 network-id 2 network-cost 50
a=ice-ufrag:Ix/f
a=ice-pwd:SH9WxmFAACABdjSAn6JIj04X
a=ice-options:trickle
a=fingerprint:sha-256 07:52:15:AF:4A:65:E2:CF:BA:C0:72:F5:BE:CA:AE:5E:5A:DB:57:32:F7:4C:7A:3D:D1:F6:03:14:20:50:45:91
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=recvonly
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:126 telephone-event/8000
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
m=video 9 UDP/TLS/RTP/SAVPF 120 121 126 97 99 100 101 119 125 118 124 107 123 109 122
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:Ix/f
a=ice-pwd:SH9WxmFAACABdjSAn6JIj04X
a=ice-options:trickle
a=fingerprint:sha-256 07:52:15:AF:4A:65:E2:CF:BA:C0:72:F5:BE:CA:AE:5E:5A:DB:57:32:F7:4C:7A:3D:D1:F6:03:14:20:50:45:91
a=setup:actpass
a=mid:video
a=extmap:5 urn:ietf:params:rtp-hdrext:toffset
a=extmap:4 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:14 urn:3gpp:video-orientation
a=extmap:13 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:120 VP8/90000
a=rtcp-fb:120 goog-remb
a=rtcp-fb:120 ccm fir
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtpmap:121 VP9/90000
a=rtcp-fb:121 goog-remb
a=rtcp-fb:121 ccm fir
a=rtcp-fb:121 nack
a=rtcp-fb:121 nack pli
a=rtpmap:126 H264/90000
a=rtcp-fb:126 goog-remb
a=rtcp-fb:126 ccm fir
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=fmtp:126 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=120
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=121
a=rtpmap:100 H264/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:119 rtx/90000
a=fmtp:119 apt=127
a=rtpmap:125 H264/90000
a=rtcp-fb:125 goog-remb
a=rtcp-fb:125 transport-cc
a=rtcp-fb:125 ccm fir
a=rtcp-fb:125 nack
a=rtcp-fb:125 nack pli
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032
a=rtpmap:118 rtx/90000
a=fmtp:118 apt=125
a=rtpmap:124 H264/90000
a=rtcp-fb:124 goog-remb
a=rtcp-fb:124 transport-cc
a=rtcp-fb:124 ccm fir
a=rtcp-fb:124 nack
a=rtcp-fb:124 nack pli
a=fmtp:124 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032
a=rtpmap:107 rtx/90000
a=fmtp:107 apt=124
a=rtpmap:123 red/90000
a=rtpmap:109 rtx/90000
a=fmtp:109 apt=123
a=rtpmap:122 ulpfec/90000
a=ssrc-group:FID 1201747064 509791018
a=ssrc:1201747064 cname:YVRT45hw2PKZdJQO
a=ssrc:1201747064 msid:dfdd4512-4dae-4576-89cd-50bd1063bd73 6df5460b-7617-4923-9b48-ca482b413997
a=ssrc:1201747064 mslabel:dfdd4512-4dae-4576-89cd-50bd1063bd73
a=ssrc:1201747064 label:6df5460b-7617-4923-9b48-ca482b413997
a=ssrc:509791018 cname:YVRT45hw2PKZdJQO
a=ssrc:509791018 msid:dfdd4512-4dae-4576-89cd-50bd1063bd73 6df5460b-7617-4923-9b48-ca482b413997
a=ssrc:509791018 mslabel:dfdd4512-4dae-4576-89cd-50bd1063bd73
a=ssrc:509791018 label:6df5460b-7617-4923-9b48-ca482b413997
m=application 9 DTLS/SCTP 5000
c=IN IP4 0.0.0.0
a=ice-ufrag:Ix/f
a=ice-pwd:SH9WxmFAACABdjSAn6JIj04X
a=ice-options:trickle
a=fingerprint:sha-256 07:52:15:AF:4A:65:E2:CF:BA:C0:72:F5:BE:CA:AE:5E:5A:DB:57:32:F7:4C:7A:3D:D1:F6:03:14:20:50:45:91
a=setup:actpass
a=mid:data
a=sctpmap:5000 webrtc-datachannel 1024
`.split('\n').join('\r\n');

// Chrome-Safari PT conflict scenario where same PT is used for different codecs.
// See, https://github.com/twilio/twilio-video.js/issues/2122.
const chromeSafariConflictSdp = `v=0
o=- 7515242340730242770 4 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0 1
a=extmap-allow-mixed
a=msid-semantic: WMS
m=audio 55415 UDP/TLS/RTP/SAVPF 111 63 9 0 8 13 110 126
c=IN IP4 192.168.1.24
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:nCiO
a=ice-pwd:OOxf3Oy3dM0Zu9rmp63WKhTN
a=setup:actpass
a=mid:0
a=recvonly
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:63 red/48000/2
a=fmtp:63 111/111
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:126 telephone-event/8000
m=video 9 UDP/TLS/RTP/SAVPF 96 98 102 96 100 99 103 105 107 109 125 113 97 101 104 108 127 112 114
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:nCiO
a=ice-pwd:OOxf3Oy3dM0Zu9rmp63WKhTN
a=setup:actpass
a=mid:1
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtpmap:98 H264/90000
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=fmtp:98 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:102 H264/90000
a=rtcp-fb:102 goog-remb
a=rtcp-fb:102 transport-cc
a=rtcp-fb:102 ccm fir
a=rtcp-fb:102 nack
a=rtcp-fb:102 nack pli
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f
a=rtpmap:96 H264/90000
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640c1f
a=rtpmap:100 H264/90000
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=640c1f
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:103 rtx/90000
a=fmtp:103 apt=102
a=rtpmap:105 rtx/90000
a=fmtp:105 apt=104
a=rtpmap:107 rtx/90000
a=fmtp:107 apt=96
a=rtpmap:109 rtx/90000
a=fmtp:109 apt=108
a=rtpmap:125 rtx/90000
a=fmtp:125 apt=127
a=rtpmap:113 rtx/90000
a=fmtp:113 apt=112
a=rtpmap:104 H265/90000
a=rtcp-fb:104 goog-remb
a=rtcp-fb:104 transport-cc
a=rtcp-fb:104 ccm fir
a=rtcp-fb:104 nack
a=rtcp-fb:104 nack pli
a=fmtp:104 level-id=93;tx-mode=SRST
a=rtpmap:108 VP9/90000
a=rtcp-fb:108 goog-remb
a=rtcp-fb:108 transport-cc
a=rtcp-fb:108 ccm fir
a=rtcp-fb:108 nack
a=rtcp-fb:108 nack pli
a=fmtp:108 profile-id=0
a=rtpmap:127 VP9/90000
a=rtcp-fb:127 goog-remb
a=rtcp-fb:127 transport-cc
a=rtcp-fb:127 ccm fir
a=rtcp-fb:127 nack
a=rtcp-fb:127 nack pli
a=fmtp:127 profile-id=2
a=rtpmap:112 red/90000
a=rtpmap:114 ulpfec/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
`.split('\n').join('\r\n');
