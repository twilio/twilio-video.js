'use strict';

/**
 * @interface TracksByKind
 * @property {Array<string>} [audio]
 * @property {Array<string>} [video]
 */

/**
 * @typedef {string|TrackAndSSRC} Track
 */

/**
 * @interface TrackAndSSRC
 * @property {string} id
 * @property {string} ssrc
 */

/**
 * @param {TracksByKind} kinds
 * @returns {string} sdp
 */
function makeSdpWithTracks(kinds) {
  const session = `\
v=0\r
o=- 0 1 IN IP4 0.0.0.0\r
s=-\r
t=0 0\r
a=ice-ufrag:0000\r
a=ice-pwd:0000000000000000000000\r
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r
`;
  return ['audio', 'video'].reduce((sdp, kind) => {
    const codecs = {
      audio: '0',
      video: '99'
    }[kind];

    const media = `\
m=${kind} 9 UDP/TLS/RTP/SAVPF ${codecs}\r
c=IN IP4 0.0.0.0\r
a=sendrecv\r
${kind === 'video'
 ? 'a=rtpmap:99 H264/90000\r\n'
 : ''}\
a=rtcp-mux\r
`;
    const tracks = kinds[kind] || [];
    return tracks.reduce((sdp, trackAndSSRC) => {
      const { id, ssrc } = typeof trackAndSSRC === 'string'
        ? { id: trackAndSSRC, ssrc: 1 }
        : trackAndSSRC;
      return sdp + `\
a=ssrc:${ssrc} cname:0\r
a=ssrc:${ssrc} msid:stream ${id}\r
`;
    }, sdp + media);
  }, session);
}

exports.makeSdpWithTracks = makeSdpWithTracks;
