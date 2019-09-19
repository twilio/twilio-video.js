'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var DominantSpeakerSignaling = require('./dominantspeakersignaling');
var NetworkQualityMonitor = require('./networkqualitymonitor');
var NetworkQualitySignaling = require('./networkqualitysignaling');
var RecordingV2 = require('./recording');
var RoomSignaling = require('../room');
var RemoteParticipantV2 = require('./remoteparticipant');
var StatsReport = require('../../stats/statsreport');
var util = require('../../util');
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;

var STATS_PUBLISH_INTERVAL_MS = 1000;

/**
 * @extends RoomSignaling
 */

var RoomV2 = function (_RoomSignaling) {
  _inherits(RoomV2, _RoomSignaling);

  function RoomV2(localParticipant, initialState, transport, peerConnectionManager, options) {
    _classCallCheck(this, RoomV2);

    options = Object.assign({
      DominantSpeakerSignaling: DominantSpeakerSignaling,
      NetworkQualityMonitor: NetworkQualityMonitor,
      NetworkQualitySignaling: NetworkQualitySignaling,
      RecordingSignaling: RecordingV2,
      RemoteParticipantV2: RemoteParticipantV2,
      statsPublishIntervalMs: STATS_PUBLISH_INTERVAL_MS
    }, options);

    var _this = _possibleConstructorReturn(this, (RoomV2.__proto__ || Object.getPrototypeOf(RoomV2)).call(this, localParticipant, initialState.sid, initialState.name, options));

    Object.defineProperties(_this, {
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

    handleLocalParticipantEvents(_this, localParticipant);
    handlePeerConnectionEvents(_this, peerConnectionManager);
    handleTransportEvents(_this, transport);
    periodicallyPublishStats(_this, transport, options.statsPublishIntervalMs);

    _this._update(initialState);
    return _this;
  }

  /**
   * The Signaling Connection State
   * @property {string} - "connected", "reconnecting", "disconnected"
   */


  _createClass(RoomV2, [{
    key: '_deleteTrackReceiverDeferred',


    /**
     * @private
     */
    value: function _deleteTrackReceiverDeferred(id) {
      return this._trackReceiverDeferreds.delete(id);
    }

    /**
     * @private
     */

  }, {
    key: '_getOrCreateTrackReceiverDeferred',
    value: function _getOrCreateTrackReceiverDeferred(id) {
      var deferred = this._trackReceiverDeferreds.get(id) || util.defer();
      var trackReceivers = this._peerConnectionManager.getTrackReceivers();

      // NOTE(mmalavalli): In Firefox, there can be instances where a MediaStreamTrack
      // for the given Track ID already exists, for example, when a Track is removed
      // and added back. If that is the case, then we should resolve 'deferred'.
      var trackReceiver = trackReceivers.find(function (trackReceiver) {
        return trackReceiver.id === id && trackReceiver.readyState !== 'ended';
      });

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

  }, {
    key: '_addTrackReceiver',
    value: function _addTrackReceiver(trackReceiver) {
      var deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver.id);
      deferred.resolve(trackReceiver);
      return this;
    }

    /**
     * @private
     */

  }, {
    key: '_disconnect',
    value: function _disconnect(error) {
      var didDisconnect = _get(RoomV2.prototype.__proto__ || Object.getPrototypeOf(RoomV2.prototype), '_disconnect', this).call(this, error);
      if (didDisconnect) {
        this._teardownDominantSpeakerSignaling();
        this._teardownNetworkQualityMonitor();
        this._transport.disconnect();
        this._peerConnectionManager.close();
      }

      this.localParticipant.tracks.forEach(function (track) {
        track.publishFailed(error || new Error('LocalParticipant disconnected'));
      });

      return didDisconnect;
    }

    /**
     * @private
     */

  }, {
    key: '_getTrackReceiver',
    value: function _getTrackReceiver(id) {
      var _this2 = this;

      return this._getOrCreateTrackReceiverDeferred(id).promise.then(function (trackReceiver) {
        _this2._deleteTrackReceiverDeferred(id);
        return trackReceiver;
      });
    }

    /**
     * @private
     */

  }, {
    key: '_getOrCreateRemoteParticipant',
    value: function _getOrCreateRemoteParticipant(participantState) {
      var RemoteParticipantV2 = this._RemoteParticipantV2;
      var participant = this.participants.get(participantState.sid);
      var self = this;
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

  }, {
    key: '_getState',
    value: function _getState() {
      return {
        participant: this.localParticipant.getState()
      };
    }

    /**
     * @private
     */

  }, {
    key: '_publishNewLocalParticipantState',
    value: function _publishNewLocalParticipantState() {
      this._transport.publish(this._getState());
    }

    /**
     * @private
     */

  }, {
    key: '_publishPeerConnectionState',
    value: function _publishPeerConnectionState(peerConnectionState) {
      /* eslint camelcase:0 */
      this._transport.publish(Object.assign({
        peer_connections: [peerConnectionState]
      }, this._getState()));
    }

    /**
     * @private
     */

  }, {
    key: '_update',
    value: function _update(roomState) {
      var _this3 = this;

      var participantsToKeep = new Set();

      if (roomState.subscribed && roomState.subscribed.revision > this._subscribedRevision) {
        this._subscribedRevision = roomState.subscribed.revision;
        roomState.subscribed.tracks.forEach(function (trackState) {
          if (trackState.id) {
            this._subscriptionFailures.delete(trackState.sid);
            this._subscribed.set(trackState.sid, trackState.id);
          } else if (trackState.error && !this._subscriptionFailures.has(trackState.sid)) {
            this._subscriptionFailures.set(trackState.sid, trackState.error);
          }
        }, this);

        var subscribedTrackSids = new Set(roomState.subscribed.tracks.filter(function (trackState) {
          return !!trackState.id;
        }).map(function (trackState) {
          return trackState.sid;
        }));

        this._subscribed.forEach(function (trackId, trackSid) {
          if (!subscribedTrackSids.has(trackSid)) {
            _this3._subscribed.delete(trackSid);
          }
        });
      }

      // TODO(mroberts): Remove me once the Server is fixed.
      (roomState.participants || []).forEach(function (participantState) {
        if (participantState.sid === _this3.localParticipant.sid || _this3._disconnectedParticipantSids.has(participantState.sid)) {
          return;
        }
        var participant = _this3._getOrCreateRemoteParticipant(participantState);
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
        roomState.published.tracks.forEach(function (track) {
          if (track.sid) {
            this._published.set(track.id, track.sid);
          }
        }, this);
        this.localParticipant.update(roomState.published);
      }

      if (roomState.participant) {
        this.localParticipant.connect(roomState.participant.sid, roomState.participant.identity);
      }

      if (!this._dominantSpeakerSignalingPromise && roomState.media_signaling && roomState.media_signaling.active_speaker && roomState.media_signaling.active_speaker.transport && roomState.media_signaling.active_speaker.transport.type === 'data-channel') {
        this._setupDataTransportBackedDominantSpeakerSignaling(roomState.media_signaling.active_speaker.transport.label);
      }

      if (!this._networkQualityMonitorPromise && roomState.media_signaling && roomState.media_signaling.network_quality && roomState.media_signaling.network_quality.transport && roomState.media_signaling.network_quality.transport.type === 'data-channel') {
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

  }, {
    key: '_setupDataTransportBackedDominantSpeakerSignaling',
    value: function _setupDataTransportBackedDominantSpeakerSignaling(id) {
      var _this4 = this;

      this._teardownDominantSpeakerSignaling();
      var dominantSpeakerSignalingPromise = this._getTrackReceiver(id).then(function (receiver) {
        if (receiver.kind !== 'data') {
          throw new Error('Expected a DataTrackReceiver');
        }if (_this4._dominantSpeakerSignalingPromise !== dominantSpeakerSignalingPromise) {
          // NOTE(mroberts): _teardownDominantSpeakerSignaling was called.
          return;
        }

        // NOTE(mpatwardhan): The underlying RTCDataChannel is closed whenever
        // the VMS instance fails over, and a new RTCDataChannel is created in order
        // to resume sending Dominant Speaker updates.
        receiver.once('close', function () {
          return _this4._teardownDominantSpeakerSignaling();
        });

        var dominantSpeakerSignaling = new _this4._DominantSpeakerSignaling(receiver.toDataTransport());
        _this4._setDominantSpeakerSignaling(dominantSpeakerSignaling);
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

  }, {
    key: '_setupDataTransportBackedNetworkQualityMonitor',
    value: function _setupDataTransportBackedNetworkQualityMonitor(id) {
      var _this5 = this;

      var self = this;
      this._teardownNetworkQualityMonitor();
      var networkQualityMonitorPromise = this._getTrackReceiver(id).then(function (receiver) {
        if (receiver.kind !== 'data') {
          throw new Error('Expected a DataTrackReceiver');
        }if (_this5._networkQualityMonitorPromise !== networkQualityMonitorPromise) {
          // NOTE(mroberts): _teardownNetworkQualityMonitor was called.
          return;
        }

        // NOTE(mpatwardhan): The underlying RTCDataChannel is closed whenever
        // the VMS instance fails over, and new a RTCDataChannel is created in order
        // to resume exchanging Network Quality messages.
        receiver.once('close', function () {
          return _this5._teardownNetworkQualityMonitor();
        });

        var networkQualitySignaling = new _this5._NetworkQualitySignaling(receiver.toDataTransport(), self._networkQualityConfiguration);
        var networkQualityMonitor = new _this5._NetworkQualityMonitor(_this5._peerConnectionManager, networkQualitySignaling);
        _this5._setNetworkQualityMonitor(networkQualityMonitor);
      });
      this._networkQualityMonitorPromise = networkQualityMonitorPromise;
    }
  }, {
    key: '_setDominantSpeakerSignaling',
    value: function _setDominantSpeakerSignaling(dominantSpeakerSignaling) {
      var _this6 = this;

      this._dominantSpeakerSignaling = dominantSpeakerSignaling;
      dominantSpeakerSignaling.on('updated', function () {
        return _this6.setDominantSpeaker(dominantSpeakerSignaling.loudestParticipantSid);
      });
    }
  }, {
    key: '_setNetworkQualityMonitor',
    value: function _setNetworkQualityMonitor(networkQualityMonitor) {
      var _this7 = this;

      this._networkQualityMonitor = networkQualityMonitor;
      networkQualityMonitor.on('updated', function () {
        if (_this7.mediaConnectionState === 'failed') {
          return;
        }
        _this7.localParticipant.setNetworkQualityLevel(networkQualityMonitor.level, networkQualityMonitor.levels);
        _this7.participants.forEach(function (participant) {
          var levels = networkQualityMonitor.remoteLevels.get(participant.sid);
          if (levels) {
            participant.setNetworkQualityLevel(levels.level, levels);
          }
        });
      });
      networkQualityMonitor.start();
    }
  }, {
    key: '_teardownDominantSpeakerSignaling',
    value: function _teardownDominantSpeakerSignaling() {
      this._dominantSpeakerSignalingPromise = null;
      this._dominantSpeakerSignaling = null;
    }
  }, {
    key: '_teardownNetworkQualityMonitor',
    value: function _teardownNetworkQualityMonitor() {
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

  }, {
    key: 'getStats',
    value: function getStats() {
      var _this8 = this;

      return this._peerConnectionManager.getStats().then(function (responses) {
        return new Map(Array.from(responses).map(function (_ref) {
          var _ref2 = _slicedToArray(_ref, 2),
              id = _ref2[0],
              response = _ref2[1];

          return [id, Object.assign({}, response, {
            localAudioTrackStats: filterAndAddLocalTrackSids(_this8, response.localAudioTrackStats),
            localVideoTrackStats: filterAndAddLocalTrackSids(_this8, response.localVideoTrackStats),
            remoteAudioTrackStats: filterAndAddRemoteTrackSids(_this8, response.remoteAudioTrackStats),
            remoteVideoTrackStats: filterAndAddRemoteTrackSids(_this8, response.remoteVideoTrackStats)
          })];
        }));
      });
    }
  }, {
    key: 'signalingConnectionState',
    get: function get() {
      return this._transport.state === 'syncing' ? 'reconnecting' : this._transport.state;
    }

    /**
     * The Media Connection State
     * @property {RTCIceConnectionState}
     */

  }, {
    key: 'mediaConnectionState',
    get: function get() {
      return this._peerConnectionManager.iceConnectionState;
    }
  }]);

  return RoomV2;
}(RoomSignaling);

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
    return trackSid ? [Object.assign({}, trackStat, { trackSid: trackSid })].concat(trackStats) : trackStats;
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
  var idToSid = new Map(Array.from(roomV2._subscribed.entries()).map(function (_ref3) {
    var _ref4 = _slicedToArray(_ref3, 2),
        sid = _ref4[0],
        id = _ref4[1];

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
  var renegotiate = util.oncePerTick(function () {
    var trackSenders = util.flatMap(localParticipant.tracks, function (trackV2) {
      return trackV2.trackTransceiver;
    });
    roomV2._peerConnectionManager.setTrackSenders(trackSenders);
  });

  var localParticipantUpdated = util.oncePerTick(function () {
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

  peerConnectionManager.on('iceConnectionStateChanged', function () {
    roomV2.emit('mediaConnectionStateChanged');
    if (roomV2.mediaConnectionState === 'failed') {
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
  var interval = setInterval(function () {
    roomV2.getStats().then(function (stats) {
      stats.forEach(function (response, id) {
        // NOTE(mmalavalli): A StatsReport is used to publish a "stats-report"
        // event instead of using StandardizedStatsResponse directly because
        // StatsReport will add nulls to properties that do not exist.
        var report = new StatsReport(id, response);

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
        var activeIceCandidatePair = replaceNullsWithDefaults(response.activeIceCandidatePair, report.peerConnectionId);

        transport.publishEvent('quality', 'active-ice-candidate-pair', activeIceCandidatePair);
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
  var trackSignalings = new Map(util.flatMap(room.participants, function (participant) {
    return Array.from(participant.tracks.values()).map(function (track) {
      return [track.sid, track];
    });
  }));

  room._subscriptionFailures.forEach(function (error, trackSid) {
    var trackSignaling = trackSignalings.get(trackSid);
    if (trackSignaling) {
      room._subscriptionFailures.delete(trackSid);
      trackSignaling.subscribeFailed(createTwilioError(error.code, error.message));
    }
  });

  trackSignalings.forEach(function (trackSignaling) {
    var trackId = room._subscribed.get(trackSignaling.sid);
    if (!trackId || trackSignaling.isSubscribed && trackSignaling.trackTransceiver.id !== trackId) {
      trackSignaling.setTrackTransceiver(null);
    }
    if (trackId) {
      room._getTrackReceiver(trackId).then(function (trackReceiver) {
        return trackSignaling.setTrackTransceiver(trackReceiver);
      });
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