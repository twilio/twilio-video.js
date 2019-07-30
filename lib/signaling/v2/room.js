'use strict';

const DominantSpeakerSignaling = require('./dominantspeakersignaling');
const NetworkQualityMonitor = require('./networkqualitymonitor');
const NetworkQualitySignaling = require('./networkqualitysignaling');
const RecordingV2 = require('./recording');
const RoomSignaling = require('../room');
const RemoteParticipantV2 = require('./remoteparticipant');
const StatsReport = require('../../stats/statsreport');
const util = require('../../util');
const createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

const STATS_PUBLISH_INTERVAL_MS = 1000;

/**
 * @extends RoomSignaling
 */
class RoomV2 extends RoomSignaling {
  constructor(localParticipant, initialState, transport, peerConnectionManager, options) {
    options = Object.assign({
      DominantSpeakerSignaling,
      NetworkQualityMonitor,
      NetworkQualitySignaling,
      RecordingSignaling: RecordingV2,
      RemoteParticipantV2,
      statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
    }, options);

    super(localParticipant, initialState.sid, initialState.name, options);

    Object.defineProperties(this, {
      _dominantSpeakerSignaling: {
        value: null,
        writable: true
      },
      _DominantSpeakerSignaling: {
        value: options.DominantSpeakerSignaling
      },
      _dominantSpeakerSignalingPromise: {
        value: null,
        writable: true
      },
      _disconnectedParticipantSids: {
        value: new Set()
      },
      _NetworkQualityMonitor: {
        value: options.NetworkQualityMonitor
      },
      _NetworkQualitySignaling: {
        value: options.NetworkQualitySignaling
      },
      _networkQualityMonitor: {
        value: null,
        writable: true
      },
      _networkQualityMonitorPromise: {
        value: null,
        writable: true
      },
      _networkQualityConfiguration: {
        value: localParticipant.networkQualityConfiguration
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
    periodicallyPublishStats(this, transport, options.statsPublishIntervalMs);

    this._update(initialState);
  }

  /**
   * The Signaling Connection State
   * @property {string} - "connected", "reconnecting", "disconnected"
   */
  get signalingConnectionState() {
    return this._transport.state === 'syncing'
      ? 'reconnecting'
      : this._transport.state;
  }

  /**
   * The Media Connection State
   * @property {RTCIceConnectionState}
   */
  get mediaConnectionState() {
    return this._peerConnectionManager.iceConnectionState;
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
      this._teardownDominantSpeakerSignaling();
      this._teardownNetworkQualityMonitor();
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
          this._subscribed.set(trackState.sid, trackState.id);
        } else if (trackState.error && !this._subscriptionFailures.has(trackState.sid)) {
          this._subscriptionFailures.set(trackState.sid, trackState.error);
        }
      }, this);

      const subscribedTrackSids = new Set(roomState.subscribed.tracks
        .filter(trackState => !!trackState.id)
        .map(trackState => trackState.sid));

      this._subscribed.forEach((trackId, trackSid) => {
        if (!subscribedTrackSids.has(trackSid)) {
          this._subscribed.delete(trackSid);
        }
      });
    }

    // TODO(mroberts): Remove me once the Server is fixed.
    (roomState.participants || []).forEach(participantState => {
      if (participantState.sid === this.localParticipant.sid ||
          this._disconnectedParticipantSids.has(participantState.sid)) {
        return;
      }
      const participant = this._getOrCreateRemoteParticipant(participantState);
      participant.update(participantState);
      participantsToKeep.add(participant);
    });

    handleSubscriptions(this);

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

    if (!this._dominantSpeakerSignalingPromise
      && roomState.media_signaling
      && roomState.media_signaling.active_speaker
      && roomState.media_signaling.active_speaker.transport
      && roomState.media_signaling.active_speaker.transport.type === 'data-channel') {
      this._setupDataTransportBackedDominantSpeakerSignaling(roomState.media_signaling.active_speaker.transport.label);
    }

