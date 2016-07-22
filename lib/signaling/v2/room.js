'use strict';

var constants = require('../../util/constants');
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

RoomV2.prototype.getMediaStreamTrack = function getMediaStreamTrack(id) {
  return this._getOrCreateMediaStreamTrackDeferred(id).promise;
};

RoomV2.prototype.getOrCreateRemoteParticipant = function getOrCreateRemoteParticipant(participantState) {
  var participant = this.participants.get(participantState.participant_sid);
  if (!participant) {
    participant = new RemoteParticipantV2(participantState, this.getMediaStreamTrack.bind(this));
    this.connectParticipant(participant);
  }
  return participant;
};

RoomV2.prototype.getState = function getState(room) {
  return {
    participant: room.localParticipant.getState(),
    protocol: 2
  };
};

RoomV2.prototype.publish = function _publish() {
  var peerConnectionManager = this._session.mediaHandler.peerConnectionManager;
  this.localParticipant.update();
  var updateMessage = Object.assign(this.getState(), peerConnectionManager.getState());
  updateMessage.type = 'update';
  publish(this._session, updateMessage);
  return this;
};

RoomV2.prototype.update = function update(roomState) {
  var participantsToKeep = new Set();

  roomState.participants.forEach(function(participantState) {
    var participant = this.getOrCreateRemoteParticipant(participantState);
    participant.update(participantState);
    participantsToKeep.add(participant);
  }, this);

  this.participants.forEach(function(participant) {
    if (!participantsToKeep.has(participant)) {
      this.disconnectParticipant(participant);
    }
  }, this);

  return this;
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
          break;
        default:
          reject(response);
      }
    }
    setTimeout(function() {
      session.sendRequest('INFO', {
        body: JSON.stringify(payload),
        extraHeaders: [
          'Content-Type: application/room-signaling+json',
          'Event: room-signaling',
          'Info-Package: room-signaling'
        ],
        receiveResponse: receiveResponse
      });
    }, attempts * constants.PUBLISH_BACKOFF_MS);
  });
}

function handleLocalParticipantEvents(roomV2, localParticipant) {
  var removeListeners = new Map();
  var session = roomV2._session;
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  function renegotiate() {
    var mediaStreams = new Set();
    localParticipant.tracks.forEach(function(track) {
      mediaStreams.add(track.mediaStream);
    });
    peerConnectionManager
      .renegotiate(mediaStreams)
      .then(roomV2.publish.bind(roomV2));
  }

  function addListener(track) {
    function stateChanged(state) {
      switch (state) {
        case 'ended':
          track.removeListener('stateChanged', stateChanged);
          break;
        default:
          roomV2.publish();
          break;
      }
    }

    track.on('stateChanged', stateChanged);

    removeListener(track);
    removeListeners.set(track, track.removeListener.bind(track, 'stateChanged', stateChanged));
  }

  function removeListener(track) {
    var removeListener = removeListeners.get(track);
    if (removeListener) {
      removeListener();
    }
  }

  function trackAdded(track) {
    addListener(track);
    renegotiate();
  }

  function trackRemoved(track) {
    removeListener(track);
    renegotiate();
  }

  localParticipant.on('trackAdded', trackAdded);
  localParticipant.on('trackRemoved', trackRemoved);

  localParticipant.tracks.forEach(addListener);

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
  var notification;
  try {
    notification = JSON.parse(request.body);
  } catch (error) {
    return;
  }
  roomV2.update(notification);
  peerConnectionManager.update(notification).then(function updated() {
    roomV2.publish();
  });
}

function handleSessionEvents(roomV2, session) {
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  // Publish any Room Signaling messages leftover from session establishment.
  roomV2.publish();

  peerConnectionManager.on('roomState', roomV2.publish.bind(roomV2));
  peerConnectionManager.dequeue('roomState');

  var infoOrNotify = handleInfoOrNotify.bind(null, roomV2, session, peerConnectionManager);
  session.on('info', infoOrNotify);
  session.on('notify', infoOrNotify);

  session.mediaHandler.on('roomState', roomV2.update.bind(roomV2));

  session.mediaHandler.dequeue('roomState');

  session.mediaHandler.peerConnectionManager.on('trackAdded', roomV2.addMediaStreamTrack.bind(roomV2));

  session.mediaHandler.peerConnectionManager.dequeue('trackAdded');
}

module.exports = RoomV2;
