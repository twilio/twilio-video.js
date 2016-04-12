'use strict';

var constants = require('./util/constants');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Media = require('./media');
var Participant = require('./participant');
var util = require('./util');

var Log = require('./util/log');
var E = constants.twilioErrors;

/**
 * Construct a {@link Conversation}.
 * @class
 * @classdesc A {@link Conversation} represents communication between your
 *   {@link Client} and one or more {@link Participant}s sharing
 *   {@link AudioTrack}s and {@link VideoTrack}s.
 *   <br><br>
 *   You can join a {@link Conversation} by first creating an
 *   {@link OutgoingInvite} with {@link Client#inviteToConversation} or by
 *   accepting an {@link IncomingInvite} with {@link IncomingInvite#accept}.
 * @param {Object} [options] - Options to override the constructor's default
 *   behavior.
 * @property {LocalMedia} localMedia - Your {@link Client}'s {@link LocalMedia} in the {@link Conversation}
 * @property {Map<Participant.SID, Participant>} participants - The {@link Participant}s
 *   participating in this {@link Conversation}
 * @property {Conversation.SID} sid - The {@link Conversation}'s SID
 * @fires Conversation#disconnected
 * @fires Conversation#participantConnected
 * @fires Conversation#participantDisconnected
 * @fires Conversation#participantFailed
 * @fires Conversation#trackAdded
 * @fires Conversation#trackDimensionsChanged
 * @fires Conversation#trackDisabled
 * @fires Conversation#trackEnabled
 * @fires Conversation#trackEnded
 * @fires Conversation#trackRemoved
 * @fires Conversation#trackStarted
 */
function Conversation(options) {
  if (!(this instanceof Conversation)) {
    return new Conversation(options);
  }
  EventEmitter.call(this);

  options = util.withDefaults({ }, options, {
    logLevel: constants.DEFAULT_LOG_LEVEL
  });

  var localMedia = options.localMedia;
  var participantSid = null;
  var shouldStopLocalMediaOnDisconnect = options.shouldStopLocalMediaOnDisconnect;
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
    _shouldStopLocalMediaOnDisconnect: {
      get: function() {
        return shouldStopLocalMediaOnDisconnect;
      },
      set: function(_shouldStopLocalMediaOnDisconnect) {
        shouldStopLocalMediaOnDisconnect = _shouldStopLocalMediaOnDisconnect;
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

var TRACK_ADDED = Conversation.TRACK_ADDED = Participant.TRACK_ADDED;
var TRACK_DIMENSIONS_CHANGED = Conversation.TRACK_DIMENSIONS_CHANGED = Participant.TRACK_DIMENSIONS_CHANGED;
var TRACK_DISABLED = Conversation.TRACK_DISABLED = Participant.TRACK_DISABLED;
var TRACK_ENABLED = Conversation.TRACK_ENABLED = Participant.TRACK_ENABLED;
var TRACK_ENDED = Conversation.TRACK_ENDED = Participant.TRACK_ENDED;
var TRACK_REMOVED = Conversation.TRACK_REMOVED = Participant.TRACK_REMOVED;
var TRACK_STARTED = Conversation.TRACK_STARTED = Participant.TRACK_STARTED;

inherits(Conversation, EventEmitter);

/**
 * Add a {@link Dialog} to the {@link Conversation}.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @returns {this}
 */
Conversation.prototype._onDialog = function _onDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }

  this._sid = this.sid || dialog.conversationSid;
  this._localMedia = this.localMedia || dialog.localMedia;
  this._participantSid = this._participantSid || dialog.participantSid;
  this._dialogs.add(dialog);

  dialog.once('ended', this._removeDialog.bind(this));

  dialog.on('notification', this._onNotification.bind(this, dialog));
  dialog.dequeue('notification');
  handleDialogTrackEvents(dialog, this._trackIdToParticipants);

  return this;
};

Conversation.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
  this._options.localMedia = this.localMedia;
  return inviteServerTransaction.accept(this._options).then(this._onDialog.bind(this));
};

/**
 * Handle {@link Dialog} {@link Track} events using a Map from {@link Track} IDs
 * to {@link Participant}s. This technique relies on Conversation Events to
 * construct the Map. It is topology-independent.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @param {Map<string, Set>} trackIdToParticipants - The Map from
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
  dialogMedia.on(Media.TRACK_ADDED, addTrack);
  dialogMedia.on(Media.TRACK_REMOVED, removeTrack);
  dialog.once('ended', function() {
    dialogMedia.removeListener(Media.TRACK_ADDED, addTrack);
    dialogMedia.removeListener(Media.TRACK_REMOVED, removeTrack);
  });
}

/**
 * Connect a {@link Participant} to the {@link Conversation}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @returns {this}
 */
