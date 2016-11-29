/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var inherits = require('util').inherits;
var TrackStats = require('./trackstats');

function LocalTrackStats(browserNativeStats) {
  TrackStats.call(this, browserNativeStats);
  buildStats(this, browserNativeStats);
}

inherits(LocalTrackStats, TrackStats);

LocalTrackStats.prototype.toJSON = function toJSON() {
  var self = this;
  var trackStats = TrackStats.prototype.toJSON.call(this);
  var localTrackStats = Object.keys(this).reduce(function(json, stat) {
    Object.defineProperty(json, stat, {
      value: self[stat],
      enumerable: true
    });
    return json;
  }, {});

  return Object.assign({}, trackStats, localTrackStats);
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
    { stat: 'bytesSent', nativeStat: 'bytesSent' },
    { stat: 'packetsSent', nativeStat: 'packetsSent' },
    { stat: 'roundTripTime', nativeStat: 'googRtt' }
  ].forEach(function(map) {
    if (names.has(map.nativeStat)) {
      Object.defineProperty(trackStats, map.stat, {
        value: Number(ssrcReport.stat(map.nativeStat)),
        enumerable: true
      });
    }
  });

  if (ssrcReport) {
    Object.defineProperty(trackStats, 'direction', {
      value: 'sending',
      enumerable: true
    });
  }
}

function firefoxBuildStats(/*trackStats, browserNativeStats*/) {}

module.exports = LocalTrackStats;
