'use strict';

var assert = require('assert');
var LocalTrackStats = require('../../../../lib/stats/localtrackstats');

describe('LocalTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      bytesSent: 40,
      packetsSent: 5,
      roundTripTime: 2
    };

    it('should set direction, bytesSent, packetsSent and roundTripTime properties', () => {
      var trackStats = new LocalTrackStats(stats.trackId, stats);
      assert.equal(trackStats.direction, 'sending');
      assert.equal(trackStats.bytesSent, stats.bytesSent);
      assert.equal(trackStats.packetsSent, stats.packetsSent);
      assert.equal(trackStats.roundTripTime, stats.roundTripTime);
    });

    ['bytesSent', 'packetsSent', 'roundTripTime'].forEach(statName => {
      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${statName} property to null`, () => {
          var statValue = stats[statName];
          delete stats[statName];

          var trackStats = new LocalTrackStats(stats.trackId, stats);
          assert.equal(trackStats[statName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
