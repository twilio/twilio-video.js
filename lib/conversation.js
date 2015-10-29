'use strict';

var constants = require('./util/constants');
var ConversationInfo = require('./signaling/conversationinfo');
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
 * @property {Map<string, Participant>} participants - The Map of {@link Participant}s
 *   active in this {@link Conversation}, keyed by {@link Participant} SID
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
  var participantSid = null;
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
    _options: {
      value: options
    },
    _participantSid: {
      get: function() {
        return participantSid;
      },
      set: function(_participantSid) {
        participantSid = _participantSid;
      }
    },
    _sid: {
      set: function(_sid) {
        sid = _sid;
      }
    },
    _trackIdToParticipants: {
      value: new Map()
    },
    localMedia: {
      enumerable: true,
      get: function() {
        return localMedia;
      }
    },
    participants: {
      enumerable: true,
      value: new Map()
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

/**
 * Add a {@link Dialog} to the {@link Conversation}.
 * @param {Dialog} dialog - The {@link Dialog}
 * @returns {this}
 */
Conversation.prototype._addDialog = function _addDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }

  this._sid = this.sid || dialog.conversationSid;
  this._localMedia = this._localMedia || dialog.localMedia;
  this._participantSid = this._participantSid || dialog.participantSid;
  this._dialogs.add(dialog);

  dialog.once('ended', this._removeDialog.bind(this));

  dialog.on('notification', this._onNotification.bind(this, dialog));
  dialog.dequeue('notification');
  handleDialogTrackEvents(dialog, this._trackIdToParticipants);

  // NOTE(mroberts): Simulate Conversation Events if disabled. Once we are
  // confident in the Conversation Events implementation we will completely
  // remove this path.
  if (!this._options.useConversationEvents) {
    var participantSid = util.makeUUID();
    var notification = ConversationInfo
      .simulateParticipantConnectedEvent(dialog, participantSid);
    this._onNotification(dialog, notification);
    var participant = this.participants.get(participantSid);
    handleDialogTrackEventsMesh(dialog, participant);
  }

  return this;
};

/**
 * Handle {@link Dialog} {@link Track} events using a Map from {@link Track} IDs
 * to {@link Participant}s. This technique relies on Conversation Events to
 * construct the Map. It is topology-independent.
 * @param {Dialog} dialog - The {@link Dialog}
 * @param {Map<string, Set<Participant>} trackIdToParticipants - The Map from
 *   {@link Track} IDs to {@link Participant}s
 */
function handleDialogTrackEvents(dialog, trackIdToParticipants) {
  // Add the Track to any Participant associated with the Track ID.
  function addTrack(track) {
    var participants = trackIdToParticipants.get(track.id) || new Set();
    participants.forEach(function(participant) {
      participant.media._addTrack(track);
    });
  }

  // Remove the Track from any Participant associated with the Track ID, and
  // remove the Track from the Map.
  function removeTrack(track) {
    var participants = trackIdToParticipants.get(track.id) || new Set();
    participants.forEach(function(participant) {
      participant.media._removeTrack(track);
    });
    trackIdToParticipants.delete(track.id);
  }

  var dialogMedia = dialog.remoteMedia;
  dialogMedia.tracks.forEach(addTrack);
  dialogMedia.on('trackAdded', addTrack);
  dialogMedia.on('trackRemoved', removeTrack);
  dialog.once('ended', function() {
    dialogMedia.removeListener('trackAdded', addTrack);
    dialogMedia.removeListener('trackRemoved', removeTrack);
  });
}

/**
 * Handle {@link Dialog} {@link Track} events using a one-to-one association
 * with a {@link Participant}. This technique only works in mesh topologies.
 * @param {Dialog} dialog - The {@link Dialog}
 * @param {Participant} participant - The {@link Participant}
 */
function handleDialogTrackEventsMesh(dialog, participant) {
  var dialogMedia = dialog.remoteMedia;
  var participantMedia = participant.media;
  dialogMedia.tracks.forEach(participantMedia._addTrack, participantMedia);
  dialogMedia.on('trackAdded', participantMedia._addTrack.bind(participantMedia));
  dialogMedia.on('trackRemoved', participantMedia._removeTrack.bind(participantMedia));
}

/**
 * Connect a {@link Participant} to the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant}
 * @returns {this}
 */
Conversation.prototype._connectParticipant = function _connectParticipant(participant) {
  if (this.participants.has(participant.sid)) {
    return this;
  }

  this.participants.set(participant.sid, participant);

  var self = this;
  participant.on('trackAdded', function trackAdded(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener('trackAdded', trackAdded);
    }
    self.emit('trackAdded', participant, track);
  });
  participant.on('trackRemoved', function trackRemoved(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener('trackRemoved', trackRemoved);
    }
    self.emit('trackRemoved', participant, track);
  });

  // Emit these events on the next tick so the customer has
  // a chance to listen for them.
  setTimeout(function() {
    self.emit('participantConnected', participant);

    // Re-emit the "trackAdded" event for each of the Participant's Tracks.
    participant.media.tracks.forEach(participant.emit.bind(participant, 'trackAdded'));
  });

  return this;
};

