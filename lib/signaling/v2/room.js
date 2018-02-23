'use strict';

const RecordingV2 = require('./recording');
const RoomSignaling = require('../room');
const RemoteParticipantV2 = require('./remoteparticipant');
const util = require('../../util');
const createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

const STATS_PUBLISH_INTERVAL_MS = 1000;

/**
 * @extends RoomSignaling
 */
class RoomV2 extends RoomSignaling {
  constructor(localParticipant, initialState, transport, peerConnectionManager, options) {
    options = Object.assign({
      RecordingSignaling: RecordingV2,
      RemoteParticipantV2,
      statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
    }, options);

    super(localParticipant, initialState.sid, initialState.name, options);

    Object.defineProperties(this, {
      _disconnectedParticipantSids: {
        value: new Set()
      },
      _peerConnectionManager: {
        value: peerConnectionManager
      },
      _published: {
        value: new Map()
      },
      _publishedRevision: {
        value: 0,
        writable: true
      },
      _RemoteParticipantV2: {
        value: options.RemoteParticipantV2
      },
      _subscribed: {
        value: new Map()
      },
      _subscribedRevision: {
        value: 0,
        writable: true
      },
      _subscriptionFailures: {
        value: new Map()
      },
      _transport: {
        value: transport
      },
      _trackReceiverDeferreds: {
        value: new Map()
      }
    });

    handleLocalParticipantEvents(this, localParticipant);
    handlePeerConnectionEvents(this, peerConnectionManager);
    handleTransportEvents(this, transport);
    periodicallyPublishStats(this, localParticipant, transport, options.statsPublishIntervalMs);

    this._update(initialState);
  }

  /**
   * @private
   */
  _deleteTrackReceiverDeferred(id) {
    return this._trackReceiverDeferreds.delete(id);
  }

  /**
   * @private
   */
  _getOrCreateTrackReceiverDeferred(id) {
    const deferred = this._trackReceiverDeferreds.get(id) || util.defer();
    const trackReceivers = this._peerConnectionManager.getTrackReceivers();

    // NOTE(mmalavalli): In Firefox, there can be instances where a MediaStreamTrack
    // for the given Track ID already exists, for example, when a Track is removed
    // and added back. If that is the case, then we should resolve 'deferred'.
    const trackReceiver = trackReceivers.find(trackReceiver => trackReceiver.id === id && trackReceiver.readyState !== 'ended');

    if (trackReceiver) {
      deferred.resolve(trackReceiver);
    } else {
      // NOTE(mmalavalli): Only add the 'deferred' to the map if it's not
      // resolved. This will prevent old copies of the MediaStreamTrack from
      // being used when the remote peer removes and re-adds a MediaStreamTrack.
      this._trackReceiverDeferreds.set(id, deferred);
    }

    return deferred;
  }

