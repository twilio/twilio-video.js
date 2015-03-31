'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Set = require('./util/set');
var Stream = require('./media/stream');
var Q = require('q');

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents a communication to and from one
 *   or more participants.
 *   <br><br>
 *   {@link Conversation}s are created with {@link Endpoint#createConversation}.
 * @param {Array<Dialog>} dialogs - the {@link Dialog}s that define this
 *   {@link Conversation}
 * @property {Set<string>} participants - the set of
 *   participants active in this {@link Conversation}
 * @fires Conversation#participantJoined
 * @fires Conversation#participantLeft
 */
function Conversation(_dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(_dialogs);
  }
  var self = this;
  EventEmitter.call(this);
  var dialogs = new Set();
  var localStream = null;
  var participants = new Set();
  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    '_localStream': {
      get: function() {
        return localStream;
      },
      set: function(_localStream) {
        localStream = _localStream;
      }
    },
    'participants': {
      enumerable: true,
      value: participants
    }
  });
  _dialogs = _dialogs || [];
  _dialogs.forEach(function(dialog) {
    self._addDialog(dialog);
  });
  return Object.freeze(this);
}

inherits(Conversation, EventEmitter);

Conversation.prototype._addDialog = function _addDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }
  var self = this;
  this._localStream = this._localStream || dialog.localStream;
  var participant = dialog.remote;
  this._dialogs.add(dialog);
  this.participants.add(participant);
  setTimeout(function() {
    self.emit('participantJoined', participant);
  });
  dialog.once('ended', function() {
    self._dialogs.delete(dialog);
    self.emit('participantLeft', participant);
  });
  return this;
};

/**
 * Get the remote {@link Stream} that a participant is sharing in the
 *   {@link Conversation}.
 * @instance
 * @param {string} participant - the participant to retrieve a remote
 *   {@link Stream} for
 * @returns {Stream}
 * @example
 * // Get a participant's Stream,
 * var remoteStream = myConversation.getRemoteStream('bob');
 *
 * // And attach it to your application's view.
 * var participantVideos = document.getElementById('participant-videos');
 * var participantVideo = remoteStream.attach();
 * participantVideos.appendChild(participantVideo);
 */
Conversation.prototype.getRemoteStream = function getRemoteStream(participant) {
  var stream = null;
  this._dialogs.forEach(function(dialog) {
    if (dialog.remote === participant) {
      stream = stream || dialog.remoteStream;
    }
  });
  return stream;
};

/**
 * Get the remote {@link Stream}s the participants in the {@link Conversation}
 *   are sharing.
 * @instance
 * @returns {Array<Stream>}
 * @example
 * // Get each participant's Stream,
 * conversation.getRemoteStreams().forEach(function(remoteStream) {
 *   // And attach it to your application's view.
 *   var participantVideos = document.getElementById('participant-videos');
 *   var participantVideo = remoteStream.attach();
 *   participantVideos.appendChild(participantVideo);
 * });
 */
Conversation.prototype.getRemoteStreams = function() {
  var streamSet = new Set();
  var streams = [];
  this._dialogs.forEach(function(dialog) {
    var stream = dialog.remoteStream;
    if (!streamSet.has(stream)) {
      streamSet.add(stream);
      streams.push(stream);
    }
  });
  return streams;
};

/**
 * Get the local {@link Stream} that your {@link Endpoint} is sharing in
 *   the {@link Conversation}.
 * @example
 * // Get the local Stream,
 * var localStream = myConversation.getLocalStream();
 *
 * // And attach it to your application's view.
 * var myVideo = document.getElementById('my-video');
 * localStream.attach(myVideo);
 * @instance
 * @returns {Stream}
 */
Conversation.prototype.getLocalStream = function getLocalStream() {
  return this._localStream;
};

Conversation.prototype.getStats = function getStats() {
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.getStats());
  });
  return Q.all(promises);
};

Object.freeze(Conversation.prototype);

/**
 * A participant joined the {@link Conversation}.
 * @param {string} participant - the address of the participant who joined
 * @event Conversation#participantJoined
 * @example
 * myConversation.on('participantJoined', function(participant) {
 *   console.log(participant ' joined the Conversation');
 *   
 *   // Get the participant's Stream,
 *   var remoteStream = myConversation.getRemoteStream(participant);
 *
 *   // And attach it to your application's view.
 *   var participantVideos = document.getElementById('participant-videos');
 *   var participantVideo = remoteStream.attach();
 *   participantVideos.appendChild(participantVideo);
 * });
 */

/**
 * A participant left the {@link Conversation}.
 * @param {string} participant - the address of the participant who left
 * @event Conversation#participantLeft
 * @example
 * myConversation.on('participantLeft', function(participant) {
 *   console.log(participant + ' left the Conversation');
 * });
 */

module.exports = Conversation;
