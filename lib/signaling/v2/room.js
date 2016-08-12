'use strict';

var constants = require('../../util/constants');
var inherits = require('util').inherits;
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var SIP = require('sip.js');
var util = require('../../util');

function RoomV2(localParticipant, initialState, session, options) {
  if (!(this instanceof RoomV2)) {
    return new RoomV2(localParticipant, initialState, session, options);
  }
  options = Object.assign({
    RemoteParticipantV2: RemoteParticipantV2
  }, options);

  RoomSignaling.call(this, localParticipant, initialState.sid, initialState.name, options);

  Object.defineProperties(this, {
    _disconnectedParticipantSids: {
      value: new Set()
    },
    _RemoteParticipantV2: {
      value: options.RemoteParticipantV2
    },
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

  handleLocalParticipantEvents(this, localParticipant);
  handlePeerConnectionEvents(this, session.mediaHandler.peerConnectionManager);
  handleSessionEvents(this, session);

  this._update(initialState);
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

RoomV2.prototype._addMediaStreamTrack = function _addMediaStreamTrack(mediaStreamTrack, mediaStream) {
  var deferred = this._getOrCreateMediaStreamTrackDeferred(mediaStreamTrack.id);
  deferred.resolve([mediaStreamTrack, mediaStream]);
  return this;
};

RoomV2.prototype.disconnect = function disconnect() {
  var didDisconnect = RoomSignaling.prototype.disconnect.call(this);
  if (didDisconnect) {
    this._session.terminate();
  }
  return didDisconnect;
};

RoomV2.prototype._getMediaStreamTrack = function _getMediaStreamTrack(id) {
  return this._getOrCreateMediaStreamTrackDeferred(id).promise;
};

RoomV2.prototype._getOrCreateRemoteParticipant = function _getOrCreateRemoteParticipant(participantState) {
  var RemoteParticipantV2 = this._RemoteParticipantV2;
  var participant = this.participants.get(participantState.sid);
  var self = this;
  if (!participant) {
    participant = new RemoteParticipantV2(participantState, this._getMediaStreamTrack.bind(this));
    participant.on('stateChanged', function stateChanged(state) {
      if (state === 'disconnected') {
        participant.removeListener('stateChanged', stateChanged);
        self.participants.delete(participant.sid);
        self._disconnectedParticipantSids.add(participant.sid);
      }
    });
    this.connectParticipant(participant);
  }
  return participant;
};

RoomV2.prototype._getState = function _getState() {
  return {
    participant: this.localParticipant.getState(),
    version: 1
  };
};

RoomV2.prototype._publishNewLocalParticipantState = function _publishNewLocalParticipantState() {
  this.localParticipant.update();
  var updateMessage = Object.assign({
    type: 'update'
  }, this._getState());
  publish(this._session, updateMessage);
  return this;
};

RoomV2.prototype._publishPeerConnectionState = function _publishPeerConnectionState(peerConnectionState) {
  /* eslint camelcase:0 */
  var updateMessage = Object.assign({
    type: 'update',
    peer_connections: [peerConnectionState]
  }, this._getState());
  publish(this._session, updateMessage);
  return this;
};

RoomV2.prototype._update = function _update(roomState) {
  var participantsToKeep = new Set();

  roomState.participants.forEach(function(participantState) {
    if (participantState.sid === this.localParticipant.sid ||
        this._disconnectedParticipantSids.has(participantState.sid)) {
      return;
    }
    var participant = this._getOrCreateRemoteParticipant(participantState);
    participant.update(participantState);
    participantsToKeep.add(participant);
  }, this);

  /* eslint camelcase:0 */
  if (roomState.peer_connections) {
    this._session.mediaHandler.peerConnectionManager.update(roomState.peer_connections);
  }

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
    function sendRequest() {
      session.sendRequest('INFO', {
        body: JSON.stringify(payload),
        extraHeaders: [
          'Content-Type: application/room-signaling+json',
          'Event: room-signaling',
          'Info-Package: room-signaling'
        ],
        receiveResponse: receiveResponse
      });
    }
    if (attempts === 0) {
      return sendRequest();
    }
    setTimeout(sendRequest, attempts * constants.PUBLISH_BACKOFF_MS);
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
    peerConnectionManager.setMediaStreams(mediaStreams);
  }

  function addListener(track) {
    function stateChanged(state) {
      switch (state) {
        case 'ended':
          track.removeListener('stateChanged', stateChanged);
          break;
        default:
          roomV2._publishNewLocalParticipantState();
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

function handleInfo(roomV2, session, peerConnectionManager, request) {
  if (request instanceof SIP.OutgoingRequest) {
    return;
  }
  var notification;
  try {
    notification = JSON.parse(request.body);
  } catch (error) {
    return;
  }
  roomV2._update(notification);
}

function handleSessionEvents(roomV2, session) {
  var peerConnectionManager = session.mediaHandler.peerConnectionManager;

  session.on('info', handleInfo.bind(null, roomV2, session, peerConnectionManager));
}

function handlePeerConnectionEvents(roomV2, peerConnectionManager) {
  peerConnectionManager.on('description', function onDescription(description) {
    roomV2._publishPeerConnectionState(description);
  });
  peerConnectionManager.dequeue('description');

  peerConnectionManager.on('candidates', function onCandidates(candidates) {
    roomV2._publishPeerConnectionState(candidates);
  });
  peerConnectionManager.dequeue('candidates');

  peerConnectionManager.on('trackAdded', roomV2._addMediaStreamTrack.bind(roomV2));
  peerConnectionManager.dequeue('trackAdded');

  peerConnectionManager.getRemoteMediaStreams().forEach(function(mediaStream) {
    mediaStream.getTracks().forEach(function(mediaStreamTrack) {
      roomV2._addMediaStreamTrack(mediaStreamTrack, mediaStream);
    });
  });
}

module.exports = RoomV2;