  /**
   * @private
   */
  _addTrackReceiver(trackReceiver) {
    const deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver.id);
    deferred.resolve(trackReceiver);
    return this;
  }

  /**
   * @private
   */
  _disconnect(error) {
    const didDisconnect = super._disconnect.call(this, error);
    if (didDisconnect) {
      this._transport.disconnect();
      this._peerConnectionManager.close();
    }

    this.localParticipant.tracks.forEach(track => {
      track.publishFailed(error || new Error('LocalParticipant disconnected'));
    });

    return didDisconnect;
  }

  /**
   * @private
   */
  _getTrackReceiver(id) {
    return this._getOrCreateTrackReceiverDeferred(id).promise.then(trackReceiver => {
      this._deleteTrackReceiverDeferred(id);
      return trackReceiver;
    });
  }

  /**
   * @private
   */
  _getOrCreateRemoteParticipant(participantState) {
    const RemoteParticipantV2 = this._RemoteParticipantV2;
    let participant = this.participants.get(participantState.sid);
    const self = this;
    if (!participant) {
      participant = new RemoteParticipantV2(participantState, this._getTrackReceiver.bind(this));
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
  }

  /**
   * @private
   */
  _getState() {
    return {
      participant: this.localParticipant.getState()
    };
  }

  /**
   * @private
   */
  _publishNewLocalParticipantState() {
    this._transport.publish(this._getState());
  }

  /**
   * @private
   */
  _publishPeerConnectionState(peerConnectionState) {
    /* eslint camelcase:0 */
    this._transport.publish(Object.assign({
      peer_connections: [peerConnectionState]
    }, this._getState()));
  }

  /**
   * @private
   */
  _update(roomState) {
    const participantsToKeep = new Set();

    if (roomState.subscribed && roomState.subscribed.revision > this._subscribedRevision) {
      this._subscribedRevision = roomState.subscribed.revision;
      roomState.subscribed.tracks.forEach(function(trackState) {
        if (trackState.id) {
          this._subscriptionFailures.delete(trackState.sid);
          this._subscribed.set(trackState.id, trackState.sid);
        } else if (trackState.error && !this._subscriptionFailures.has(trackState.sid)) {
          this._subscriptionFailures.set(trackState.sid, trackState.error);
        }
      }, this);
    }

    // TODO(mroberts): Remove me once the Server is fixed.
    (roomState.participants || []).forEach(function(participantState) {
      if (participantState.sid === this.localParticipant.sid ||
          this._disconnectedParticipantSids.has(participantState.sid)) {
        return;
      }
      const participant = this._getOrCreateRemoteParticipant(participantState);
      participant.update(participantState);
      participantsToKeep.add(participant);
    }, this);

    handleSubscriptionFailures(this);

    // TODO(mroberts): Remove me once the Server is fixed.
    /* eslint camelcase:0 */
    if (roomState.peer_connections) {
      this._peerConnectionManager.update(roomState.peer_connections);
    }

    if (roomState.recording) {
      this.recording.update(roomState.recording);
    }

    if (roomState.published && roomState.published.revision > this._publishedRevision) {
      this._publishedRevision = roomState.published.revision;
      roomState.published.tracks.forEach(function(track) {
        if (track.sid) {
          this._published.set(track.id, track.sid);
        }
      }, this);
      this.localParticipant.update(roomState.published);
    }

    if (roomState.participant) {
      this.localParticipant.connect(
        roomState.participant.sid,
        roomState.participant.identity);
    }

    return this;
  }

  /**
   * Get the {@link RoomV2}'s media statistics.
   * @returns {Promise.<Array<StatsReport>>}
   */
  getStats() {
    const self = this;

    function filterLocalTrackStats(trackStats) {
      return self._published.has(trackStats.trackId);
    }

    function filterRemoteTrackStats(trackStats) {
      return self._subscribed.has(trackStats.trackId);
    }

    return this._peerConnectionManager.getStats().then(reports => reports.map(report => Object.assign({}, report, {
      localAudioTrackStats: report.localAudioTrackStats.filter(filterLocalTrackStats),
      localVideoTrackStats: report.localVideoTrackStats.filter(filterLocalTrackStats),
      remoteAudioTrackStats: report.remoteAudioTrackStats.filter(filterRemoteTrackStats),
      remoteVideoTrackStats: report.remoteVideoTrackStats.filter(filterRemoteTrackStats),
    })));
  }
}

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
  const renegotiate = util.oncePerTick(() => {
    const trackSenders = util.flatMap(localParticipant.tracks, trackV2 => trackV2.trackTransceiver);
    roomV2._peerConnectionManager.setTrackSenders(trackSenders);
  });

  const localParticipantUpdated = util.oncePerTick(() => {
    roomV2._publishNewLocalParticipantState();
  });

  localParticipant.on('trackAdded', renegotiate);
  localParticipant.on('trackRemoved', renegotiate);
  localParticipant.on('updated', localParticipantUpdated);

  roomV2.on('stateChanged', function stateChanged(state) {
    if (state === 'disconnected') {
      localParticipant.removeListener('trackAdded', renegotiate);
      localParticipant.removeListener('trackRemoved', renegotiate);
      localParticipant.removeListener('updated', localParticipantUpdated);
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

  peerConnectionManager.on('trackAdded', roomV2._addTrackReceiver.bind(roomV2));
  peerConnectionManager.dequeue('trackAdded');
  peerConnectionManager.getTrackReceivers().forEach(roomV2._addTrackReceiver, roomV2);
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
  const interval = setInterval(() => {
    roomV2.getStats().then(stats => {
      stats.forEach(report => {
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
    }, () => {
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

function handleSubscriptionFailures(room) {
  const remoteTracks = new Map(util.flatMap(room.participants, participant => Array.from(participant.tracks.values()).map(track => [track.sid, track])));

  room._subscriptionFailures.forEach((error, trackSid) => {
    const remoteTrack = remoteTracks.get(trackSid);
    if (remoteTrack) {
      room._subscriptionFailures.delete(trackSid);
      remoteTrack.subscribeFailed(createTwilioError(error.code, error.message));
    }
  });
}
module.exports = RoomV2;
