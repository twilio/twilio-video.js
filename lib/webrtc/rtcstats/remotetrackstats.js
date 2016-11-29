/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var TrackStats = require('./trackstats');

function RemoteTrackStats(browserNativeStats) {
  TrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(RemoteTrackStats, TrackStats);

RemoteTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var trackStats = TrackStats.prototype.toJSON.call(this);
  var remoteTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign(trackStats, remoteTrackStats);
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
  var names = new Set(ssrcReport.names());

  [
    { stat: 'bytesReceived', nativeStat: 'bytesReceived' },
    { stat: 'jitterReceived', nativeStat: 'googJitterReceived' },
    { stat: 'packetsReceived', nativeStat: 'packetsReceived' }
  ].forEach(function(map) {
    if (names.has(map.nativeStat)) {
      Object.defineProperty(trackStats, map.stat, {
        value: Number(ssrcReport.stat(map.nativeStat)),
        enumerable: true
      });
    }
  });

  Object.defineProperty(trackStats, 'direction', {
    value: 'receiving',
    enumerable: true
  });
}

function firefoxBuildStats(trackStats, browserNativeStats) {}

module.exports = RemoteTrackStats;
