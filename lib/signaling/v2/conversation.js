'use strict';

var ConversationSignaling = require('../conversation');
var ConversationInfo = require('../conversation-info');
var ParticipantV2 = require('./participant');
var SIP = require('sip.js');
var inherits = require('util').inherits;
var util = require('../../util');

function ConversationV2(localMedia, participantSid, conversationSid, session, options) {
  if (!(this instanceof ConversationV2)) {
    return new ConversationV2(localMedia, participantSid, conversationSid, session, options);
  }
  ConversationSignaling.call(this, localMedia, participantSid, conversationSid, options);

  Object.defineProperties(this, {
    _participants: {
      value: new Map()
    },
    _session: {
      value: session
    },
    _trackIdToParticipants: {
      value: new Map()
    }
  });

  handleSessionEvents(this, session);
  handleLocalMediaEvents(this, localMedia);
}

inherits(ConversationV2, ConversationSignaling);

ConversationV2.prototype._associateParticipantToTrackId = function _associateParticipantToTrackId(participant, track) {
  util.map.addToMapOfSets(this._trackIdToParticipants, track.id, participant);
  return this;
};

ConversationV2.prototype._associateParticipantToTrackIds = function _associateParticipantToTrackIds(participant, tracks) {
  tracks.forEach(this._associateParticipantToTrackId.bind(this, participant));
  return this;
};

ConversationV2.prototype._connectParticipant = function _connectParticipant(participant) {
  if (this._participants.has(participant.sid)) {
    return this;
  }

  this._participants.set(participant.sid, participant);

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

ConversationV2.prototype._disassociateParticipantFromTrackId = function _disassociateParticipantFromTrackId(participant, _track) {
  var id = _track.id;
  util.map.deleteFromMapOfSets(this._trackIdToParticipants, id, participant);
  var track = participant.media.tracks.get(id);
  if (track) {
    participant.media._removeTrack(track);
  }
  return this;
};

ConversationV2.prototype._disassociateParticipantFromTrackIds = function _disassociateParticipantFromTrackIds(participant, tracks) {
  tracks.forEach(this._disassociateParticipantFromTrackId.bind(this, participant));
  return this;
};

ConversationV2.prototype.disconnect = function _disconnect() {
  this.preempt('disconnected');
  this._session.terminate();
};

ConversationV2.prototype._disconnectParticipant = function _disconnectParticipant(participant) {
  participant.preempt('disconnected');
  participant.media.tracks.forEach(function(track) {
    this._disassociateParticipantFromTrackId(participant, track.id);
    participant.media._removeTrack(track);
  }, this);
  this._participants.delete(participant.sid);
  this.emit('participantDisconnected', participant);
  return this;
};

ConversationV2.prototype._onFullNotification = function _onFullNotification(notification) {
  notification.conversation_state.participants.forEach(this._onParticipantConnected, this);
  return this;
};

ConversationV2.prototype._onNotification = function _onNotification(notification) {
  var conversationState = notification.conversation_state;
  if (conversationState) {
    if (this.sid !== conversationState.sid) {
      return this;
    }
    return this._onFullNotification(notification);
  }
  return this._onPartialNotification(notification);
};

ConversationV2.prototype._onPartialNotification = function _onPartialNotification(notification) {
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
    var participant = this._participants.get(event.participant_sid);
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

ConversationV2.prototype._onParticipantConnected = function _onParticipantConnected(event) {
  if (this.participantSid === event.participant_sid) {
    return this;
  }

  var participant = this._participants.get(event.participant_sid);
  var connectParticipant = false;

  if (!participant) {
    participant = new ParticipantV2(event.participant_sid, util.getUser(event.address), 'connected');
    connectParticipant = true;
  }

  this._associateParticipantToTrackIds(participant, event.tracks);

  if (connectParticipant) {
    this._connectParticipant(participant);
  }

  return this;
};

ConversationV2.prototype._onParticipantDisconnected = function _onParticipantDisconnected(event) {
  if (this.participantSid === event.participant_sid) {
    return this;
  }

  var participant = this._participants.get(event.participant_sid);

  if (participant) {
    this._disconnectParticipant(participant);
  }

  return this;
};

ConversationV2.prototype._onParticipantFailed = function _onParticipantFailed(event) {
  if (this.participantSid === event.participant_sid) {
    return this;
  }

  var participant = this._participants.get(event.participant_sid) ||
    new ParticipantV2(event.participant_sid, util.getUser(event.address), 'failed');

  this.emit('participantFailed', participant);

  return this;
};

ConversationV2.prototype.invite = function invite(identity) {
  var target = identity;

  var extraHeaders = [
    'Contact: ' + this._session.contact,
    'Allow: ' + SIP.UA.C.ALLOWED_METHODS.toString(),
    'Refer-To: ' + this._session.ua.normalizeTarget(target),
    'Allow-Events: refer',
    'Event: refer;id=' + Math.floor((Math.random() * 1000) + 1)
  ];

  var self = this;
  return new Promise(function refer(resolve, reject) {
    self._session.sendRequest('REFER', {
      extraHeaders: extraHeaders,
      receiveResponse: function receiveResponse(response) {
        if (response.status_code === 202) {
          resolve();
        } else {
          reject(response);
        }
      }
    });
  });
};

function publish(session, payload) {
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        default:
          reject(response);
      }
    }
    session.sendRequest('INFO', {
      body: JSON.stringify(payload),
      extraHeaders: [
        'Content-Type: application/conversation-info+json',
        'Event: conversation',
        'Info-Package: conversation-events'
      ],
      receiveResponse: receiveResponse
    });
  });
}

