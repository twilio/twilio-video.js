'use strict';

const assert = require('assert');
const { makeUUID } = require('../../../../lib/util');

const {
  getPlanBTrackIds,
  getUnifiedPlanTrackIds,
  getPlanBSSRCs,
  getUnifiedPlanSSRCs,
  updatePlanBTrackIdsToSSRCs,
  updateUnifiedPlanTrackIdsToSSRCs
} = require('../../../../lib/util/sdp');

function makePlanBSDP(version, trackIds, ssrcs) {
  return `v=0
o=- 7286723344670728240 ${version} IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE audio video
a=msid-semantic: WMS 71d61989-ae80-4f93-aa6a-c764957b9785
m=audio 9 UDP/TLS/RTP/SAVPF 111 103 104 9 0 8 106 105 13 110 112 113 126
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:I8XF
a=ice-pwd:V1LUXrmNieMufDUPxWT8eFR0
a=fingerprint:sha-256 5C:F7:7A:79:A8:60:84:B1:5E:88:43:C0:64:D1:DB:12:06:16:C2:37:4E:A9:EB:26:7F:84:7B:0E:B9:52:A4:8D
a=setup:actpass
a=mid:audio
a=extmap:1 urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=sendrecv
a=rtcp-mux
a=rtpmap:111 opus/48000/2
a=rtcp-fb:111 transport-cc
a=fmtp:111 minptime=10;useinbandfec=1
a=rtpmap:103 ISAC/16000
a=rtpmap:104 ISAC/32000
a=rtpmap:9 G722/8000
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:106 CN/32000
a=rtpmap:105 CN/16000
a=rtpmap:13 CN/8000
a=rtpmap:110 telephone-event/48000
a=rtpmap:112 telephone-event/32000
a=rtpmap:113 telephone-event/16000
a=rtpmap:126 telephone-event/8000
a=ssrc:${ssrcs[0][0]} cname:ZVrerVFXW7ne/tcZ
a=ssrc:${ssrcs[0][0]} msid:71d61989-ae80-4f93-aa6a-c764957b9785 ${trackIds[0]}
a=ssrc:${ssrcs[0][0]} mslabel:71d61989-ae80-4f93-aa6a-c764957b9785
a=ssrc:${ssrcs[0][0]} label:8c5067ce-869b-4bdc-bf96-6a1c5f9c6ce7
m=video 9 UDP/TLS/RTP/SAVPF 96 98 100 102 127 97 99 101 125
c=IN IP4 0.0.0.0
a=rtcp:9 IN IP4 0.0.0.0
a=ice-ufrag:I8XF
a=ice-pwd:V1LUXrmNieMufDUPxWT8eFR0
a=fingerprint:sha-256 5C:F7:7A:79:A8:60:84:B1:5E:88:43:C0:64:D1:DB:12:06:16:C2:37:4E:A9:EB:26:7F:84:7B:0E:B9:52:A4:8D
a=setup:actpass
a=mid:video
a=extmap:2 urn:ietf:params:rtp-hdrext:toffset
a=extmap:3 http://www.webrtc.org/experiments/rtp-hdrext/abs-send-time
a=extmap:4 urn:3gpp:video-orientation
a=extmap:5 http://www.ietf.org/id/draft-holmer-rmcat-transport-wide-cc-extensions-01
a=extmap:6 http://www.webrtc.org/experiments/rtp-hdrext/playout-delay
a=sendrecv
a=rtcp-mux
a=rtcp-rsize
a=rtpmap:96 VP8/90000
a=rtcp-fb:96 ccm fir
a=rtcp-fb:96 nack
a=rtcp-fb:96 nack pli
a=rtcp-fb:96 goog-remb
a=rtcp-fb:96 transport-cc
a=rtpmap:98 VP9/90000
a=rtcp-fb:98 ccm fir
a=rtcp-fb:98 nack
a=rtcp-fb:98 nack pli
a=rtcp-fb:98 goog-remb
a=rtcp-fb:98 transport-cc
a=rtpmap:100 H264/90000
a=rtcp-fb:100 ccm fir
a=rtcp-fb:100 nack
a=rtcp-fb:100 nack pli
a=rtcp-fb:100 goog-remb
a=rtcp-fb:100 transport-cc
a=fmtp:100 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=rtpmap:102 red/90000
a=rtpmap:127 ulpfec/90000
a=rtpmap:97 rtx/90000
a=fmtp:97 apt=96
a=rtpmap:99 rtx/90000
a=fmtp:99 apt=98
a=rtpmap:101 rtx/90000
a=fmtp:101 apt=100
a=rtpmap:125 rtx/90000
a=fmtp:125 apt=102
a=ssrc-group:FID ${ssrcs[1][0]} ${ssrcs[1][1]}
a=ssrc:${ssrcs[1][0]} cname:ZVrerVFXW7ne/tcZ
a=ssrc:${ssrcs[1][0]} msid:71d61989-ae80-4f93-aa6a-c764957b9785 ${trackIds[1]}
a=ssrc:${ssrcs[1][0]} mslabel:71d61989-ae80-4f93-aa6a-c764957b9785
a=ssrc:${ssrcs[1][0]} label:${trackIds[1]}
a=ssrc:${ssrcs[1][1]} cname:ZVrerVFXW7ne/tcZ
a=ssrc:${ssrcs[1][1]} msid:71d61989-ae80-4f93-aa6a-c764957b9785 ${trackIds[1]}
a=ssrc:${ssrcs[1][1]} mslabel:71d61989-ae80-4f93-aa6a-c764957b9785
a=ssrc:${ssrcs[1][1]} label:${trackIds[1]}
`.split('\n').join('\r\n');
}

