/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

function TrackStats(browserNativeStats) {
  buildStats(this, browserNativeStats);
}

TrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  return Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});
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
    { stat: 'codecName', nativeStat: 'googCodecName' },
    { stat: 'ssrc', nativeStat: 'ssrc' },
    { stat: 'trackId', nativeStat: 'googTrackId' }
  ].forEach(function(map) {
    if (names.has(map.nativeStat)) {
      Object.defineProperty(trackStats, map.stat, {
        value: ssrcReport.stat(map.nativeStat),
        enumerable: true
      });
    }
  });

  Object.defineProperty(trackStats, 'timestamp', {
    value: Number(ssrcReport.timestamp),
    enumerable: true
  });
}

function firefoxBuildStats(trackStats, browserNativeStats) {}

module.exports = TrackStats;
