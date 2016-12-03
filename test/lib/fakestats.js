'use strict';

var randomId = require('./util').randomName;

function FakeChromeRTCStatsReport(type, stats) {
  Object.defineProperties(this, Object.assign({
    id: { value: randomId() },
    type: { value: type },
    timestamp: { value: new Date() }
  }, Object.keys(stats).reduce(function(_stats, stat) {
    _stats[stat] = { value: stats[stat], enumerable: true };
    return _stats;
  }, {})));
}

FakeChromeRTCStatsReport.prototype.names = function names() {
  return Object.keys(this);
};

FakeChromeRTCStatsReport.prototype.stat = function stat(name) {
  return this[name];
};

function FakeChromeRTCStatsResponse() {
  Object.defineProperty(this, '_result', {
    value: []
  });
}

FakeChromeRTCStatsResponse.prototype._addReport = function _addReport(type, stats) {
  this._result.push(new FakeChromeRTCStatsReport(type, stats));
};

FakeChromeRTCStatsResponse.prototype.result = function result() {
  return this._result;
};

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

FakeRTCPeerConnection.prototype.getRemoteStreams = function getRemoteStreams() {
  return this.remoteStreams;
};

FakeRTCPeerConnection.prototype.getStats = function getStats() {
  var args = [].slice.call(arguments);

  if (typeof args[0] === 'function') {
    var response = new FakeChromeRTCStatsResponse();
    response._addReport('ssrc', this._options.chromeFakeStats);
    args[0](response);
  } else if (typeof args[1] === 'function') {
    args[1](this._options.firefoxFakeStats);
  }
};

module.exports.FakeRTCPeerConnection = FakeRTCPeerConnection;
