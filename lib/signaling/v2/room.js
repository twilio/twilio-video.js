'use strict';

var inherits = require('util').inherits;
var RecordingV2 = require('./recording');
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var util = require('../../util');

function RoomV2(localParticipant, initialState, transport, peerConnectionManager, options) {
  if (!(this instanceof RoomV2)) {
    return new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options);
  }
  options = Object.assign({
    RecordingSignaling: RecordingV2,
    RemoteParticipantV2: RemoteParticipantV2
  }, options);

  RoomSignaling.call(this, localParticipant, initialState.sid, initialState.name, options);

  Object.defineProperties(this, {
    _disconnectedParticipantSids: {
      value: new Set()
    },
    _peerConnectionManager: {
      value: peerConnectionManager
    },
    _RemoteParticipantV2: {
      value: options.RemoteParticipantV2
    },
    _transport: {
      value: transport
    },
    _trackIdToParticipants: {
      value: new Map()
    },
    _mediaStreamTrackDeferreds: {
      value: new Map()
    }
  });

  handleLocalParticipantEvents(this, localParticipant);
  handlePeerConnectionEvents(this, peerConnectionManager);
  handleTransportEvents(this, transport);

  this._update(initialState);
}

inherits(RoomV2, RoomSignaling);

RoomV2.prototype._deleteMediaStreamTrackDeferred = function _deleteMediaStreamTrackDeferred(id) {
  return this._mediaStreamTrackDeferreds.delete(id);
};

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
    this._transport.disconnect();
  }
  return didDisconnect;
};

RoomV2.prototype._getMediaStreamTrack = function _getMediaStreamTrack(id) {
  var self = this;
  return this._getOrCreateMediaStreamTrackDeferred(id).promise.then(function(result) {
    self._deleteMediaStreamTrackDeferred(id);
    return result;
  });
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
    participant: this.localParticipant.getState()
  };
};

RoomV2.prototype._publishNewLocalParticipantState = function _publishNewLocalParticipantState() {
  this.localParticipant.update();
  this._transport.publish(this._getState());
};

RoomV2.prototype._publishPeerConnectionState = function _publishPeerConnectionState(peerConnectionState) {
  /* eslint camelcase:0 */
  this._transport.publish(Object.assign({
    peer_connections: [peerConnectionState]
  }, this._getState()));
};

RoomV2.prototype._update = function _update(roomState) {
  var participantsToKeep = new Set();

  // TODO(mroberts): Remove me once the Server is fixed.
  (roomState.participants || []).forEach(function(participantState) {
    if (participantState.sid === this.localParticipant.sid ||
        this._disconnectedParticipantSids.has(participantState.sid)) {
      return;
    }
    var participant = this._getOrCreateRemoteParticipant(participantState);
    participant.update(participantState);
    participantsToKeep.add(participant);
  }, this);

  // TODO(mroberts): Remove me once the Server is fixed.
  /* eslint camelcase:0 */
  if (roomState.peer_connections) {
    this._peerConnectionManager.update(roomState.peer_connections);
  }

  if (roomState.recording) {
    this.recording.update(roomState.recording);
  }

  return this;
};

/**
 * Get the {@link RoomV2}'s media statistics.
 * @returns {Promise.<Array<StatsReport>>}
 */
RoomV2.prototype.getStats = function getStats() {
  return this._peerConnectionManager.getStats();
};

/**
 * @typedef {object} RoomV2#Representation
 * @property {string} name
 * @property {LocalParticipantV2#Representation} participant
 * @property {?Array<ParticipantV2#Representation>} participants
 * @property {?Array<PeerConnectionV2#Representation>} peer_connections
 * @property {?RecordingV2#Representation} recording
 * @property {string} sid
 */

function handleLocalParticipantEvents(roomV2, localParticipant) {
  var removeListeners = new Map();
  var peerConnectionManager = roomV2._peerConnectionManager;

  function renegotiate() {
    var mediaStreams = new Set();
    localParticipant.tracks.forEach(function(track) {
      mediaStreams.add(track.mediaStream);
    });
    peerConnectionManager.setMediaStreams(mediaStreams);
  }

  function addListener(track) {
    function updated() {
      roomV2._publishNewLocalParticipantState();
    }

    track.on('updated', updated);

    removeListener(track);
    removeListeners.set(track, track.removeListener.bind(track, 'updated', updated));
  }

  function removeListener(track) {
    var removeListener = removeListeners.get(track);
    if (removeListener) {
      removeListener();
    }
  }

  function trackAdded(track) {
    addListener(track);
    roomV2._publishNewLocalParticipantState();
    renegotiate();
  }

  function trackRemoved(track) {
    removeListener(track);
    roomV2._publishNewLocalParticipantState();
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

function handleTransportEvents(roomV2, transport) {
  transport.on('message', roomV2._update.bind(roomV2));
  transport.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      if (roomV2.state === 'connected') {
        roomV2._handleUnexpectedDisconnect();
      }
      transport.removeListener('stateChanged', stateChanged);
    }
  });
}

module.exports = RoomV2;
