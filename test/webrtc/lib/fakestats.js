'use strict';

var { flatMap } = require('../../lib/util');
var { randomName: randomId } = require('./util');

function FakeRTCPeerConnection(options) {
  Object.defineProperties(this, {
    id: { value: randomId() },
    localStreams: { value: [] },
    remoteStreams: { value: [] },
    _options: { value: options }
  });
}

FakeRTCPeerConnection.prototype._addLocalStream = function _addLocalStream(stream) {
  this.localStreams.push(stream);
};

FakeRTCPeerConnection.prototype._addRemoteStream = function _addRemoteStream(stream) {
  this.remoteStreams.push(stream);
};

FakeRTCPeerConnection.prototype.getLocalStreams = function getLocalStreams() {
  return this.localStreams;
};

FakeRTCPeerConnection.prototype.getReceivers = function getReceivers() {
  return flatMap(this.remoteStreams, stream => stream.getTracks().map(track => {
    // NOTE(mroberts): This is a _really_ minimal RTCRtpReceiver.
    return { track };
  }));
};

FakeRTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
  return this.remoteStreams;
};

FakeRTCPeerConnection.prototype.getSenders = function getSenders() {
  return flatMap(this.localStreams, stream => stream.getTracks().map(track => {
    // NOTE(mroberts): This is a _really_ minimal RTCRtpSender.
    return { track };
  }));
};

FakeRTCPeerConnection.prototype.getStats = function getStats() {
  var args = [].slice.call(arguments);
  var stats = this._options.chromeFakeStats
    || this._options.firefoxFakeStats
    || this._options.safariFakeStats;

  if (stats) {
    if (typeof args[1] === 'function') {
      args[1](stats);
    }
    return Promise.resolve(stats);
  }
  return Promise.resolve(null);
};

exports.FakeRTCPeerConnection = FakeRTCPeerConnection;
