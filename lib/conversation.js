'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
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
 * @param {Endpoint} endpoint - the {@link Endpoint} that owns this {@link Conversation} object
 * @param {Array<Dialog>} dialogs - the {@link Dialog}s that define this
 *   {@link Conversation}
 * @property {Stream} localStream - your {@link Endpoint}'s local {@link Stream} in the {@link Conversation}
 * @property {Set<Participant>} participants - the set of
 *   participants active in this {@link Conversation}
 * @property {string} sid - the {@link Conversation}'s SID
 * @fires Conversation#participantJoined
 * @fires Conversation#participantLeft
 */
function Conversation(endpoint, _dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(endpoint, _dialogs);
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
    '_endpoint': {
      value: endpoint
    },
    '_localStream': {
      set: function(_localStream) {
        localStream = _localStream;
      }
    },
    'localStream': {
      enumerable: true,
      get: function() {
        return localStream;
      }
    },
    'participants': {
      enumerable: true,
      value: participants
    },
    'sid': {
      enumerable: true,
      get: function() {
        var sid = null;
        dialogs.forEach(function(dialog) {
          sid = sid || dialog.conversationSid;
        });
        return sid;
      }
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
  this._localStream = this.localStream || dialog.localStream;
  var participant = new Participant(this, dialog);
  this._dialogs.add(dialog);
  this.participants.add(participant);
  setTimeout(function() {
    self.emit('participantJoined', participant);
  });
  dialog.once('ended', function() {
    self._removeDialog(dialog);
  });
  return this;
};

Conversation.prototype._removeDialog = function _removeDialog(dialog) {
  var self = this;
  var participant = null;
  this.participants.forEach(function(_participant) {
    if (_participant._dialog === dialog) {
      participant = _participant;
      self.participants.delete(participant);
    }
  });
  this._dialogs.delete(dialog);
  this.emit('participantLeft', participant);
  return this;
};

Conversation.prototype.getStats = function getStats() {
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.getStats());
  });
  return Q.all(promises);
};

/**
 * Leave the {@link Conversation}.
 * @instance
 * @returns {Promise<Conversation>}
 */
Conversation.prototype.leave = function leave() {
  var self = this;
  var endpoint = this._endpoint;
  var dialogs = [];
  this._dialogs.forEach(function(dialog) {
    dialogs.push(dialog.end().then(function() {
      endpoint.conversations.delete(self);
    }, function(error) {
      endpoint.conversations.delete(self);
      throw error;
    }));
  });
  if (dialogs.length === 0) {
    endpoint.conversations.delete(this);
  }
  return Q.all(dialogs).then(function() {
    return self;
  }, function(error) {
    endpoint.conversations.delete(self);
    throw error;
  });
};

Object.freeze(Conversation.prototype);

/**
 * A participant joined the {@link Conversation}.
 * @param {Participant} participant - the {@link Participant} who joined
 * @event Conversation#participantJoined
 * @example
 * myConversation.on('participantJoined', function(participant) {
 *   console.log(participant.address ' joined the Conversation');
 *   
 *   // Get the participant's Stream,
 *   var remoteStream = participant.stream;
 *
 *   // And attach it to your application's view.
 *   var participantVideos = document.getElementById('participant-videos');
 *   var participantVideo = remoteStream.attach();
 *   participantVideos.appendChild(participantVideo);
 * });
 */

/**
 * A participant left the {@link Conversation}.
 * @param {Participant} participant - the {@link Participant} who left
 * @event Conversation#participantLeft
 * @example
 * myConversation.on('participantLeft', function(participant) {
 *   console.log(participant.address + ' left the Conversation');
 * });
 */

module.exports = Conversation;
