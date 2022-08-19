'use strict';

const assert = require('assert');

const LocalTrackStats = require('../../../../lib/stats/localtrackstats');

describe('LocalTrackStats', () => {
  [true, false].forEach(prepareForInsights => {
    describe(`constructor(prepareForInsights=${prepareForInsights})`, () => {
      const stats = {
        trackId: 'abcd',
        timestamp: 12345,
        ssrc: 'foo',
        bytesSent: 40,
        packetsSent: 5,
        roundTripTime: 2
      };

      it('should set bytesSent, packetsSent and roundTripTime properties', () => {
        const trackStats = new LocalTrackStats(stats.trackId, stats, prepareForInsights);
        assert.equal(trackStats.bytesSent, stats.bytesSent);
        assert.equal(trackStats.packetsSent, stats.packetsSent);
        assert.equal(trackStats.roundTripTime, stats.roundTripTime);
      });

      ['bytesSent', 'packetsSent', 'roundTripTime'].forEach(statName => {
        context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
          it(`should set the ${statName} property to ${prepareForInsights ? '0' : 'null'}`, () => {
            const statValue = stats[statName];
            delete stats[statName];

            const trackStats = new LocalTrackStats(stats.trackId, stats, prepareForInsights);
            assert.equal(trackStats[statName], prepareForInsights ? 0 : null);

            stats[statName] = statValue;
          });
        });
      });
    });
  });
});
