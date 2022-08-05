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
var RemoteTrackPublicationSignaling = require('../remotetrackpublication');
/**
 * @extends RemoteTrackPublicationSignaling
 */
var RemoteTrackPublicationV3 = /** @class */ (function (_super) {
    __extends(RemoteTrackPublicationV3, _super);
    /**
     * Construct a {@link RemoteTrackPublicationV3}.
     * @param {RemoteTrackPublicationV3#Representation} track
     * @param {boolean} isSwitchedOff
     * @param {?string} switchOffReason
     * @param {function(MediaStreamTrack): Promise<Map<PeerConnectionV2#id, StandardizedTrackStatsReport>>} getTrackStats
     */
    function RemoteTrackPublicationV3(track, isSwitchedOff, switchOffReason, getTrackStats) {
        var _this = this;
        switchOffReason = isSwitchedOff ? switchOffReason : null;
        var enabled = isEnabled(isSwitchedOff, switchOffReason);
        var kind = track.kind, name = track.name, priority = track.priority, sid = track.sid;
        _this = _super.call(this, sid, name, kind, enabled, priority, isSwitchedOff, 3) || this;
        Object.defineProperties(_this, {
            _getTrackStats: {
                value: getTrackStats
            },
            _isSubscribed: {
                value: false,
                writable: true
            },
            _pendingGetTrackStatsPromise: {
                value: Promise.resolve(),
                writable: true
            },
            _switchOffReason: {
                value: switchOffReason,
                writable: true
            },
            _switchOffStateChangeStats: {
                value: initialTrackStats(sid, kind),
                writable: true
            },
            _switchOnMediaStreamTrackStats: {
                value: initialTrackStats(sid, kind),
                writable: true
            }
        });
        return _this;
    }
    Object.defineProperty(RemoteTrackPublicationV3.prototype, "isSubscribed", {
        /**
         * Whether the {@link RemoteTrackPublicationV3} is subscribed to.
         * @property {boolean}
         */
        get: function () {
            return this._isSubscribed;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(RemoteTrackPublicationV3.prototype, "switchOffReason", {
        /**
         * The reason for the {@link RemoteTrackPublicationV3} being switched off.
         * @returns {?string}
         */
        get: function () {
            return this._switchOffReason;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Adjust Track statistics based on new stats. Returns the most recent switched
     * off state change Track statistics if no argument is provided.
     * @param {StandardizedTrackStatsReport} [newMediaStreamTrackStats]
     * @returns {StandardizedTrackStatsReport}
     */
    RemoteTrackPublicationV3.prototype.adjustTrackStats = function (newMediaStreamTrackStats) {
        var _this = this;
        if (newMediaStreamTrackStats === void 0) { newMediaStreamTrackStats = {}; }
        var cumulativeStatsProps = [
            'bytesReceived',
            'framesDecoded',
            'packetsLost',
            'packetsReceived',
            'totalDecodeTime'
        ];
        var snapshotStatsProps = [
            'audioOutputLevel',
            'codecName',
            'estimatedPlayoutTimestamp',
            'frameHeightReceived',
            'frameRateReceived',
            'frameWidthReceived',
            'jitter',
            'jitterBufferDelay',
            'jitterBufferEmittedCount',
            'roundTripTime',
            'ssrc',
            'timestamp',
            'trackId'
        ];
        var trackStats = Object.assign({}, this._switchOffStateChangeStats);
        cumulativeStatsProps.forEach(function (prop) {
            if (prop in newMediaStreamTrackStats) {
                trackStats[prop] = _this._switchOffStateChangeStats[prop] + newMediaStreamTrackStats[prop] - _this._switchOnMediaStreamTrackStats[prop];
            }
        });
        snapshotStatsProps.forEach(function (prop) {
            if (prop in newMediaStreamTrackStats) {
                trackStats[prop] = newMediaStreamTrackStats[prop];
            }
        });
        if (!this.isSubscribed || this.isSwitchedOff) {
            trackStats.ssrc = '';
            trackStats.timestamp = Date.now();
            trackStats.trackId = '';
        }
        return trackStats;
    };
    /**
     * Updates track switch on/off state.
     * @param {boolean} isSwitchedOff
     * @param {?string} switchOffReason
     * @returns {this}
     */
    RemoteTrackPublicationV3.prototype.setSwitchedOff = function (isSwitchedOff, switchOffReason) {
        switchOffReason = isSwitchedOff ? switchOffReason : null;
        var shouldEmitUpdated = isSwitchedOff !== this.isSwitchedOff
            || switchOffReason !== this.switchOffReason;
        this._isSwitchedOff = isSwitchedOff;
        this._switchOffReason = switchOffReason;
        if (shouldEmitUpdated) {
            this.emit('updated');
        }
        return this.enable(isEnabled(isSwitchedOff, switchOffReason));
    };
    /**
     * Set the {@link MediaTrackReceiver} on the {@link RemoteTrackPublicationV3}.
     * @override
     * @param {MediaTrackReceiver} trackReceiver
     * @param {boolean} isSubscribed
     * @returns {this}
     */
    RemoteTrackPublicationV3.prototype.setTrackTransceiver = function (trackReceiver, isSubscribed) {
        var _this = this;
        isSubscribed = !!trackReceiver || isSubscribed;
        var shouldEmitUpdated = trackReceiver !== this.trackTransceiver || isSubscribed !== this.isSubscribed;
        if (this.kind !== 'data' && trackReceiver !== this.trackTransceiver) {
            var track_1 = (trackReceiver || this.trackTransceiver).track;
            this._pendingGetTrackStatsPromise = this._pendingGetTrackStatsPromise.then(function () { return _this._getTrackStats(track_1); }).then(function (report) {
                // NOTE(mmalavalli): Because RSPv3 is associated with Large Rooms only, the statistics
                // map will contain an entry associated with only one RTCPeerConnection.
                var mediaStreamTrackStats = report.values().next().value;
                if (trackReceiver) {
                    _this._switchOnMediaStreamTrackStats = mediaStreamTrackStats;
                }
                _this._switchOffStateChangeStats = _this.adjustTrackStats(mediaStreamTrackStats);
                _this._pendingGetTrackStatsPromise = Promise.resolve();
            });
        }
        this._trackTransceiver = trackReceiver;
        this._isSubscribed = isSubscribed;
        if (shouldEmitUpdated) {
            this.emit('updated');
        }
        return this;
    };
    /**
     * Compare the {@link RemoteTrackPublicationV3} to a
     * {@link RemoteTrackPublicationV3#Representation} of itself and perform any
     * updates necessary.
     * @param {RemoteTrackPublicationV3#Representation} track
     * @returns {this}
     * @fires TrackSignaling#updated
     */
    RemoteTrackPublicationV3.prototype.update = function (track) {
        this.setPriority(track.priority);
        return this;
    };
    return RemoteTrackPublicationV3;
}(RemoteTrackPublicationSignaling));
/**
 * @private
 * @param {boolean} isSwitchedOff
 * @param {?string} switchOffReason
 * @returns {boolean}
 */
function isEnabled(isSwitchedOff, switchOffReason) {
    return !(isSwitchedOff && switchOffReason === 'DISABLED_BY_PUBLISHER');
}
/**
 * @private
 * @param {Track.SID} sid
 * @param {Track.Kind} kind
 * @returns {StandardizedTrackStatsReport}
 */
function initialTrackStats(sid, kind) {
    return Object.assign({
        bytesReceived: 0,
        codecName: '',
        estimatedPlayoutTimestamp: 0,
        jitter: 0,
        jitterBufferDelay: 0,
        jitterBufferEmittedCount: 0,
        packetsLost: 0,
        packetsReceived: 0,
        roundTripTime: 0,
        ssrc: '',
        timestamp: 0,
        trackId: '',
        trackSid: sid
    }, {
        audio: {
            audioOutputLevel: 0
        },
        data: {},
        video: {
            frameHeightReceived: 0,
            frameRateReceived: 0,
            framesDecoded: 0,
            frameWidthReceived: 0,
            totalDecodeTime: 0
        }
    }[kind]);
}
/**
 * The Room Signaling Protocol (RSP) representation of a {@link RemoteTrackPublicationV3}.
 * @typedef {object} RemoteTrackPublicationV3#Representation
 * @property {Track.Kind} kind
 * @property {string} name
 * @priority {Track.Priority} priority
 * @property {Track.SID} sid
 */
module.exports = RemoteTrackPublicationV3;
//# sourceMappingURL=remotetrackpublication.js.map