    if (!this._networkQualityMonitorPromise
      && roomState.media_signaling
      && roomState.media_signaling.network_quality
      && roomState.media_signaling.network_quality.transport
      && roomState.media_signaling.network_quality.transport.type === 'data-channel') {
      this._setupDataTransportBackedNetworkQualityMonitor(roomState.media_signaling.network_quality.transport.label);
    }

    return this;
  }

  /**
   * Create a {@link DataTransport}-backed {@link DominantSpeakerSignaling}.
   * @private
   * @param {ID} id - ID of the {@link DataTrackReceiver} that will ultimately
   *   be converted into a {@link DataTrackTransport} for use with
   *   {@link DominantSpeakerSignaling}
   * @returns {Promise<void>}
   */
  _setupDataTransportBackedDominantSpeakerSignaling(id) {
    this._teardownDominantSpeakerSignaling();
    const dominantSpeakerSignalingPromise = this._getTrackReceiver(id).then(receiver => {
      if (receiver.kind !== 'data') {
        throw new Error('Expected a DataTrackReceiver');
      } if (this._dominantSpeakerSignalingPromise !== dominantSpeakerSignalingPromise) {
        // NOTE(mroberts): _teardownDominantSpeakerSignaling was called.
        return;
      }

      // NOTE(mpatwardhan): The underlying RTCDataChannel is closed whenever
      // the VMS instance fails over, and a new RTCDataChannel is created in order
      // to resume sending Dominant Speaker updates.
      receiver.once('close', () => this._teardownDominantSpeakerSignaling());

      const dominantSpeakerSignaling = new this._DominantSpeakerSignaling(receiver.toDataTransport());
      this._setDominantSpeakerSignaling(dominantSpeakerSignaling);
    });
    this._dominantSpeakerSignalingPromise = dominantSpeakerSignalingPromise;
  }
  /**
   * Create a {@link DataTransport}-backed {@link NetworkQualityMonitor}.
   * @private
   * @param {ID} id - ID of the {@link DataTrackReceiver} that will ultimately
   *   be converted into a {@link DataTrackTransport} for use with
   *   {@link NetworkQualitySignaling}
   * @returns {Promise<void>}
   */
  _setupDataTransportBackedNetworkQualityMonitor(id) {
    var self = this;
    this._teardownNetworkQualityMonitor();
    const networkQualityMonitorPromise = this._getTrackReceiver(id).then(receiver => {
      if (receiver.kind !== 'data') {
        throw new Error('Expected a DataTrackReceiver');
      } if (this._networkQualityMonitorPromise !== networkQualityMonitorPromise) {
        // NOTE(mroberts): _teardownNetworkQualityMonitor was called.
        return;
      }

      // NOTE(mpatwardhan): The underlying RTCDataChannel is closed whenever
      // the VMS instance fails over, and new a RTCDataChannel is created in order
      // to resume exchanging Network Quality messages.
      receiver.once('close', () => this. _teardownNetworkQualityMonitor());

      const networkQualitySignaling = new this._NetworkQualitySignaling(
        receiver.toDataTransport(), self._networkQualityConfiguration);
      const networkQualityMonitor = new this._NetworkQualityMonitor(this._peerConnectionManager, networkQualitySignaling);
      this._setNetworkQualityMonitor(networkQualityMonitor);
    });
    this._networkQualityMonitorPromise = networkQualityMonitorPromise;
  }

  _setDominantSpeakerSignaling(dominantSpeakerSignaling) {
    this._dominantSpeakerSignaling = dominantSpeakerSignaling;
    dominantSpeakerSignaling.on('updated', () => this.setDominantSpeaker(dominantSpeakerSignaling.loudestParticipantSid));
  }

  _setNetworkQualityMonitor(networkQualityMonitor) {
    this._networkQualityMonitor = networkQualityMonitor;
    networkQualityMonitor.on('updated', () => {
      if (this.mediaConnectionState === 'failed') {
        return;
      }
      this.localParticipant.setNetworkQualityLevel(
        networkQualityMonitor.level,
        networkQualityMonitor.levels);
      this.participants.forEach((participant) => {
        const levels = networkQualityMonitor.remoteLevels.get(participant.sid);
        if (levels) {
          participant.setNetworkQualityLevel(levels.level, levels);
        }
      });
    });
    networkQualityMonitor.start();
  }

  _teardownDominantSpeakerSignaling() {
    this._dominantSpeakerSignalingPromise = null;
    this._dominantSpeakerSignaling = null;
  }

  _teardownNetworkQualityMonitor() {
    this._networkQualityMonitorPromise = null;
    if (this._networkQualityMonitor) {
      this._networkQualityMonitor.stop();
      this._networkQualityMonitor = null;
    }
  }

  /**
   * Get the {@link RoomV2}'s media statistics.
   * @returns {Promise.<Map<PeerConnectionV2#id, StandardizedStatsResponse>>}
   */
  getStats() {
    return this._peerConnectionManager.getStats().then(responses =>
      new Map(Array.from(responses).map(([id, response]) =>
        [id, Object.assign({}, response, {
          localAudioTrackStats: filterAndAddLocalTrackSids(this, response.localAudioTrackStats),
          localVideoTrackStats: filterAndAddLocalTrackSids(this, response.localVideoTrackStats),
          remoteAudioTrackStats: filterAndAddRemoteTrackSids(this, response.remoteAudioTrackStats),
          remoteVideoTrackStats: filterAndAddRemoteTrackSids(this, response.remoteVideoTrackStats)
        })]
      ))
    );
  }
}