Conversation.prototype._connectParticipant = function _connectParticipant(participant) {
  if (this.participants.has(participant.sid)) {
    return this;
  }

  this.participants.set(participant.sid, participant);

  var self = this;
  participant.on(Participant.TRACK_ADDED, function trackAdded(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ADDED, trackAdded);
    }
    self.emit(TRACK_ADDED, participant, track);
  });
  participant.on(Participant.TRACK_DIMENSIONS_CHANGED, function trackDimensionsChanged(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_DIMENSIONS_CHANGED, trackDimensionsChanged);
    }
    self.emit(TRACK_DIMENSIONS_CHANGED, participant, track);
  });
  participant.on(Participant.TRACK_DISABLED, function trackDisabled(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_DISABLED, trackDisabled);
    }
    self.emit(TRACK_DISABLED, participant, track);
  });
  participant.on(Participant.TRACK_ENABLED, function trackEnabled(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ENABLED, trackEnabled);
    }
    self.emit(TRACK_ENABLED, participant, track);
  });
  participant.on(Participant.TRACK_ENDED, function trackEnded(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_ENDED, trackEnded);
    }
    self.emit(TRACK_ENDED, participant, track);
  });
  participant.on(Participant.TRACK_REMOVED, function trackRemoved(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_REMOVED, trackRemoved);
    }
    self.emit(TRACK_REMOVED, participant, track);
  });
  participant.on(Participant.TRACK_STARTED, function trackStarted(track) {
    if (!self.participants.has(participant.sid)) {
      return participant.removeListener(Participant.TRACK_STARTED, trackStarted);
    }
    self.emit(TRACK_STARTED, participant, track);
  });

  // Emit these events on the next tick so the customer has
  // a chance to listen for them.
  setTimeout(function() {
    self.emit('participantConnected', participant);

    // Re-emit the "trackAdded" event for each of the Participant's Tracks.
    participant.media.tracks.forEach(participant.emit.bind(participant, Participant.TRACK_ADDED));
  });

  return this;
};

Conversation.prototype._removeDialog = function _removeDialog(dialog) {
  this._dialogs.delete(dialog);

  if (!this._dialogs.size) {
    if (this._shouldStopLocalMediaOnDisconnect) {
      this.localMedia.stop();
    }

    this.emit('disconnected', this);

    // NOTE(mroberts): Regardless of topology, zero dialogs implies we are
    // disconnected from the Conversation; so disconnect any remaining
    // Participants (hopefully they have already been disconnected).
    this.participants.forEach(this._disconnectParticipant, this);
  }

  return this;
};

/**
 * Associate a {@link Track} ID to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {{id: string}} track - An object containing the {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackId = function _associateParticipantToTrackId(participant, track) {
  util.map.addToMapOfSets(this._trackIdToParticipants, track.id, participant);
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<{id: string}>} tracks - Objects containing the {@link Track} IDs
 * @returns {this}
 */
Conversation.prototype._associateParticipantToTrackIds = function _associateParticipantToTrackIds(participant, tracks) {
  tracks.forEach(this._associateParticipantToTrackId.bind(this, participant));
  return this;
};

/**
 * Disassociate a {@link Participant} from a {@link Track} ID.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {{id: string}} track - An object containing the {@link Track} ID
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackId = function _disassociateParticipantFromTrackId(participant, _track) {
  var id = _track.id;
  util.map.deleteFromMapOfSets(this._trackIdToParticipants, id, participant);
  var track = participant.media.tracks.get(id);
  if (track) {
    participant.media._removeTrack(track);
  }
  return this;
};

/**
 * Associate {@link Track} IDs to a {@link Participant}.
 * @private
 * @param {Participant} participant - The {@link Participant}
 * @param {Array<{id: string}>} tracks - Objects containing the {@link Track} IDs
 * @returns {this}
 */
Conversation.prototype._disassociateParticipantFromTrackIds = function _disassociateParticipantFromTrackIds(participant, tracks) {
  tracks.forEach(this._disassociateParticipantFromTrackId.bind(this, participant));
  return this;
};

/**
 * Disconnect a {@link Participant} from the {@link Conversation}.
 * @private
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
 * @returns {this}
 */
