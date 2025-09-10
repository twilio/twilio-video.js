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
      frameRateReceived: 29,
      freezeCount: 0,
    };

    it('should set the dimensions, frameRate, and freezeCount properties', () => {
      const trackStats = new RemoteVideoTrackStats(stats.trackId, stats);
      assert.deepEqual(trackStats.dimensions, {
        width: stats.frameWidthReceived,
        height: stats.frameHeightReceived
      });
      assert.equal(trackStats.frameRate, stats.frameRateReceived);
      assert.equal(trackStats.freezeCount, stats.freezeCount);
    });

    [
      [['frameWidthReceived', 'frameHeightReceived'], 'dimensions'],
      [['frameRateReceived'], 'frameRate'],
      [['freezeCount'], 'freezeCount']
    ].forEach(([statNames, prop]) => {
      context(`when the StandardizedTrackStatsReport does not have ${statNames.join(', ')}`, () => {
        it(`should set the ${prop} property to null`, () => {
          const statsValues = statNames.reduce((values, name) => {
            values[name] = stats[name];
            delete stats[name];
            return values;
          }, {});

          const trackStats = new RemoteVideoTrackStats(stats.trackId, stats);
          assert.equal(trackStats[prop], null);

          statNames.forEach(name => { stats[name] = statsValues[name]; });
        });
      });
    });
  });
});
