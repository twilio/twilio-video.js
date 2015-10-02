'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Participant = require('./participant');
var Q = require('q');
var util = require('./util');

var Log = require('./util/log');
var E = constants.twilioErrors;

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents a communication to and from one
 *   or more participants.
 *   <br><br>
 *   {@link Conversation}s are created with {@link Client#createConversation}
 *   and returned by {@link Invite#accept} in a Promise<Conversation>.
 * @param {Object} [options] - Options to override the
 *   constructor's default behavior.
 * @property {LocalMedia} localMedia - Your {@link Client}'s {@link LocalMedia} in the {@link Conversation}
 * @property {Set<Participant>} participants - The set of
 *   participants active in this {@link Conversation}
 * @property {string} sid - The {@link Conversation}'s SID
 * @fires Conversation#ended
 * @fires Conversation#participantConnected
 * @fires Conversation#participantDisconnected
 * @fires Conversation#participantFailed
 * @fires Conversation#trackAdded
 * @fires Conversation#trackRemoved
 */
function Conversation(options) {
  if (!(this instanceof Conversation)) {
    return new Conversation(options);
  }

  EventEmitter.call(this);

  options = util.withDefaults({ }, options, {
    logLevel: constants.DEFAULT_LOG_LEVEL
  });

  var localMedia;
  var sid;

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _dialogs: {
      value: new Set()
    },
    _localMedia: {
      set: function(_localMedia) {
        localMedia = _localMedia;
      }
    },
    _log: {
      value: new Log('Conversation', options.logLevel)
    },
    _sid: {
      set: function(_sid) {
        sid = _sid;
      }
    },
    localMedia: {
      enumerable: true,
      get: function() {
        return localMedia;
      }
    },
    participants: {
      enumerable: true,
      value: new Set()
    },
    sid: {
      enumerable: true,
      get: function() {
        return sid;
      }
    }
  });

  return this;
}

inherits(Conversation, EventEmitter);

Conversation.prototype._addDialog = function _addDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }

  this._sid = this.sid || dialog.conversationSid;
  this._localMedia = this._localMedia || dialog.localMedia;
  this._dialogs.add(dialog);

  var participant = new Participant(dialog.remote, dialog.peerConnection);
  this._connectParticipant(participant);
  driveParticipantMediaEventsFromDialogMedia(dialog, participant);

  dialog.once('ended', this._removeDialog.bind(this));

  return this;
};

function driveParticipantMediaEventsFromDialogMedia(dialog, participant) {
  // TODO(mroberts): In star topology, we will need to use a Conversation Event
  // in order to know which Tracks to add to the Participant's Media.
  var dialogMedia = dialog.remoteMedia;
  var participantMedia = participant.media;
  dialogMedia.tracks.forEach(participantMedia._addTrack, participantMedia);
  dialogMedia.on('trackAdded', participantMedia._addTrack.bind(participantMedia));
  dialogMedia.on('trackRemoved', participantMedia._removeTrack.bind(participantMedia));
}

Conversation.prototype._connectParticipant = function _connectParticipant(participant) {
  this.participants.add(participant);

  var self = this;
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

  // Emit these events on the next tick so the customer has
  // a chance to listen for them.
  setTimeout(function() {
    self.emit('participantConnected', participant);

    // NOTE(mroberts): We are really re-emitting here.
    participant.media.tracks.forEach(participant.emit.bind(participant, 'trackAdded'));
  });

  return this;
};

Conversation.prototype._removeDialog = function _removeDialog(dialog) {
  var self = this;

  this._dialogs.delete(dialog);

  this.participants.forEach(function(participant) {
    // TODO(mroberts): Eventually, we will use Conversation Events to drive
    // Participant disconnects.
    if (participant.address === dialog.remote) {
      self._disconnectParticipant(participant);
    }
  });

  if(!this._dialogs.size) {
    // NOTE(mroberts): Regardless of whether we are using mesh or star topology
    // zero dialogs implies we are disconnected from the Conversation; so
    // disconnect all the Participants.
    //
    // Until we remove the previous lines disconnecting the Participant
    // associated with the removed Dialog, the following is a noop.
    this.participants.forEach(this._disconnectParticipant, this);

    this.emit('ended', this);
  }

  return this;
};

Conversation.prototype._disconnectParticipant = function _disconnectParticipant(participant) {
  this.participants.delete(participant);
  this.emit('participantDisconnected', participant);
  return this;
};

