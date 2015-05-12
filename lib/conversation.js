'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
var Set = require('./util/set');
var Stream = require('./media/stream');
var Q = require('q');

var Log = require('./util/log');
var E = constants.twilioErrors;

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
 * @fires Conversation#participantConnected
 * @fires Conversation#participantDisconnected
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

  var log = new Log('Conversation', endpoint._logLevel);

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
    '_log': {
      value: log
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
    self.emit('participantConnected', participant);
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
  this.emit('participantDisconnected', participant);
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

/**
 * Add participant to {@link conversation}.
 * @instance
 * @param {string} participantAddress - the address of the {@link Participant} to add
 * @returns {Promise<Conversation>}
 */
Conversation.prototype.invite = function invite(participantAddress) {
  if(!participantAddress) {
    this._log.throw(E.INVALID_ARGUMENT, 'No address was provided');
  }

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  for(var _dialog of this._dialogs) {
    dialog = _dialog;
    break;
  }

  var self = this;
  var deferred = Q.defer();

  function onParticipantConnected(participant) {
    if(participant.address !== participantAddress) { return; }

    self.removeListener('participantConnected', onParticipantConnected);
    deferred.resolve(participant);
  }

  this.on('participantConnected', onParticipantConnected);

  setTimeout(function() {
    self.removeListener('participantConnected', onParticipantConnected);

    var error = E.CONVERSATION_INVITE_FAILED.clone('Invite to Participant timed out.');
    self.emit('participantFailed', participantAddress, error);
    deferred.reject(error);
  }, constants.DEFAULT_CALL_TIMEOUT);

  return dialog.refer(participantAddress).then(function() {
    return deferred.promise;
  }, function(reason) {
    self.emit('participantFailed', participantAddress, reason);
    self.removeListener('participantConnected', onParticipantConnected);
    throw reason;
  });
};

Object.freeze(Conversation.prototype);

/**
 * A participant joined the {@link Conversation}.
 * @param {Participant} participant - the {@link Participant} who joined
 * @event Conversation#participantConnected
 * @example
 * myConversation.on('participantConnected', function(participant) {
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
 * @event Conversation#participantDisconnected
 * @example
 * myConversation.on('participantDisconnected', function(participant) {
 *   console.log(participant.address + ' left the Conversation');
 * });
 */

module.exports = Conversation;
