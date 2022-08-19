'use strict';

const assert = require('assert');

const RemoteTrackStats = require('../../../../lib/stats/remotetrackstats');

describe('RemoteTrackStats', () => {
  describe('constructor', () => {
    const stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      bytesReceived: 40,
      packetsReceived: 2
    };

    it('should set bytesReceived and packetsReceived properties', () => {
      const trackStats = new RemoteTrackStats(stats.trackId, stats, true);
      assert.equal(trackStats.bytesReceived, stats.bytesReceived);
      assert.equal(trackStats.packetsReceived, stats.packetsReceived);
    });

    ['bytesReceived', 'packetsReceived'].forEach(statName => {
      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${statName} property to null`, () => {
          const statValue = stats[statName];
          delete stats[statName];

          const trackStats = new RemoteTrackStats(stats.trackId, stats, true);
          assert.equal(trackStats[statName], null);

          stats[statName] = statValue;
        });
      });
    });

  });
});
