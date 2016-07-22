'use strict';

var constants = require('../../util/constants');
var ConversationInfo = require('../conversation-info');
var inherits = require('util').inherits;
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var SIP = require('sip.js');
var util = require('../../util');

function RoomV2(localParticipant, roomSid, session, options) {
  if (!(this instanceof RoomV2)) {
    return new RoomV2(localParticipant, roomSid, session, options);
  }
  RoomSignaling.call(this, localParticipant, roomSid, options);

  Object.defineProperties(this, {
    _session: {
      value: session
    },
    _trackIdToParticipants: {
      value: new Map()
    },
    _mediaStreamTrackDeferreds: {
      value: new Map()
    }
  });

  handleSessionEvents(this, session);
  handleLocalParticipantEvents(this, localParticipant);
}

inherits(RoomV2, RoomSignaling);

RoomV2.prototype._getOrCreateMediaStreamTrackDeferred = function _getOrCreateMediaStreamTrackDeferred(id) {
  var deferred = this._mediaStreamTrackDeferreds.get(id);
  if (!deferred) {
    deferred = util.defer();
    this._mediaStreamTrackDeferreds.set(id, deferred);
  }
  return deferred;
};

RoomV2.prototype.addMediaStreamTrack = function addMediaStreamTrack(mediaStreamTrack, mediaStream) {
  var deferred = this._getOrCreateMediaStreamTrackDeferred(mediaStreamTrack.id);
  deferred.resolve([mediaStreamTrack, mediaStream]);
  return this;
};

RoomV2.prototype.disconnect = function disconnect() {
  RoomSignaling.prototype.disconnect.call(this);
  this._session.terminate();
  return this;
};

RoomV2.prototype.fullUpdate = function fullUpdate(roomState) {
  roomState.participants.forEach(function(participantState) {
    if (participantState.participant_sid !== this.localParticipant.sid) {
      var participant = this.getOrCreateRemoteParticipant(participantState);
      participant.fullUpdate(participantState);
    }
  }, this);
  return this;
};

RoomV2.prototype.getMediaStreamTrack = function getMediaStreamTrack(id) {
  return this._getOrCreateMediaStreamTrackDeferred(id).promise;
};

RoomV2.prototype.getOrCreateRemoteParticipant = function getOrCreateRemoteParticipant(participantState) {
  var participant = this.participants.get(participantState.participant_sid);
  if (!participant) {
    participant = new RemoteParticipantV2(
      participantState.participant_sid,
      util.getUser(participantState.address),
      this.getMediaStreamTrack.bind(this));
    this.connectParticipant(participant);
  }
  return participant;
};

RoomV2.prototype.partialUpdate = function partialUpdate(roomEvents) {
  roomEvents.event_list.forEach(function(participantEvent) {
    if (participantEvent.participant_sid !== this.localParticipant.sid) {
      var participant = this.getOrCreateRemoteParticipant(participantEvent);
      participant.partialUpdate(participantEvent);
      if (participantEvent.event === 'participant_disconnected') {
        this.disconnectParticipant(participant);
      }
    }
  }, this);
  return this;
};

RoomV2.prototype.update = function update(notification) {
  if (notification.conversation_state) {
    return this.fullUpdate(notification.conversation_state);
  }
  return this.partialUpdate(notification);
};

function publish(session, payload, attempts) {
  attempts = attempts || 0;
  return new Promise(function(resolve, reject) {
    function receiveResponse(response) {
      switch (Math.floor(response.status_code / 100)) {
        case 2:
          resolve();
          break;
        case 5:
          if (attempts < constants.PUBLISH_MAX_ATTEMPTS) {
            resolve(publish(session, payload, ++attempts));
            break;
          }
        default:
          reject(response);
      }
    }
    setTimeout(function() {
      session.sendRequest('INFO', {
        body: JSON.stringify(payload),
        extraHeaders: [
          'Content-Type: application/conversation-info+json',
          'Event: conversation',
          'Info-Package: conversation-events'
        ],
        receiveResponse: receiveResponse
      });
    }, attempts * constants.PUBLISH_BACKOFF_MS);
  });
}

function handleLocalParticipantEvents(roomV2, localParticipant) {
  var removeListeners = new Map();
  var session = roomV2._session;
  // var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  function renegotiate() {
    /* peerConnectionManager
      .renegotiate(localParticipant.media.mediaStreams)
      .then(function() {
        var conversationInfo = peerConnectionManager.getConversationInfo();
        if (conversationInfo) {
          return publish(session, conversationInfo);
        }
      }); */
  }

  function removeListener(track) {
    var removeListener = removeListeners.get(track);
    if (removeListener) {
      removeListener();
    }
  }

  function trackAdded(track) {
    function stateChanged(state) {
      switch (state) {
        case 'enabled':
          publish(session, ConversationInfo.trackEnabled(roomV2.localParticipant.sid, track));
          break;
        case 'ended':
          track.removeListener('stateChanged', stateChanged);
          break;
        case 'disabled':
          publish(session, ConversationInfo.trackDisabled(roomV2.localParticipant.sid, track));
          break;
      }
    }

    track.on('stateChanged', stateChanged);

    removeListener(track);
    removeListeners.set(track, track.removeListener.bind(track, 'stateChanged', stateChanged));

    renegotiate();
  }

  function trackRemoved(track) {
    removeListener(track);

    renegotiate();
  }

  localParticipant.on('trackAdded', trackAdded);
  localParticipant.on('trackRemoved', trackRemoved);

  roomV2.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      localParticipant.removeListener('trackAdded', trackAdded);
      localParticipant.removeListener('trackRemoved', trackRemoved);
      roomV2.removeListener('stateChanged', stateChanged);
      localParticipant.disconnect();
    }
  });
}

function handleInfoOrNotify(roomV2, session, peerConnectionManager, request) {
  if (request instanceof SIP.OutgoingRequest) {
    return;
  }
  if (request.getHeader('Content-Type') !== 'application/conversation-info+json') {
    return;
  }
  var notification;
  try {
    notification = JSON.parse(request.body);
  } catch (error) {
    return;
  }
  roomV2.update(notification);
  peerConnectionManager.update(notification).then(function updated() {
    var conversationInfo = peerConnectionManager.getConversationInfo();
    if (conversationInfo) {
      return publish(session, conversationInfo);
    }
  });
}

function handleSessionEvents(roomV2, session) {
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  // Publish any Room Info leftover from session establishment.
  var conversationInfo = peerConnectionManager.getConversationInfo();
  if (conversationInfo) {
    publish(session, conversationInfo);
  }

  peerConnectionManager.on('conversationInfo', publish.bind(null, session));
  peerConnectionManager.dequeue('conversationInfo');

  var infoOrNotify = handleInfoOrNotify.bind(null, roomV2, session, peerConnectionManager);
  session.on('info', infoOrNotify);
  session.on('notify', infoOrNotify);

  session.mediaHandler.on('conversationInfo', roomV2.update.bind(roomV2));

  session.mediaHandler.dequeue('conversationInfo');

  session.mediaHandler.peerConnectionManager.on('trackAdded', roomV2.addMediaStreamTrack.bind(roomV2));

  session.mediaHandler.peerConnectionManager.dequeue('trackAdded');
}

module.exports = RoomV2;