/**
 * Filter out {@link TrackStats} that aren't in the collection while also
 * stamping their Track SIDs.
 * @param {Map<ID, SID>} idToSid
 * @param {Array<TrackStats>} trackStats
 * @returns {Array<TrackStats>}
 */
function filterAndAddTrackSids(idToSid, trackStats) {
  return trackStats.reduce((trackStats, trackStat) => {
    const trackSid = idToSid.get(trackStat.trackId);
    return trackSid
      ? [Object.assign({}, trackStat, { trackSid })].concat(trackStats)
      : trackStats;
  }, []);
}

/**
 * Filter out {@link LocalTrackStats} that aren't currently published while also
 * stamping their Track SIDs.
 * @param {RoomV2} roomV2
 * @param {Array<LocalTrackStats>} localTrackStats
 * @returns {Array<LocalTrackStats>}
 */
function filterAndAddLocalTrackSids(roomV2, localTrackStats) {
  return filterAndAddTrackSids(roomV2._published, localTrackStats);
}

/**
 * Filter out {@link RemoteTrackStats} that aren't currently subscribed while
 * also stamping their Track SIDs.
 * @param {RoomV2} roomV2
 * @param {Array<RemoteTrackStats>} remoteTrackStats
 * @returns {Array<RemoteTrackStats>}
 */
function filterAndAddRemoteTrackSids(roomV2, remoteTrackStats) {
  const idToSid = new Map(Array.from(roomV2._subscribed.entries()).map(([sid, id]) => [id, sid]));
  return filterAndAddTrackSids(idToSid, remoteTrackStats);
}

/**
 * @typedef {object} RoomV2#Representation
 * @property {string} name
 * @property {LocalParticipantV2#Representation} participant
 * @property {?Array<RemoteParticipantV2#Representation>} participants
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

  peerConnectionManager.on('iceConnectionStateChanged', () => {
    roomV2.emit('mediaConnectionStateChanged');
    if (roomV2.mediaConnectionState === 'failed') {
      if (roomV2.localParticipant.networkQualityLevel !== null) {
        roomV2.localParticipant.setNetworkQualityLevel(0);
      }
      roomV2.participants.forEach(participant => {
        if (participant.networkQualityLevel !== null) {
          participant.setNetworkQualityLevel(0);
        }
      });
    }
  });
}

function handleTransportEvents(roomV2, transport) {
  transport.on('message', roomV2._update.bind(roomV2));
  transport.on('stateChanged', function stateChanged(state, error) {
    if (state === 'disconnected') {
      if (roomV2.state !== 'disconnected') {
        roomV2._disconnect(error);
      }
      transport.removeListener('stateChanged', stateChanged);
    }
    roomV2.emit('signalingConnectionStateChanged');
  });
}

/**
 * Periodically publish {@link StatsReport}s.
 * @private
 * @param {RoomV2} roomV2
 * @param {Transport} transport
 * @param {Number} intervalMs
 */
