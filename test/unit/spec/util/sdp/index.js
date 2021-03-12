'use strict';

const assert = require('assert');

const { flatMap } = require('../../../../../lib/util');

const {
  disableRtx,
  enableDtxForOpus,
  getMediaSections,
  setBitrateParameters,
  setCodecPreferences,
  setSimulcast,
  unifiedPlanFilterLocalCodecs,
  unifiedPlanFilterRemoteVideoCodecs,
  removeSSRCAttributes,
  revertSimulcastForNonVP8MediaSections,
  unifiedPlanAddOrRewriteNewTrackIds,
  unifiedPlanAddOrRewriteTrackIds
} = require('../../../../../lib/util/sdp');

const { makeSdpForSimulcast, makeSdpWithTracks } = require('../../../../lib/mocksdp');
const { combinationContext } = require('../../../../lib/util');

describe('setBitrateParameters', () => {
  context('when there is no existing b= line in the SDP', () => {
    combinationContext([
      [
        ['AS', 'TIAS'],
        x => `when the modifier is ${x}`
      ],
      [
        [5000, null],
        x => `when maxAudioBitrate is ${x ? 'not ' : ''}null`
      ],
      [
        [8000, null],
        x => `when maxVideoBitrate is ${x ? 'not ' : ''}null`
      ]
    ], ([modifier, maxAudioBitrate, maxVideoBitrate]) => {
      let sdp;

      beforeEach(() => {
        sdp = makeSdpWithTracks(modifier === 'TIAS' ? 'unified' : 'planb', {
          audio: ['audio-1', 'audio-2'],
          video: ['video-1', 'video-2']
        });
        sdp = setBitrateParameters(sdp, modifier, maxAudioBitrate, maxVideoBitrate);
      });

      ['audio', 'video'].forEach(kind => {
        const maxBitrate = kind === 'audio'
          ? modifier === 'TIAS'
            ? maxAudioBitrate
            : maxAudioBitrate && Math.round((maxAudioBitrate + 16000) / 950)
          : modifier === 'TIAS'
            ? maxVideoBitrate
            : maxVideoBitrate && Math.round((maxVideoBitrate + 16000) / 950);

        const bLine = new RegExp(`\r\nb=${modifier}:${maxBitrate || '([0-9])+'}`);

        it(`should ${maxBitrate ? '' : 'not '}add a b= line to the given m=${kind} line`, () => {
          sdp.split('\r\nm=').slice(1).filter(section => section.split(' ')[0] === kind).forEach(section => {
            assert(typeof maxBitrate === 'number' ? bLine.test(section) : !bLine.test(section));
          });
        });
      });
    });
  });

  context('when there is an existing b= line in the SDP', () => {
    combinationContext([
      [
        ['AS', 'TIAS'],
        x => `when the modifier is ${x}`
      ],
      [
        [5000, 7000, null],
        x => `when maxAudioBitrate is ${!x ? 'null' : (x === 5000 ? 'less' : 'greater') + ' than the current value'}`
      ],
      [
        [8000, 10000, null],
        x => `when maxVideoBitrate is ${!x ? 'null' : (x === 8000 ? 'less' : 'greater') + ' than the current value'}`
      ]
    ], ([modifier, maxAudioBitrate, maxVideoBitrate]) => {
      const currentMaxAudioBitrate = 6000;
      const currentMaxVideoBitrate = 9000;

      let sdp;

      beforeEach(() => {
        sdp = makeSdpWithTracks(modifier === 'TIAS' ? 'unified' : 'planb', {
          audio: ['audio-1', 'audio-2'],
          video: ['video-1', 'video-2']
        }, currentMaxAudioBitrate, currentMaxVideoBitrate);
        sdp = setBitrateParameters(sdp, modifier, maxAudioBitrate, maxVideoBitrate);
      });

      ['audio', 'video'].forEach(kind => {
        function getMaxBitrate(maxAudioBitrate, maxVideoBitrate) {
          return kind === 'audio'
            ? modifier === 'TIAS'
              ? maxAudioBitrate
              : maxAudioBitrate && Math.round((maxAudioBitrate + 16000) / 950)
            : modifier === 'TIAS'
              ? maxVideoBitrate
              : maxVideoBitrate &&  Math.round((maxVideoBitrate + 16000) / 950);
        }

        const currentMaxBitrate = getMaxBitrate(currentMaxAudioBitrate, currentMaxVideoBitrate);
        const maxBitrate = getMaxBitrate(maxAudioBitrate, maxVideoBitrate);
        const shouldUpdateBLine = maxBitrate && maxBitrate <= currentMaxBitrate;
        const bLine = new RegExp(`\r\nb=${modifier}:${shouldUpdateBLine ? maxBitrate : currentMaxBitrate}`);

        it(`should ${shouldUpdateBLine ? '' : 'not '}update the b= line of the given m=${kind} line to the new value`, () => {
          sdp.split('\r\nm=').slice(1).filter(section => section.split(' ')[0] === kind).forEach(section => {
            assert(bLine.test(section));
          });
        });
      });
    });
  });
});

