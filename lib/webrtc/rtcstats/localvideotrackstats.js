/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var LocalTrackStats = require('./localtrackstats');

function LocalVideoTrackStats(browserNativeStats) {
  LocalTrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(LocalVideoTrackStats, LocalTrackStats);

LocalVideoTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var localTrackStats = LocalTrackStats.prototype.toJSON.call(this);
  var localVideoTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign(localTrackStats, localVideoTrackStats);
};

function buildStats(trackStats, browserNativeStats) {
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    chromeBuildStats(trackStats, browserNativeStats);
  } else if (typeof mozRTCPeerConnection !== 'undefined') {
    firefoxBuildStats(trackStats, browserNativeStats);
  }
}

function chromeBuildStats(trackStats, browserNativeStats) {
  var ssrcReport = browserNativeStats.result().filter(function(report) {
    return report.type === 'ssrc';
  });
  var captureDimensions = {};
  var sentDimensions = {};

  Object.defineProperties(captureDimensions, {
    width: {
      value: Number(ssrcReport.stat('googFrameWidthInput')),
      enumerable: true
    },
    height: {
      value: Number(ssrcReport.stat('googFrameHeightInput')),
      enumerable: true
    }
  });

  Object.defineProperties(sentDimensions, {
    width: {
      value: Number(ssrcReport.stat('googFrameWidthSent')),
      enumerable: true
    },
    height: {
      value: Number(ssrcReport.stat('googFrameHeightSent')),
      enumerable: true
    }
  });

  Object.defineProperties(trackStats, {
    captureDimensions: {
      value: captureDimensions,
      enumerable: true
    },
    frameRate: {
      value: Number(ssrcReport.stat('googFrameRateInput')),
      enumerable: true
    },
    sentDimensions: {
      value: sentDimensions,
      enumerable: true
    }
  });
}

function firefoxBuildStats(trackStats, browserNativeStats) {}

module.exports = LocalVideoTrackStats;
