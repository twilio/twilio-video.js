'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Q = require('q');

/**
 * Construct a {@link Dialog}.
 * @class
 * @classdesc A {@link Dialog} represents an in-progress call.
 * @param {UserAgent} - the {@link UserAgent} that owns this {@link Dialog}
 * @param {(RemoteEndpoint|UserAgent)} from - the sender of the {@link Dialog}
 * @param {(RemoteEndpoint|UserAgent)} to - the recipient of the {@link Dialog}
 * @param {string} sid - the {@link Dialog}'s SID
 * @property {boolean} ended - whether the {@link Dialog} has ended
 * @property {(RemoteEndpoint|UserAgent)} from - the sender of this {@link Dialog}
 * @property {Stream} localStream - the {@link Dialog}'s local {@link Stream}
 * @property {Stream} remoteStream - the {@link Dialog}'s remote {@link Stream}
 * @property {string} sid - the {@link Dialog}'s SID
 * @property {(RemoteEndpoint|UserAgent)} to - the recipient of this
 *   {@link Dialog}
 * @property {UserAgent} userAgent - the {@link UserAgent} that owns this
 *   {@link Dialog}
 * @fires Dialog#ended
 * @fires Dialog#statistics
 */
function Dialog(userAgent, from, to, sid, localStream, remoteStream) {
  var self = this;
  EventEmitter.call(this);
  var ended = false;
  Object.defineProperties(this, {
    '_ended': {
      set: function(_ended) {
        ended = _ended;
      }
    },
    'ended': {
      get: function() {
        return ended;
      }
    },
    'from': {
      enumerable: true,
      value: from
    },
    'localStream': {
      enumerable: true,
      value: localStream
    },
    'remoteStream': {
      enumerable: true,
      value: remoteStream
    },
    'sid': {
      enumerable: true,
      value: sid
    },
    'to': {
      enumerable: true,
      value: to
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

module.exports = Dialog;
