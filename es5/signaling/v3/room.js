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
        Object.defineProperties(_this, {
            _pendingDataChannelLabels: {
                value: new Map()
            },
            _pendingTrackMids: {
                value: new Map()
            }
        });
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
        return new RemoteParticipantV3(participantState, function (trackSid) { return _this._getPendingTrackReceiver(trackSid); }, function (trackSid) { return _this._getInitialTrackSwitchOffState(trackSid); }, function (trackSid, priority) { return _this._trackPrioritySignaling.sendTrackPriorityUpdate(trackSid, 'subscribe', priority); }, function (trackSid, hint) { return _this._renderHintsSignaling.setTrackHint(trackSid, hint); }, function (trackSid) { return _this._renderHintsSignaling.clearTrackHint(trackSid); });
    };
    /**
     * @private
     * @override
     */
    RoomV3.prototype._getInitialTrackSwitchOffState = function (trackSid) {
        var switchOffState = this._pendingSwitchOffStates.get(trackSid)
            || { state: 'OFF', switchOffReason: 'DISABLED_BY_SUBSCRIBER' };
        this._pendingSwitchOffStates.delete(trackSid);
        if (switchOffState.state === 'OFF') {
            this._log.warn("[" + trackSid + "] was initially switched off! ");
        }
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
     */
    RoomV3.prototype._initTrackSubscriptionsSignaling = function () {
        var _this = this;
        this._trackSubscriptionsSignaling.on('updated', function (media, data, errors) {
            var trackSidsToTrackSignalings = _this._getTrackSidsToTrackSignalings();
            var dataTrackSidsToDataChannelLabels = new Map(Object.entries(data));
            var mediaTrackSidsToTrackStates = new Map(Object.entries(media));
            var trackSidsToErrors = new Map(Object.entries(errors));
            mediaTrackSidsToTrackStates.forEach(function (_a, sid) {
                var mid = _a.mid, _b = _a.off_reason, switchOffReason = _b === void 0 ? null : _b, state = _a.state;
                var trackSignaling = trackSidsToTrackSignalings.get(sid);
                var trackState = { state: state, switchOffReason: switchOffReason };
                if (!trackSignaling) {
                    _this._pendingSwitchOffStates.set(sid, trackState);
                    _this._pendingTrackMids.set(sid, mid);
                    return;
                }
                var isSwitchedOff = state === 'OFF';
                if (isSwitchedOff || (trackSignaling.trackTransceiver && trackSignaling.trackTransceiver.mid !== mid)) {
                    // NOTE(mmalavalli): If a RemoteTrackPublicationV3's MID changes, then we need to unsubscribe
                    // from the RemoteTrack before subscribing to it again with the MediaTrackReceiver associated with the new
                    // MID. If a RemoteTrackPublicationV3's RemoteTrack is switched off, then we should still be subscribed
                    // to it, even though it no longer has an MID associated with it.
                    trackSignaling.setTrackTransceiver(null, isSwitchedOff);
                }
                if (!isSwitchedOff) {
                    _this._getTrackReceiver(mid, 'mid').then(function (trackReceiver) { return trackSignaling.setTrackTransceiver(trackReceiver, true); });
                }
                trackSignaling.setSwitchedOff(isSwitchedOff);
            });
            dataTrackSidsToDataChannelLabels.forEach(function (dataChannelLabel, sid) {
                var trackSignaling = trackSidsToTrackSignalings.get(sid);
                if (!trackSignaling) {
                    _this._pendingDataChannelLabels.set(sid, dataChannelLabel);
                    return;
                }
                _this._getTrackReceiver(dataChannelLabel).then(function (trackReceiver) { return trackSignaling.setTrackTransceiver(trackReceiver, true); });
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
                if (!mediaTrackSidsToTrackStates.has(sid) && !dataTrackSidsToDataChannelLabels.has(sid)) {
                    _this._pendingSwitchOffStates.delete(sid);
                    _this._pendingTrackMids.delete(sid);
                    trackSignaling.setTrackTransceiver(null, false);
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
    return RoomV3;
}(RoomV2));
module.exports = RoomV3;
//# sourceMappingURL=room.js.map