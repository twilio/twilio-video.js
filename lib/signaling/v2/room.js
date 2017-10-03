'use strict';

var inherits = require('util').inherits;
var RecordingV2 = require('./recording');
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var util = require('../../util');

var STATS_PUBLISH_INTERVAL_MS = 1000;

function RoomV2(localParticipant, initialState, transport, peerConnectionManager, options) {
  if (!(this instanceof RoomV2)) {
    return new RoomV2(localParticipant, initialState, transport, peerConnectionManager, options);
  }
  options = Object.assign({
    RecordingSignaling: RecordingV2,
    RemoteParticipantV2: RemoteParticipantV2,
    statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
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
    _mediaStreamTrackAndDataTrackReceiverDeferreds: {
      value: new Map()
    }
  });

  handleLocalParticipantEvents(this, localParticipant);
  handlePeerConnectionEvents(this, peerConnectionManager);
  handleTransportEvents(this, transport);
  periodicallyPublishStats(this, localParticipant, transport, options.statsPublishIntervalMs);

  this._update(initialState);
}

inherits(RoomV2, RoomSignaling);

RoomV2.prototype._deleteMediaStreamTrackOrDataTrackReceiverDeferred = function _deleteMediaStreamTrackOrDataTrackReceiverDeferred(id) {
  return this._mediaStreamTrackAndDataTrackReceiverDeferreds.delete(id);
};

RoomV2.prototype._getOrCreateMediaStreamTrackOrDataTrackReceiverDeferred = function _getOrCreateMediaStreamTrackOrDataTrackReceiverDeferred(id) {
  var deferred = this._mediaStreamTrackAndDataTrackReceiverDeferreds.get(id) || util.defer();
  var mediaStreamTracksAndDataTrackReceivers = this._peerConnectionManager.getRemoteMediaStreamTracksAndDataTrackReceivers();

  // NOTE(mmalavalli): In Firefox, there can be instances where a MediaStreamTrack
  // for the given Track ID already exists, for example, when a Track is removed
  // and added back. If that is the case, then we should resolve 'deferred'.
  var mediaStreamTrackOrDataTrackReceiver = mediaStreamTracksAndDataTrackReceivers.find(function(track) {
    return track.id === id && track.readyState !== 'ended';
  });

  if (mediaStreamTrackOrDataTrackReceiver) {
    deferred.resolve(mediaStreamTrackOrDataTrackReceiver);
  } else {
    // NOTE(mmalavalli): Only add the 'deferred' to the map if it's not
    // resolved. This will prevent old copies of the MediaStreamTrack from
    // being used when the remote peer removes and re-adds a MediaStreamTrack.
    this._mediaStreamTrackAndDataTrackReceiverDeferreds.set(id, deferred);
  }

  return deferred;
};

RoomV2.prototype._addMediaStreamTrackOrDataTrackReceiver = function _addMediaStreamTrackOrDataTrackReceiver(mediaStreamTrackOrDataTrackReceiver) {
  var deferred = this._getOrCreateMediaStreamTrackOrDataTrackReceiverDeferred(mediaStreamTrackOrDataTrackReceiver.id);
  deferred.resolve(mediaStreamTrackOrDataTrackReceiver);
  return this;
};

RoomV2.prototype._disconnect = function _disconnect(error) {
  var didDisconnect = RoomSignaling.prototype._disconnect.call(this, error);
  if (didDisconnect) {
    this._transport.disconnect();
    this._peerConnectionManager.close();
  }

  this.localParticipant.tracks.forEach(function(track) {
    track.publishFailed(error);
  });

  return didDisconnect;
};

RoomV2.prototype._getMediaStreamTrackOrDataTrackReceiver = function _getMediaStreamTrackOrDataTrackReceiver(id) {
  var self = this;
  return this._getOrCreateMediaStreamTrackOrDataTrackReceiverDeferred(id).promise.then(function(mediaStreamTrackOrDataTrackReceiver) {
    self._deleteMediaStreamTrackOrDataTrackReceiverDeferred(id);
    return mediaStreamTrackOrDataTrackReceiver;
  });
};

RoomV2.prototype._getOrCreateRemoteParticipant = function _getOrCreateRemoteParticipant(participantState) {
  var RemoteParticipantV2 = this._RemoteParticipantV2;
  var participant = this.participants.get(participantState.sid);
  var self = this;
  if (!participant) {
    participant = new RemoteParticipantV2(participantState, this._getMediaStreamTrackOrDataTrackReceiver.bind(this));
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
  this.localParticipant.incrementRevision();
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

  if (roomState.published) {
    this.localParticipant.update(roomState.published);
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

  var updateLocalParticipantStateAndRenegotiate = util.oncePerTick(function() {
    roomV2._publishNewLocalParticipantState();
    renegotiate();
  });

  function renegotiate() {
    var mediaStreamTracksAndDataTrackSenders = util.flatMap(localParticipant.tracks, function(track) {
      return track.mediaStreamTrackOrDataTrackTransceiver;
    });
    peerConnectionManager.setMediaStreamTracksAndDataTrackSenders(mediaStreamTracksAndDataTrackSenders);
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
    updateLocalParticipantStateAndRenegotiate();
  }

  function trackRemoved(track) {
    removeListener(track);
    updateLocalParticipantStateAndRenegotiate();
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

  peerConnectionManager.on('trackAdded', roomV2._addMediaStreamTrackOrDataTrackReceiver.bind(roomV2));
  peerConnectionManager.dequeue('trackAdded');

  peerConnectionManager.getRemoteMediaStreamTracksAndDataTrackReceivers().forEach(function(mediaStreamTrackOrDataTrackReceiver) {
    roomV2._addMediaStreamTrackOrDataTrackReceiver(mediaStreamTrackOrDataTrackReceiver);
  });
}

function handleTransportEvents(roomV2, transport) {
  transport.on('message', roomV2._update.bind(roomV2));
  transport.on('stateChanged', function stateChanged(state, error) {
    if (state === 'disconnected') {
      if (roomV2.state === 'connected') {
        roomV2._disconnect(error);
      }
      transport.removeListener('stateChanged', stateChanged);
    }
  });
}

/**
 * Periodically publish {@link StatsReport}s.
 * @private
 * @param {RoomV2} roomV2
 * @param {LocalParticipantV2} localParticipant
 * @param {Transport} transport
 * @param {Number} intervalMs
 */
function periodicallyPublishStats(roomV2, localParticipant, transport, intervalMs) {
  var interval = setInterval(function() {
    roomV2.getStats().then(function(stats) {
      stats.forEach(function(report) {
        transport.publishEvent('quality', 'stats-report', {
          audioTrackStats: report.remoteAudioTrackStats,
          localAudioTrackStats: report.localAudioTrackStats,
          localVideoTrackStats: report.localVideoTrackStats,
          participantSid: localParticipant.sid,
          peerConnectionId: report.peerConnectionId,
          roomSid: roomV2.sid,
          videoTrackStats: report.remoteVideoTrackStats
        });
      });
    }, function() {
      // Do nothing.
    });
  }, intervalMs);

  roomV2.on('stateChanged', function onStateChanged(state) {
    if (state === 'disconnected') {
      clearInterval(interval);
      roomV2.removeListener('stateChanged', onStateChanged);
    }
  });
}

module.exports = RoomV2;
