/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var RemoteTrackStats = require('./remotetrackstats');

function RemoteAudioTrackStats(browserNativeStats) {
  RemoteTrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(RemoteAudioTrackStats, RemoteTrackStats);

RemoteAudioTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var remoteTrackStats = RemoteTrackStats.prototype.toJSON.call(this);
  var remoteAudioTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign({}, remoteTrackStats, remoteAudioTrackStats);
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
    { stat: 'audioOutputLevel', nativeStat: 'audioOutputLevel' },
    { stat: 'jitterReceived', nativeStat: 'googJitterReceived' }
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

module.exports = RemoteAudioTrackStats;