describe('setCodecPreferences', () => {
  combinationContext([
    [
      ['planb', 'unified'],
      x => `when called with a ${x} sdp`
    ],
    [
      ['', 'PCMA,G722'],
      x => `when preferredAudioCodecs is ${x ? 'not ' : ''}empty`
    ],
    [
      ['', 'H264,VP9'],
      x => `when preferredVideoCodecs is ${x ? 'not ' : ''}empty`
    ]
  ], ([sdpType, preferredAudioCodecs, preferredVideoCodecs]) => {
    preferredAudioCodecs = preferredAudioCodecs ? preferredAudioCodecs.split(',').map(codec => ({ codec })) : [];
    preferredVideoCodecs = preferredVideoCodecs ? preferredVideoCodecs.split(',').map(codec => ({ codec })) : [];
    context(`should ${preferredAudioCodecs.length ? 'update the' : 'preserve the existing'} audio codec order`, () => {
      it(`and ${preferredVideoCodecs.length ? 'update the' : 'preserve the existing'} video codec order`, () => {
        const expectedAudioCodecIds = preferredAudioCodecs.length
          ? ['8', '101', '9', '109', '0']
          : ['109', '9', '0', '8', '101'];
        const expectedVideoCodecIds = preferredVideoCodecs.length
          ? ['126', '97', '121', '120', '99']
          : ['120', '121', '126', '97', '99'];
        itShouldHaveCodecOrder(sdpType, preferredAudioCodecs, preferredVideoCodecs, expectedAudioCodecIds, expectedVideoCodecIds);
      });
    });
  });
});

describe('setSimulcast', () => {
  combinationContext([
    [
      ['planb', 'unified'],
      x => `when called with a ${x} sdp`
    ],
    [
      [true, false],
      x => `when the SDP ${x ? 'already has' : 'does not already have'} simulcast SSRCs`
    ],
    [
      [true, false],
      x => `when the payload type for VP8 is${x ? '' : ' not'} present in the m= line`
    ],
    [
      [new Set(['01234']), new Set(['01234', '56789'])],
      x => `when retransmission is${x.size === 2 ? '' : ' not'} supported`
    ]
  ], ([sdpType, areSimSSRCsAlreadyPresent, isVP8PayloadTypePresent, ssrcs]) => {
    let sdp;
    let simSdp;
    let trackIdsToAttributes;

    before(() => {
      ssrcs = Array.from(ssrcs.values());
      sdp = makeSdpForSimulcast(sdpType, ssrcs);
      trackIdsToAttributes = new Map();

      if (!isVP8PayloadTypePresent) {
        sdp = sdp.replace(/m=video 9 UDP\/TLS\/RTP\/SAVPF 120 121 126 97/,
          'm=video 9 UDP/TLS/RTP/SAVPF 121 126 97');
      }
      if (areSimSSRCsAlreadyPresent) {
        sdp = setSimulcast(sdp, sdpType, trackIdsToAttributes);
      }
      simSdp = setSimulcast(sdp, sdpType, trackIdsToAttributes);
    });

    if (!isVP8PayloadTypePresent || areSimSSRCsAlreadyPresent) {
      it('should not add simulcast SSRCs for each video MediaStreamTrack ID', () => {
        assert.equal(simSdp, sdp);
      });
      return;
    }

    it('should add simulcast SSRCs for each video MediaStreamTrack ID', () => {
      const videoSection = `m=${simSdp.split('\r\nm=')[2]}`;
      const simSSRCs = (videoSection.match(/^a=ssrc:.+ msid:.+$/gm) || []).map(line => {
        return line.match(/^a=ssrc:([0-9]+)/)[1];
      });

      const flowPairs = (videoSection.match(/^a=ssrc-group:FID .+$/gm) || []).reduce((pairs, line) => {
        const ssrcs = line.match(/^a=ssrc-group:FID ([0-9]+) ([0-9]+)$/).slice(1);
        pairs.set(ssrcs[1], ssrcs[0]);
        return pairs;
      }, new Map());

      assert.equal(simSSRCs.length, ssrcs.length * 3);
      assert.equal(simSSRCs[0], ssrcs[0]);
      assert.equal(flowPairs.size, ssrcs.length === 2 ? 3 : 0);

      if (ssrcs.length === 2) {
        assert.equal(simSSRCs[1], ssrcs[1]);
        assert.equal(flowPairs.get(ssrcs[1]), ssrcs[0]);
      }
    });

    it('should include "a=x-google-flag:conference"', () => {
      assert(simSdp.match(/a=x-google-flag:conference/));
    });

    context('when the SDP contains a previously added MediaStreamTrack ID', () => {
      before(() => {
        simSdp = setSimulcast(sdp, sdpType, trackIdsToAttributes);
      });

      it('should not generate new simulcast SSRCs and re-use the existing simulcast SSRCs', () => {
        const videoSection = `m=${simSdp.split('\r\nm=')[2]}`;
        const trackAttributes = [...trackIdsToAttributes.values()][0];
        const simSSRCs = (videoSection.match(/^a=ssrc:.+ msid:.+$/gm) || []).map(line => {
          return line.match(/^a=ssrc:([0-9]+)/)[1];
        });

        const flowPairs = (videoSection.match(/^a=ssrc-group:FID .+$/gm) || []).reduce((pairs, line) => {
          const ssrcs = line.match(/^a=ssrc-group:FID ([0-9]+) ([0-9]+)$/).slice(1);
          pairs.set(ssrcs[1], ssrcs[0]);
          return pairs;
        }, new Map());

        const existingSimSSRCs = trackAttributes.rtxPairs.size
          ? flatMap([...trackAttributes.rtxPairs.entries()], pair => pair.reverse())
          : [...trackAttributes.primarySSRCs.values()];

        assert.deepEqual(simSSRCs, existingSimSSRCs);
        assert.deepEqual([...flowPairs.entries()], [...trackAttributes.rtxPairs.entries()]);
      });
    });
  });

  describe('when a subsequent offer disables RTX', () => {
    it('does not add RTX SSRCs, FID groups, etc.', () => {
      const sdp1 = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE audio video\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:audio\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=recvonly\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 101 123 122 107 109 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:video\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:101 rtx/90000\r
a=fmtp:101 apt=100\r
a=rtpmap:123 rtx/90000\r
a=fmtp:123 apt=102\r
a=rtpmap:122 rtx/90000\r
a=fmtp:122 apt=127\r
a=rtpmap:107 rtx/90000\r
a=fmtp:107 apt=125\r
a=rtpmap:109 rtx/90000\r
a=fmtp:109 apt=108\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;

      const sdp2 = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE audio video\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:audio\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=recvonly\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:video\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;

      const trackAttributes = new Map();

      const simSdp1 = setSimulcast(sdp1, 'planb', trackAttributes);

      const fidGroups = simSdp1.match(/a=ssrc-group:FID/g);
      assert.equal(fidGroups.length, 3, 'RTX is enabled; therefore, there should be 3 FID groups in the SDP');

      const ssrcs1 = new Set(simSdp1.match(/a=ssrc:[0-9]+/g).map(line => line.match(/a=ssrc:([0-9]+)/)[1]));
      assert.equal(ssrcs1.size, 6, 'RTX is enabled; therefore, there should be 6 SSRCs in the SDP');

      const simSdp2 = setSimulcast(sdp2, 'planb', trackAttributes);

      assert(!simSdp2.match(/a=ssrc-group:FID/), 'RTX is disabled; therefore, there should be no FID groups in the SDP');

      const ssrcs2 = new Set(simSdp2.match(/a=ssrc:[0-9]+/g).map(line => line.match(/a=ssrc:([0-9]+)/)[1]));
      assert.equal(ssrcs2.size, 3, 'RTX is disabled; therefore, there should be just 3 SSRCs in the SDP');
    });
  });
});

