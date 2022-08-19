'use strict';

const assert = require('assert');

const RemoteAudioTrackStats = require('../../../../lib/stats/remoteaudiotrackstats');

describe('RemoteAudioTrackStats', () => {
  describe('constructor', () => {
    const stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      audioOutputLevel: 9,
      jitter: 0.5
    };

    it('should set the audioLevel and jitter properties', () => {
      const trackStats = new RemoteAudioTrackStats(stats.trackId, stats, true);
      assert.equal(trackStats.audioLevel, stats.audioOutputLevel);
      assert.equal(trackStats.jitter, stats.jitter);
    });

    [['audioLevel', 'audioOutputLevel'], 'jitter'].forEach(statName => {
      const propName = typeof statName === 'string'
        ? statName : statName[0];

      statName = typeof statName === 'string'
        ? statName : statName[1];

      context(`when ${statName} is absent from the StandardizedTrackStatsReport`, () => {
        it(`should set the ${propName} property to null`, () => {
          const statValue = stats[statName];
          delete stats[statName];

          const trackStats = new RemoteAudioTrackStats(stats.trackId, stats, true);
          assert.equal(trackStats[propName], null);

          stats[statName] = statValue;
        });
      });
    });
  });
});
