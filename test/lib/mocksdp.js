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
 * Create an SDP string.
 * @param {TracksByKind} kinds
 * @param {number} [maxAudioBitrate]
 * @param {number} [maxVideoBitrate]
 * @param {boolean} [withAppData = true]
 * @returns {string} sdp
 */
function makeSdpWithTracks(kinds, maxAudioBitrate, maxVideoBitrate, withAppData = true) {
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
      audio: '109 9 0 8 101',
      video: '120 121 126 97 99'
    }[kind];

    const bLine = kind === 'audio' && typeof maxAudioBitrate === 'number'
      ? `b=TIAS:${maxAudioBitrate}\r\n`
      : kind === 'video' && typeof maxVideoBitrate === 'number'
        ? `b=TIAS:${maxVideoBitrate}\r\n`
        : '';

    const media = `\
m=${kind} 9 UDP/TLS/RTP/SAVPF ${codecs}\r
c=IN IP4 0.0.0.0\r
${bLine}a=sendrecv\r
${kind === 'video'
    ? 'a=rtpmap:120 VP8/90000\r\n' +
        'a=rtpmap:121 VP9/90000\r\n' +
        'a=rtpmap:126 H264/90000\r\n' +
        'a=rtpmap:97 H264/180000\r\n' +
        'a=rtpmap:99 rtx/8000'
    : 'a=rtpmap:109 opus/48000/2\r\n' +
        'a=rtpmap:9 G722/8000/1\r\n' +
        'a=rtpmap:0 PCMU/8000\r\n' +
        'a=rtpmap:8 PCMA/8000\r\n' +
        'a=rtpmap:101 PCMA/16000'}\r
a=rtcp-mux\r
`;
    const tracks = kinds[kind] || [];
    return tracks.reduce((sdp, trackAndSSRC) => {
      const { id, ssrc } = typeof trackAndSSRC === 'string'
        ? { id: trackAndSSRC, ssrc: 1 }
        : trackAndSSRC;
      return sdp + media + `\
a=msid:-${withAppData ? ` ${id}` : ''}\r
a=ssrc:${ssrc} cname:0\r
a=ssrc:${ssrc} msid:-${withAppData ? ` ${id}` : ''}\r
a=mid:mid_${id}\r
`;
    }, sdp);
  }, session);
}

/**
 * Make an sdp to test simulcast.
 * @param {Array<string>} ssrcs
 * @returns {string} sdp
 */
function makeSdpForSimulcast(ssrcs) {
  const sdp = makeSdpWithTracks({
    audio: ['audio-1'],
    video: [{ id: 'video-1', ssrc: ssrcs[0] }]
  });
  const ssrcSdpLines = ssrcs.length === 2 ? [
    `a=ssrc:${ssrcs[1]} cname:0`,
    `a=ssrc:${ssrcs[1]} msid:- video-1`
  ] : [];
  const fidSdpLines = ssrcs.length === 2
    ? [`a=ssrc-group:FID ${ssrcs.join(' ')}`]
    : [];
  const aLines = [...ssrcSdpLines, ...fidSdpLines].join('\r\n');
  return sdp + aLines + (aLines ? '\r\n' : '');
}

exports.makeSdpWithTracks = makeSdpWithTracks;
exports.makeSdpForSimulcast = makeSdpForSimulcast;