Conversation.prototype._removeDialog = function _removeDialog(dialog) {
  this._dialogs.delete(dialog);

  // NOTE(mroberts): Simulate Conversation Events if disabled. Once we are
  // confident in the Conversation Events implementation we will completely
  // remove this path.
  if (!this._options.useConversationEvents) {
    var notification = ConversationInfo
      .simulateParticipantDisconnectedEvents(this.participants, dialog);
    this._onNotification(dialog, notification);
  }

  if(!this._dialogs.size) {
    this.emit('ended', this);

    // NOTE(mroberts): Regardless of topology, zero dialogs implies we are
    // disconnected from the Conversation; so disconnect any remaining
    // Participants (hopefully they have already been disconnected).
    this.participants.forEach(this._disconnectParticipant, this);
  }

  return this;
};

/**
 * Associate a {@link Track} ID to a {@link Participant}.
 * @param {Participant} participant - The {@link Participant}
 * @param {string} id - The {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackId = function _associateParticipantToTrackId(participant, id) {
  util.map.addToMapOfSets(this._trackIdToParticipants, id, participant);
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<Object>} tracks - The tracks from a conversation event
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackIds = function _associateParticipantToTrackIds(participant, tracks) {
  tracks.forEach(function(track) {
    this._associateParticipantToTrackId(participant, track.id);
  }, this);
  return this;
};

/**
 * Disassociate a {@link Participant} from a {@link Track} ID.
 * @param {Participant} participant - The {@link Participant}
 * @param {string} id - The {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackId = function _disassociateParticipantFromTrackId(participant, id) {
  util.map.deleteFromMapOfSets(this._trackIdToParticipants, id, participant);
  var track = participant.media.tracks.get(id);
  if (track) {
    participant.media._removeTrack(track);
  }
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<Object>} tracks - The tracks from a conversation event
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackIds = function _disassociateParticipantFromTrackIds(participant, tracks) {
  tracks.forEach(function(track) {
    this._disassociateParticipantFromTrackId(participant, track.id);
  }, this);
  return this;
};

/**
 * Disconnect a {@link Participant} from the {@link Conversation}.
 * @param {Participant} - The {@link Participant}
 * @returns {this}
 */
Conversation.prototype._disconnectParticipant = function _disconnectParticipant(participant) {
  participant.media.tracks.forEach(function(track) {
    this._disassociateParticipantFromTrackId(participant, track.id);
    participant.media._removeTrack(track);
  }, this);
  this.participants.delete(participant.sid);
  this.emit('participantDisconnected', participant);
  return this;
};

/**
 * Update the {@link Conversation} upon receipt of a {@link Notification}.
 * @private
 * @param {Dialog} dialog - the {@link Dialog} that received the
 *   {@link PartialNotification}
 * @param {PartialNotification} notification
 * @returns {Conversation}
 */
Conversation.prototype._onNotification = function _onNotification(dialog, notification) {
  var conversationState = notification.conversation_state;
  if (conversationState) {
    if (this.sid !== conversationState.sid) {
      // console.warn('SID does not match: ' + this.sid + ' !== ' + conversationState.sid);
      return this;
    }
    return this._onFullNotification(dialog, notification);
  }
  return this._onPartialNotification(dialog, notification);
};

Conversation.prototype._onFullNotification = function _onFullNotification(dialog, notification) {
  notification.conversation_state.participants.forEach(this._onParticipantConnected, this);
  return this;
};

Conversation.prototype._onPartialNotification = function _onPartialNotification(dialog, notification) {
  notification.event_list.forEach(function(event) {
    var eventType = event.event.toLowerCase();
    switch (eventType) {
      case 'participant_connected':
        return this._onParticipantConnected(event);
      case 'participant_disconnected':
        return this._onParticipantDisconnected(event);
    }
    var participant = this.participants.get(event.participant_sid);
    if (participant) {
      switch (eventType) {
        case 'track_added':
          this._associateParticipantToTrackIds(participant, event.tracks);
          return;
        case 'track_removed':
          this._disassociateParticipantFromTrackIds(participant, event.tracks);
          return;
      }
      participant._onConversationEvent(event);
    }
  }, this);
  return this;
};

/**
 * Handle a "participant_connected" Conversation Event.
 * @param {Notification} event
 * @returns {this}
 */
Conversation.prototype._onParticipantConnected = function _onParticipantConnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);
  var connectParticipant = false;

  if (!participant) {
    participant = new Participant(event.participant_sid, util.getUser(event.address));
    connectParticipant = true;
  }

  if (participant) {
    this._associateParticipantToTrackIds(participant, event.tracks);

    if (connectParticipant) {
      this._connectParticipant(participant);
    }
  }

  return this;
};

/**
 * Handle a "participant_disconnected" Conversation Event.
 * @param {Notification} event
 * @returns {this}
 */
Conversation.prototype._onParticipantDisconnected = function _onParticipantDisconnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);

  if (participant) {
    this._disconnectParticipant(participant);
  }

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
  if (!participantAddress) {
    this._log.throw(E.INVALID_ARGUMENT, 'No address was provided');
  }

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  this._dialogs.forEach(function(_dialog) {
    dialog = dialog || _dialog;
  });

  var wasArray = !!participantAddress.forEach;
  var addresses = wasArray ? participantAddress : [participantAddress];
  dialog.userAgent.token._validateAddress(addresses);

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
