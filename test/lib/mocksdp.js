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
 * @param {'planb' | 'unified'} type
 * @param {TracksByKind} kinds
 * @param {number} [maxAudioBitrate]
 * @param {number} [maxVideoBitrate]
 * @returns {string} sdp
 */
function makeSdpWithTracks(type, kinds, maxAudioBitrate, maxVideoBitrate) {
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
      ? `b=${type === 'planb' ? 'AS' : 'TIAS'}:${maxAudioBitrate}\r\n`
      : kind === 'video' && typeof maxVideoBitrate === 'number'
        ? `b=${type === 'planb' ? 'AS' : 'TIAS'}:${maxVideoBitrate}\r\n`
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
      return sdp + (type === 'planb' ? '' : media + `\
a=mid:mid_${id}\r
a=msid:- ${id}\r
`) + `\
a=ssrc:${ssrc} cname:0\r
a=ssrc:${ssrc} msid:${type === 'planb' ? 'stream' : '-'} ${id}\r
`;
    }, sdp + (type === 'planb' ? media : ''));
  }, session);
}

/**
 * Make an sdp to test simulcast.
 * @param {'planb' | 'unified'} type
 * @param {Array<string>} ssrcs
 * @returns {string} sdp
 */
function makeSdpForSimulcast(type, ssrcs) {
  const sdp = makeSdpWithTracks(type, {
    audio: ['audio-1'],
    video: [{ id: 'video-1', ssrc: ssrcs[0] }]
  });
  const ssrcSdpLines = ssrcs.length === 2 ? [
    `a=ssrc:${ssrcs[1]} cname:0`,
    `a=ssrc:${ssrcs[1]} msid:${type === 'planb' ? 'stream' : '-'} video-1`
  ] : [];
  const fidSdpLines = ssrcs.length === 2
    ? [`a=ssrc-group:FID ${ssrcs.join(' ')}`]
    : [];
  const aLines = [...ssrcSdpLines, ...fidSdpLines].join('\r\n');
  return sdp + aLines + (aLines ? '\r\n' : '');
}

exports.makeSdpWithTracks = makeSdpWithTracks;
exports.makeSdpForSimulcast = makeSdpForSimulcast;
