'use strict';

var assert = require('assert');
var RemoteTrackStats = require('../../../../lib/stats/remotetrackstats');

describe('RemoteTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      bytesReceived: 40,
      packetsReceived: 2
    };

    it('should set bytesReceived and packetsReceived properties', () => {
      var trackStats = new RemoteTrackStats(stats.trackId, stats);
      assert.equal(trackStats.bytesReceived, stats.bytesReceived);
      assert.equal(trackStats.packetsReceived, stats.packetsReceived);
    });

    ['bytesReceived', 'packetsReceived'].forEach(statName => {
      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${statName} property to null`, () => {
          var statValue = stats[statName];
          delete stats[statName];

          var trackStats = new RemoteTrackStats(stats.trackId, stats);
          assert.equal(trackStats[statName], null);

          stats[statName] = statValue;
        });
      });
    });

  });
});
