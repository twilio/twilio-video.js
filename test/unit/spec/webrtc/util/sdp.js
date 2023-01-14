'use strict';

const assert = require('assert');
const { makeUUID } = require('../../../../../lib/webrtc/util');

const {
  getTrackIds,
  getSSRCs,
  updateTrackIdsToSSRCs
} = require('../../../../../lib/webrtc/util/sdp');

function makeSDP(version, trackIds, ssrcs) {
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

function makeTrackId() {
  return `{${makeUUID()}}`;
}

describe('sdp utils', () => {
  const trackIds = [makeTrackId(), makeTrackId()];

  const audioSSRCs = [makeSSRC()];
  const videoSSRCs =  [makeSSRC()];

  const ssrcs = [audioSSRCs, videoSSRCs];

  const changedAudioSSRCs = [makeSSRC()];
  const changedVideoSSRCs = [makeSSRC()];
  const changedSSRCs = [changedAudioSSRCs, changedVideoSSRCs];

  const sdp1 = makeSDP(1, trackIds, ssrcs);
  const sdp2 = makeSDP(2, trackIds, changedSSRCs);

  describe('getTrackIds', () => {
    it('should return the MediaStreamTrack IDs announced in the SDP', () => {
      assert.deepEqual([...getTrackIds(sdp1)], trackIds);
    });
  });

  describe('getSSRCs', () => {
    it('should return the SSRCs for the given MediaStreamTrack ID as announced in the SDP', () => {
      trackIds.forEach((trackId, i) => {
        assert.deepEqual([...getSSRCs(sdp1, trackId)], ssrcs[i]);
      });
    });
  });

  describe('updateTrackIdsToSSRCs', () => {
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
