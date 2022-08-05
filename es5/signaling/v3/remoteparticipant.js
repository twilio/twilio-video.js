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
var RemoteParticipantV2 = require('../v2/remoteparticipant');
var RemoteTrackPublicationV3 = require('./remotetrackpublication');
/**
 * @extends RemoteParticipantV2
 */
var RemoteParticipantV3 = /** @class */ (function (_super) {
    __extends(RemoteParticipantV3, _super);
    /**
     * Construct a {@link RemoteParticipantV2}.
     * @param {object} participantState
     * @param {function(Track.SID): Promise<MediaTrackReceiver>} getPendingTrackReceiver
     * @param {function(Track.SID): boolean} getInitialTrackSwitchOffState
     * @param {function(Track.SID, Track.Priority): boolean} setPriority
     * @param {function(Track.SID, ClientRenderHint): Promise<void>} setRenderHint
     * @param {function(Track.SID): void} clearTrackHint
     * @param {function(MediaStreamTrack): Promise<Map<PeerConnectionV2#id, StandardizedTrackStatsReport>>} getTrackStats
     * @param {object} [options]
     */
    function RemoteParticipantV3(participantState, getPendingTrackReceiver, getInitialTrackSwitchOffState, setPriority, setRenderHint, clearTrackHint, getTrackStats, options) {
        var _this = this;
        options = Object.assign({
            RemoteTrackPublicationSignaling: RemoteTrackPublicationV3,
            getPendingTrackReceiver: getPendingTrackReceiver,
            getTrackStats: getTrackStats
        }, options);
        _this = _super.call(this, participantState, getInitialTrackSwitchOffState, setPriority, setRenderHint, clearTrackHint, options) || this;
        return _this;
    }
    /**
     * @private
     */
    RemoteParticipantV3.prototype._getOrCreateTrack = function (trackState) {
        var _a = this, RemoteTrackPublicationV3 = _a._RemoteTrackPublicationSignaling, getPendingTrackReceiver = _a._getPendingTrackReceiver, getTrackStats = _a._getTrackStats;
        var track = this.tracks.get(trackState.sid);
        if (!track) {
            var _b = this.kind === 'data'
                ? { state: 'ON', switchOffReason: null }
                : this._getInitialTrackSwitchOffState(trackState.sid), state = _b.state, _c = _b.switchOffReason, switchOffReason = _c === void 0 ? null : _c;
            track = new RemoteTrackPublicationV3(trackState, state === 'OFF', switchOffReason, getTrackStats);
            this.addTrack(track);
            getPendingTrackReceiver(track.sid).then(function (trackReceiver) {
                // NOTE(mmalavalli): DataTracks are subscribed to only if corresponding DataTrackReceivers
                // are available, whereas MediaTracks can be subscribed to irrespective of whether corresponding
                // MediaTrackReceivers are available. MediaTracks without MediaTrackReceivers are considered
                // switched off.
                track.setTrackTransceiver(trackReceiver, track.kind !== 'data' || !!trackReceiver);
            });
        }
        return track;
    };
    return RemoteParticipantV3;
}(RemoteParticipantV2));
module.exports = RemoteParticipantV3;
//# sourceMappingURL=remoteparticipant.js.map