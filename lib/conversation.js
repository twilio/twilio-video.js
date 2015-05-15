'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Track = require('./media/track');
var Participant = require('./participant');
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
 * @property {LocalMedia} localMedia - your {@link Endpoint}'s {@link LocalMedia} in the {@link Conversation}
 * @property {Set<Participant>} participants - the set of
 *   participants active in this {@link Conversation}
 * @property {string} sid - the {@link Conversation}'s SID
 * @fires Conversation#ended
 * @fires Conversation#participantConnected
 * @fires Conversation#participantDisconnected
 * @fires Conversation#participantFailed
 * @fires Conversation#trackAdded
 * @fires Conversation#trackRemoved
 */
function Conversation(endpoint, _dialogs) {
  if (!(this instanceof Conversation)) {
    return new Conversation(endpoint, _dialogs);
  }
  var self = this;
  EventEmitter.call(this);
  var dialogs = new Set();
  var localMedia = null;
  var participants = new Set();

  var log = new Log('Conversation', endpoint._logLevel);

  Object.defineProperties(this, {
    '_dialogs': {
      value: dialogs
    },
    '_endpoint': {
      value: endpoint
    },
    '_localMedia': {
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    '_log': {
      value: log
    },
    'localMedia': {
      enumerable: true,
      get: function() {
        return localMedia;
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
  this._localMedia = this.localMedia || dialog.localMedia;
  var participant = new Participant(this, dialog);
  this._dialogs.add(dialog);
  this.participants.add(participant);
  setTimeout(function() {
    self.emit('participantConnected', participant);
    // NOTE(mroberts): I think we need to push this out one step so that
    // participantConnected can fire first.
    setTimeout(function() {
      participant.on('trackAdded', function trackAdded(track) {
        if (!self.participants.has(participant)) {
          return participant.removeListener('trackAdded', trackAdded);
        }
        self.emit('trackAdded', participant, track);
      });
      participant.on('trackRemoved', function trackRemoved(track) {
        if (!self.participants.has(participant)) {
          return participant.removeListener('trackRemoved', trackRemoved);
        }
        self.emit('trackRemoved', participant, track);
      });
      // NOTE(mroberts): We are really re-emitting here.
      participant.media.audioTracks.forEach(function(audioTrack) {
        participant.emit('trackAdded', audioTrack);
      });
      participant.media.videoTracks.forEach(function(videoTrack) {
        participant.emit('trackAdded', videoTrack);
      });
    });
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
  if(!this._dialogs.size) {
    this.emit('ended', this);
  }
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
  } else if(typeof participantAddress !== 'string') {
    this._log.throw(E.INVALID_ARGUMENT, 'Participant address must be a string');
  }

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  this._dialogs.forEach(function(_dialog) {
    dialog = dialog || _dialog;
  });

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

  dialog.refer(participantAddress)
    .catch(function(reason) {
      self.emit('participantFailed', participantAddress, reason);
      self.removeListener('participantConnected', onParticipantConnected);
      deferred.reject(reason);
    });

  return deferred.promise;
};

Object.freeze(Conversation.prototype);

/**
 * The {@link Conversation} has ended. There are no more {@link Participant}s
 * participating (including your {@link Endpoint}).
 * @param {Conversation} conversation - the {@link Conversation} that ended
 * @event Conversation#ended
 * @example
 * myConversation.on('ended', function() {
 *   myConversation.localMedia.detach();
 * });
 */

/**
 * A participant joined the {@link Conversation}.
 * @param {Participant} participant - the {@link Participant} who joined
 * @event Conversation#participantConnected
 * @example
 * myConversation.on('participantConnected', function(participant) {
 *   console.log(participant.address ' joined the Conversation');
 *   
 *   // Get the participant's Media,
 *   var participantMedia = participant.media;
 *
 *   // And attach it to your application's view.
 *   var participantView = document.getElementById('participant-view');
 *   participantMedia.attach(participantView);
 *   participantVideos.appendChild(participantView);
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

/**
 * A participant failed to join {@link Conversation}.
 * @param {Participant} participantAddress - the address
 * @event Conversation#participantFailed
 * @example
 * myConversation.on('participantFailed', function(participantAddress) {
 *   console.log(participantAddress + ' failed to join the Conversation');
 * });
 */

/**
 * A {@link Track} was added to the {@link Conversation}.
 * @param {Track} track - the {@link Track} that was added
 * @param {Participant} participant - the {@link Participant} who added the
 *   {@link Track}
 * @event Conversation#trackAdded
 */

/**
 * A {@link Track} was removed from the {@link Conversation}.
 * @param {Track} track - the {@link Track} that was removed
 * @param {Participant} participant - the {@link Participant} who removed the
 *   {@link Track}
 * @event Conversation#trackRemoved
 */

module.exports = Conversation;
