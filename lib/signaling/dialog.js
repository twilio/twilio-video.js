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
 * @param {LocalMedia} localMedia - the {@link LocalMedia}
 * @param {Media} remoteMedia - the remote {@link Media}
 * @param {object} PeerConnection - the PeerConnection
 * @property {string} callSid - the {@link Dialog}'s call SID
 * @property {string} conversationSid - the {@link Dialog}'s {@link Conversation} SID
 * @property {boolean} ended - whether the {@link Dialog} has ended
 * @property {LocalMedia} localMedia - the {@link Dialog}'s {@link LocalMedia}
 * @property {PeerConnection} peerConnection - the PeerConnection
 * @property {string} remote - the remote participant in the {@link Dialog}
 * @property {Media} remoteMedia - the {@link Dialog}'s remote {@link Media}
 * @property {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link Dialog}
 * @fires Dialog#ended
 * @fires Dialog#statistics
 */
function Dialog(userAgent, remote, conversationSid, callSid, localMedia, remoteMedia, peerConnection) {
  var self = this;
  EventEmitter.call(this);

  var ended = false;

  var sampleInterval = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    '_ended': {
      set: function(_ended) {
        ended = _ended;
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
    'localMedia': {
      enumerable: true,
      value: localMedia
    },
    'peerConnection': {
      enumerable: true,
      value: peerConnection
    },
    'remote': {
      enumerable: true,
      value: remote
    },
    'remoteMedia': {
      enumerable: true,
      value: remoteMedia
    },
    'userAgent': {
      enumerable: true,
      value: userAgent
    }
  });

  function handleTrack(wasAdded, track) {
    if (self.ended) {
      localMedia.removeListener('trackAdded', trackAdded);
      localMedia.removeListener('trackRemoved', trackRemoved);
      return;
    }

    var wasRemoved = !wasAdded;
    var localStreams = peerConnection.getLocalStreams();
    if (localStreams) {
      var hasStream = false;
      localStreams.forEach(function(localStream) {
        if (localStream === track.mediaStream) {
          hasStream = true;
        }
      });

      if (wasAdded && !hasStream) {
        peerConnection.addStream(track.mediaStream);
        self._reinvite();
      } else if (wasRemoved && hasStream) {
        // TODO(mroberts): This breaks in Firefox.
        peerConnection.removeStream(track.mediaStream);
        self._reinvite();
      }
    }
  }

  var trackAdded = handleTrack.bind(null, true);
  var trackRemoved = handleTrack.bind(null, false);
  localMedia.on('trackAdded', trackAdded);
  localMedia.on('trackRemoved', trackRemoved);

  try {
    startPublishingStatistics(this, 1000);
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
  var self = this;
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
};

Dialog.prototype._refer = function _refer(participantAddress) {
  var self = this;
  var deferred = Q.defer();
  setTimeout(function() {
    deferred.resolve(self);
  });
  return deferred.promise;
};

Dialog.prototype._onReferSuccess = function _onReferSuccess() {
  return this;
};

Dialog.prototype._onReferFailure = function _onReferFailure(error) {
  throw error;
};

Dialog.prototype.getStats = function getStats() {
  var self = this;
  var deferred = Q.defer();
  getStatistics(this.peerConnection, function(error, sample) {
    if (error) {
      return deferred.reject(error);
    }
    var stats = {
      'callsid': self.callSid,
      'samples': [sample]
    };
    deferred.resolve(stats);
  });
  return deferred.promise;
};

function startPublishingStatistics(dialog, sampleIntervalDuration) {
  var peerConnection = dialog.peerConnection;
  dialog._sampleInterval = setInterval(function() {
    getStatistics(peerConnection, function(error, stats) {
      // TODO(mroberts): Figure out how we want to handle this error.
      if (error) { return; }

      dialog.emit('stats', stats);
    });
  }, sampleIntervalDuration);

  var self = dialog;
  dialog.once('ended', function() {
    if (self._sampleInterval) {
      clearInterval(self._sampleInterval);
      self._sampleInterval = null;
    }
  });
}

module.exports = Dialog;