function makeUnifiedPlanSDP(version, trackIds, ssrcs) {
return `v=0
o=mozilla...THIS_IS_SDPARTA-53.0 3990212676194185183 0 IN IP4 0.0.0.0
s=-
t=0 0
a=fingerprint:sha-256 C7:8B:D1:46:FB:C9:63:0F:DB:D0:4E:7B:B0:CE:FA:58:61:22:2B:C4:87:75:F4:38:1D:D9:F9:78:9E:85:DC:2D
a=group:BUNDLE sdparta_0 sdparta_1
a=ice-options:trickle
a=msid-semantic:WMS *
m=audio 9 UDP/TLS/RTP/SAVPF 109 9 0 8 101
c=IN IP4 0.0.0.0
a=sendrecv
a=extmap:1/sendonly urn:ietf:params:rtp-hdrext:ssrc-audio-level
a=fmtp:109 maxplaybackrate=48000;stereo=1;useinbandfec=1
a=fmtp:101 0-15
a=ice-pwd:38dd971cd28b47bec81ec649b552cd02
a=ice-ufrag:0546e001
a=mid:sdparta_0
a=msid:{db2a3bcb-14f1-8f42-941d-28d5043319ed} ${trackIds[0]}
a=rtcp-mux
a=rtpmap:109 opus/48000/2
a=rtpmap:9 G722/8000/1
a=rtpmap:0 PCMU/8000
a=rtpmap:8 PCMA/8000
a=rtpmap:101 telephone-event/8000/1
a=setup:actpass
a=ssrc:${ssrcs[0]} cname:{53bc17b9-cbcc-af4d-8c8a-92dd6adb79dd}
m=video 9 UDP/TLS/RTP/SAVPF 120 121 126 97
c=IN IP4 0.0.0.0
a=bundle-only
a=sendrecv
a=fmtp:126 profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1
a=fmtp:97 profile-level-id=42e01f;level-asymmetry-allowed=1
a=fmtp:120 max-fs=12288;max-fr=60
a=fmtp:121 max-fs=12288;max-fr=60
a=ice-pwd:38dd971cd28b47bec81ec649b552cd02
a=ice-ufrag:0546e001
a=mid:sdparta_1
a=msid:{db2a3bcb-14f1-8f42-941d-28d5043319ed} ${trackIds[1]}
a=rtcp-fb:120 nack
a=rtcp-fb:120 nack pli
a=rtcp-fb:120 ccm fir
a=rtcp-fb:120 goog-remb
a=rtcp-fb:121 nack
a=rtcp-fb:121 nack pli
a=rtcp-fb:121 ccm fir
a=rtcp-fb:121 goog-remb
a=rtcp-fb:126 nack
a=rtcp-fb:126 nack pli
a=rtcp-fb:126 ccm fir
a=rtcp-fb:126 goog-remb
a=rtcp-fb:97 nack
a=rtcp-fb:97 nack pli
a=rtcp-fb:97 ccm fir
a=rtcp-fb:97 goog-remb
a=rtcp-mux
a=rtpmap:120 VP8/90000
a=rtpmap:121 VP9/90000
a=rtpmap:126 H264/90000
a=rtpmap:97 H264/90000
a=setup:actpass
a=ssrc:${ssrcs[1]} cname:{53bc17b9-cbcc-af4d-8c8a-92dd6adb79dd}
`.split('\n').join('\r\n');
}

