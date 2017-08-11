'use strict';

var assert = require('assert');
var RemoteAudioTrackStats = require('../../../../lib/stats/remoteaudiotrackstats');

describe('RemoteAudioTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      audioOutputLevel: 9,
      jitter: 0.5
    };

    it('should set the audioLevel and jitter properties', () => {
      var trackStats = new RemoteAudioTrackStats(stats.trackId, stats);
      assert.equal(trackStats.audioLevel, stats.audioOutputLevel);
      assert.equal(trackStats.jitter, stats.jitter);
    });

    [['audioLevel','audioOutputLevel'], 'jitter'].forEach(statName => {
      var propName = typeof statName === 'string'
        ? statName : statName[0];

      statName = typeof statName === 'string'
        ? statName : statName[1];

      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${propName} property to null`, () => {
          var statValue = stats[statName];
          delete stats[statName];

          var trackStats = new RemoteAudioTrackStats(stats.trackId, stats);
          assert.equal(trackStats[propName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
