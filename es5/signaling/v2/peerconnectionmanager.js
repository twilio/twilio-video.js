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
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var guessBrowser = require('../../webrtc/util').guessBrowser;
var PeerConnectionV2 = require('./peerconnection');
var MediaTrackSender = require('../../media/track/sender');
var QueueingEventEmitter = require('../../queueingeventemitter');
var util = require('../../util');
var MediaConnectionError = require('../../util/twilio-video-errors').MediaConnectionError;
var isFirefox = guessBrowser() === 'firefox';
/**
 * {@link PeerConnectionManager} manages multiple {@link PeerConnectionV2}s.
 * @extends QueueingEventEmitter
 * @emits PeerConnectionManager#candidates
 * @emits PeerConnectionManager#connectionStateChanged
 * @emits PeerConnectionManager#description
 * @emits PeerConnectionManager#iceConnectionStateChanged
 * @emits PeerConnectionManager#trackAdded
 */
var PeerConnectionManager = /** @class */ (function (_super) {
    __extends(PeerConnectionManager, _super);
    /**
     * Construct {@link PeerConnectionManager}.
     * @param {EncodingParametersImpl} encodingParameters
     * @param {PreferredCodecs} preferredCodecs
     * @param {object} options
     */
    function PeerConnectionManager(encodingParameters, preferredCodecs, options) {
        var _this = _super.call(this) || this;
        options = Object.assign({
            audioContextFactory: isFirefox
                ? require('../../webaudio/audiocontext')
                : null,
            PeerConnectionV2: PeerConnectionV2
        }, options);
        var audioContext = options.audioContextFactory
            ? options.audioContextFactory.getOrCreate(_this)
            : null;
        // NOTE(mroberts): If we're using an AudioContext, we don't need to specify
        // `offerToReceiveAudio` in RTCOfferOptions.
        var offerOptions = audioContext
            ? { offerToReceiveVideo: true }
            : { offerToReceiveAudio: true, offerToReceiveVideo: true };
        Object.defineProperties(_this, {
            _audioContextFactory: {
                value: options.audioContextFactory
            },
            _closedPeerConnectionIds: {
                value: new Set()
            },
            _configuration: {
                writable: true,
                value: null
            },
            _configurationDeferred: {
                writable: true,
                value: util.defer()
            },
            _connectionState: {
                value: 'new',
                writable: true
            },
            _dummyAudioTrackSender: {
                value: audioContext
                    ? new MediaTrackSender(createDummyAudioMediaStreamTrack(audioContext))
                    : null
            },
            _encodingParameters: {
                value: encodingParameters
            },
            _iceConnectionState: {
                writable: true,
                value: 'new'
            },
            _dataTrackSenders: {
                writable: true,
                value: new Set()
            },
            _lastConnectionState: {
                value: 'new',
                writable: true
            },
            _lastIceConnectionState: {
                writable: true,
                value: 'new'
            },
            _mediaTrackSenders: {
                writable: true,
                value: new Set()
            },
            _offerOptions: {
                value: offerOptions
            },
            _peerConnections: {
                value: new Map()
            },
            _preferredCodecs: {
                value: preferredCodecs
            },
            _sessionTimeout: {
                value: null,
                writable: true
            },
            _PeerConnectionV2: {
                value: options.PeerConnectionV2
            }
        });
        return _this;
    }
    PeerConnectionManager.prototype.setEffectiveAdaptiveSimulcast = function (effectiveAdaptiveSimulcast) {
        this._peerConnections.forEach(function (pc) { return pc.setEffectiveAdaptiveSimulcast(effectiveAdaptiveSimulcast); });
        this._preferredCodecs.video.forEach(function (cs) {
            if ('adaptiveSimulcast' in cs) {
                cs.adaptiveSimulcast = effectiveAdaptiveSimulcast;
            }
        });
    };
    Object.defineProperty(PeerConnectionManager.prototype, "connectionState", {
        /**
         * A summarized RTCPeerConnectionState across all the
         * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
         * @property {RTCPeerConnectionState}
         */
        get: function () {
            return this._connectionState;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PeerConnectionManager.prototype, "iceConnectionState", {
        /**
         * A summarized RTCIceConnectionState across all the
         * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
         * @property {RTCIceConnectionState}
         */
        get: function () {
            return this._iceConnectionState;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Close the {@link PeerConnectionV2}s which are no longer relevant.
     * @param {Array<object>} peerConnectionStates
     * @returns {this}
     */
    PeerConnectionManager.prototype._closeAbsentPeerConnections = function (peerConnectionStates) {
        var peerConnectionIds = new Set(peerConnectionStates.map(function (peerConnectionState) { return peerConnectionState.id; }));
        this._peerConnections.forEach(function (peerConnection) {
            if (!peerConnectionIds.has(peerConnection.id)) {
                peerConnection._close();
            }
        });
        return this;
    };
    /**
     * Get the {@link PeerConnectionManager}'s configuration.
     * @private
     * @returns {Promise<object>}
     */
    PeerConnectionManager.prototype._getConfiguration = function () {
        return this._configurationDeferred.promise;
    };
    /**
     * Get or create a {@link PeerConnectionV2}.
     * @private
     * @param {string} id
     * @param {object} [configuration]
     * @returns {PeerConnectionV2}
     */
    PeerConnectionManager.prototype._getOrCreate = function (id, configuration) {
        var _this = this;
        var self = this;
        var peerConnection = this._peerConnections.get(id);
        if (!peerConnection) {
            var PeerConnectionV2_1 = this._PeerConnectionV2;
            var options = Object.assign({
                dummyAudioMediaStreamTrack: this._dummyAudioTrackSender
                    ? this._dummyAudioTrackSender.track
                    : null,
                offerOptions: this._offerOptions
            }, this._sessionTimeout ? {
                sessionTimeout: this._sessionTimeout
            } : {}, configuration);
            try {
                peerConnection = new PeerConnectionV2_1(id, this._encodingParameters, this._preferredCodecs, options);
            }
            catch (e) {
                throw new MediaConnectionError();
            }
            this._peerConnections.set(peerConnection.id, peerConnection);
            peerConnection.on('candidates', this.queue.bind(this, 'candidates'));
            peerConnection.on('description', this.queue.bind(this, 'description'));
            peerConnection.on('trackAdded', this.queue.bind(this, 'trackAdded'));
            peerConnection.on('stateChanged', function stateChanged(state) {
                if (state === 'closed') {
                    peerConnection.removeListener('stateChanged', stateChanged);
                    self._dataTrackSenders.forEach(function (sender) { return peerConnection.removeDataTrackSender(sender); });
                    self._mediaTrackSenders.forEach(function (sender) { return peerConnection.removeMediaTrackSender(sender); });
                    self._peerConnections.delete(peerConnection.id);
                    self._closedPeerConnectionIds.add(peerConnection.id);
                    updateConnectionState(self);
                    updateIceConnectionState(self);
                }
            });
            peerConnection.on('connectionStateChanged', function () { return updateConnectionState(_this); });
            peerConnection.on('iceConnectionStateChanged', function () { return updateIceConnectionState(_this); });
            this._dataTrackSenders.forEach(peerConnection.addDataTrackSender, peerConnection);
            this._mediaTrackSenders.forEach(peerConnection.addMediaTrackSender, peerConnection);
            updateIceConnectionState(this);
        }
        return peerConnection;
    };
    /**
     * Close all the {@link PeerConnectionV2}s in this {@link PeerConnectionManager}.
     * @returns {this}
     */
    PeerConnectionManager.prototype.close = function () {
        this._peerConnections.forEach(function (peerConnection) {
            peerConnection.close();
        });
        if (this._dummyAudioTrackSender) {
            this._dummyAudioTrackSender.stop();
        }
        if (this._audioContextFactory) {
            this._audioContextFactory.release(this);
        }
        updateIceConnectionState(this);
        return this;
    };
    /**
     * Create a new {@link PeerConnectionV2} on this {@link PeerConnectionManager}.
     * Then, create a new offer with the newly-created {@link PeerConnectionV2}.
     * @return {Promise<this>}
     */
    PeerConnectionManager.prototype.createAndOffer = function () {
        var _this = this;
        return this._getConfiguration().then(function (configuration) {
            var id;
            do {
                id = util.makeUUID();
            } while (_this._peerConnections.has(id));
            return _this._getOrCreate(id, configuration);
        }).then(function (peerConnection) {
            return peerConnection.offer();
        }).then(function () {
            return _this;
        });
    };
    /**
     * Get the {@link DataTrackReceiver}s and {@link MediaTrackReceiver}s of all
     * the {@link PeerConnectionV2}s.
     * @returns {Array<DataTrackReceiver|MediaTrackReceiver>} trackReceivers
     */
    PeerConnectionManager.prototype.getTrackReceivers = function () {
        return util.flatMap(this._peerConnections, function (peerConnection) { return peerConnection.getTrackReceivers(); });
    };
    /**
     * Get the states of all {@link PeerConnectionV2}s.
     * @returns {Array<object>}
     */
    PeerConnectionManager.prototype.getStates = function () {
        var peerConnectionStates = [];
        this._peerConnections.forEach(function (peerConnection) {
            var peerConnectionState = peerConnection.getState();
            if (peerConnectionState) {
                peerConnectionStates.push(peerConnectionState);
            }
        });
        return peerConnectionStates;
    };
    /**
     * Set the {@link PeerConnectionManager}'s configuration.
     * @param {object} configuration
     * @returns {this}
     */
    PeerConnectionManager.prototype.setConfiguration = function (configuration) {
        if (this._configuration) {
            this._configurationDeferred = util.defer();
            this._peerConnections.forEach(function (peerConnection) {
                peerConnection.setConfiguration(configuration);
            });
        }
        this._configuration = configuration;
        this._configurationDeferred.resolve(configuration);
        return this;
    };
    /**
     * Set the ICE reconnect timeout period for all {@link PeerConnectionV2}s.
     * @param {number} period - Period in milliseconds.
     * @returns {this}
     */
    PeerConnectionManager.prototype.setIceReconnectTimeout = function (period) {
        if (this._sessionTimeout === null) {
            this._peerConnections.forEach(function (peerConnection) {
                peerConnection.setIceReconnectTimeout(period);
            });
            this._sessionTimeout = period;
        }
        return this;
    };
    /**
     * Set the {@link DataTrackSender}s and {@link MediaTrackSender}s on the
     * {@link PeerConnectionManager}'s underlying {@link PeerConnectionV2}s.
     * @param {Array<DataTrackSender|MediaTrackSender>} trackSenders
     * @returns {this}
     */
    PeerConnectionManager.prototype.setTrackSenders = function (trackSenders) {
        var dataTrackSenders = new Set(trackSenders.filter(function (trackSender) { return trackSender.kind === 'data'; }));
        var mediaTrackSenders = new Set(trackSenders
            .filter(function (trackSender) { return trackSender && (trackSender.kind === 'audio' || trackSender.kind === 'video'); }));
        var changes = getTrackSenderChanges(this, dataTrackSenders, mediaTrackSenders);
        this._dataTrackSenders = dataTrackSenders;
        this._mediaTrackSenders = mediaTrackSenders;
        applyTrackSenderChanges(this, changes);
        return this;
    };
    /**
     * Update the {@link PeerConnectionManager}.
     * @param {Array<object>} peerConnectionStates
     * @param {boolean} [synced=false]
     * @returns {Promise<this>}
     */
    PeerConnectionManager.prototype.update = function (peerConnectionStates, synced) {
        var _this = this;
        if (synced === void 0) { synced = false; }
        if (synced) {
            this._closeAbsentPeerConnections(peerConnectionStates);
        }
        return this._getConfiguration().then(function (configuration) {
            return Promise.all(peerConnectionStates.map(function (peerConnectionState) {
                if (_this._closedPeerConnectionIds.has(peerConnectionState.id)) {
                    return null;
                }
                var peerConnection = _this._getOrCreate(peerConnectionState.id, configuration);
                return peerConnection.update(peerConnectionState);
            }));
        }).then(function () {
            return _this;
        });
    };
    /**
     * Get the {@link PeerConnectionManager}'s media statistics.
     * @returns {Promise.<Map<PeerConnectionV2#id, StandardizedStatsResponse>>}
     */
    PeerConnectionManager.prototype.getStats = function () {
        var peerConnections = Array.from(this._peerConnections.values());
        return Promise.all(peerConnections.map(function (peerConnection) { return peerConnection.getStats().then(function (response) { return [
            peerConnection.id,
            response
        ]; }); })).then(function (responses) { return new Map(responses); });
    };
    return PeerConnectionManager;
}(QueueingEventEmitter));
/**
 * Create a dummy audio MediaStreamTrack with the given AudioContext.
 * @private
 * @param {AudioContext} audioContext
 * @return {MediaStreamTrack}
 */
function createDummyAudioMediaStreamTrack(audioContext) {
    var mediaStreamDestination = audioContext.createMediaStreamDestination();
    return mediaStreamDestination.stream.getAudioTracks()[0];
}
/**
 * @event {PeerConnectionManager#candidates}
 * @param {object} candidates
 */
/**
 * @event {PeerConnectionManager#connectionStateChanged}
 */
/**
 * @event {PeerConnectionManager#description}
 * @param {object} description
 */
/**
 * @event {PeerConnectionManager#iceConnectionStateChanged}
 */
/**
 * @event {PeerConnectionManager#trackAdded}
 * @param {MediaStreamTrack|DataTrackReceiver} mediaStreamTrackOrDataTrackReceiver
 */
/**
 * Apply {@link TrackSenderChanges}.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {TrackSenderChanges} changes
 * @returns {void}
 */
function applyTrackSenderChanges(peerConnectionManager, changes) {
    if (changes.data.add.size
        || changes.data.remove.size
        || changes.media.add.size
        || changes.media.remove.size) {
        peerConnectionManager._peerConnections.forEach(function (peerConnection) {
            changes.data.remove.forEach(peerConnection.removeDataTrackSender, peerConnection);
            changes.media.remove.forEach(peerConnection.removeMediaTrackSender, peerConnection);
            changes.data.add.forEach(peerConnection.addDataTrackSender, peerConnection);
            changes.media.add.forEach(peerConnection.addMediaTrackSender, peerConnection);
            if (changes.media.add.size
                || changes.media.remove.size
                || (changes.data.add.size && !peerConnection.isApplicationSectionNegotiated)) {
                peerConnection.offer();
            }
        });
    }
}
/**
 * @interface DataTrackSenderChanges
 * @property {Set<DataTrackSender>} add
 * @property {Set<DataTrackSender>} remove
 */
/**
 * Get the {@Link DataTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @returns {DataTrackSenderChanges} changes
 */
function getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders) {
    var dataTrackSendersToAdd = util.difference(dataTrackSenders, peerConnectionManager._dataTrackSenders);
    var dataTrackSendersToRemove = util.difference(peerConnectionManager._dataTrackSenders, dataTrackSenders);
    return {
        add: dataTrackSendersToAdd,
        remove: dataTrackSendersToRemove
    };
}
/**
 * @interface TrackSenderChanges
 * @property {DataTrackSenderChanges} data
 * @property {MediaTrackSenderChanges} media
 */
/**
 * Get {@link DataTrackSender} and {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<DataTrackSender>} dataTrackSenders
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {TrackSenderChanges} changes
 */
function getTrackSenderChanges(peerConnectionManager, dataTrackSenders, mediaTrackSenders) {
    return {
        data: getDataTrackSenderChanges(peerConnectionManager, dataTrackSenders),
        media: getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders)
    };
}
/**
 * @interface MediaTrackSenderChanges
 * @property {Set<MediaTrackSender>} add
 * @property {Set<MediaTrackSender>} remove
 */
/**
 * Get the {@link MediaTrackSender} changes.
 * @param {PeerConnectionManager} peerConnectionManager
 * @param {Array<MediaTrackSender>} mediaTrackSenders
 * @returns {MediaTrackSenderChanges} changes
 */
function getMediaTrackSenderChanges(peerConnectionManager, mediaTrackSenders) {
    var mediaTrackSendersToAdd = util.difference(mediaTrackSenders, peerConnectionManager._mediaTrackSenders);
    var mediaTrackSendersToRemove = util.difference(peerConnectionManager._mediaTrackSenders, mediaTrackSenders);
    return {
        add: mediaTrackSendersToAdd,
        remove: mediaTrackSendersToRemove
    };
}
/**
 * This object maps RTCIceConnectionState and RTCPeerConnectionState values to a "rank".
 */
var toRank = {
    new: 0,
    checking: 1,
    connecting: 2,
    connected: 3,
    completed: 4,
    disconnected: -1,
    failed: -2,
    closed: -3
};
/**
 * This object maps "rank" back to RTCIceConnectionState or RTCPeerConnectionState values.
 */
var fromRank;
/**
 * `Object.keys` is not supported in older browsers, so we can't just
 * synchronously call it in this module; we need to defer invoking it until we
 * know we're in a modern environment (i.e., anything that supports WebRTC).
 * @returns {object} fromRank
 */
function createFromRank() {
    return Object.keys(toRank).reduce(function (fromRank, state) {
        var _a;
        return Object.assign(fromRank, (_a = {}, _a[toRank[state]] = state, _a));
    }, {});
}
/**
 * Summarize RTCIceConnectionStates or RTCPeerConnectionStates.
 * @param {Array<RTCIceConnectionState>|Array<RTCPeerConnectionState>} states
 * @returns {RTCIceConnectionState|RTCPeerConnectionState} summary
 */
function summarizeIceOrPeerConnectionStates(states) {
    if (!states.length) {
        return 'new';
    }
    fromRank = fromRank || createFromRank();
    return states.reduce(function (state1, state2) {
        return fromRank[Math.max(toRank[state1], toRank[state2])];
    });
}
/**
 * Update the {@link PeerConnectionManager}'s `iceConnectionState`, and emit an
 * "iceConnectionStateChanged" event, if necessary.
 * @param {PeerConnectionManager} pcm
 * @returns {void}
 */
function updateIceConnectionState(pcm) {
    pcm._lastIceConnectionState = pcm.iceConnectionState;
    pcm._iceConnectionState = summarizeIceOrPeerConnectionStates(__spreadArray([], __read(pcm._peerConnections.values())).map(function (pcv2) { return pcv2.iceConnectionState; }));
    if (pcm.iceConnectionState !== pcm._lastIceConnectionState) {
        pcm.emit('iceConnectionStateChanged');
    }
}
/**
 * Update the {@link PeerConnectionManager}'s `connectionState`, and emit a
 * "connectionStateChanged" event, if necessary.
 * @param {PeerConnectionManager} pcm
 * @returns {void}
 */
function updateConnectionState(pcm) {
    pcm._lastConnectionState = pcm.connectionState;
    pcm._connectionState = summarizeIceOrPeerConnectionStates(__spreadArray([], __read(pcm._peerConnections.values())).map(function (pcv2) { return pcv2.connectionState; }));
    if (pcm.connectionState !== pcm._lastConnectionState) {
        pcm.emit('connectionStateChanged');
    }
}
module.exports = PeerConnectionManager;
//# sourceMappingURL=peerconnectionmanager.js.map