function handleLocalMediaEvents(conversationV2, localMedia) {
  var session = conversationV2._session;
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  function handleTrack() {
    peerConnectionManager
      .renegotiate(localMedia.mediaStreams)
      .then(function() {
        var conversationInfo = peerConnectionManager.getConversationInfo();
        if (conversationInfo) {
          return publish(session, conversationInfo);
        }
      });
  }

  function trackDisabled(track) {
    publish(session, ConversationInfo.trackDisabled(conversationV2._participantSid, track));
  }

  function trackEnabled(track) {
    publish(session, ConversationInfo.trackEnabled(conversationV2._participantSid, track));
  }

  localMedia.on('trackAdded', handleTrack);
  localMedia.on('trackRemoved', handleTrack);
  localMedia.on('trackDisabled', trackDisabled);
  localMedia.on('trackEnabled', trackEnabled);

  conversationV2.once('disconnected', function disconnected() {
    conversationV2.removeListener('trackAdded', handleTrack);
    conversationV2.removeListener('trackRemoved', handleTrack);
    conversationV2.removeListener('trackEnabled', trackEnabled);
    conversationV2.removeListener('trackDisabled', trackDisabled);
  });
}

function handleInfoOrNotify(conversationV2, session, peerConnectionManager, request) {
  if (request instanceof SIP.OutgoingRequest) {
    return;
  }
  if (request.getHeader('Content-Type') !== 'application/conversation-info+json') {
    return;
  }
  var notification;
  try {
    notification = ConversationInfo.parseNotification(request.body);
  } catch (error) {
    return;
  }
  conversationV2._onNotification(notification);
  peerConnectionManager.update(notification).then(function updated() {
    var conversationInfo = peerConnectionManager.getConversationInfo();
    if (conversationInfo) {
      return publish(session, conversationInfo);
    }
  });
}

function handleSessionEvents(conversationV2, session) {
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  // Publish any Conversation Info leftover from session establishment.
  var conversationInfo = peerConnectionManager.getConversationInfo();
  if (conversationInfo) {
    publish(session, conversationInfo);
  }

  var infoOrNotify = handleInfoOrNotify.bind(null, conversationV2, session, peerConnectionManager);
  session.on('info', infoOrNotify);
  session.on('notify', infoOrNotify);

  session.mediaHandler.on('conversationInfo', function conversationInfoFn(conversationInfo) {
    conversationV2._onNotification(conversationInfo, false);
  });

  session.mediaHandler.dequeue('conversationInfo');

  session.mediaHandler.peerConnectionManager.on('trackAdded', function trackAdded(mediaStreamTrack, mediaStream) {
    var participants = conversationV2._trackIdToParticipants.get(mediaStreamTrack.id);
    if (!participants) {
      return;
    }
    participants.forEach(function(participant) {
      participant.media._addRemoteTrack(mediaStreamTrack, mediaStream);
    });
  });

  session.mediaHandler.peerConnectionManager.dequeue('trackAdded');

  session.mediaHandler.peerConnectionManager.on('trackRemoved', function trackRemoved(mediaStreamTrack) {
    var participants = conversationV2._trackIdToParticipants.get(mediaStreamTrack.id);
    if (!participants) {
      return;
    }
    participants.forEach(function(participant) {
      var track = participant.media.tracks.get(mediaStreamTrack.id);
      if (track) {
        participant.media._removeTrack(track);
      }
    });
  });

  session.mediaHandler.peerConnectionManager.dequeue('trackRemoved');
}

module.exports = ConversationV2;
