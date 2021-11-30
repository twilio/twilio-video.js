'use strict';

const assert = require('assert');
const { makeSdpWithTracks } = require('../../../lib/mocksdp');
const TrackMatcher = require('../../../../lib/util/sdp/trackmatcher.js');

describe('TrackMatcher', () => {
  const tests = [
    // Add a first, then a second, and then two more audio MediaStreamTracks
    {
      sdps: [
        { audio: ['track1'] },
        { audio: ['track1', 'track2'] },
        { audio: ['track1', 'track2', 'track3', 'track4'] }
      ],
      matches: [
        { audio: ['track1'] },
        { audio: ['track2'] },
        { audio: ['track3', 'track4'] }
      ]
    },
    // Add a first, then a second, and then two more video MediaStreamTracks
    {
      sdps: [
        { video: ['track1'] },
        { video: ['track1', 'track2'] },
        { video: ['track1', 'track2', 'track3', 'track4'] }
      ],
      matches: [
        { video: ['track1'] },
        { video: ['track2'] },
        { video: ['track3', 'track4'] }
      ]
    },
    // First add an audio MediaStreamTrack, then add a video MediaStreamTrack
    {
      sdps: [
        { audio: ['track1'] },
        { audio: ['track1'], video: ['track2'] }
      ],
      matches: [
        { audio: ['track1'] },
        { audio: [], video: ['track2'] }
      ]
    },
    // First add an video MediaStreamTrack, then add a audio MediaStreamTrack
    {
      sdps: [
        { video: ['track1'] },
        { video: ['track1'], audio: ['track2'] }
      ],
      matches: [
        { video: ['track1'] },
        { video: [], audio: ['track2'] }
      ]
    },
    // Add two audio MediaStreamTracks, remove the first one, then add it back
    {
      sdps: [
        { audio: ['track1'] },
        { audio: ['track1', 'track2'] },
        { audio: ['track2'] },
        { audio: ['track1'] }
      ],
      matches: [
        { audio: ['track1'] },
        { audio: ['track2'] },
        { audio: [] },
        { audio: ['track1'] }
      ]
    },
    // Add two video MediaStreamTracks, remove the first one, then add it back
    {
      sdps: [
        { video: ['track1'] },
        { video: ['track1', 'track2'] },
        { video: ['track2'] },
        { video: ['track1'] }
      ],
      matches: [
        { video: ['track1'] },
        { video: ['track2'] },
        { video: [] },
        { video: ['track1'] }
      ]
    }
  ];

  it('should match new MediaStreamTrack IDs to their MIDs in the SDP', () => {
    tests.forEach(test => {
      const trackMatcher = new TrackMatcher();

      test.sdps.forEach((tracksByKind, i) => {
        const sdp = makeSdpWithTracks(tracksByKind);
        const matchesByKind = test.matches[i];

        trackMatcher.update(sdp);

        ['audio', 'video'].forEach(kind => {
          const matches = matchesByKind[kind] || [];
          matches.forEach(match => {
            const event = { transceiver: { mid: `mid_${match}` } };
            assert.equal(trackMatcher.match(event), match);
          });
        });
      });
    });
  });
});
