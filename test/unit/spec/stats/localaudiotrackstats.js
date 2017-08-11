'use strict';

var assert = require('assert');
var LocalAudioTrackStats = require('../../../../lib/stats/localaudiotrackstats');

describe('LocalAudioTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      audioInputLevel: 9,
      jitter: 0.5
    };

    it('should set the audioLevel and jitter properties', () => {
      var trackStats = new LocalAudioTrackStats(stats.trackId, stats);
      assert.equal(trackStats.audioLevel, stats.audioInputLevel);
      assert.equal(trackStats.jitter, stats.jitter);
    });

    [['audioLevel', 'audioInputLevel'], 'jitter'].forEach(statName => {
      var propName = typeof statName === 'string'
        ? statName : statName[0];

      statName = typeof statName === 'string'
        ? statName : statName[1];

      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${propName} property to null`, () => {
          var statValue = stats[statName];
          delete stats[statName];

          var trackStats = new LocalAudioTrackStats(stats.trackId, stats);
          assert.equal(trackStats[propName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
