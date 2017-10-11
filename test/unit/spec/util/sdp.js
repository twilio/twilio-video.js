'use strict';

const assert = require('assert');

const { setBitrateParameters, setCodecPreferences, setSimulcast } = require('../../../../lib/util/sdp');

const { makeSdpForSimulcast, makeSdpWithTracks } = require('../../../lib/mocksdp');
const { combinationContext } = require('../../../lib/util');

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
          ? ['126', '97', '121', '120']
          : ['120', '121', '126', '97'];
        itShouldHaveCodecOrder(sdpType, preferredAudioCodecs, preferredVideoCodecs, expectedAudioCodecIds, expectedVideoCodecIds);
      });
    });
  });
});

describe('setSimulcast', () => {
  combinationContext([
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
  ], ([areSimSSRCsAlreadyPresent, isVP8PayloadTypePresent, ssrcs]) => {
    let sdp;
    let simSdp;

    before(() => {
      ssrcs = Array.from(ssrcs.values());
      sdp = makeSdpForSimulcast(ssrcs);

      if (!isVP8PayloadTypePresent) {
        sdp = sdp.replace(/m=video 9 UDP\/TLS\/RTP\/SAVPF 120 121 126 97/,
          'm=video 9 UDP/TLS/RTP/SAVPF 121 126 97');
      }
      if (areSimSSRCsAlreadyPresent) {
        sdp = setSimulcast(sdp);
      }
      simSdp = setSimulcast(sdp);
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
        pairs.set(ssrcs[0], ssrcs[1]);
        return pairs;
      }, new Map());

      assert.equal(simSSRCs.length, ssrcs.length * 3);
      assert.equal(simSSRCs[0], ssrcs[0]);
      assert.equal(flowPairs.size, ssrcs.length === 2 ? 3 : 0);

      if (ssrcs.length === 2) {
        assert.equal(simSSRCs[1], ssrcs[1]);
        assert.equal(flowPairs.get(ssrcs[0]), ssrcs[1]);
      }
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
