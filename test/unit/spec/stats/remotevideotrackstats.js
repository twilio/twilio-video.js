'use strict';

const assert = require('assert');

const RemoteVideoTrackStats = require('../../../../lib/stats/remotevideotrackstats');

describe('RemoteVideoTrackStats', () => {
  describe('constructor', () => {
    const stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      frameWidthReceived: 320,
      frameHeightReceived: 240,
      frameRateReceived: 29
    };

    it('should set the dimensions and frameRate properties', () => {
      const trackStats = new RemoteVideoTrackStats(stats.trackId, stats, true);
      assert.deepEqual(trackStats.dimensions, {
        width: stats.frameWidthReceived,
        height: stats.frameHeightReceived
      });
      assert.equal(trackStats.frameRate, stats.frameRateReceived);
    });

    [
      [['frameWidthReceived', 'frameHeightReceived'], 'dimensions'],
      [['frameRateReceived'], 'frameRate']
    ].forEach(([statNames, prop]) => {
      context(`when the StandardizedTrackStatsReport does not have ${statNames.join(', ')}`, () => {
        it(`should set the ${prop} property to null`, () => {
          const statsValues = statNames.reduce((values, name) => {
            values[name] = stats[name];
            delete stats[name];
            return values;
          }, {});

          const trackStats = new RemoteVideoTrackStats(stats.trackId, stats, true);
          assert.equal(trackStats[prop], null);

          statNames.forEach(name => { stats[name] = statsValues[name]; });
        });
      });
    });
  });
});