function makeSSRC() {
  return Math.floor(Math.random() * 1e9);
}

function makeChromeStyleTrackId() {
  return makeUUID();
}

function makeFirefoxStyleTrackId() {
  return `{${makeChromeStyleTrackId()}}`;
}

[
  [
    'PlanB',
    makePlanBSDP,
    getPlanBTrackIds,
    getPlanBSSRCs,
    updatePlanBTrackIdsToSSRCs
  ],
  [
    'UnifiedPlan',
    makeUnifiedPlanSDP,
    getUnifiedPlanTrackIds,
    getUnifiedPlanSSRCs,
    updateUnifiedPlanTrackIdsToSSRCs
  ]
].forEach(([format, makeSDP, getTrackIds, getSSRCs, updateTrackIdsToSSRCs]) => {
  const makeTrackId = format === 'UnifiedPlan'
    ? makeFirefoxStyleTrackId
    : makeChromeStyleTrackId;

  const trackIds = [makeTrackId(), makeTrackId()];

  const audioSSRCs = [makeSSRC()];
  const videoSSRCs = format === 'PlanB'
    ? [makeSSRC(), makeSSRC()]
    : [makeSSRC()];

  const ssrcs = [audioSSRCs, videoSSRCs];

  const changedAudioSSRCs = [makeSSRC()];
  const changedVideoSSRCs = format === 'PlanB'
    ? [makeSSRC(), makeSSRC()]
    : [makeSSRC()];
  const changedSSRCs = [changedAudioSSRCs, changedVideoSSRCs];

  const sdp1 = makeSDP(1, trackIds, ssrcs);
  const sdp2 = makeSDP(2, trackIds, changedSSRCs);

  describe(`get${format}TrackIds`, () => {
    it('should return the MediaStreamTrack IDs announced in the SDP', () => {
      assert.deepEqual([...getTrackIds(sdp1)], trackIds);
    });
  });

  describe(`get${format}SSRCs`, () => {
    it('should return the SSRCs for the given MediaStreamTrack ID as announced in the SDP', () => {
      trackIds.forEach((trackId, i) => {
        assert.deepEqual([...getSSRCs(sdp1, trackId)], ssrcs[i]);
      });
    });
  });

  describe(`update${format}TrackIdsToSSRCs`, () => {
    let updatedSDP2;

    beforeEach(() => {
      const trackIdsToSSRCs = new Map();
      const updatedSDP1 = updateTrackIdsToSSRCs(trackIdsToSSRCs, sdp1);
      assert.equal(updatedSDP1, sdp1);
      updatedSDP2 = updateTrackIdsToSSRCs(trackIdsToSSRCs, sdp2);
    });

    it('should maintain the SSRCs originally announced for each MediaStreamTrack in the SDP', () => {
      trackIds.forEach((trackId, i) => {
        assert.deepEqual([...getSSRCs(updatedSDP2, trackId)], ssrcs[i]);
      });
    });

    it('should maintain the SSRCs originally announced for each SSRC group in the SDP', () => {
      const oldSSRCGroups = sdp1.match(/^a=ssrc-group:.*$/, 'gm');
      const newSSRCGroups = updatedSDP2.match(/^a=ssrc-group:.*$/, 'gm');
      assert.deepEqual(newSSRCGroups, oldSSRCGroups);
    });
  });
});
