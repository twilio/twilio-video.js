'use strict';

const LocalAudioTrackStats = require('./localaudiotrackstats');
const LocalVideoTrackStats = require('./localvideotrackstats');
const RemoteAudioTrackStats = require('./remoteaudiotrackstats');
const RemoteVideoTrackStats = require('./remotevideotrackstats');

/**
 * Statistics report for an RTCPeerConnection.
 * @property {string} peerConnectionId - ID of the RTCPeerConnection
 * @property {Array<LocalAudioTrackStats>} localAudioTrackStats - List of {@link LocalAudioTrackStats}
 * @property {Array<LocalVideoTrackStats>} localVideoTrackStats - List of {@link LocalVideoTrackStats}
 * @property {Array<RemoteAudioTrackStats>} remoteAudioTrackStats - List of {@link RemoteAudioTrackStats}
 * @property {Array<RemoteVideoTrackStats>} remoteVideoTrackStats - List of {@link RemoteVideoTrackStats}
 */
class StatsReport {
  /**
   * @param {string} peerConnectionId - RTCPeerConnection ID
   * @param {StandardizedStatsResponse} statsResponse
   */
  constructor(peerConnectionId, statsResponse) {
    if (typeof peerConnectionId !== 'string') {
      throw new Error('RTCPeerConnection id must be a string');
    }

    Object.defineProperties(this, {
      peerConnectionId: {
        value: peerConnectionId,
        enumerable: true
      },
      localAudioTrackStats: {
        value: statsResponse.localAudioTrackStats.map(report => new LocalAudioTrackStats(report.trackId, report)),
        enumerable: true
      },
      localVideoTrackStats: {
        value: statsResponse.localVideoTrackStats.map(report => new LocalVideoTrackStats(report.trackId, report)),
        enumerable: true
      },
      remoteAudioTrackStats: {
        value: statsResponse.remoteAudioTrackStats.map(report => new RemoteAudioTrackStats(report.trackId, report)),
        enumerable: true
      },
      remoteVideoTrackStats: {
        value: statsResponse.remoteVideoTrackStats.map(report => new RemoteVideoTrackStats(report.trackId, report)),
        enumerable: true
      }
    });
  }
}

module.exports = StatsReport;
