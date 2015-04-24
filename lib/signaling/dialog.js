'use strict';

var EventEmitter = require('events').EventEmitter;
var getStatistics = require('../webrtc/getstatistics');
var inherits = require('util').inherits;
var Q = require('q');

/**
 * Construct a {@link Dialog}.
 * @class
 * @classdesc A {@link Dialog} represents an in-progress call.
 * @param {UserAgent} - the {@link UserAgent} that owns this {@link Dialog}
 * @param {string} remote - the remote participant in the {@link Dialog}
 * @param {string} conversationSid - the {@link Dialog}'s conversation SID
 * @param {string} callSid - the {@link Dialog}'s call SID
 * @param {Stream} localStream - the local {@link Stream}
 * @param {Stream} remoteStream - the remote {@link Stream}
 * @param {Array<object>} iceServers - the (STUN/TURN) ICE servers
 * @param {object} PeerConnection - the PeerConnection
 * @property {string} callSid - the {@link Dialog}'s call SID
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID
 * @property {boolean} ended - whether the {@link Dialog} has ended
 * @property {Array<object>} iceServers - the (STUN/TURN) ICE servers
 * @property {Stream} localStream - the {@link Dialog}'s local {@link Stream}
 * @property {PeerConnection} peerConnection - the PeerConnection
 * @property {string} remote - the remote participant in the {@link Dialog}
 * @property {Stream} remoteStream - the {@link Dialog}'s remote {@link Stream}
 * @property {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link Dialog}
 * @fires Dialog#ended
 * @fires Dialog#statistics
 */
function Dialog(userAgent, remote, conversationSid, callSid, localStream, remoteStream, iceServers, peerConnection) {
  var self = this;
  EventEmitter.call(this);

  var ended = false;

  var publishInterval = null;
  var sampleInterval = null;
  var queuedStatistics = [];

  Object.defineProperties(this, {
    '_ended': {
      set: function(_ended) {
        ended = _ended;
      }
    },
    '_publishInterval': {
      get: function() {
        return publishInterval;
      },
      set: function(_publishInterval) {
        publishInterval = _publishInterval;
      }
    },
    '_queuedStatistics': {
      get: function() {
        return queuedStatistics;
      },
      set: function(_queuedStatistics) {
        queuedStatistics = _queuedStatistics;
      }
    },
    '_sampleInterval': {
      get: function() {
        return sampleInterval;
      },
      set: function(_sampleInterval) {
        sampleInterval = _sampleInterval;
      }
    },
    'callSid': {
      enumerable: true,
      value: callSid
    },
    'conversationSid': {
      enumerable: true,
      value: conversationSid
    },
    'ended': {
      enumerable: true,
      get: function() {
        return ended;
      }
    },
    'localStream': {
      enumerable: true,
      value: localStream
    },
    'peerConnection': {
      enumerable: true,
      value: peerConnection
    },
    'remote': {
      enumerable: true,
      value: remote
    },
    'remoteStream': {
      enumerable: true,
      value: remoteStream
    },
    'userAgent': {
      enumerable: true,
      value: userAgent
    }
  });
  function reinvite() {
    if (self.ended) {
      localStream.off('trackAdded', this);
      localStream.off('trackRemoved', this);
      return;
    }
    self._reinvite();
  }
  localStream.on('trackAdded', reinvite);
  localStream.on('trackRemoved', reinvite);

  try {
    startPublishingStatistics(this, 1000, 10000);
  } catch (e) {
    console.error(e);
    throw e;
  }

  return this;
}

inherits(Dialog, EventEmitter);

/**
 * Hangup the {@link Dialog}.
 * @instance
 * @returns Promise<Dialog>
 */
Dialog.prototype.end = function end() {
  if (this.ended) {
    throw new Error('Dialog already ended');
  }
  this._ended = true;
  var self = this;
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(self);
    self.emit('ended', self);
  });
  return deferred.promise;
};

Dialog.prototype._reinvite = function _reinvite() {
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(self);
    self.emit('reinvite', self);
  });
  return deferred.promise;
};

Dialog.prototype.refer = function refer(participantAddress) {
  return this._refer(participantAddress).then(
    this._onReferSuccess.bind(this),
    this._onReferFailure.bind(this));
}

Dialog.prototype._refer = function _refer(participantAddress) {
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(self);
  });
  return deferred.promise;
};

Dialog.prototype._onReferSuccess = function _onReferSuccess() {
  return this;
}

Dialog.prototype._onReferFailure = function _onReferFailure(error) {
  throw error;
}

Dialog.prototype.getStats = function getStats() {
  var self = this;
  var deferred = Q.defer();
  getStatistics(this.peerConnection, function(error, sample) {
    if (error) {
      return deferred.reject(error);
    }
    var stats = {
      'callsid': self.sid,
      'samples': [sample]
    };
    deferred.resolve(stats);
  });
  return deferred.promise;
};

function startPublishingStatistics(dialog, sampleIntervalDuration, publishIntervalDuration) {
  function publishQueuedStatistics() {
    var queuedStatistics = dialog._queuedStatistics;
    dialog._queuedStatistics = [];
    var stats = {
      'callsid': dialog.sid,
      'samples': queuedStatistics
    };
    dialog.emit('stats', stats);
  }

  dialog._sampleInterval = setInterval(function() {
    var peerConnection = dialog.peerConnection;
    getStatistics(peerConnection, function(error, stats) {
      if (error) {
        // TODO(mroberts): Figure out how we want to handle this error.
        return;
      }
      dialog._queuedStatistics.push(stats);
    });
  }, sampleIntervalDuration);

  dialog._publishInterval = setInterval(publishQueuedStatistics, publishIntervalDuration);

  var self = dialog;
  dialog.once('ended', function() {
    if (self._sampleInterval) {
      clearInterval(self._sampleInterval);
      self._sampleInterval = null;
    }
    if (self._publishInterval) {
      clearInterval(self._publishInterval);
      self._publishInterval = null;
    }
    publishQueuedStatistics();
  });
}

module.exports = Dialog;
