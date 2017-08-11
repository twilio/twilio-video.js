'use strict';

var assert = require('assert');
var LocalVideoTrackStats = require('../../../../lib/stats/localvideotrackstats');

describe('LocalVideoTrackStats', () => {
  describe('constructor', () => {
    var stats = {
      trackId: 'abcd',
      timestamp: 12345,
      ssrc: 'foo',
      frameWidthInput: 320,
      frameHeightInput: 240,
      frameWidthSent: 160,
      frameHeightSent: 120,
      frameRateInput: 29,
      frameRateSent: 25
    };

    it('should set the captureDimensions, dimensions, captureFrameRate and frameRate properties', () => {
      var trackStats = new LocalVideoTrackStats(stats.trackId, stats);
      assert.deepEqual(trackStats.captureDimensions, {
        width: stats.frameWidthInput,
        height: stats.frameHeightInput
      });
      assert.deepEqual(trackStats.dimensions, {
        width: stats.frameWidthSent,
        height: stats.frameHeightSent
      });
      assert.equal(trackStats.captureFrameRate, stats.frameRateInput);
      assert.equal(trackStats.frameRate, stats.frameRateSent);
    });

    [
      [['frameWidthInput', 'frameHeightInput'], 'captureDimensions'],
      [['frameWidthSent', 'frameHeightSent'], 'dimensions'],
      [['frameRateInput'], 'captureFrameRate'],
      [['frameRateSent'], 'frameRate']
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

          var trackStats = new LocalVideoTrackStats(stats.trackId, stats);
          assert.equal(trackStats[prop], null);

          statNames.forEach(name => stats[name] = statsValues[name]);
        });
      });
    });
  });
});
