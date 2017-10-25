'use strict';

const assert = require('assert');

const LocalAudioTrackStats = require('../../../../lib/stats/localaudiotrackstats');

describe('LocalAudioTrackStats', () => {
  describe('constructor', () => {
    const stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      audioInputLevel: 9,
      jitter: 0.5
    };

    it('should set the audioLevel and jitter properties', () => {
      const trackStats = new LocalAudioTrackStats(stats.trackId, stats);
      assert.equal(trackStats.audioLevel, stats.audioInputLevel);
      assert.equal(trackStats.jitter, stats.jitter);
    });

    [['audioLevel', 'audioInputLevel'], 'jitter'].forEach(statName => {
      const propName = typeof statName === 'string'
        ? statName : statName[0];

      statName = typeof statName === 'string'
        ? statName : statName[1];

      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${propName} property to null`, () => {
          const statValue = stats[statName];
          delete stats[statName];

          const trackStats = new LocalAudioTrackStats(stats.trackId, stats);
          assert.equal(trackStats[propName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
