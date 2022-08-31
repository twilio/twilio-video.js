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
var createTwilioError = require('../../util/twilio-video-errors').createTwilioError;
var RoomV2 = require('../v2/room');
var RemoteParticipantV3 = require('../v3/remoteparticipant');
var TrackSubscriptionsSignaling = require('./tracksubscriptionssignaling');
/**
 * @extends RoomV2
 */
var RoomV3 = /** @class */ (function (_super) {
    __extends(RoomV3, _super);
    function RoomV3(localParticipant, initialState, transport, peerConnectionManager, options) {
        var _this = this;
        options = Object.assign({
            RemoteParticipantSignaling: RemoteParticipantV3,
            TrackSubscriptionsSignaling: TrackSubscriptionsSignaling
        }, options);
        _this = _super.call(this, localParticipant, initialState, transport, peerConnectionManager, options) || this;
        return _this;
    }
    /**
     * @private
     * @override
     */
    RoomV3.prototype._addTrackReceiver = function (trackReceiver) {
        var idType = trackReceiver.kind === 'data' ? 'id' : 'mid';
        var deferred = this._getOrCreateTrackReceiverDeferred(trackReceiver[idType], idType);
        deferred.resolve(trackReceiver);
        return this;
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._createRemoteParticipant = function (participantState) {
        var _this = this;
        var RemoteParticipantV3 = this._RemoteParticipantSignaling;
        return new RemoteParticipantV3(participantState, function (trackSid) { return _this._getPendingTrackReceiver(trackSid); }, function (trackSid) { return _this._getInitialTrackSwitchOffState(trackSid); }, function (trackSid, priority) { return _this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority); }, function (trackSid, hint) { return _this._renderHintsSignaling.setTrackHint(trackSid, hint); }, function (trackSid) { return _this._renderHintsSignaling.clearTrackHint(trackSid); }, function (track) { return _this._peerConnectionManager.getRemoteTrackStats(track); });
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._getInitialTrackSwitchOffState = function (trackSid) {
        var switchOffState = this._pendingSwitchOffStates.get(trackSid)
            || { state: 'OFF', switchOffReason: 'DISABLED_BY_SUBSCRIBER' };
        this._pendingSwitchOffStates.delete(trackSid);
        return switchOffState;
    };
    /**
     * @private
     */
    RoomV3.prototype._getPendingTrackReceiver = function (trackSid) {
        var dataChannelLabel = this._pendingDataChannelLabels.get(trackSid);
        var mid = this._pendingTrackMids.get(trackSid);
        var promise = Promise.resolve(null);
        if (dataChannelLabel) {
            this._pendingDataChannelLabels.delete(trackSid);
            promise = this._getTrackReceiver(dataChannelLabel);
        }
        else if (mid) {
            this._pendingTrackMids.delete(trackSid);
            promise = this._getTrackReceiver(mid, 'mid');
        }
        return promise;
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._handleSubscriptions = function () {
        /* Do nothing since RSP v3 messages will not contain the "subscribed" property. */
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._init = function (localParticipant, peerConnectionManager, transport, options, initialState) {
        var _this = this;
        var getTrackReceiver = function (id) { return _this._getTrackReceiver(id); };
        var log = this._log;
        Object.defineProperties(this, {
            _pendingDataChannelLabels: {
                value: new Map()
            },
            _pendingTrackMids: {
                value: new Map()
            },
            _trackSubscriptionsSignaling: {
                value: new options.TrackSubscriptionsSignaling(getTrackReceiver, { log: log })
            }
        });
        this._initTrackSubscriptionsSignaling();
        _super.prototype._init.call(this, localParticipant, peerConnectionManager, transport, options, initialState);
    };
    /**
     * @private
     */
    RoomV3.prototype._initTrackSubscriptionsSignaling = function () {
        var _this = this;
        this._trackSubscriptionsSignaling.on('updated', function (media, data, errors) {
            var trackSidsToTrackSignalings = _this._getTrackSidsToTrackSignalings();
            var dataTrackSidsToTrackStates = new Map(Object.entries(data));
            var mediaTrackSidsToTrackStates = new Map(Object.entries(media));
            var trackSidsToErrors = new Map(Object.entries(errors));
            mediaTrackSidsToTrackStates.forEach(function (_a, sid) {
                var mid = _a.mid, _b = _a.off_reason, switchOffReason = _b === void 0 ? null : _b, state = _a.state;
                var trackSignaling = trackSidsToTrackSignalings.get(sid);
                var trackState = { state: state, switchOffReason: switchOffReason };
                if (!trackSignaling) {
                    _this._pendingSwitchOffStates.set(sid, trackState);
                    _this._pendingTrackMids.set(sid, mid);
                    _this._trackSidsToTrackIds.delete(sid);
                    return;
                }
                var isSwitchedOff = state === 'OFF';
                if (isSwitchedOff || (trackSignaling.trackTransceiver && trackSignaling.trackTransceiver.mid !== mid)) {
                    // NOTE(mmalavalli): If a RemoteTrackPublicationV3's MID changes, then we need to unsubscribe
                    // from the RemoteTrack before subscribing to it again with the MediaTrackReceiver associated with the new
                    // MID. If a RemoteTrackPublicationV3's RemoteTrack is switched off, then we should still be subscribed
                    // to it, even though it no longer has an MID associated with it.
                    trackSignaling.setTrackTransceiver(null, isSwitchedOff);
                    _this._trackSidsToTrackIds.delete(trackSignaling.sid);
                }
                if (!isSwitchedOff) {
                    _this._getTrackReceiver(mid, 'mid').then(function (trackReceiver) {
                        trackSignaling.setTrackTransceiver(trackReceiver, true);
                        _this._trackSidsToTrackIds.set(trackSignaling.sid, trackReceiver.id);
                        // NOTE(mpatwardhan): when track is switched on, send the switchOn message
                        // only after track receiver is set so that application can access (new) mediaStreamTrack
                        trackSignaling.setSwitchedOff(isSwitchedOff, switchOffReason);
                    });
                }
                else {
                    trackSignaling.setSwitchedOff(isSwitchedOff, switchOffReason);
                }
            });
            dataTrackSidsToTrackStates.forEach(function (_a, sid) {
                var label = _a.label;
                var trackSignaling = trackSidsToTrackSignalings.get(sid);
                if (!trackSignaling) {
                    _this._pendingDataChannelLabels.set(sid, label);
                    return;
                }
                _this._getTrackReceiver(label).then(function (trackReceiver) { return trackSignaling.setTrackTransceiver(trackReceiver, true); });
            });
            trackSidsToErrors.forEach(function (_a, sid) {
                var code = _a.code, message = _a.message;
                var trackSignaling = trackSidsToTrackSignalings.get(sid);
                if (trackSignaling) {
                    trackSignaling.subscribeFailed(createTwilioError(code, message));
                }
            });
            trackSidsToTrackSignalings.forEach(function (trackSignaling) {
                var sid = trackSignaling.sid;
                if (!mediaTrackSidsToTrackStates.has(sid) && !dataTrackSidsToTrackStates.has(sid)) {
                    _this._pendingSwitchOffStates.delete(sid);
                    _this._pendingTrackMids.delete(sid);
                    trackSignaling.setTrackTransceiver(null, false);
                    _this._trackSidsToTrackIds.delete(trackSignaling.sid);
                }
            });
            _this._trackSidsToTrackIds.forEach(function (id, sid) {
                if (!mediaTrackSidsToTrackStates.has(sid)) {
                    _this._trackSidsToTrackIds.delete(sid);
                }
            });
        });
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._updateSubscribed = function (roomState) {
        /* Do nothing since RSP v3 messages will not contain the "subscribed" property. */
    };
    /**
     * Get the {@link RoomV3}'s media statistics. Note that the values reported
     * are best-effort approximations based off of the raw WebRTC statistics.
     * @returns {Promise.<Map<PeerConnectionV2#id, StandardizedStatsResponse>>}
     */
    RoomV3.prototype.getStats = function () {
        var _this = this;
        return _super.prototype.getStats.call(this).then(function (responses) {
            var trackSidsToTrackSignalings = _this._getTrackSidsToTrackSignalings();
            var trackSignalings = Array.from(trackSidsToTrackSignalings.values());
            var switchedOffMediaTrackSignalings = trackSignalings.filter(function (_a) {
                var isSubscribed = _a.isSubscribed, isSwitchedOff = _a.isSwitchedOff, kind = _a.kind;
                return kind !== 'data' && isSubscribed && isSwitchedOff;
            });
            var switchedOffMediaTrackSidsToTrackStats = new Map(switchedOffMediaTrackSignalings.map(function (trackSignaling) { return [trackSignaling.sid, trackSignaling.adjustTrackStats()]; }));
            responses.forEach(function (response) {
                var remoteAudioTrackStats = response.remoteAudioTrackStats, remoteVideoTrackStats = response.remoteVideoTrackStats;
                // NOTE(mmalavalli): Adjust stats for switched on RemoteAudioTracks with respect
                // to its associated MediaStreamTrack.
                remoteAudioTrackStats.forEach(function (stats, i) {
                    var trackSignaling = trackSidsToTrackSignalings.get(stats.trackSid);
                    if (trackSignaling) {
                        remoteAudioTrackStats[i] = trackSignaling.adjustTrackStats(stats);
                    }
                });
                // NOTE(mmalavalli): Adjust stats for switched on RemoteVideoTracks with respect
                // to its associated MediaStreamTrack.
                remoteVideoTrackStats.forEach(function (stats, i) {
                    var trackSignaling = trackSidsToTrackSignalings.get(stats.trackSid);
                    if (trackSignaling) {
                        remoteVideoTrackStats[i] = trackSignaling.adjustTrackStats(stats);
                    }
                });
                // NOTE(mmalavalli): Add stats for switched off media RemoteTracks in
                // remoteAudioTrackStats and remoteVideoTrackStats respectively.
                switchedOffMediaTrackSidsToTrackStats.forEach(function (trackStats, trackSid) {
                    var trackSignaling = trackSidsToTrackSignalings.get(trackSid) || {};
                    var trackStatsWithTrackSid = Object.assign({ trackSid: trackSid }, trackStats);
                    if (trackSignaling.kind === 'audio') {
                        remoteAudioTrackStats.push(trackStatsWithTrackSid);
                    }
                    else if (trackSignaling.kind === 'video') {
                        remoteVideoTrackStats.push(trackStatsWithTrackSid);
                    }
                });
            });
            return responses;
        });
    };
    return RoomV3;
}(RoomV2));
module.exports = RoomV3;
//# sourceMappingURL=room.js.map