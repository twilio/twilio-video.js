/* eslint-disable no-console */
'use strict';

const DominantSpeakerSignaling = require('./dominantspeakersignaling');
const NetworkQualityMonitor = require('./networkqualitymonitor');
const NetworkQualitySignaling = require('./networkqualitysignaling');
const RecordingV2 = require('./recording');
const RoomSignaling = require('../room');
const RemoteParticipantV2 = require('./remoteparticipant');
const StatsReport = require('../../stats/statsreport');
const TrackPrioritySignaling = require('./trackprioritysignaling');
const TrackSwitchOffSignaling = require('./trackswitchoffsignaling');
const RenderHintsSignaling = require('./renderhintssignaling');
const PublisherHintsSignaling = require('./publisherhintsignaling.js');


const {
  constants: { DEFAULT_SESSION_TIMEOUT_SEC },
  createBandwidthProfilePayload,
  defer,
  difference,
  filterObject,
  flatMap,
  oncePerTick
} = require('../../util');

const MovingAverageDelta = require('../../util/movingaveragedelta');
const { createTwilioError } = require('../../util/twilio-video-errors');

const STATS_PUBLISH_INTERVAL_MS = 10000;

/**
 * @extends RoomSignaling
 */
class RoomV2 extends RoomSignaling {
  constructor(localParticipant, initialState, transport, peerConnectionManager, options) {
    initialState.options = Object.assign({
      session_timeout: DEFAULT_SESSION_TIMEOUT_SEC
    }, initialState.options);

    options = Object.assign({
      DominantSpeakerSignaling,
      NetworkQualityMonitor,
      NetworkQualitySignaling,
      RecordingSignaling: RecordingV2,
      RemoteParticipantV2,
      TrackPrioritySignaling,
      TrackSwitchOffSignaling,
      bandwidthProfile: null,
      sessionTimeout: initialState.options.session_timeout * 1000,
      statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
    }, options);

    localParticipant.setBandwidthProfile(options.bandwidthProfile);

    const { options: { signaling_region: signalingRegion, audio_processors: audioProcessors = [] } } = initialState;
    localParticipant.setSignalingRegion(signalingRegion);


    if (audioProcessors.includes('krisp')) {
      // Note(mpatwardhan): we add rnnoise as allowed_processor to enable testing our pipeline e2e.
      audioProcessors.push('rnnoise');
    }

    localParticipant.setAudioProcessors(audioProcessors);

    peerConnectionManager.setIceReconnectTimeout(options.sessionTimeout);

    super(localParticipant, initialState.sid, initialState.name, options);

    const getTrackReceiver = id => this._getTrackReceiver(id);
    const log = this._log;

    Object.defineProperties(this, {
      _disconnectedParticipantRevisions: {
        value: new Map()
      },
      _NetworkQualityMonitor: {
        value: options.NetworkQualityMonitor
      },
      _lastBandwidthProfileRevision: {
        value: localParticipant.bandwidthProfileRevision,
        writable: true
      },
      _mediaStatesWarningsRevision: {
        value: 0,
        writable: true
      },
      _networkQualityMonitor: {
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
      _dominantSpeakerSignaling: {
        value: new options.DominantSpeakerSignaling(getTrackReceiver, { log })
      },
      _networkQualitySignaling: {
        value: new options.NetworkQualitySignaling(
          getTrackReceiver,
          localParticipant.networkQualityConfiguration,
          { log }
        )
      },
      _renderHintsSignaling: {
        value: new RenderHintsSignaling(getTrackReceiver, { log }),
      },
      _publisherHintsSignaling: {
        value: new PublisherHintsSignaling(getTrackReceiver, { log }),
      },
      _trackPrioritySignaling: {
        value: new options.TrackPrioritySignaling(getTrackReceiver, { log }),
      },
      _trackSwitchOffSignaling: {
        value: new options.TrackSwitchOffSignaling(getTrackReceiver, { log }),
      },
      _pendingSwitchOffStates: {
        value: new Map()
      },
      _transport: {
        value: transport
      },
      _trackReceiverDeferreds: {
        value: new Map()
      },
      mediaRegion: {
        enumerable: true,
        value: initialState.options.media_region || null
      }
    });

    this._initTrackSwitchOffSignaling();
    this._initDominantSpeakerSignaling();
    this._initNetworkQualityMonitorSignaling();
    this._initPublisherHintSignaling();

    handleLocalParticipantEvents(this, localParticipant);
    handlePeerConnectionEvents(this, peerConnectionManager);
    handleTransportEvents(this, transport);
    periodicallyPublishStats(this, transport, options.statsPublishIntervalMs);

    this._update(initialState);

    // NOTE(mpatwardhan) after initial state we know if publisher_hints are enabled or not
    // if they are not enabled. we need to undo simulcast that was enabled with initial offer.
    this._peerConnectionManager.setEffectiveAdaptiveSimulcast(this._publisherHintsSignaling.isSetup);
  }

  /**
   * The PeerConnection state.
   * @property {RTCPeerConnectionState}
   */
  get connectionState() {
    return this._peerConnectionManager.connectionState;
  }

  /**
   * The Signaling Connection State.
   * @property {string} - "connected", "reconnecting", "disconnected"
   */
  get signalingConnectionState() {
    return this._transport.state === 'syncing'
      ? 'reconnecting'
      : this._transport.state;
  }

  /**
   * The Ice Connection State.
   * @property {RTCIceConnectionState}
   */
  get iceConnectionState() {
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
    const deferred = this._trackReceiverDeferreds.get(id) || defer();
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
  _getInitialTrackSwitchOffState(trackSid) {
    const initiallySwitchedOff = this._pendingSwitchOffStates.get(trackSid) || false;
    this._pendingSwitchOffStates.delete(trackSid);
    if (initiallySwitchedOff) {
      this._log.warn(`[${trackSid}] was initially switched off! `);
    }
    return initiallySwitchedOff;
  }


  /**
   * @private
   */
  _getTrackSidsToTrackSignalings() {
    const trackSidsToTrackSignalings = flatMap(this.participants, participant => Array.from(participant.tracks));
    return new Map(trackSidsToTrackSignalings);
  }

  /**
   * @private
   */
  _getOrCreateRemoteParticipant(participantState) {
    const RemoteParticipantV2 = this._RemoteParticipantV2;
    let participant = this.participants.get(participantState.sid);
    const self = this;
    if (!participant) {
      participant = new RemoteParticipantV2(
        participantState,
        trackSid => this._getInitialTrackSwitchOffState(trackSid),
        (trackSid, priority) => this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority),
        (trackSid, hint) => this._renderHintsSignaling.setTrackHint(trackSid, hint),
        trackSid => this._renderHintsSignaling.clearTrackHint(trackSid)
      );
      participant.on('stateChanged', function stateChanged(state) {
        if (state === 'disconnected') {
          participant.removeListener('stateChanged', stateChanged);
          self.participants.delete(participant.sid);
          self._disconnectedParticipantRevisions.set(participant.sid, participant.revision);
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
  _maybeAddBandwidthProfile(update) {
    const { bandwidthProfile, bandwidthProfileRevision } = this.localParticipant;
    if (bandwidthProfile && this._lastBandwidthProfileRevision < bandwidthProfileRevision) {
      this._lastBandwidthProfileRevision = bandwidthProfileRevision;
      return Object.assign({
        bandwidth_profile: createBandwidthProfilePayload(bandwidthProfile)
      }, update);
    }
    return update;
  }
  /**
   * @private
   */
  _publishNewLocalParticipantState() {
    this._transport.publish(this._maybeAddBandwidthProfile(this._getState()));
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
    if (roomState.subscribed && roomState.subscribed.revision > this._subscribedRevision) {
      this._subscribedRevision = roomState.subscribed.revision;
      roomState.subscribed.tracks.forEach(trackState => {
        if (trackState.id) {
          this._subscriptionFailures.delete(trackState.sid);
          this._subscribed.set(trackState.sid, trackState.id);
        } else if (trackState.error && !this._subscriptionFailures.has(trackState.sid)) {
          this._subscriptionFailures.set(trackState.sid, trackState.error);
        }
      });

      const subscribedTrackSids = new Set(roomState.subscribed.tracks
        .filter(trackState => !!trackState.id)
        .map(trackState => trackState.sid));

      this._subscribed.forEach((trackId, trackSid) => {
        if (!subscribedTrackSids.has(trackSid)) {
          this._subscribed.delete(trackSid);
        }
      });
    }

    const participantsToKeep = new Set();

    // eslint-disable-next-line no-warning-comments
    // TODO(mroberts): Remove me once the Server is fixed.
    (roomState.participants || []).forEach(participantState => {
      if (participantState.sid === this.localParticipant.sid) {
        return;
      }

      // NOTE(mmalavalli): If the incoming revision for a disconnected Participant is less than or
      // equal to the revision when it was disconnected, then the state is old and can be ignored.
      // Otherwise, the Participant was most likely disconnected in a Large Group Room when it
      // stopped publishing media, and hence needs to be re-added.
      const disconnectedParticipantRevision = this._disconnectedParticipantRevisions.get(participantState.sid);
      if (disconnectedParticipantRevision && participantState.revision <= disconnectedParticipantRevision) {
        return;
      }

      if (disconnectedParticipantRevision) {
        this._disconnectedParticipantRevisions.delete(participantState.sid);
      }
      const participant = this._getOrCreateRemoteParticipant(participantState);
      participant.update(participantState);
      participantsToKeep.add(participant);
    });

    if (roomState.type === 'synced') {
      this.participants.forEach(participant => {
        if (!participantsToKeep.has(participant)) {
          participant.disconnect();
        }
      });
    }

    handleSubscriptions(this);

    // eslint-disable-next-line no-warning-comments
    // TODO(mroberts): Remove me once the Server is fixed.
    /* eslint camelcase:0 */
    if (roomState.peer_connections) {
      this._peerConnectionManager.update(roomState.peer_connections, roomState.type === 'synced');
    }

    if (roomState.recording) {
      this.recording.update(roomState.recording);
    }

    if (roomState.published && roomState.published.revision > this._publishedRevision) {
      this._publishedRevision = roomState.published.revision;
      roomState.published.tracks.forEach(track => {
        if (track.sid) {
          this._published.set(track.id, track.sid);
        }
      });
      this.localParticipant.update(roomState.published);
    }

    if (roomState.participant) {
      this.localParticipant.connect(
        roomState.participant.sid,
        roomState.participant.identity);
    }

    [
      this._dominantSpeakerSignaling,
      this._networkQualitySignaling,
      this._trackPrioritySignaling,
      this._trackSwitchOffSignaling,
      this._renderHintsSignaling,
      this._publisherHintsSignaling
    ].forEach(mediaSignaling => {
      const channel = mediaSignaling.channel;
      if (!mediaSignaling.isSetup
        && roomState.media_signaling
        && roomState.media_signaling[channel]
        && roomState.media_signaling[channel].transport
        && roomState.media_signaling[channel].transport.type === 'data-channel') {
        mediaSignaling.setup(roomState.media_signaling[channel].transport.label);
      }
    });

    if (roomState.type === 'warning' && roomState.states &&
      roomState.states.revision > this._mediaStatesWarningsRevision) {
      this._mediaStatesWarningsRevision = roomState.states.revision;
      this.localParticipant.updateMediaStates(roomState.states);
    }

    return this;
  }

  _initPublisherHintSignaling() {
    this._publisherHintsSignaling.on('updated', (hints, id) => {
      Promise.all(hints.map(hint => {
        return this.localParticipant.setPublisherHint(hint.track, hint.encodings).then(result => {
          return { track: hint.track, result };
        });
      })).then(hintResponses => {
        this._publisherHintsSignaling.sendHintResponse({ id, hints: hintResponses });
      });
    });

    const handleReplaced = track => {
      if (track.kind === 'video') {
        track.trackTransceiver.on('replaced', () => {
          this._publisherHintsSignaling.sendTrackReplaced({ trackSid: track.sid });
        });
      }
    };

    // hook up for any existing and new tracks getting replaced.
    Array.from(this.localParticipant.tracks.values()).forEach(track => handleReplaced(track));
    this.localParticipant.on('trackAdded', track => handleReplaced(track));
  }

  _initTrackSwitchOffSignaling() {
    this._trackSwitchOffSignaling.on('updated', (tracksOff, tracksOn) => {
      try {
        this._log.debug('received trackSwitch: ', { tracksOn, tracksOff });
        const trackUpdates = new Map();
        tracksOn.forEach(trackSid => trackUpdates.set(trackSid, true));
        tracksOff.forEach(trackSid => {
          if (trackUpdates.get(trackSid)) {
            // NOTE(mpatwardhan): This means that VIDEO-3762 has been reproduced.
            this._log.warn(`${trackSid} is DUPLICATED in both tracksOff and tracksOn list`);
          }
          trackUpdates.set(trackSid, false);
        });
        this.participants.forEach(participant => {
          participant.tracks.forEach(track => {
            const isOn = trackUpdates.get(track.sid);
            if (typeof isOn !== 'undefined') {
              track.setSwitchedOff(!isOn);
              trackUpdates.delete(track.sid);
            }
          });
        });
        // NOTE(mpatwardhan): Cache any notification about the tracks that we do not yet know about.
        trackUpdates.forEach((isOn, trackSid) => this._pendingSwitchOffStates.set(trackSid, !isOn));
      } catch (ex) {
        this._log.error('error processing track switch off:', ex);
      }
    });
  }

  _initDominantSpeakerSignaling() {
    this._dominantSpeakerSignaling.on('updated', () => this.setDominantSpeaker(this._dominantSpeakerSignaling.loudestParticipantSid));
  }

  _initNetworkQualityMonitorSignaling() {
    this._networkQualitySignaling.on('ready', () => {
      const networkQualityMonitor = new this._NetworkQualityMonitor(this._peerConnectionManager, this._networkQualitySignaling);
      this._networkQualityMonitor = networkQualityMonitor;
      networkQualityMonitor.on('updated', () => {
        if (this.iceConnectionState === 'failed') {
          return;
        }
        this.localParticipant.setNetworkQualityLevel(
          networkQualityMonitor.level,
          networkQualityMonitor.levels);
        this.participants.forEach(participant => {
          const levels = networkQualityMonitor.remoteLevels.get(participant.sid);
          if (levels) {
            participant.setNetworkQualityLevel(levels.level, levels);
          }
        });
      });
      networkQualityMonitor.start();
    });
    this._networkQualitySignaling.on('teardown', () => this._teardownNetworkQualityMonitor());
  }

  _teardownNetworkQualityMonitor() {
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
  const localParticipantUpdated = oncePerTick(() => {
    roomV2._publishNewLocalParticipantState();
  });

  const renegotiate = oncePerTick(() => {
    const trackSenders = flatMap(localParticipant.tracks, trackV2 => trackV2.trackTransceiver);
    roomV2._peerConnectionManager.setTrackSenders(trackSenders);
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

  roomV2.on('signalingConnectionStateChanged', () => {
    const { localParticipant, signalingConnectionState } = roomV2;
    const { identity, sid } = localParticipant;
    switch (signalingConnectionState) {
      case 'connected':
        localParticipant.connect(sid, identity);
        break;
      case 'reconnecting':
        localParticipant.reconnecting();
        break;
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

  peerConnectionManager.on('connectionStateChanged', () => {
    roomV2.emit('connectionStateChanged');
  });

  peerConnectionManager.on('iceConnectionStateChanged', () => {
    roomV2.emit('iceConnectionStateChanged');
    if (roomV2.iceConnectionState === 'failed') {
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
  const movingAverageDeltas = new Map();
  let oddPublishCount = false;
  const interval = setInterval(() => {
    roomV2.getStats().then(stats => {
      oddPublishCount = !oddPublishCount;
      stats.forEach((response, id) => {
        // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
        // event instead of using StandardizedStatsResponse directly because
        // StatsReport will add zeros to properties that do not exist.
        const report = new StatsReport(id, response, true /* prepareForInsights */);

        // NOTE(mmalavalli): Since A/V sync metrics are not part of the StatsReport class,
        // we add them to the insights payload here.
        transport.publishEvent('quality', 'stats-report', 'info', {
          audioTrackStats: report.remoteAudioTrackStats.map((trackStat, i) =>
            addAVSyncMetricsToRemoteTrackStats(trackStat, response.remoteAudioTrackStats[i], movingAverageDeltas)),
          localAudioTrackStats: report.localAudioTrackStats.map((trackStat, i) =>
            addAVSyncMetricsToLocalTrackStats(trackStat, response.localAudioTrackStats[i], movingAverageDeltas)),
          localVideoTrackStats: report.localVideoTrackStats.map((trackStat, i) =>
            addAVSyncMetricsToLocalTrackStats(trackStat, response.localVideoTrackStats[i], movingAverageDeltas)),
          peerConnectionId: report.peerConnectionId,
          videoTrackStats: report.remoteVideoTrackStats.map((trackStat, i) =>
            addAVSyncMetricsToRemoteTrackStats(trackStat, response.remoteVideoTrackStats[i], movingAverageDeltas)),
        });

        // NOTE(mmalavalli): Clean up entries for Tracks that are no longer published or subscribed to.
        const keys = flatMap([
          'localAudioTrackStats',
          'localVideoTrackStats',
          'remoteAudioTrackStats',
          'remoteVideoTrackStats'
        ], prop => report[prop].map(({ ssrc, trackSid }) => `${trackSid}+${ssrc}`));
        const movingAverageDeltaKeysToBeRemoved = difference(Array.from(movingAverageDeltas.keys()), keys);
        movingAverageDeltaKeysToBeRemoved.forEach(key => movingAverageDeltas.delete(key));

        if (oddPublishCount) {
          // NOTE(mmalavalli): null properties of the "active-ice-candidate-pair"
          // payload are assigned default values until the Insights gateway
          // accepts null values.
          const activeIceCandidatePair = replaceNullsWithDefaults(
            response.activeIceCandidatePair,
            report.peerConnectionId);

          transport.publishEvent(
            'quality',
            'active-ice-candidate-pair',
            'info',
            activeIceCandidatePair);
        }
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
  const trackSidsToTrackSignalings = room._getTrackSidsToTrackSignalings();

  room._subscriptionFailures.forEach((error, trackSid) => {
    const trackSignaling = trackSidsToTrackSignalings.get(trackSid);
    if (trackSignaling) {
      room._subscriptionFailures.delete(trackSid);
      trackSignaling.subscribeFailed(createTwilioError(error.code, error.message));
    }
  });

  trackSidsToTrackSignalings.forEach(trackSignaling => {
    const trackId = room._subscribed.get(trackSignaling.sid);
    if (!trackId || (trackSignaling.isSubscribed && trackSignaling.trackTransceiver.id !== trackId)) {
      trackSignaling.setTrackTransceiver(null);
    }
    if (trackId) {
      room._getTrackReceiver(trackId).then(trackReceiver => trackSignaling.setTrackTransceiver(trackReceiver));
    }
  });
}

/**
 * NOTE(mmalavalli): Since A/V sync metrics are not part of the public StatsReport class, we add them
 * only for reporting purposes.
 * @private
 */
function addAVSyncMetricsToLocalTrackStats(trackStats, trackResponse, movingAverageDeltas) {
  const {
    framesEncoded,
    packetsSent,
    totalEncodeTime,
    totalPacketSendDelay
  } = trackResponse;
  const augmentedTrackStats = Object.assign({}, trackStats);
  const key = `${trackStats.trackSid}+${trackStats.ssrc}`;
  const trackMovingAverageDeltas = movingAverageDeltas.get(key) || new Map();

  if (typeof totalEncodeTime === 'number' && typeof framesEncoded === 'number') {
    const trackAvgEncodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgEncodeDelay')
      || new MovingAverageDelta();
    trackAvgEncodeDelayMovingAverageDelta.putSample(totalEncodeTime * 1000, framesEncoded);
    augmentedTrackStats.avgEncodeDelay = Math.round(trackAvgEncodeDelayMovingAverageDelta.get());
    trackMovingAverageDeltas.set('avgEncodeDelay', trackAvgEncodeDelayMovingAverageDelta);
  }
  if (typeof totalPacketSendDelay === 'number' && typeof packetsSent === 'number') {
    const trackAvgPacketSendDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgPacketSendDelay')
      || new MovingAverageDelta();
    trackAvgPacketSendDelayMovingAverageDelta.putSample(totalPacketSendDelay * 1000, packetsSent);
    augmentedTrackStats.avgPacketSendDelay = Math.round(trackAvgPacketSendDelayMovingAverageDelta.get());
    trackMovingAverageDeltas.set('avgPacketSendDelay', trackAvgPacketSendDelayMovingAverageDelta);
  }
  movingAverageDeltas.set(key, trackMovingAverageDeltas);
  return augmentedTrackStats;
}

/**
 * NOTE(mmalavalli): Since A/V sync metrics are not part of the public StatsReport class, we add them
 * only for reporting purposes.
 * @private
 */
function addAVSyncMetricsToRemoteTrackStats(trackStats, trackResponse, movingAverageDeltas) {
  const {
    estimatedPlayoutTimestamp,
    framesDecoded,
    jitterBufferDelay,
    jitterBufferEmittedCount,
    totalDecodeTime
  } = trackResponse;
  const augmentedTrackStats = Object.assign({}, trackStats);
  const key = `${trackStats.trackSid}+${trackStats.ssrc}`;
  const trackMovingAverageDeltas = movingAverageDeltas.get(key) || new Map();

  if (typeof estimatedPlayoutTimestamp === 'number') {
    augmentedTrackStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
  }
  if (typeof framesDecoded === 'number' && typeof totalDecodeTime === 'number') {
    const trackAvgDecodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgDecodeDelay')
      || new MovingAverageDelta();
    trackAvgDecodeDelayMovingAverageDelta.putSample(totalDecodeTime * 1000, framesDecoded);
    augmentedTrackStats.avgDecodeDelay = Math.round(trackAvgDecodeDelayMovingAverageDelta.get());
    trackMovingAverageDeltas.set('avgDecodeDelay', trackAvgDecodeDelayMovingAverageDelta);
  }
  if (typeof jitterBufferDelay === 'number' && typeof jitterBufferEmittedCount === 'number') {
    const trackAvgJitterBufferDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgJitterBufferDelay')
      || new MovingAverageDelta();
    trackAvgJitterBufferDelayMovingAverageDelta.putSample(jitterBufferDelay * 1000, jitterBufferEmittedCount);
    augmentedTrackStats.avgJitterBufferDelay = Math.round(trackAvgJitterBufferDelayMovingAverageDelta.get());
    trackMovingAverageDeltas.set('avgJitterBufferDelay', trackAvgJitterBufferDelayMovingAverageDelta);
  }
  movingAverageDeltas.set(key, trackMovingAverageDeltas);
  return augmentedTrackStats;
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
  }, filterObject(activeIceCandidatePair || {}, null));

  activeIceCandidatePair.localCandidate = Object.assign({
    candidateType: 'host',
    deleted: false,
    ip: '',
    port: 0,
    priority: 0,
    protocol: 'udp',
    url: ''
  }, filterObject(activeIceCandidatePair.localCandidate || {}, null));

  activeIceCandidatePair.remoteCandidate = Object.assign({
    candidateType: 'host',
    ip: '',
    port: 0,
    priority: 0,
    protocol: 'udp',
    url: ''
  }, filterObject(activeIceCandidatePair.remoteCandidate || {}, null));

  return activeIceCandidatePair;
}

module.exports = RoomV2;