function periodicallyPublishStats(roomV2, transport, intervalMs) {
  const interval = setInterval(() => {
    roomV2.getStats().then(stats => {
      stats.forEach((response, id) => {
        // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
        // event instead of using StandardizedStatsResponse directly because
        // StatsReport will add nulls to properties that do not exist.
        const report = new StatsReport(id, response);

        transport.publishEvent('quality', 'stats-report', {
          audioTrackStats: report.remoteAudioTrackStats,
          localAudioTrackStats: report.localAudioTrackStats,
          localVideoTrackStats: report.localVideoTrackStats,
          peerConnectionId: report.peerConnectionId,
          videoTrackStats: report.remoteVideoTrackStats
        });

        // NOTE(mmalavalli): null properties of the "active-ice-candidate-pair"
        // payload are assigned default values until the Insights gateway
        // accepts null values.
        const activeIceCandidatePair = replaceNullsWithDefaults(
          response.activeIceCandidatePair,
          report.peerConnectionId);

        transport.publishEvent('quality', 'active-ice-candidate-pair', activeIceCandidatePair);
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

function handleSubscriptions(room) {
  const trackSignalings = new Map(util.flatMap(room.participants, participant => Array.from(participant.tracks.values()).map(track => [track.sid, track])));

  room._subscriptionFailures.forEach((error, trackSid) => {
    const trackSignaling = trackSignalings.get(trackSid);
    if (trackSignaling) {
      room._subscriptionFailures.delete(trackSid);
      trackSignaling.subscribeFailed(createTwilioError(error.code, error.message));
    }
  });

  trackSignalings.forEach(trackSignaling => {
    const trackId = room._subscribed.get(trackSignaling.sid);
    if (!trackId || (trackSignaling.isSubscribed && trackSignaling.trackTransceiver.id !== trackId)) {
      trackSignaling.setTrackTransceiver(null);
    }
    if (trackId) {
      room._getTrackReceiver(trackId).then(trackReceiver => trackSignaling.setTrackTransceiver(trackReceiver));
    }
  });
}

function replaceNullsWithDefaults(activeIceCandidatePair, peerConnectionId) {
  activeIceCandidatePair = Object.assign({
    availableIncomingBitrate: 0,
    availableOutgoingBitrate: 0,
    bytesReceived: 0,
    bytesSent: 0,
    consentRequestsSent: 0,
    currentRoundTripTime: 0,
    lastPacketReceivedTimestamp: 0,
    lastPacketSentTimestamp: 0,
    nominated: false,
    peerConnectionId: peerConnectionId,
    priority: 0,
    readable: false,
    requestsReceived: 0,
    requestsSent: 0,
    responsesReceived: 0,
    responsesSent: 0,
    retransmissionsReceived: 0,
    retransmissionsSent: 0,
    state: 'failed',
    totalRoundTripTime: 0,
    transportId: '',
    writable: false
  }, util.filterObject(activeIceCandidatePair || {}, null));

  activeIceCandidatePair.localCandidate = Object.assign({
    candidateType: 'host',
    deleted: false,
    ip: '',
    port: 0,
    priority: 0,
    protocol: 'udp',
    relayProtocol: 'udp',
    url: ''
  }, util.filterObject(activeIceCandidatePair.localCandidate || {}, null));

  activeIceCandidatePair.remoteCandidate = Object.assign({
    candidateType: 'host',
    ip: '',
    port: 0,
    priority: 0,
    protocol: 'udp',
    url: ''
  }, util.filterObject(activeIceCandidatePair.remoteCandidate || {}, null));

  return activeIceCandidatePair;
}

module.exports = RoomV2;
