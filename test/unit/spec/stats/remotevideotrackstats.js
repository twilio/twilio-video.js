'use strict';

var assert = require('assert');
var RemoteVideoTrackStats = require('../../../../lib/stats/remotevideotrackstats');

describe('RemoteVideoTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      frameWidthReceived: 320,
      frameHeightReceived: 240,
      frameRateReceived: 29
    };

    it('should set the dimensions and frameRate properties', () => {
      var trackStats = new RemoteVideoTrackStats(stats.trackId, stats);
      assert.deepEqual(trackStats.dimensions, {
        width: stats.frameWidthReceived,
        height: stats.frameHeightReceived
      });
      assert.equal(trackStats.frameRate, stats.frameRateReceived);
    });

    [
      [['frameWidthReceived', 'frameHeightReceived'], 'dimensions'],
      [['frameRateReceived'], 'frameRate']
    ].forEach(nulledStats => {
      var statNames = nulledStats[0];
      var prop = nulledStats[1];

      context(`when the StandardizedTrackStatsReport does not have ${statNames.join(', ')}`, () => {
        it(`should set the ${prop} property to null`, () => {
          var statsValues = statNames.reduce((values, name) => {
            values[name] = stats[name];
            delete stats[name];
            return values;
          }, {});

          var trackStats = new RemoteVideoTrackStats(stats.trackId, stats);
          assert.equal(trackStats[prop], null);

          statNames.forEach(name => stats[name] = statsValues[name]);
        });
      });
    });
  });
});
