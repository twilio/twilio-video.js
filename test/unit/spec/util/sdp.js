'use strict';

const assert = require('assert');

const { setBitrateParameters, setCodecPreferences } = require('../../../../lib/util/sdp');

const { makeSdpWithTracks } = require('../../../lib/mocksdp');
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