Conversation.prototype._onNotification = function _onNotification(dialog, notification) {
  var conversationState = notification.conversation_state;
  if (conversationState) {
    if (this.sid !== conversationState.sid) {
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
        this._onParticipantConnected(event);
        return;
      case 'participant_disconnected':
        this._onParticipantDisconnected(event);
        return;
      case 'participant_failed':
        this._onParticipantFailed(event);
        return;
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
 * @private
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

  this._associateParticipantToTrackIds(participant, event.tracks);

  if (connectParticipant) {
    this._connectParticipant(participant);
  }

  return this;
};

Conversation.prototype._onParticipantFailed = function _onParticipantFailed(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid) ||
    new Participant(event.participant_sid, util.getUser(event.address));

  this.emit('participantFailed', participant);

  return this;
};

/**
 * Handle a "participant_disconnected" Conversation Event.
 * @private
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
  var promises = [];
  this._dialogs.forEach(function(dialog) {
    promises.push(dialog.getStats());
  });

  return Promise.all(promises);
};

/**
 * Disconnect from the {@link Conversation}.
 * @returns {this}
 */
Conversation.prototype.disconnect = function disconnect() {
  this._dialogs.forEach(function(dialog) {
    dialog.end();
  });
  return this;
};

/**
 * Add a {@link Participant} to the {@link Conversation}.
 * @param {string} identity - The identity of the {@link Participant} to add
 * @returns {this}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 *  client.inviteToConversation('alice').then(function(conversation) {
 *    conversation.invite('bob');
 *
 *    conversation.on('participantConnected', function(participant) {
 *      if (participant.identity === 'bob') {
 *        console.log('Bob has connected');
 *      }
 *    });
 *  });
 * @throws {Error} INVALID_ARGUMENT
 *//**
 * Add {@link Participant}s to the {@link Conversation}.
 * @param {Array<string>} identities - The identities of the {@link Participant}s to add
 * @returns {this}
 * @example
 * var initialToken = getAccessToken();
 * var manager = new Twilio.AccessManager(initialToken);
 * var client = new Twilio.Conversations.Client(manager);
 *
 *  client.inviteToConversation('alice').then(function(conversation) {
 *    conversation.invite(['bob', 'charlie']);
 *
 *    conversation.on('participantConnected', function() {
 *      if (participant.identity === 'bob') {
 *        console.log('Bob has connected');
 *      } else if (participant.identity === 'charlie') {
 *        console.log('Charlie has connected');
 *      }
 *    });
 *  });
 * @throws {Error} INVALID_ARGUMENT
 */
Conversation.prototype.invite = function invite(identity) {
  if (!identity) {
    this._log.throw(E.INVALID_ARGUMENT, 'No Participant identities were provided');
  }

  // there maybe several dialogs within the conversation
  // we just pick the first dialog to send the REFER to conversation service
  var dialog;
  this._dialogs.forEach(function(_dialog) {
    dialog = dialog || _dialog;
  });

  if (!dialog) {
    // NOTE(mroberts): There's no dialog, probably because we disconnected from
    // the Conversation. We may consider throwing an error here, but for now
    // let's return early.
    return this;
  }

  var identities = identity.forEach ? identity : [identity];

  var accessManager = dialog.userAgent.accessManager;
  util.validateAddresses(accessManager._tokenPayload.sub, identities);

  identities.forEach(dialog.refer, dialog);

  return this;
};

Object.freeze(Conversation.prototype);

/**
 * A {@link Conversation.SID} is a 34-character string starting with "CV"
 * that uniquely identifies a {@link Conversation}.
 * @type string
 * @typedef Conversation.SID
 */

/**
 * Your {@link Client} was disconnected from the {@link Conversation} and all
 * other {@link Participant}s.
 * @param {Conversation} conversation - The {@link Conversation} your
 *   {@link Client} was disconnected from
 * @event Conversation#disconnected
 * @example
 * myConversation.on('disconnected', function() {
 *   myConversation.localMedia.detach();
 * });
 */

/**
 * A {@link Participant} joined the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} who joined
 * @event Conversation#participantConnected
 * @example
 * myConversation.on('participantConnected', function(participant) {
 *   console.log(participant.identity + ' joined the Conversation');
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
 * A {@link Participant} left the {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} who left
 * @event Conversation#participantDisconnected
 * @example
 * myConversation.on('participantDisconnected', function(participant) {
 *   console.log(participant.identity + ' left the Conversation');
 * });
 */

/**
 * A {@link Participant} failed to join {@link Conversation}.
 * @param {Participant} participant - The {@link Participant} that failed to join
 * @event Conversation#participantFailed
 * @example
 * myConversation.on('participantFailed', function(participant) {
 *   console.log(participant.identity + ' failed to join the Conversation');
 * });
 */

/**
 * A {@link Track} was added by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was added
 * @param {Participant} participant - The {@link Participant} who added the
 *   {@link Track}
 * @event Conversation#trackAdded
 */

/**
 * One of the {@link Participant}'s {@link VideoTrack}'s dimensions changed.
 * @param {VideoTrack} track - The {@link VideoTrack} whose dimensions changed
 * @param {Participant} participant - The {@link Participant} whose {@link VideoTrack}'s
 *   dimensions changed
 * @event Conversation#trackDimensionsChanged
 */

/**
 * A {@link Track} was disabled by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was disabled
 * @param {Participant} participant - The {@link Participant} who disabled the
 *   {@link Track}
 * @event Conversation#trackDisabled
 */

/**
 * A {@link Track} was enabled by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was enabled
 * @param {Participant} participant - The {@link Participant} who enabled the
 *   {@link Track}
 * @event Conversation#trackEnabled
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Conversation} ended.
 * @param {Track} track - The {@link Track} that ended
 * @param {Participant} participant - The {@link Participant} whose {@link Track} ended
 * @event Conversation#trackEnded
 */

/**
 * A {@link Track} was removed by a {@link Participant} in the {@link Conversation}.
 * @param {Track} track - The {@link Track} that was removed
 * @param {Participant} participant - The {@link Participant} who removed the
 *   {@link Track}
 * @event Conversation#trackRemoved
 */

/**
 * One of a {@link Participant}'s {@link Track}s in the {@link Conversation} started.
 * @param {Track} track - The {@link Track} that started
 * @param {Participant} participant - The {@link Participant} whose {@link Track} started
 * @event Conversation#trackStarted
 */

module.exports = Conversation;
