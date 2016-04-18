'use strict';

var constants = require('../../util/constants');
var ConversationImpl_ = require('../conversationimpl');
var E = require('../../util/constants').twilioErrors;
var inherits = require('util').inherits;
var Log = require('../../util/log');
var Media = require('../../media');
var ParticipantImpl = require('./participantimpl');
var util = require('../../util');

function ConversationImpl(localMedia, participantSid, sid, signaling, options) {
  if (!(this instanceof ConversationImpl)) {
    return new ConversationImpl(localMedia, participantSid, sid, signaling,
      options);
  }
  options = util.withDefaults({ }, options, {
    localMedia: localMedia,
    logLevel: constants.DEFAULT_LOG_LEVEL
  });

  ConversationImpl_.call(this, localMedia, participantSid, sid, signaling,
    options);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _dialogs: {
      value: new Set()
    },
    _log: {
      value: new Log('Conversation', options.logLevel)
    },
    _trackIdToParticipants: {
      value: new Map()
    },
    participants: {
      enumerable: true,
      value: new Map()
    }
  });

  this.on('stateChanged', this.emit.bind(this));
}

inherits(ConversationImpl, ConversationImpl_);

/**
 * Add a {@link Dialog} to the {@link Conversation}.
 * @private
 * @param {Dialog} dialog - The {@link Dialog}
 * @returns {this}
 */
ConversationImpl.prototype._onDialog = function _onDialog(dialog) {
  if (this._dialogs.has(dialog)) {
    return this;
  }

  this._sid = this.sid || dialog.conversationSid;
  this._participantSid = this._participantSid || dialog.participantSid;
  this._dialogs.add(dialog);

  dialog.once('ended', this._removeDialog.bind(this));

  dialog.on('notification', this._onNotification.bind(this, dialog));
  dialog.dequeue('notification');
  handleDialogTrackEvents(dialog, this._trackIdToParticipants);

  return this;
};

ConversationImpl.prototype._onInviteServerTransaction = function _onInviteServerTransaction(inviteServerTransaction) {
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
ConversationImpl.prototype._connectParticipant = function _connectParticipant(participant) {
  if (this.participants.has(participant.sid)) {
    return this;
  }

  this.participants.set(participant.sid, participant);

  var self = this;

  // Emit these events on the next tick so the customer has
  // a chance to listen for them.
  setTimeout(function() {
    self.emit('participantConnected', participant);

    // Re-emit the "trackAdded" event for each of the Participant's Tracks.
    participant.media.tracks.forEach(participant.emit.bind(participant, 'trackAdded'));
  });

  return this;
};

ConversationImpl.prototype._removeDialog = function _removeDialog(dialog) {
  this._dialogs.delete(dialog);

  if (!this._dialogs.size) {
    if (this.state !== 'disconnected') {
      this.preempt('disconnected');
    }

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
ConversationImpl.prototype._associateParticipantToTrackId = function _associateParticipantToTrackId(participant, track) {
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
ConversationImpl.prototype._associateParticipantToTrackIds = function _associateParticipantToTrackIds(participant, tracks) {
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
ConversationImpl.prototype._disassociateParticipantFromTrackId = function _disassociateParticipantFromTrackId(participant, _track) {
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
ConversationImpl.prototype._disassociateParticipantFromTrackIds = function _disassociateParticipantFromTrackIds(participant, tracks) {
  tracks.forEach(this._disassociateParticipantFromTrackId.bind(this, participant));
  return this;
};

/**
 * Disconnect a {@link Participant} from the {@link Conversation}.
 * @private
 * @param {Participant} - The {@link Participant}
 * @returns {this}
 */
ConversationImpl.prototype._disconnectParticipant = function _disconnectParticipant(participant) {
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
ConversationImpl.prototype._onNotification = function _onNotification(dialog, notification) {
  var conversationState = notification.conversation_state;
  if (conversationState) {
    if (this.sid !== conversationState.sid) {
      return this;
    }
    return this._onFullNotification(dialog, notification);
  }
  return this._onPartialNotification(dialog, notification);
};

ConversationImpl.prototype._onFullNotification = function _onFullNotification(dialog, notification) {
  notification.conversation_state.participants.forEach(this._onParticipantConnected, this);
  return this;
};

ConversationImpl.prototype._onPartialNotification = function _onPartialNotification(dialog, notification) {
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
ConversationImpl.prototype._onParticipantConnected = function _onParticipantConnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);
  var connectParticipant = false;

  if (!participant) {
    participant = new ParticipantImpl(event.participant_sid, util.getUser(event.address));
    connectParticipant = true;
  }

  this._associateParticipantToTrackIds(participant, event.tracks);

  if (connectParticipant) {
    this._connectParticipant(participant);
  }

  return this;
};

ConversationImpl.prototype._onParticipantFailed = function _onParticipantFailed(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid) ||
    new ParticipantImpl(event.participant_sid, util.getUser(event.address));

  this.emit('participantFailed', participant);

  return this;
};

/**
 * Handle a "participant_disconnected" Conversation Event.
 * @private
 * @param {Notification} event
 * @returns {this}
 */
ConversationImpl.prototype._onParticipantDisconnected = function _onParticipantDisconnected(event) {
  if (this._participantSid === event.participant_sid) {
    return this;
  }

  var participant = this.participants.get(event.participant_sid);

  if (participant) {
    this._disconnectParticipant(participant);
  }

  return this;
};

ConversationImpl.prototype.disconnect = function disconnect() {
  this.preempt('disconnected');
  this._dialogs.forEach(function(dialog) {
    dialog.end();
  });
  return this;
};

ConversationImpl.prototype.invite = function invite(identity) {
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
    // the ConversationImpl. We may consider throwing an error here, but for now
    // let's return early.
    return this;
  }

  var identities = identity.forEach ? identity : [identity];

  var accessManager = dialog.userAgent.accessManager;
  util.validateAddresses(accessManager._tokenPayload.sub, identities);

  identities.forEach(dialog.refer, dialog);

  return this;
};

module.exports = ConversationImpl;
