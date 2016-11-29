/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var LocalTrackStats = require('./localtrackstats');

function LocalAudioTrackStats(browserNativeStats) {
  LocalTrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(LocalAudioTrackStats, LocalTrackStats);

LocalAudioTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var localTrackStats = LocalTrackStats.prototype.toJSON.call(this);
  var localAudioTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign({}, localTrackStats, localAudioTrackStats);
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
  })[0];
  var names = new Set(ssrcReport ? ssrcReport.names() : []);

  [
    { stat: 'audioInputLevel', nativeStat: 'audioInputLevel' },
    { stat: 'jitter', nativeStat: 'googJitterReceived' }
  ].forEach(function(map) {
    if (names.has(map.nativeStat)) {
      Object.defineProperty(trackStats, map.stat, {
        value: Number(ssrcReport.stat(map.nativeStat)),
        enumerable: true
      });
    }
  });
}

function firefoxBuildStats(/*trackStats, browserNativeStats*/) {}

module.exports = LocalAudioTrackStats;