describe('unifiedPlanFilterLocalCodecs', () => {
  it('should filter codecs in a local SDP based on those advertised in the remote SDP', () => {
    const localSdp = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1 2\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 101 123 122 107 109 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:1\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:101 rtx/90000\r
a=fmtp:101 apt=100\r
a=rtpmap:123 rtx/90000\r
a=fmtp:123 apt=102\r
a=rtpmap:122 rtx/90000\r
a=fmtp:122 apt=127\r
a=rtpmap:107 rtx/90000\r
a=fmtp:107 apt=125\r
a=rtpmap:109 rtx/90000\r
a=fmtp:109 apt=108\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 101 123 122 107 109 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:2\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:101 rtx/90000\r
a=fmtp:101 apt=100\r
a=rtpmap:123 rtx/90000\r
a=fmtp:123 apt=102\r
a=rtpmap:122 rtx/90000\r
a=fmtp:122 apt=127\r
a=rtpmap:107 rtx/90000\r
a=fmtp:107 apt=125\r
a=rtpmap:109 rtx/90000\r
a=fmtp:109 apt=108\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;
    const remoteSdp = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 0\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=recvonly\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:0 PCMU/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 99 22\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:1\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=recvonly\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:99 H264/90000\r
a=rtcp-fb:99 goog-remb\r
a=rtcp-fb:99 transport-cc\r
a=rtcp-fb:99 ccm fir\r
a=rtcp-fb:99 nack\r
a=rtcp-fb:99 nack pli\r
a=fmtp:99 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:22 rtx/90000\r
a=fmtp:22 apt=99\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;

    const filteredLocalSdp = unifiedPlanFilterLocalCodecs(localSdp, remoteSdp);
    const [audioSection, videoSection, newVideoSection] = getMediaSections(localSdp);
    const [filteredAudioSection, filteredVideoSection, filteredNewVideoSection] = getMediaSections(filteredLocalSdp);

    [
      ['audio', filteredAudioSection, audioSection, [111, 0], [103, 104, 9, 8, 106, 105, 13, 110, 112, 113, 126]],
      ['video', filteredVideoSection, videoSection, [123, 102], [96, 97, 99, 101, 122, 107, 109, 98, 100, 127, 125, 108, 124]]
    ].forEach(([kind, filteredSection, section, expectedPtsRetained, expectedPtsFiltered]) => {
      const mLineRegex = new RegExp(`^m=${kind} .+ ${expectedPtsRetained.join(' ')}$`, 'm');
      assert(mLineRegex.test(filteredSection));

      expectedPtsRetained.forEach(pt => {
        ['rtpmap', 'rtcp-fb', 'fmtp'].forEach(attr => {
          const attrRegex = new RegExp(`^a=${attr}:${pt} (.+)$`, 'm');
          const match = section.match(attrRegex);
          const filteredMatch = filteredSection.match(attrRegex);
          assert.equal(!!filteredMatch, !!match);
          if (filteredMatch) {
            assert.equal(filteredMatch[1], match[1]);
          }
        });
      });

      expectedPtsFiltered.forEach(pt => {
        ['rtpmap', 'rtcp-fb', 'fmtp'].forEach(attr => {
          const attrRegex = new RegExp(`^a=${attr}:${pt} .+$`, 'm');
          assert(!attrRegex.test(filteredSection));
        });
      });

      assert.equal(filteredNewVideoSection, newVideoSection);
    });
  });
});

