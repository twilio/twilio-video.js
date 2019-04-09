'use strict';

const assert = require('assert');

const { flatMap } = require('../../../../../lib/util');

const {
  getMediaSections,
  setBitrateParameters,
  setCodecPreferences,
  setSimulcast,
  unifiedPlanRewriteNewTrackIds,
  unifiedPlanRewriteTrackIds
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
    preferredAudioCodecs = preferredAudioCodecs ? preferredAudioCodecs.split(',') : [];
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

describe('unifiedPlanRewriteNewTrackIds', () => {
  it('should rewrite Track IDs with the IDs of MediaStreamTracks associated with unassigned RTCRtpTransceivers', () => {
    const sdp = makeSdpWithTracks('unified', { audio: ['foo', 'bar'], video: ['baz', 'zee'] });
    const newTrackIdsByKind = new Map([['audio', ['yyy']], ['video', ['zzz']]]);
    const newSdp = unifiedPlanRewriteNewTrackIds(sdp, newTrackIdsByKind);
    const trackIdAndKinds = getMediaSections(newSdp).map(section => [
      section.match(/^a=msid:.+ (.+)/m)[1],
      section.match(/^m=(audio|video)/)[1]
    ]);
    assert.deepEqual(trackIdAndKinds, [
      ['foo', 'audio'],
      ['yyy', 'audio'],
      ['baz', 'video'],
      ['zzz', 'video']
    ]);
  });
});

describe('unifiedPlanRewriteTrackIds', () => {
  it('should rewrite Track IDs with the IDs of MediaStreamTracks associated with recycled RTCRtpTransceivers', () => {
    const sdp = makeSdpWithTracks('unified', { audio: ['foo'], video: ['bar'] });
    const midsToTrackIds = new Map([['mid_foo', 'baz'], ['mid_bar', 'zee']]);
    const newSdp = unifiedPlanRewriteTrackIds(sdp, midsToTrackIds);
    const sections = getMediaSections(newSdp);
    midsToTrackIds.forEach((trackId, mid) => {
      const section = sections.find(section => new RegExp(`^a=mid:${mid}$`, 'm').test(section));
      assert.equal(section.match(/^a=msid:.+ (.+)$/m)[1], trackId);
      assert.equal(section.match(/^a=ssrc:.+ msid:.+ (.+)$/m)[1], trackId);
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
