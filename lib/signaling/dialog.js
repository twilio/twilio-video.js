'use strict';

var QueueingEventEmitter = require('../queueingeventemitter');
var getStatistics = require('../webrtc/getstatistics');
var inherits = require('util').inherits;
var Media = require('../media');
var conversationInfo = require('./conversation-info');
var util = require('../util');

/**
 * Construct a {@link Dialog}.
 * @class
 * @classdesc A {@link Dialog} represents an in-progress call.
 * @param {UserAgent} userAgent - the {@link UserAgent} that owns this {@link Dialog}
 * @param {string} remote - the remote participant in the {@link Dialog}
 * @param {string} conversationSid - the {@link Dialog}'s conversation SID
 * @param {string} callSid - the {@link Dialog}'s call SID
 * @param {LocalMedia} localMedia - the {@link LocalMedia}
 * @param {Media} remoteMedia - the remote {@link Media}
 * @param {PeerConnection} peerConnection - the PeerConnection
 * @param {string} participantSid - the {@link UserAgent}'s {@link Participant} SID
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
 * @fires Dialog#notification
 * @fires Dialog#statistics
 */
function Dialog(userAgent, remote, conversationSid, callSid, localMedia, remoteMedia, peerConnection, participantSid) {
  var self = this;
  QueueingEventEmitter.call(this);

  var ended = false;

  var sampleInterval = null;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _ended: {
      set: function(_ended) {
        ended = _ended;
      }
    },
    _sampleInterval: {
      get: function() {
        return sampleInterval;
      },
      set: function(_sampleInterval) {
        sampleInterval = _sampleInterval;
      }
    },
    callSid: {
      enumerable: true,
      value: callSid
    },
    conversationSid: {
      enumerable: true,
      value: conversationSid
    },
    participantSid: {
      enumerable: true,
      value: participantSid
    },
    ended: {
      enumerable: true,
      get: function() {
        return ended;
      }
    },
    localMedia: {
      enumerable: true,
      value: localMedia
    },
    peerConnection: {
      enumerable: true,
      value: peerConnection
    },
    remote: {
      enumerable: true,
      value: remote
    },
    remoteMedia: {
      enumerable: true,
      value: remoteMedia
    },
    userAgent: {
      enumerable: true,
      value: userAgent
    }
  });

  function handleTrack(wasAdded, track) {
    if (self.ended) {
      /* eslint no-use-before-define:0 */
      localMedia.removeListener(Media.TRACK_ADDED, trackAdded);
      localMedia.removeListener(Media.TRACK_REMOVED, trackRemoved);
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
        if (!localMedia.mediaStreams.has(track.mediaStream)) {
          peerConnection.removeStream(track.mediaStream);
        }
        self._reinvite();
      }
    }
  }

  var trackAdded = handleTrack.bind(null, true);
  var trackRemoved = handleTrack.bind(null, false);
  localMedia.on(Media.TRACK_ADDED, trackAdded);
  localMedia.on(Media.TRACK_REMOVED, trackRemoved);

  localMedia.on(Media.TRACK_DISABLED, function trackDisabled(track) {
    if (self.ended) {
      localMedia.removeListener(Media.TRACK_DISABLED, trackDisabled);
      return;
    }
    self.publish(conversationInfo.trackDisabled(self.participantSid, track));
  });
  localMedia.on(Media.TRACK_ENABLED, function trackEnabled(track) {
    if (self.ended) {
      return;
    }
    self.publish(conversationInfo.trackEnabled(self.participantSid, track));
  });

  try {
    startPublishingStatistics(this, 1000);
  } catch (e) {
    console.error(e);
    throw e;
  }

  return this;
}

inherits(Dialog, QueueingEventEmitter);

/**
 * Hangup the {@link Dialog}.
 * @returns {this}
 */
Dialog.prototype.end = function end() {
  if (this.ended) {
    throw new Error('Dialog already ended');
  }
  this._ended = true;
  this.emit('ended', this);
  return this;
};

Dialog.prototype._reinvite = function _reinvite() {
  var self = this;
  var deferred = util.defer();
  setTimeout(function() {
    deferred.resolve(self);
    self.emit('reinvite', self);
  });
  return deferred.promise;
};

Dialog.prototype.refer = function refer(participant) {
  return this._refer(participant).then(
    this._onReferSuccess.bind(this),
    this._onReferFailure.bind(this));
};

Dialog.prototype._refer = function _refer() {
  var self = this;
  var deferred = util.defer();
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

Dialog.prototype.publish = function publish(payload) {
  return this._publish(payload).then(
    this._onPublishSuccess.bind(this),
    this._onPublishFailure.bind(this));
};

Dialog.prototype._publish = function _publish() {
  var self = this;
  var deferred = util.defer();
  setTimeout(function() {
    deferred.resolve(self);
  });
  return deferred.promise;
};

Dialog.prototype._onPublishSuccess = function _onPublishSuccess() {
  return this;
};

Dialog.prototype._onPublishFailure = function _onPublishFailure(error) {
  throw error;
};

Dialog.prototype.getStats = function getStats() {
  var self = this;
  var deferred = util.defer();
  getStatistics(this.peerConnection, function(error, sample) {
    if (error) {
      return deferred.reject(error);
    }
    var stats = {
      callsid: self.callSid,
      samples: [sample]
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

  dialog.once('ended', function() {
    if (dialog._sampleInterval) {
      clearInterval(dialog._sampleInterval);
      dialog._sampleInterval = null;
    }
  });
}

module.exports = Dialog;
