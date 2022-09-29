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
var StateMachine = require('../statemachine');
var NetworkQualityStats = require('../stats/networkqualitystats');
/*
ParticipantSignaling States
----------------------

    +------------+     +-----------+     +--------------+
    |            |     |           |     |              |
    | connecting |---->| connected |---->| disconnected |
    |            |     |           |     |              |
    +------------+     +-----------+     +--------------+
                           | ^                    ^
                           | |  +--------------+  |
                           | |--|              |  |
                           |--->| reconnecting |--|
                                |              |
                                +--------------+
*/
var states = {
    connecting: [
        'connected'
    ],
    connected: [
        'disconnected',
        'reconnecting'
    ],
    reconnecting: [
        'connected',
        'disconnected'
    ],
    disconnected: []
};
/**
 * A {@link Participant} implementation
 * @extends StateMachine
 * @property {?string} identity
 * @property {?Participant.SID} sid
 * @property {string} state - "connecting", "connected", or "disconnected"
 * @property {Map<Track.ID | Track.SID, TrackSignaling>} tracks
 * @emits ParticipantSignaling#networkQualityLevelChanged
 * @emits ParticipantSignaling#trackAdded
 * @emits ParticipantSignaling#trackRemoved
 */
var ParticipantSignaling = /** @class */ (function (_super) {
    __extends(ParticipantSignaling, _super);
    /**
     * Construct a {@link ParticipantSignaling}.
     */
    function ParticipantSignaling() {
        var _this = _super.call(this, 'connecting', states) || this;
        Object.defineProperties(_this, {
            _identity: {
                writable: true,
                value: null
            },
            _networkQualityLevel: {
                value: null,
                writable: true
            },
            _networkQualityStats: {
                value: null,
                writable: true
            },
            _sid: {
                writable: true,
                value: null
            },
            identity: {
                enumerable: true,
                get: function () {
                    return this._identity;
                }
            },
            sid: {
                enumerable: true,
                get: function () {
                    return this._sid;
                }
            },
            tracks: {
                enumerable: true,
                value: new Map()
            }
        });
        return _this;
    }
    Object.defineProperty(ParticipantSignaling.prototype, "networkQualityLevel", {
        /**
         * Get the current {@link NetworkQualityLevel}, if any.
         * @returns {?NetworkQualityLevel} networkQualityLevel - initially null
         */
        get: function () {
            return this._networkQualityLevel;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(ParticipantSignaling.prototype, "networkQualityStats", {
        /**
         * Get the current {@link NetworkQualityStats}
         * @returns {?NetworkQualityStats} networkQualityStats - initially null
         */
        get: function () {
            return this._networkQualityStats;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Add the {@link TrackSignaling}, MediaStreamTrack, or
     * {@link DataTrackSender} to the {@link ParticipantSignaling}.
     * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
     * @returns {this}
     * @fires ParticipantSignaling#trackAdded
     */
    ParticipantSignaling.prototype.addTrack = function (track) {
        this.tracks.set(track.id || track.sid, track);
        this.emit('trackAdded', track);
        return this;
    };
    /**
     * Disconnect the {@link ParticipantSignaling}.
     * @returns {boolean}
     */
    ParticipantSignaling.prototype.disconnect = function () {
        if (this.state !== 'disconnected') {
            this.preempt('disconnected');
            return true;
        }
        return false;
    };
    /**
     * Remove the {@link TrackSignaling}, MediaStreamTrack, or
     * {@link DataTrackSender} from the {@link ParticipantSignaling}.
     * @param {TrackSignaling|DataTrackSender|MediaTrackSender} track
     * @returns {?TrackSignaling}
     * @fires ParticipantSignaling#trackRemoved
     */
    ParticipantSignaling.prototype.removeTrack = function (track) {
        var signaling = this.tracks.get(track.id || track.sid);
        this.tracks.delete(track.id || track.sid);
        if (signaling) {
            this.emit('trackRemoved', track);
        }
        return signaling || null;
    };
    /**
     * @param {NetworkQualityLevel} networkQualityLevel
     * @param {?NetworkQualityLevels} [networkQualityLevels=null]
     * @returns {void}
     */
    ParticipantSignaling.prototype.setNetworkQualityLevel = function (networkQualityLevel, networkQualityLevels) {
        if (this._networkQualityLevel !== networkQualityLevel) {
            this._networkQualityLevel = networkQualityLevel;
            this._networkQualityStats = networkQualityLevels
                && (networkQualityLevels.audio || networkQualityLevels.video)
                ? new NetworkQualityStats(networkQualityLevels)
                : null;
            this.emit('networkQualityLevelChanged');
        }
    };
    /**
     * Connect the {@link ParticipantSignaling}.
     * @param {Participant.SID} sid
     * @param {string} identity
     * @returns {boolean}
     */
    ParticipantSignaling.prototype.connect = function (sid, identity) {
        if (this.state === 'connecting' || this.state === 'reconnecting') {
            if (!this._sid) {
                this._sid = sid;
            }
            if (!this._identity) {
                this._identity = identity;
            }
            this.preempt('connected');
            return true;
        }
        return false;
    };
    /**
     * Transition to "reconnecting" state.
     * @returns {boolean}
     */
    ParticipantSignaling.prototype.reconnecting = function () {
        if (this.state === 'connecting' || this.state === 'connected') {
            this.preempt('reconnecting');
            return true;
        }
        return false;
    };
    return ParticipantSignaling;
}(StateMachine));
/**
 * @event ParticipantSignaling#event:networkQualityLevelChanged
 */
/**
 * {@link TrackSignaling} was added to the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackAdded
 * @param {TrackSignaling} track
 */
/**
 * {@link TrackSignaling} was removed from the {@link ParticipantSignaling}.
 * @event ParticipantSignaling#trackRemoved
 * @param {TrackSignaling} track
 */
module.exports = ParticipantSignaling;
//# sourceMappingURL=participant.js.map