Conversation.prototype.getStats = function getStats() {
  var self = this;
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.getStats());
  });

  return Q.all(promises);
};

/**
 * Disconnect from the {@link Conversation}.
 * @returns {Promise<Conversation>}
 */
Conversation.prototype.disconnect = function disconnect() {
  var self = this;
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.end());
  });

  return Q.all(promises).then(function() {
    return self;
  });
};

/**
 * Add a {@link Participant} to the {@link Conversation} by address.
 * @param {string} participantAddress - The address of the {@link Participant} to add
 * @returns {Promise<Participant>}
 * @example
 * var client = new Twilio.Conversations.Client('$TOKEN');
 *
 *  client.createConversation('alice').then(function(conversation) {
 *    conversation.invite('bob').then(function(participant) {
 *      console.log('Bob has connected');
 *    });
 *  });
 * @throws {Error} INVALID_ARGUMENT
 *//**
 * Add {@link Participant}s to the {@link Conversation} by addresses.
 * @param {Array<string>} participantAddresses - The addresses of the {@link Participant}s to add
 * @returns {Array<Promise<Participant>>}
 * @example
 * var client = new Twilio.Conversations.Client('$TOKEN');
 *
 *  client.createConversation('alice').then(function(conversation) {
 *    var promises = conversation.invite(['bob', 'charlie']);
 *    promises[0].then(function(participant) {
 *      console.log('Bob has connected');
 *    });
 *    promises[1].then(function(participant) {
 *      console.log('Charlie has connected');
 *    });
 *  });
 */
Conversation.prototype.invite = function invite(participantAddress) {
  if(!participantAddress) {
    this._log.throw(E.INVALID_ARGUMENT, 'No address was provided');
  }

  var wasArray = !!participantAddress.forEach;
  var addresses = wasArray ? participantAddress : [participantAddress];

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  this._dialogs.forEach(function(_dialog) {
    dialog = dialog || _dialog;
  });

  var promises = addresses.map(this._invite.bind(this, dialog, constants.DEFAULT_CALL_TIMEOUT));
  return wasArray ? promises : promises[0];
};

Conversation.prototype._invite = function _invite(dialog, timeout, participantAddress) {
  var deferred = Q.defer();
  var self = this;
  var timer;

  function onParticipantConnected(participant) {
    if(participant.address !== participantAddress) { return; }

    clearTimeout(timer);
    self.removeListener('participantConnected', onParticipantConnected);
    deferred.resolve(participant);
  }

  this.on('participantConnected', onParticipantConnected);

  timer = setTimeout(function() {
    self.removeListener('participantConnected', onParticipantConnected);

    var error = E.CONVERSATION_INVITE_TIMEOUT.clone('Invite to Participant timed out.');
    self.emit('participantFailed', participantAddress, error);
    deferred.reject(error);
  }, timeout);

  dialog.refer(participantAddress)
    .catch(function(reason) {
      clearTimeout(timer);
      self.emit('participantFailed', participantAddress, reason);
      self.removeListener('participantConnected', onParticipantConnected);
      deferred.reject(reason);
    });

  return deferred.promise;
};

Object.freeze(Conversation.prototype);

/**
 * The {@link Conversation} has ended. There are no more {@link Participant}s
 * participating (including your {@link Client}).
 * @param {Conversation} conversation - The {@link Conversation} that ended
 * @event Conversation#ended
 * @example
 * myConversation.on('ended', function() {
 *   myConversation.localMedia.detach();
 * });
 */

/**
 * A participant joined the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} who joined
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
 * @param {Participant} participant - The {@link Participant} who left
 * @event Conversation#participantDisconnected
 * @example
 * myConversation.on('participantDisconnected', function(participant) {
 *   console.log(participant.address + ' left the Conversation');
 * });
 */

/**
 * A participant failed to join {@link Conversation}.
 * @param {Participant} participantAddress - The address
 * @event Conversation#participantFailed
 * @example
 * myConversation.on('participantFailed', function(participantAddress) {
 *   console.log(participantAddress + ' failed to join the Conversation');
 * });
 */

/**
 * A {@link Track} was added to the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was added
 * @param {Participant} participant - The {@link Participant} who added the
 *   {@link Track}
 * @event Conversation#trackAdded
 */

/**
 * A {@link Track} was removed from the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was removed
 * @param {Participant} participant - The {@link Participant} who removed the
 *   {@link Track}
 * @event Conversation#trackRemoved
 */

module.exports = Conversation;
