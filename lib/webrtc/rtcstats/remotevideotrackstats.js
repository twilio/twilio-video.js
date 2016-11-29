/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var RemoteTrackStats = require('./remotetrackstats');

function RemoteVideoTrackStats(browserNativeStats) {
  RemoteTrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(RemoteVideoTrackStats, RemoteTrackStats);

RemoteVideoTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var remoteTrackStats = RemoteTrackStats.prototype.toJSON.call(this);
  var remoteVideoTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign(remoteTrackStats, remoteVideoTrackStats);
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
  var dimensions = {};

  Object.defineProperties(dimensions, {
    width: {
      value: Number(ssrcReport.stat('googFrameWidthReceived')),
      enumerable: true
    },
    height: {
      value: Number(ssrcReport.stat('googFrameHeightReceived')),
      enumerable: true
    }
  });

  Object.defineProperties(trackStats, {
    dimensions: {
      value: dimensions,
      enumerable: true
    },
    frameRate: {
      value: Number(ssrcReport.stat('googFrameRateReceived')),
      enumerable: true
    }
  });
}

function firefoxBuildStats(trackStats, browserNativeStats) {}

module.exports = RemoteVideoTrackStats;