describe('unifiedPlanFilterRemoteVideoCodecs', () => {
  it('should filter codecs in a remote SDP based on those advertised in the local SDP', () => {
    const localSdp = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1 2\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 101 123 122 107 109 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:1\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:101 rtx/90000\r
a=fmtp:101 apt=100\r
a=rtpmap:123 rtx/90000\r
a=fmtp:123 apt=102\r
a=rtpmap:122 rtx/90000\r
a=fmtp:122 apt=127\r
a=rtpmap:107 rtx/90000\r
a=fmtp:107 apt=125\r
a=rtpmap:109 rtx/90000\r
a=fmtp:109 apt=108\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 101 123 122 107 109 98 100 102 127 125 108 124\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:2\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=rtpmap:99 rtx/90000\r
a=fmtp:99 apt=98\r
a=rtpmap:101 rtx/90000\r
a=fmtp:101 apt=100\r
a=rtpmap:123 rtx/90000\r
a=fmtp:123 apt=102\r
a=rtpmap:122 rtx/90000\r
a=fmtp:122 apt=127\r
a=rtpmap:107 rtx/90000\r
a=fmtp:107 apt=125\r
a=rtpmap:109 rtx/90000\r
a=fmtp:109 apt=108\r
a=rtpmap:98 VP9/90000\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtpmap:100 H264/90000\r
a=rtcp-fb:100 goog-remb\r
a=rtcp-fb:100 transport-cc\r
a=rtcp-fb:100 ccm fir\r
a=rtcp-fb:100 nack\r
a=rtcp-fb:100 nack pli\r
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42001f\r
a=rtpmap:102 H264/90000\r
a=rtcp-fb:102 goog-remb\r
a=rtcp-fb:102 transport-cc\r
a=rtcp-fb:102 ccm fir\r
a=rtcp-fb:102 nack\r
a=rtcp-fb:102 nack pli\r
a=fmtp:102 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:127 H264/90000\r
a=rtcp-fb:127 goog-remb\r
a=rtcp-fb:127 transport-cc\r
a=rtcp-fb:127 ccm fir\r
a=rtcp-fb:127 nack\r
a=rtcp-fb:127 nack pli\r
a=fmtp:127 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=4d0032\r
a=rtpmap:125 H264/90000\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=fmtp:125 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=640032\r
a=rtpmap:108 red/90000\r
a=rtpmap:124 ulpfec/90000\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;
    const remoteSdp = `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 0\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=recvonly\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:0 PCMU/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 99 22\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:1\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=recvonly\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:99 H264/90000\r
a=rtcp-fb:99 goog-remb\r
a=rtcp-fb:99 transport-cc\r
a=rtcp-fb:99 ccm fir\r
a=rtcp-fb:99 nack\r
a=rtcp-fb:99 nack pli\r
a=fmtp:99 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:22 rtx/90000\r
a=fmtp:22 apt=99\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
m=video 9 UDP/TLS/RTP/SAVPF 99 96 22 21\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:2\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=recvonly\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:99 H264/90000\r
a=rtcp-fb:99 goog-remb\r
a=rtcp-fb:99 transport-cc\r
a=rtcp-fb:99 ccm fir\r
a=rtcp-fb:99 nack\r
a=rtcp-fb:99 nack pli\r
a=fmtp:99 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f\r
a=rtpmap:22 rtx/90000\r
a=fmtp:22 apt=99\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:21 rtx/90000\r
a=fmtp:21 apt=96\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`;

    const filteredRemoteSdp = unifiedPlanFilterRemoteVideoCodecs(remoteSdp, localSdp, ['h264']);
    const [audioSection, videoSection, newVideoSection] = getMediaSections(remoteSdp);
    const [filteredAudioSection, filteredVideoSection, filteredNewVideoSection] = getMediaSections(filteredRemoteSdp);

    [
      ['video', filteredVideoSection, videoSection, [99, 22], []],
      ['video', filteredNewVideoSection, newVideoSection, [96, 21], [99, 22]]
    ].forEach(([kind, filteredSection, section, expectedPtsRetained, expectedPtsFiltered]) => {
      const mLineRegex = new RegExp(`^m=${kind} .+ ${expectedPtsRetained.join(' ')}$`, 'm');
      assert(mLineRegex.test(filteredSection));

      expectedPtsRetained.forEach(pt => {
        ['rtpmap', 'rtcp-fb', 'fmtp'].forEach(attr => {
          const attrRegex = new RegExp(`^a=${attr}:${pt} (.+)$`, 'm');
          const match = section.match(attrRegex);
          const filteredMatch = filteredSection.match(attrRegex);
          assert.equal(!!filteredMatch, !!match);
          if (filteredMatch) {
            assert.equal(filteredMatch[1], match[1]);
          }
        });
      });

      expectedPtsFiltered.forEach(pt => {
        ['rtpmap', 'rtcp-fb', 'fmtp'].forEach(attr => {
          const attrRegex = new RegExp(`^a=${attr}:${pt} .+$`, 'm');
          assert(!attrRegex.test(filteredSection));
        });
      });
    });

    assert.equal(filteredAudioSection, audioSection);
  });
});

