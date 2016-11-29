/* global webkitRTCPeerConnection, mozRTCPeerConnection */
'use strict';

var LocalAudioTrackStats = require('./localaudiotrackstats');
var LocalVideoTrackStats = require('./localvideotrackstats');
var RemoteAudioTrackStats = require('./remoteaudiotrackstats');
var RemoteVideoTrackStats = require('./remotevideotrackstats');

function getStats(peerConnection) {
  if (!(peerConnection && peerConnection.getStats)) {
    return Promise.reject(new Error('Given PeerConnection does not support getStats'));
  }
  if (typeof webkitRTCPeerConnection !== 'undefined') {
    return chromeGetStats(peerConnection);
  }
  if (typeof mozRTCPeerConnection !== 'undefined') {
    return firefoxGetStats(peerConnection);
  }
  return Promise.reject(new Error('PeerConnection#getStats() not supported'));
}

function chromeGetStats(peerConnection) {
  var localAudioTracks = getTracks(peerConnection, 'audio', 'local');
  var localVideoTracks = getTracks(peerConnection, 'video', 'local');
  var audioTracks = getTracks(peerConnection, 'audio');
  var videoTracks = getTracks(peerConnection, 'video');
  var statsReport = {
    localAudioTrackStats: [],
    localVideoTrackStats: [],
    audioTrackStats: [],
    videoTrackStats: []
  };
  var trackStatsPromises = localAudioTracks.map(function(track) {
    return chromeGetTrackStats(peerConnection, track, 'local').then(function(trackStats) {
      statsReport.localAudioTrackStats.push(trackStats.toJSON());
    });
  });

  trackStatsPromises = trackStatsPromises.concat(localVideoTracks.map(function(track) {
    return chromeGetTrackStats(peerConnection, track, 'local').then(function(trackStats) {
      statsReport.localVideoTrackStats.push(trackStats.toJSON());
    });
  }));

  trackStatsPromises = trackStatsPromises.concat(audioTracks.map(function(track) {
    return chromeGetTrackStats(peerConnection, track).then(function(trackStats) {
      statsReport.audioTrackStats.push(trackStats.toJSON());
    });
  }));

  trackStatsPromises = trackStatsPromises.concat(videoTracks.map(function(track) {
    return chromeGetTrackStats(peerConnection, track).then(function(trackStats) {
        statsReport.videoTrackStats.push(trackStats.toJSON());
      });
  }));

  return Promise.all(trackStatsPromises).then(function() {
    return statsReport;
  });
}

function firefoxGetStats(/*peerConnection*/) {
  return Promise.resolve({
    localAudioTrackStats: [],
    localVideoTrackStats: [],
    audioTrackStats: [],
    videoTrackStats: []
  });
}

function chromeGetTrackStats(peerConnection, track, localOrRemote) {
  return new Promise(function(resolve, reject) {
    var TrackStats = localOrRemote === 'local'
      ? (track.kind === 'audio' ? LocalAudioTrackStats : LocalVideoTrackStats)
      : (track.kind === 'audio' ? RemoteAudioTrackStats : RemoteVideoTrackStats);

    peerConnection.getStats(function(response) {
      resolve(new TrackStats(response));
    }, track, reject);
  });
}

function getTracks(peerConnection, kind, localOrRemote) {
  var getStreams = localOrRemote === 'local' ? 'getLocalStreams' : 'getRemoteStreams';
  return peerConnection[getStreams]().reduce(function(localTracks, localStream) {
    var getTracks = kind === 'audio' ? 'getAudioTracks' : 'getVideoTracks';
    return localTracks.concat(localStream[getTracks]());
  }, []);
}

module.exports = getStats;
