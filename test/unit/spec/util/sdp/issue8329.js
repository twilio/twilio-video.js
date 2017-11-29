/* eslint-disable no-use-before-define */
'use strict';

const assert = require('assert');
const { RTCSessionDescription } = require('@twilio/webrtc');

const workaround = require('../../../../../lib/util/sdp/issue8329');

const { a } = require('../../../../lib/util');

describe('Issue 8329', function() {
  ['offer', 'answer', 'pranswer'].forEach(testWithSdp);

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
          var input = makeDescription({ type, sdp: validSdp });
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
          assert.equal(output.sdp, validSdp);
        });
      });
    });
  });
}

const validSdp = `v=0
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
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=121
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
a=fmtp:101 apt=126
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
`.split('\n').join('\r\n');