describe('revertSimulcastForNonVP8MediaSections', () => {
  combinationContext([
    [
      ['planb', 'unified'],
      x => `when called with a ${x} sdp`
    ],
    [
      [true, false],
      x => `when the preferred payload type in answer is${x ? '' : ' not'} VP8`
    ],
    [
      [new Set(['01234']), new Set(['01234', '56789'])],
      x => `when retransmission is${x.size === 2 ? '' : ' not'} supported`
    ]
  ], ([sdpType, isVP8PreferredPayloadType, ssrcs]) => {
    let sdp;
    let simSdp;
    let remoteSdp;
    let revertedSdp;
    let trackIdsToAttributes;

    before(() => {
      ssrcs = Array.from(ssrcs.values());
      sdp = makeSdpForSimulcast(sdpType, ssrcs);
      trackIdsToAttributes = new Map();
      simSdp = setSimulcast(sdp, sdpType, trackIdsToAttributes);
      remoteSdp = makeSdpWithTracks(sdpType, {
        audio: ['audio-1'],
        video: [{ id: 'video-1', ssrc: ssrcs[0] }]
      });
      if (isVP8PreferredPayloadType) {
        remoteSdp = setCodecPreferences(sdp, [{ codec: 'PCMU' }], [{ codec: 'VP8' }]);
      } else {
        remoteSdp = setCodecPreferences(sdp, [{ codec: 'PCMU' }], [{ codec: 'H264' }]);
      }
      revertedSdp = revertSimulcastForNonVP8MediaSections(simSdp, sdp, remoteSdp);
    });

    if (isVP8PreferredPayloadType) {
      it('should not revert simulcast SSRCs', () => {
        assert.equal(revertedSdp, simSdp);
      });
    } else {
      it('should revert simulcast SSRCs', () => {
        assert.equal(revertedSdp, sdp);
      });
    }
  });
});

describe('unifiedPlanAddOrRewriteNewTrackIds', () => {
  [true, false].forEach(withAppData => {
    context(`when the Unified Plan SDP ${withAppData ? 'has' : 'does not have'} MediaStreamTrack IDs in a=msid: lines`, () => {
      it('should rewrite Track IDs with the IDs of MediaStreamTracks associated with unassigned RTCRtpTransceivers', () => {
        const sdp = makeSdpWithTracks('unified', {
          audio: ['foo', 'bar'],
          video: ['baz', 'zee']
        }, null, null, withAppData);
        const activeMidsToTrackIds = new Map([['mid_baz', 'baz']]);
        const newTrackIdsByKind = new Map([['audio', ['xxx', 'yyy']], ['video', ['zzz']]]);
        const newSdp = unifiedPlanAddOrRewriteNewTrackIds(sdp, activeMidsToTrackIds, newTrackIdsByKind);
        const msAttrsAndKinds = getMediaSections(newSdp).map(section => [
          section.match(/^a=msid:(.+)/m)[1],
          section.match(/^m=(audio|video)/)[1]
        ]);
        assert.deepEqual(msAttrsAndKinds, [
          ['- xxx', 'audio'],
          ['- yyy', 'audio'],
          [withAppData ? '- baz' : '-', 'video'],
          ['- zzz', 'video']
        ]);
      });
    });
  });
});

describe('unifiedPlanAddOrRewriteTrackIds', () => {
  [true, false].forEach(withAppData => {
    context(`when the Unified Plan SDP ${withAppData ? 'has' : 'does not have'} MediaStreamTrack IDs in a=msid: lines`, () => {
      it('should rewrite Track IDs with the IDs of MediaStreamTracks associated with RTCRtpTransceivers', () => {
        const sdp = makeSdpWithTracks('unified', { audio: ['foo'], video: ['bar'] }, null, null, withAppData);
        const midsToTrackIds = new Map([['mid_foo', 'baz'], ['mid_bar', 'zee']]);
        const newSdp = unifiedPlanAddOrRewriteTrackIds(sdp, midsToTrackIds);
        const sections = getMediaSections(newSdp);
        midsToTrackIds.forEach((trackId, mid) => {
          const section = sections.find(section => new RegExp(`^a=mid:${mid}$`, 'm').test(section));
          assert.equal(section.match(/^a=msid:.+ (.+)$/m)[1], trackId);
          assert.equal(section.match(/^a=ssrc:.+ msid:.+ (.+)$/m)[1], trackId);
        });
      });
    });
  });
});

