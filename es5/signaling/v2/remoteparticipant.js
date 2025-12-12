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
var RemoteParticipantSignaling = require('../remoteparticipant');
var RemoteTrackPublicationV2 = require('./remotetrackpublication');
/**
 * @extends RemoteParticipantSignaling
 * @property {?number} revision
 */
var RemoteParticipantV2 = /** @class */ (function (_super) {
    __extends(RemoteParticipantV2, _super);
    /**
     * Construct a {@link RemoteParticipantV2}.
     * @param {object} participantState
     * @param {function(Track.SID): boolean} getInitialTrackSwitchOffState
     * @param {function(Track.SID, Track.Priority): boolean} setPriority
     * @param {function(Track.SID, ClientRenderHint): Promise<void>} setRenderHint
     * @param {function(Track.SID): void} clearTrackHint
     * @param {object} [options]
     */
    function RemoteParticipantV2(participantState, getInitialTrackSwitchOffState, setPriority, setRenderHint, clearTrackHint, options) {
        var _this = _super.call(this, participantState.sid, participantState.identity) || this;
        options = Object.assign({
            RemoteTrackPublicationV2: RemoteTrackPublicationV2
        }, options);
        Object.defineProperties(_this, {
            _revision: {
                writable: true,
                value: null
            },
            _RemoteTrackPublicationV2: {
                value: options.RemoteTrackPublicationV2
            },
            _getInitialTrackSwitchOffState: {
                value: getInitialTrackSwitchOffState
            },
            updateSubscriberTrackPriority: {
                value: function (trackSid, priority) { return setPriority(trackSid, priority); }
            },
            updateTrackRenderHint: {
                value: function (trackSid, renderHint) { return setRenderHint(trackSid, renderHint); }
            },
            clearTrackHint: {
                value: function (trackSid) { return clearTrackHint(trackSid); }
            },
            revision: {
                enumerable: true,
                get: function () {
                    return this._revision;
                }
            }
        });
        return _this.update(participantState);
    }
    /**
     * @private
     */
    RemoteParticipantV2.prototype._getOrCreateTrack = function (trackState) {
        var RemoteTrackPublicationV2 = this._RemoteTrackPublicationV2;
        var track = this.tracks.get(trackState.sid);
        if (!track) {
            var isSwitchedOff = this._getInitialTrackSwitchOffState(trackState.sid);
            track = new RemoteTrackPublicationV2(trackState, isSwitchedOff);
            this.addTrack(track);
        }
        return track;
    };
    /**
     * Update the {@link RemoteParticipantV2} with the new state.
     * @param {object} participantState
     * @returns {this}
     */
    RemoteParticipantV2.prototype.update = function (participantState) {
        var _this = this;
        if (this.revision !== null && participantState.revision <= this.revision) {
            return this;
        }
        this._revision = participantState.revision;
        var tracksToKeep = new Set();
        participantState.tracks.forEach(function (trackState) {
            var track = _this._getOrCreateTrack(trackState);
            track.update(trackState);
            tracksToKeep.add(track);
        });
        this.tracks.forEach(function (track) {
            if (!tracksToKeep.has(track)) {
                _this.removeTrack(track);
            }
        });
        switch (participantState.state) {
            case 'disconnected':
                this.disconnect();
                break;
            case 'reconnecting':
                this.reconnecting();
                break;
            case 'connected':
                this.connect(this.sid, this.identity);
                break;
        }
        return this;
    };
    return RemoteParticipantV2;
}(RemoteParticipantSignaling));
module.exports = RemoteParticipantV2;
//# sourceMappingURL=remoteparticipant.js.map