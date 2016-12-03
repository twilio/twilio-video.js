'use strict';

var LocalAudioTrackStats = require('./localaudiotrackstats');
var LocalVideoTrackStats = require('./localvideotrackstats');
var RemoteAudioTrackStats = require('./remoteaudiotrackstats');
var RemoteVideoTrackStats = require('./remotevideotrackstats');

/**
 * Statistics report for an RTCPeerConnection.
 * @property {Array<LocalAudioTrackStats>} localAudioTrackStats - List of {@link LocalAudioTrackStats}
 * @property {Array<LocalVideoTrackStats>} localVideoTrackStats - List of {@link LocalVideoTrackStats}
 * @property {Array<RemoteAudioTrackStats>} remoteAudioTrackStats - List of {@link RemoteAudioTrackStats}
 * @property {Array<RemoteVideoTrackStats>} remoteVideoTrackStats - List of {@link RemoteVideoTrackStats}
 * @param {string} peerConnectionId - RTCPeerConnection ID
 * @param {StandardizedStatsResponse} statsResponse
 * @constructor
 */
function StatsReport(peerConnectionId, statsResponse) {
  if (typeof peerConnectionId !== 'string') {
    throw new Error('RTCPeerConnection id must be a string');
  }

  Object.defineProperties(this, {
    peerConnectionId: {
      value: peerConnectionId,
      enumerable: true
    },
    localAudioTrackStats: {
      value: statsResponse.localAudioTrackStats.map(function(report) {
        return new LocalAudioTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    localVideoTrackStats: {
      value: statsResponse.localVideoTrackStats.map(function(report) {
        return new LocalVideoTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    remoteAudioTrackStats: {
      value: statsResponse.remoteAudioTrackStats.map(function(report) {
        return new RemoteAudioTrackStats(report.trackId, report);
      }),
      enumerable: true
    },
    remoteVideoTrackStats: {
      value: statsResponse.remoteVideoTrackStats.map(function(report) {
        return new RemoteVideoTrackStats(report.trackId, report);
      }),
      enumerable: true
    }
  });
}

module.exports = StatsReport;