describe('removeSSRCAttributes', () => {
  const tests = [{
    name: 'removes single ssrc attribute (cname)',
    before: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r`,
    remove: ['cname'],
    after: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r`
  },
  {
    name: 'removes specified attributes (mslabel, label)',
    before: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      `,
    remove: ['mslabel', 'label'],
    after: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      `
  },
  {
    name: 'does not remove non-existant attribute (foo)',
    before: `\
      a=ssrc:0000000000 msid:foo-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      `,
    remove: ['FID'],
    after: `\
      a=ssrc:0000000000 msid:foo-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      `
  },
  {
    name: 'does not remove ssrc-group attribute (FID)',
    before: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r`,
    remove: ['FID'],
    after: `\
      a=ssrc-group:FID 0000000000 1111111111\r
      a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
      a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
      a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
      a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r`,
  }];

  tests.forEach(test => {
    it(test.name, () => {
      assert.equal(removeSSRCAttributes(test.before, test.remove), test.after);
    });
  });
});

describe('disableRtx', () => {
  const sdpWithoutRtx = `v=0\r
o=mozilla...THIS_IS_SDPARTA-78.0.1 914717455470386583 0 IN IP4 0.0.0.0\r
s=-\r
t=0 0\r
a=fingerprint:sha-256 64:C5:43:F0:DE:63:49:1C:80:85:98:98:48:EA:50:38:DF:1E:95:28:5A:F2:5B:22:A3:9D:6E:C7:F5:66:A4:73\r
a=group:BUNDLE 0 1\r
a=ice-options:trickle\r
a=msid-semantic:WMS *\r
m=audio 9 UDP/TLS/RTP/SAVPF 111 9 0 8 126\r
c=IN IP4 0.0.0.0\r
a=sendrecv\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r
a=fmtp:111 maxplaybackrate=48000;stereo=1;useinbandfec=1\r
a=fmtp:126 0-15\r
a=ice-pwd:87bc3b58d14e6e747ec7607495db1e36\r
a=ice-ufrag:73f379bf\r
a=mid:0\r
a=msid:{7c81c628-2293-d24f-b6a6-612725ade021} {c04b41b9-0284-c549-bb2b-ba0d430f18d2}\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtpmap:9 G722/8000/1\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:126 telephone-event/8000/1\r
a=setup:active\r
a=ssrc:599948313 cname:{69b8d6b0-3ec4-004c-98e0-543de2b8e22f}\r
m=video 9 UDP/TLS/RTP/SAVPF 96 98 125 108\r
c=IN IP4 0.0.0.0\r
a=inactive\r
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r
a=fmtp:125 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1\r
a=fmtp:108 profile-level-id=42e01f;level-asymmetry-allowed=1\r
a=fmtp:96 max-fs=12288;max-fr=60\r
a=fmtp:98 max-fs=12288;max-fr=60\r
a=ice-pwd:87bc3b58d14e6e747ec7607495db1e36\r
a=ice-ufrag:73f379bf\r
a=mid:1\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:108 nack\r
a=rtcp-fb:108 nack pli\r
a=rtcp-fb:108 ccm fir\r
a=rtcp-fb:108 goog-remb\r
a=rtcp-mux\r
a=rtpmap:96 VP8/90000\r
a=rtpmap:98 VP9/90000\r
a=rtpmap:125 H264/90000\r
a=rtpmap:108 H264/90000\r
a=setup:active\r
a=ssrc:123182331 cname:{69b8d6b0-3ec4-004c-98e0-543de2b8e22f}`;

  const sdpWithRtx = `v=0\r
o=mozilla...THIS_IS_SDPARTA-79.0 182335824049326962 0 IN IP4 0.0.0.0\r
s=-\r
t=0 0\r
a=fingerprint:sha-256 24:B0:F9:5C:CD:C4:88:C2:9B:DE:CC:B1:D7:9C:41:7B:1D:94:C8:2A:87:8C:A3:F6:94:83:AC:30:64:00:4C:E5\r
a=group:BUNDLE 0 1\r
a=ice-options:trickle\r
a=msid-semantic:WMS *\r
m=audio 9 UDP/TLS/RTP/SAVPF 111 9 0 8 126\r
c=IN IP4 0.0.0.0\r
a=sendrecv\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r
a=fmtp:111 maxplaybackrate=48000;stereo=1;useinbandfec=1\r
a=fmtp:126 0-15\r
a=ice-pwd:00887f6cd54bbbdde038834c933f944e\r
a=ice-ufrag:3914f648\r
a=mid:0\r
a=msid:{ecaa60a2-3118-3d43-a5c8-0793a8a5b0cc} {dae6631b-a5f7-c047-a11f-22b467ccb280}\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtpmap:9 G722/8000/1\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:126 telephone-event/8000/1\r
a=setup:active\r
a=ssrc:3010114044 cname:{fd6b9593-e05a-f34f-b91a-389a1874c13c}\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97 99 107 109 98 125 108\r
c=IN IP4 0.0.0.0\r
a=inactive\r
a=extmap:14 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:2 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:3 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:12 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:4 urn:ietf:params:rtp-hdrext:sdes:mid\r
a=fmtp:125 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1\r
a=fmtp:108 profile-level-id=42e01f;level-asymmetry-allowed=1\r
a=fmtp:96 max-fs=12288;max-fr=60\r
a=fmtp:97 apt=96\r
a=fmtp:98 max-fs=12288;max-fr=60\r
a=fmtp:99 apt=98\r
a=fmtp:107 apt=125\r
a=fmtp:109 apt=108\r
a=ice-pwd:00887f6cd54bbbdde038834c933f944e\r
a=ice-ufrag:3914f648\r
a=mid:1\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:98 nack\r
a=rtcp-fb:98 nack pli\r
a=rtcp-fb:98 ccm fir\r
a=rtcp-fb:98 goog-remb\r
a=rtcp-fb:98 transport-cc\r
a=rtcp-fb:125 nack\r
a=rtcp-fb:125 nack pli\r
a=rtcp-fb:125 ccm fir\r
a=rtcp-fb:125 goog-remb\r
a=rtcp-fb:125 transport-cc\r
a=rtcp-fb:108 nack\r
a=rtcp-fb:108 nack pli\r
a=rtcp-fb:108 ccm fir\r
a=rtcp-fb:108 goog-remb\r
a=rtcp-fb:108 transport-cc\r
a=rtcp-mux\r
a=rtpmap:96 VP8/90000\r
a=rtpmap:97 rtx/90000\r
a=rtpmap:98 VP9/90000\r
a=rtpmap:99 rtx/90000\r
a=rtpmap:125 H264/90000\r
a=rtpmap:107 rtx/90000\r
a=rtpmap:108 H264/90000\r
a=rtpmap:109 rtx/90000\r
a=setup:active\r
a=ssrc:2476366320 cname:{fd6b9593-e05a-f34f-b91a-389a1874c13c}\r
a=ssrc:3143435575 cname:{fd6b9593-e05a-f34f-b91a-389a1874c13c}\r
a=ssrc-group:FID 2476366320 3143435575`;

  [sdpWithoutRtx, sdpWithRtx].forEach(sdp => {
    const rtxFmtpRegex = /^a=fmtp:.+ apt=.+$/gm;
    const rtxPts = [97, 99, 107, 109];
    const rtxRtpmapRegex = /^a=rtpmap:.+ rtx\/.+$/gm;
    const rtxSSRCAttrRegex = /^a=ssrc:3143435575 .+$/gm;
    const shouldRemoveRtx = sdp === sdpWithRtx;
    const ssrcGroupRegex = /^a=ssrc-group:FID .+ .+$/gm;

    it(`should ${shouldRemoveRtx ? 'disable RTX' : 'do nothing'}`, () => {
      const sdp1 = disableRtx(sdp);
      if (shouldRemoveRtx) {
        const mediaSections = getMediaSections(sdp);
        const mediaSections1 = getMediaSections(sdp1);
        mediaSections.forEach((mediaSection, i) => {
          if (!/^m=video/.test(mediaSections1[i])) {
            assert.equal(mediaSections1[i], mediaSection);
          } else {
            // The RTX payload types should not be present.
            const lines = mediaSections1[i].split('\r\n');
            const pts = lines[0].match(/(\d+)/g).slice(1);
            rtxPts.forEach(rtxPt => assert(!pts.includes(rtxPt)));

            // SDP lines related to RTX should not be present.
            const rtxLines = lines.filter(line => rtxFmtpRegex.test(line)
             || rtxRtpmapRegex.test(line)
             || rtxSSRCAttrRegex.test(line)
             || ssrcGroupRegex.test(line));
            assert.equal(rtxLines.length, 0);
          }
        });
      } else {
        assert.equal(sdp1, sdp);
      }
    });
  });
});

describe('enableDtxForOpus', () => {
  const sdps = {
    planb: `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE audio video\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:audio\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:video\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
`,
    unified: `\
v=0\r
o=- 6385359508499371184 3 IN IP4 127.0.0.1\r
s=-\r
t=0 0\r
a=group:BUNDLE 0 1 2\r
a=msid-semantic: WMS 7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:0\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
m=video 9 UDP/TLS/RTP/SAVPF 96 97\r
c=IN IP4 0.0.0.0\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:1\r
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset\r
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time\r
a=extmap:4 urn:3gpp:video-orientation\r
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01\r
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay\r
a=extmap:7 http://www.webrtc.org/experiments/rtp-hdrext/video-content-type\r
a=extmap:8 http://www.webrtc.org/experiments/rtp-hdrext/video-timing\r
a=sendrecv\r
a=rtcp-mux\r
a=rtcp-rsize\r
a=rtpmap:96 VP8/90000\r
a=rtcp-fb:96 goog-remb\r
a=rtcp-fb:96 transport-cc\r
a=rtcp-fb:96 ccm fir\r
a=rtcp-fb:96 nack\r
a=rtcp-fb:96 nack pli\r
a=rtpmap:97 rtx/90000\r
a=fmtp:97 apt=96\r
a=ssrc-group:FID 0000000000 1111111111\r
a=ssrc:0000000000 cname:s9hDwDQNjISOxWtK\r
a=ssrc:0000000000 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:0000000000 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:0000000000 label:d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 cname:s9hDwDQNjISOxWtK\r
a=ssrc:1111111111 msid:7a9d401b-3cf6-4216-b260-78f93ba4c32e d8b9a935-da54-4d21-a8de-522c87258244\r
a=ssrc:1111111111 mslabel:7a9d401b-3cf6-4216-b260-78f93ba4c32e\r
a=ssrc:1111111111 label:d8b9a935-da54-4d21-a8de-522c87258244\r
m=audio 22602 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126\r
c=IN IP4 34.203.250.135\r
a=rtcp:9 IN IP4 0.0.0.0\r
a=candidate:2235265311 1 udp 7935 34.203.250.135 22602 typ relay raddr 107.20.226.156 rport 51463 generation 0 network-cost 50\r
a=ice-ufrag:Cmuk\r
a=ice-pwd:qjHlb5sxe0bozbwpRSYqil3v\r
a=ice-options:trickle\r
a=fingerprint:sha-256 BE:29:0C:60:05:B6:6E:E6:EA:A8:28:D5:89:41:F9:5B:22:11:CD:26:01:98:E0:55:9D:FE:C2:F8:EA:4C:17:91\r
a=setup:actpass\r
a=mid:2\r
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level\r
a=sendrecv\r
a=rtcp-mux\r
a=rtpmap:111 opus/48000/2\r
a=rtcp-fb:111 transport-cc\r
a=fmtp:111 minptime=10;useinbandfec=1\r
a=rtpmap:103 ISAC/16000\r
a=rtpmap:104 ISAC/32000\r
a=rtpmap:9 G722/8000\r
a=rtpmap:0 PCMU/8000\r
a=rtpmap:8 PCMA/8000\r
a=rtpmap:106 CN/32000\r
a=rtpmap:105 CN/16000\r
a=rtpmap:13 CN/8000\r
a=rtpmap:110 telephone-event/48000\r
a=rtpmap:112 telephone-event/32000\r
a=rtpmap:113 telephone-event/16000\r
a=rtpmap:126 telephone-event/8000\r
`
  };

  combinationContext([
    [
      ['planb', 'unified'],
      x => `when the SDP is of the format "${x}"`
    ],
    [
      ['', '0'],
      x => `when audio mids are ${x ? '' : 'not '}specified`
    ]
  ], ([sdpFormat, midsCsv]) => {
    const mids = midsCsv ? midsCsv.split(',') : [];

    if (mids.length > 0 && sdpFormat === 'planb') {
      return;
    }
    const dtxMids = mids.length > 0 ? mids : sdpFormat === 'planb' ? ['audio'] : ['0', '2'];

    it(`should enable opus DTX for ${mids.length > 0 ? 'the specified audio mids' : 'all the audio mids'}`, () => {
      const sdp = sdps[sdpFormat];
      const sdp1 = mids.length > 0 ? enableDtxForOpus(sdp, mids) : enableDtxForOpus(sdp);
      const mediaSections = getMediaSections(sdp);
      const mediaSections1 = getMediaSections(sdp1);
      mediaSections1.forEach((section, i) => {
        if (!/^m=audio/.test(section)) {
          assert.equal(section, mediaSections[i]);
        } else {
          const mid = section.match(/^a=mid:(.+)$/m)[1];
          if (dtxMids.includes(mid)) {
            assert.notEqual(section, mediaSections[i]);
            assert(/a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1/.test(section));
            assert(!/a=fmtp:111 minptime=10;useinbandfec=1;usedtx=1/.test(mediaSections[i]));
          } else {
            assert.equal(section, mediaSections[i]);
          }
        }
      });
    });
  });
});

function itShouldHaveCodecOrder(sdpType, preferredAudioCodecs, preferredVideoCodecs, expectedAudioCodecIds, expectedVideoCodecIds) {
  const sdp = makeSdpWithTracks(sdpType, {
    audio: ['audio-1', 'audio-2'],
    video: ['video-1', 'video-2']
  });
  const modifiedSdp = setCodecPreferences(sdp, preferredAudioCodecs, preferredVideoCodecs);
  modifiedSdp.split('\r\nm=').slice(1).forEach(section => {
    const kind = section.split(' ')[0];
    const expectedCodecIds = kind === 'audio' ? expectedAudioCodecIds : expectedVideoCodecIds;
    const codecIds = section.split('\r\n')[0].match(/([0-9]+)/g).slice(1);
    assert.equal(codecIds.join(' '), expectedCodecIds.join(' '));
  });
}


