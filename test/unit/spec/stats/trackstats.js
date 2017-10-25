'use strict';

const assert = require('assert');

const TrackStats = require('../../../../lib/stats/trackstats');

describe('TrackStats', () => {
  describe('constructor', () => {
    const stats = {
      trackId: 'abcd',
      ssrc: 'foo',
      timestamp: 12345,
      packetsLost: 10,
      codecName: 'bar'
    };

    it('should throw if the MediaStreamTrack id is not a string', () => {
      assert.throws(() => new TrackStats(null, stats));
      assert.throws(() => new TrackStats(1, stats));
      assert.throws(() => new TrackStats(true, stats));
      assert.throws(() => new TrackStats([], stats));
      assert.throws(() => new TrackStats({}, stats));
    });

    it('should set trackId, ssrc, timestamp, packetsLost, and codec properties', () => {
      const trackStats = new TrackStats(stats.trackId, stats);
      assert.equal(trackStats.trackId, stats.trackId);
      assert.equal(trackStats.ssrc, stats.ssrc);
      assert.equal(trackStats.timestamp, stats.timestamp);
      assert.equal(trackStats.packetsLost, stats.packetsLost);
      assert.equal(trackStats.codec, stats.codecName);
    });

    ['packetsLost', ['codec', 'codecName']].forEach(statName => {
      const propName = typeof statName === 'string'
        ? statName : statName[0];

      statName = typeof statName === 'string'
        ? statName : statName[1];

      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${propName} property to null`, () => {
          const statValue = stats[statName];
          delete stats[statName];

          const trackStats = new TrackStats(stats.trackId, stats);
          assert.equal(trackStats[propName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
