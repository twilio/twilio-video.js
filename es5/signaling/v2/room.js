/* eslint-disable no-console */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var DominantSpeakerSignaling = require('./dominantspeakersignaling');
var NetworkQualityMonitor = require('./networkqualitymonitor');
var NetworkQualitySignaling = require('./networkqualitysignaling');
var RecordingV2 = require('./recording');
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var StatsReport = require('../../stats/statsreport');
var TrackPrioritySignaling = require('./trackprioritysignaling');
var TrackSwitchOffSignaling = require('./trackswitchoffsignaling');
var RenderHintsSignaling = require('./renderhintssignaling');
var PublisherHintsSignaling = require('./publisherhintsignaling.js');
var _a = require('../../util'), DEFAULT_SESSION_TIMEOUT_SEC = _a.constants.DEFAULT_SESSION_TIMEOUT_SEC, createBandwidthProfilePayload = _a.createBandwidthProfilePayload, defer = _a.defer, difference = _a.difference, filterObject = _a.filterObject, flatMap = _a.flatMap, oncePerTick = _a.oncePerTick;
var MovingAverageDelta = require('../../util/movingaveragedelta');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;
var STATS_PUBLISH_INTERVAL_MS = 10000;
/**
 * @extends RoomSignaling
 */
var RoomV2 = /** @class */ (function (_super) {
    __extends(RoomV2, _super);
    function RoomV2(localParticipant, initialState, transport, peerConnectionManager, options) {
        var _this = this;
        initialState.options = Object.assign({
            session_timeout: DEFAULT_SESSION_TIMEOUT_SEC
        }, initialState.options);
        options = Object.assign({
            DominantSpeakerSignaling: DominantSpeakerSignaling,
            NetworkQualityMonitor: NetworkQualityMonitor,
            NetworkQualitySignaling: NetworkQualitySignaling,
            RecordingSignaling: RecordingV2,
            RemoteParticipantV2: RemoteParticipantV2,
            TrackPrioritySignaling: TrackPrioritySignaling,
            TrackSwitchOffSignaling: TrackSwitchOffSignaling,
            bandwidthProfile: null,
            sessionTimeout: initialState.options.session_timeout * 1000,
            statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
        }, options);
        localParticipant.setBandwidthProfile(options.bandwidthProfile);
        var _a = initialState.options, signalingRegion = _a.signaling_region, _b = _a.audio_processors, audioProcessors = _b === void 0 ? [] : _b;
        localParticipant.setSignalingRegion(signalingRegion);
        if (audioProcessors.includes('krisp')) {
            // Note(mpatwardhan): we add rnnoise as allowed_processor to enable testing our pipeline e2e.
            audioProcessors.push('rnnoise');
        }
        localParticipant.setAudioProcessors(audioProcessors);
        peerConnectionManager.setIceReconnectTimeout(options.sessionTimeout);
        _this = _super.call(this, localParticipant, initialState.sid, initialState.name, options) || this;
        var getTrackReceiver = function (id) { return _this._getTrackReceiver(id); };
        var log = _this._log;
        Object.defineProperties(_this, {
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
                value: new options.DominantSpeakerSignaling(getTrackReceiver, { log: log })
            },
            _networkQualitySignaling: {
                value: new options.NetworkQualitySignaling(getTrackReceiver, localParticipant.networkQualityConfiguration, { log: log })
            },
            _renderHintsSignaling: {
                value: new RenderHintsSignaling(getTrackReceiver, { log: log }),
            },
            _publisherHintsSignaling: {
                value: new PublisherHintsSignaling(getTrackReceiver, { log: log }),
            },
            _trackPrioritySignaling: {
                value: new options.TrackPrioritySignaling(getTrackReceiver, { log: log }),
            },
            _trackSwitchOffSignaling: {
                value: new options.TrackSwitchOffSignaling(getTrackReceiver, { log: log }),
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
        _this._initTrackSwitchOffSignaling();
        _this._initDominantSpeakerSignaling();
        _this._initNetworkQualityMonitorSignaling();
        _this._initPublisherHintSignaling();
        handleLocalParticipantEvents(_this, localParticipant);
        handlePeerConnectionEvents(_this, peerConnectionManager);
        handleTransportEvents(_this, transport);
        periodicallyPublishStats(_this, transport, options.statsPublishIntervalMs);
        _this._update(initialState);
        // NOTE(mpatwardhan) after initial state we know if publisher_hints are enabled or not
        // if they are not enabled. we need to undo simulcast that was enabled with initial offer.
        _this._peerConnectionManager.setEffectiveAdaptiveSimulcast(_this._publisherHintsSignaling.isSetup);
        return _this;
    }
    Object.defineProperty(RoomV2.prototype, "connectionState", {
        /**
         * The PeerConnection state.
         * @property {RTCPeerConnectionState}
         */
        get: function () {
            return this._peerConnectionManager.connectionState;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RoomV2.prototype, "signalingConnectionState", {
        /**
         * The Signaling Connection State.
         * @property {string} - "connected", "reconnecting", "disconnected"
         */
        get: function () {
            return this._transport.state === 'syncing'
                ? 'reconnecting'
                : this._transport.state;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RoomV2.prototype, "iceConnectionState", {
        /**
         * The Ice Connection State.
         * @property {RTCIceConnectionState}
         */
        get: function () {
            return this._peerConnectionManager.iceConnectionState;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * @private
     */
    RoomV2.prototype._deleteTrackReceiverDeferred = function (id) {
        return this._trackReceiverDeferreds.delete(id);
    };
    /**
     * @private
     */
    RoomV2.prototype._getOrCreateTrackReceiverDeferred = function (id) {
        var deferred = this._trackReceiverDeferreds.get(id) || defer();
        var trackReceivers = this._peerConnectionManager.getTrackReceivers();
        // NOTE(mmalavalli): In Firefox, there can be instances where a MediaStreamTrack
        // for the given Track ID already exists, for example, when a Track is removed
        // and added back. If that is the case, then we should resolve 'deferred'.
        var trackReceiver = trackReceivers.find(function (trackReceiver) { return trackReceiver.id === id && trackReceiver.readyState !== 'ended'; });
        if (trackReceiver) {
            deferred.resolve(trackReceiver);
        }
        else {
            // NOTE(mmalavalli): Only add the 'deferred' to the map if it's not
            // resolved. This will prevent old copies of the MediaStreamTrack from
            // being used when the remote peer removes and re-adds a MediaStreamTrack.
            this._trackReceiverDeferreds.set(id, deferred);
        }
        return deferred;
    };
    /**
     * @private
     */
    RoomV2.prototype._addTrackReceiver = function (trackReceiver) {
        var deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver.id);
        deferred.resolve(trackReceiver);
        return this;
    };
    /**
     * @private
     */
    RoomV2.prototype._disconnect = function (error) {
        var didDisconnect = _super.prototype._disconnect.call(this, error);
        if (didDisconnect) {
            this._teardownNetworkQualityMonitor();
            this._transport.disconnect();
            this._peerConnectionManager.close();
        }
        this.localParticipant.tracks.forEach(function (track) {
            track.publishFailed(error || new Error('LocalParticipant disconnected'));
        });
        return didDisconnect;
    };
    /**
     * @private
     */
    RoomV2.prototype._getTrackReceiver = function (id) {
        var _this = this;
        return this._getOrCreateTrackReceiverDeferred(id).promise.then(function (trackReceiver) {
            _this._deleteTrackReceiverDeferred(id);
            return trackReceiver;
        });
    };
    /**
     * @private
     */
    RoomV2.prototype._getInitialTrackSwitchOffState = function (trackSid) {
        var initiallySwitchedOff = this._pendingSwitchOffStates.get(trackSid) || false;
        this._pendingSwitchOffStates.delete(trackSid);
        if (initiallySwitchedOff) {
            this._log.warn("[" + trackSid + "] was initially switched off! ");
        }
        return initiallySwitchedOff;
    };
    /**
     * @private
     */
    RoomV2.prototype._getTrackSidsToTrackSignalings = function () {
        var trackSidsToTrackSignalings = flatMap(this.participants, function (participant) { return Array.from(participant.tracks); });
        return new Map(trackSidsToTrackSignalings);
    };
    /**
     * @private
     */
    RoomV2.prototype._getOrCreateRemoteParticipant = function (participantState) {
        var _this = this;
        var RemoteParticipantV2 = this._RemoteParticipantV2;
        var participant = this.participants.get(participantState.sid);
        var self = this;
        if (!participant) {
            participant = new RemoteParticipantV2(participantState, function (trackSid) { return _this._getInitialTrackSwitchOffState(trackSid); }, function (trackSid, priority) { return _this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority); }, function (trackSid, hint) { return _this._renderHintsSignaling.setTrackHint(trackSid, hint); }, function (trackSid) { return _this._renderHintsSignaling.clearTrackHint(trackSid); });
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
    };
    /**
     * @private
     */
    RoomV2.prototype._getState = function () {
        return {
            participant: this.localParticipant.getState()
        };
    };
    /**
     * @private
     */
    RoomV2.prototype._maybeAddBandwidthProfile = function (update) {
        var _a = this.localParticipant, bandwidthProfile = _a.bandwidthProfile, bandwidthProfileRevision = _a.bandwidthProfileRevision;
        if (bandwidthProfile && this._lastBandwidthProfileRevision < bandwidthProfileRevision) {
            this._lastBandwidthProfileRevision = bandwidthProfileRevision;
            return Object.assign({
                bandwidth_profile: createBandwidthProfilePayload(bandwidthProfile)
            }, update);
        }
        return update;
    };
    /**
     * @private
     */
    RoomV2.prototype._publishNewLocalParticipantState = function () {
        this._transport.publish(this._maybeAddBandwidthProfile(this._getState()));
    };
    /**
     * @private
     */
    RoomV2.prototype._publishPeerConnectionState = function (peerConnectionState) {
        /* eslint camelcase:0 */
        this._transport.publish(Object.assign({
            peer_connections: [peerConnectionState]
        }, this._getState()));
    };
    /**
     * @private
     */
    RoomV2.prototype._update = function (roomState) {
        var _this = this;
        if (roomState.subscribed && roomState.subscribed.revision > this._subscribedRevision) {
            this._subscribedRevision = roomState.subscribed.revision;
            roomState.subscribed.tracks.forEach(function (trackState) {
                if (trackState.id) {
                    _this._subscriptionFailures.delete(trackState.sid);
                    _this._subscribed.set(trackState.sid, trackState.id);
                }
                else if (trackState.error && !_this._subscriptionFailures.has(trackState.sid)) {
                    _this._subscriptionFailures.set(trackState.sid, trackState.error);
                }
            });
            var subscribedTrackSids_1 = new Set(roomState.subscribed.tracks
                .filter(function (trackState) { return !!trackState.id; })
                .map(function (trackState) { return trackState.sid; }));
            this._subscribed.forEach(function (trackId, trackSid) {
                if (!subscribedTrackSids_1.has(trackSid)) {
                    _this._subscribed.delete(trackSid);
                }
            });
        }
        var participantsToKeep = new Set();
        // eslint-disable-next-line no-warning-comments
        // TODO(mroberts): Remove me once the Server is fixed.
        (roomState.participants || []).forEach(function (participantState) {
            if (participantState.sid === _this.localParticipant.sid) {
                return;
            }
            // NOTE(mmalavalli): If the incoming revision for a disconnected Participant is less than or
            // equal to the revision when it was disconnected, then the state is old and can be ignored.
            // Otherwise, the Participant was most likely disconnected in a Large Group Room when it
            // stopped publishing media, and hence needs to be re-added.
            var disconnectedParticipantRevision = _this._disconnectedParticipantRevisions.get(participantState.sid);
            if (disconnectedParticipantRevision && participantState.revision <= disconnectedParticipantRevision) {
                return;
            }
            if (disconnectedParticipantRevision) {
                _this._disconnectedParticipantRevisions.delete(participantState.sid);
            }
            var participant = _this._getOrCreateRemoteParticipant(participantState);
            participant.update(participantState);
            participantsToKeep.add(participant);
        });
        if (roomState.type === 'synced') {
            this.participants.forEach(function (participant) {
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
            roomState.published.tracks.forEach(function (track) {
                if (track.sid) {
                    _this._published.set(track.id, track.sid);
                }
            });
            this.localParticipant.update(roomState.published);
        }
        if (roomState.participant) {
            this.localParticipant.connect(roomState.participant.sid, roomState.participant.identity);
        }
        [
            this._dominantSpeakerSignaling,
            this._networkQualitySignaling,
            this._trackPrioritySignaling,
            this._trackSwitchOffSignaling,
            this._renderHintsSignaling,
            this._publisherHintsSignaling
        ].forEach(function (mediaSignaling) {
            var channel = mediaSignaling.channel;
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
    };
    RoomV2.prototype._initPublisherHintSignaling = function () {
        var _this = this;
        this._publisherHintsSignaling.on('updated', function (hints, id) {
            Promise.all(hints.map(function (hint) {
                return _this.localParticipant.setPublisherHint(hint.track, hint.encodings).then(function (result) {
                    return { track: hint.track, result: result };
                });
            })).then(function (hintResponses) {
                _this._publisherHintsSignaling.sendHintResponse({ id: id, hints: hintResponses });
            });
        });
        var handleReplaced = function (track) {
            if (track.kind === 'video') {
                track.trackTransceiver.on('replaced', function () {
                    _this._publisherHintsSignaling.sendTrackReplaced({ trackSid: track.sid });
                });
            }
        };
        // hook up for any existing and new tracks getting replaced.
        Array.from(this.localParticipant.tracks.values()).forEach(function (track) { return handleReplaced(track); });
        this.localParticipant.on('trackAdded', function (track) { return handleReplaced(track); });
    };
    RoomV2.prototype._initTrackSwitchOffSignaling = function () {
        var _this = this;
        this._trackSwitchOffSignaling.on('updated', function (tracksOff, tracksOn) {
            try {
                _this._log.debug('received trackSwitch: ', { tracksOn: tracksOn, tracksOff: tracksOff });
                var trackUpdates_1 = new Map();
                tracksOn.forEach(function (trackSid) { return trackUpdates_1.set(trackSid, true); });
                tracksOff.forEach(function (trackSid) {
                    if (trackUpdates_1.get(trackSid)) {
                        // NOTE(mpatwardhan): This means that VIDEO-3762 has been reproduced.
                        _this._log.warn(trackSid + " is DUPLICATED in both tracksOff and tracksOn list");
                    }
                    trackUpdates_1.set(trackSid, false);
                });
                _this.participants.forEach(function (participant) {
                    participant.tracks.forEach(function (track) {
                        var isOn = trackUpdates_1.get(track.sid);
                        if (typeof isOn !== 'undefined') {
                            track.setSwitchedOff(!isOn);
                            trackUpdates_1.delete(track.sid);
                        }
                    });
                });
                // NOTE(mpatwardhan): Cache any notification about the tracks that we do not yet know about.
                trackUpdates_1.forEach(function (isOn, trackSid) { return _this._pendingSwitchOffStates.set(trackSid, !isOn); });
            }
            catch (ex) {
                _this._log.error('error processing track switch off:', ex);
            }
        });
    };
    RoomV2.prototype._initDominantSpeakerSignaling = function () {
        var _this = this;
        this._dominantSpeakerSignaling.on('updated', function () { return _this.setDominantSpeaker(_this._dominantSpeakerSignaling.loudestParticipantSid); });
    };
    RoomV2.prototype._initNetworkQualityMonitorSignaling = function () {
        var _this = this;
        this._networkQualitySignaling.on('ready', function () {
            var networkQualityMonitor = new _this._NetworkQualityMonitor(_this._peerConnectionManager, _this._networkQualitySignaling);
            _this._networkQualityMonitor = networkQualityMonitor;
            networkQualityMonitor.on('updated', function () {
                if (_this.iceConnectionState === 'failed') {
                    return;
                }
                _this.localParticipant.setNetworkQualityLevel(networkQualityMonitor.level, networkQualityMonitor.levels);
                _this.participants.forEach(function (participant) {
                    var levels = networkQualityMonitor.remoteLevels.get(participant.sid);
                    if (levels) {
                        participant.setNetworkQualityLevel(levels.level, levels);
                    }
                });
            });
            networkQualityMonitor.start();
        });
        this._networkQualitySignaling.on('teardown', function () { return _this._teardownNetworkQualityMonitor(); });
    };
    RoomV2.prototype._teardownNetworkQualityMonitor = function () {
        if (this._networkQualityMonitor) {
            this._networkQualityMonitor.stop();
            this._networkQualityMonitor = null;
        }
    };
    /**
     * Get the {@link RoomV2}'s media statistics.
     * @returns {Promise.<Map<PeerConnectionV2#id, StandardizedStatsResponse>>}
     */
    RoomV2.prototype.getStats = function () {
        var _this = this;
        return this._peerConnectionManager.getStats().then(function (responses) {
            return new Map(Array.from(responses).map(function (_a) {
                var _b = __read(_a, 2), id = _b[0], response = _b[1];
                return [id, Object.assign({}, response, {
                        localAudioTrackStats: filterAndAddLocalTrackSids(_this, response.localAudioTrackStats),
                        localVideoTrackStats: filterAndAddLocalTrackSids(_this, response.localVideoTrackStats),
                        remoteAudioTrackStats: filterAndAddRemoteTrackSids(_this, response.remoteAudioTrackStats),
                        remoteVideoTrackStats: filterAndAddRemoteTrackSids(_this, response.remoteVideoTrackStats)
                    })];
            }));
        });
    };
    return RoomV2;
}(RoomSignaling));
/**
 * Filter out {@link TrackStats} that aren't in the collection while also
 * stamping their Track SIDs.
 * @param {Map<ID, SID>} idToSid
 * @param {Array<TrackStats>} trackStats
 * @returns {Array<TrackStats>}
 */
function filterAndAddTrackSids(idToSid, trackStats) {
    return trackStats.reduce(function (trackStats, trackStat) {
        var trackSid = idToSid.get(trackStat.trackId);
        return trackSid
            ? [Object.assign({}, trackStat, { trackSid: trackSid })].concat(trackStats)
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
    var idToSid = new Map(Array.from(roomV2._subscribed.entries()).map(function (_a) {
        var _b = __read(_a, 2), sid = _b[0], id = _b[1];
        return [id, sid];
    }));
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
    var localParticipantUpdated = oncePerTick(function () {
        roomV2._publishNewLocalParticipantState();
    });
    var renegotiate = oncePerTick(function () {
        var trackSenders = flatMap(localParticipant.tracks, function (trackV2) { return trackV2.trackTransceiver; });
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
    roomV2.on('signalingConnectionStateChanged', function () {
        var localParticipant = roomV2.localParticipant, signalingConnectionState = roomV2.signalingConnectionState;
        var identity = localParticipant.identity, sid = localParticipant.sid;
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
    peerConnectionManager.on('connectionStateChanged', function () {
        roomV2.emit('connectionStateChanged');
    });
    peerConnectionManager.on('iceConnectionStateChanged', function () {
        roomV2.emit('iceConnectionStateChanged');
        if (roomV2.iceConnectionState === 'failed') {
            if (roomV2.localParticipant.networkQualityLevel !== null) {
                roomV2.localParticipant.setNetworkQualityLevel(0);
            }
            roomV2.participants.forEach(function (participant) {
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
    var movingAverageDeltas = new Map();
    var oddPublishCount = false;
    var interval = setInterval(function () {
        roomV2.getStats().then(function (stats) {
            oddPublishCount = !oddPublishCount;
            stats.forEach(function (response, id) {
                // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
                // event instead of using StandardizedStatsResponse directly because
                // StatsReport will add zeros to properties that do not exist.
                var report = new StatsReport(id, response, true /* prepareForInsights */);
                // NOTE(mmalavalli): Since A/V sync metrics are not part of the StatsReport class,
                // we add them to the insights payload here.
                transport.publishEvent('quality', 'stats-report', 'info', {
                    audioTrackStats: report.remoteAudioTrackStats.map(function (trackStat, i) {
                        return addAVSyncMetricsToRemoteTrackStats(trackStat, response.remoteAudioTrackStats[i], movingAverageDeltas);
                    }),
                    localAudioTrackStats: report.localAudioTrackStats.map(function (trackStat, i) {
                        return addAVSyncMetricsToLocalTrackStats(trackStat, response.localAudioTrackStats[i], movingAverageDeltas);
                    }),
                    localVideoTrackStats: report.localVideoTrackStats.map(function (trackStat, i) {
                        return addAVSyncMetricsToLocalTrackStats(trackStat, response.localVideoTrackStats[i], movingAverageDeltas);
                    }),
                    peerConnectionId: report.peerConnectionId,
                    videoTrackStats: report.remoteVideoTrackStats.map(function (trackStat, i) {
                        return addAVSyncMetricsToRemoteTrackStats(trackStat, response.remoteVideoTrackStats[i], movingAverageDeltas);
                    }),
                });
                // NOTE(mmalavalli): Clean up entries for Tracks that are no longer published or subscribed to.
                var keys = flatMap([
                    'localAudioTrackStats',
                    'localVideoTrackStats',
                    'remoteAudioTrackStats',
                    'remoteVideoTrackStats'
                ], function (prop) { return report[prop].map(function (_a) {
                    var ssrc = _a.ssrc, trackSid = _a.trackSid;
                    return trackSid + "+" + ssrc;
                }); });
                var movingAverageDeltaKeysToBeRemoved = difference(Array.from(movingAverageDeltas.keys()), keys);
                movingAverageDeltaKeysToBeRemoved.forEach(function (key) { return movingAverageDeltas.delete(key); });
                if (oddPublishCount) {
                    // NOTE(mmalavalli): null properties of the "active-ice-candidate-pair"
                    // payload are assigned default values until the Insights gateway
                    // accepts null values.
                    var activeIceCandidatePair = replaceNullsWithDefaults(response.activeIceCandidatePair, report.peerConnectionId);
                    transport.publishEvent('quality', 'active-ice-candidate-pair', 'info', activeIceCandidatePair);
                }
            });
        }, function () {
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
    var trackSidsToTrackSignalings = room._getTrackSidsToTrackSignalings();
    room._subscriptionFailures.forEach(function (error, trackSid) {
        var trackSignaling = trackSidsToTrackSignalings.get(trackSid);
        if (trackSignaling) {
            room._subscriptionFailures.delete(trackSid);
            trackSignaling.subscribeFailed(createTwilioError(error.code, error.message));
        }
    });
    trackSidsToTrackSignalings.forEach(function (trackSignaling) {
        var trackId = room._subscribed.get(trackSignaling.sid);
        if (!trackId || (trackSignaling.isSubscribed && trackSignaling.trackTransceiver.id !== trackId)) {
            trackSignaling.setTrackTransceiver(null);
        }
        if (trackId) {
            room._getTrackReceiver(trackId).then(function (trackReceiver) { return trackSignaling.setTrackTransceiver(trackReceiver); });
        }
    });
}
/**
 * NOTE(mmalavalli): Since A/V sync metrics are not part of the public StatsReport class, we add them
 * only for reporting purposes.
 * @private
 */
function addAVSyncMetricsToLocalTrackStats(trackStats, trackResponse, movingAverageDeltas) {
    var framesEncoded = trackResponse.framesEncoded, packetsSent = trackResponse.packetsSent, totalEncodeTime = trackResponse.totalEncodeTime, totalPacketSendDelay = trackResponse.totalPacketSendDelay;
    var augmentedTrackStats = Object.assign({}, trackStats);
    var key = trackStats.trackSid + "+" + trackStats.ssrc;
    var trackMovingAverageDeltas = movingAverageDeltas.get(key) || new Map();
    if (typeof totalEncodeTime === 'number' && typeof framesEncoded === 'number') {
        var trackAvgEncodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgEncodeDelay')
            || new MovingAverageDelta();
        trackAvgEncodeDelayMovingAverageDelta.putSample(totalEncodeTime * 1000, framesEncoded);
        augmentedTrackStats.avgEncodeDelay = Math.round(trackAvgEncodeDelayMovingAverageDelta.get());
        trackMovingAverageDeltas.set('avgEncodeDelay', trackAvgEncodeDelayMovingAverageDelta);
    }
    if (typeof totalPacketSendDelay === 'number' && typeof packetsSent === 'number') {
        var trackAvgPacketSendDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgPacketSendDelay')
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
    var estimatedPlayoutTimestamp = trackResponse.estimatedPlayoutTimestamp, framesDecoded = trackResponse.framesDecoded, jitterBufferDelay = trackResponse.jitterBufferDelay, jitterBufferEmittedCount = trackResponse.jitterBufferEmittedCount, totalDecodeTime = trackResponse.totalDecodeTime;
    var augmentedTrackStats = Object.assign({}, trackStats);
    var key = trackStats.trackSid + "+" + trackStats.ssrc;
    var trackMovingAverageDeltas = movingAverageDeltas.get(key) || new Map();
    if (typeof estimatedPlayoutTimestamp === 'number') {
        augmentedTrackStats.estimatedPlayoutTimestamp = estimatedPlayoutTimestamp;
    }
    if (typeof framesDecoded === 'number' && typeof totalDecodeTime === 'number') {
        var trackAvgDecodeDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgDecodeDelay')
            || new MovingAverageDelta();
        trackAvgDecodeDelayMovingAverageDelta.putSample(totalDecodeTime * 1000, framesDecoded);
        augmentedTrackStats.avgDecodeDelay = Math.round(trackAvgDecodeDelayMovingAverageDelta.get());
        trackMovingAverageDeltas.set('avgDecodeDelay', trackAvgDecodeDelayMovingAverageDelta);
    }
    if (typeof jitterBufferDelay === 'number' && typeof jitterBufferEmittedCount === 'number') {
        var trackAvgJitterBufferDelayMovingAverageDelta = trackMovingAverageDeltas.get('avgJitterBufferDelay')
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
//# sourceMappingURL=room.js.map