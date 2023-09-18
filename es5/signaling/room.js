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
var DefaultRecordingSignaling = require('./recording');
var StateMachine = require('../statemachine');
var DefaultTimeout = require('../util/timeout');
var buildLogLevels = require('../util').buildLogLevels;
var DEFAULT_LOG_LEVEL = require('../util/constants').DEFAULT_LOG_LEVEL;
var Log = require('../util/log');
var _a = require('../util/twilio-video-errors'), MediaConnectionError = _a.MediaConnectionError, MediaDTLSTransportFailedError = _a.MediaDTLSTransportFailedError, SignalingConnectionDisconnectedError = _a.SignalingConnectionDisconnectedError;
var nInstances = 0;
/*
RoomSignaling States
-----------------------

    +-----------+     +--------------+
    |           |     |              |
    | connected |---->| disconnected |
    |           |     |              |
    +-----------+     +--------------+
          |  ^               ^
          |  |               |
          |  |   +--------------+
          |  +---|              |
          |      | reconnecting |
          +----->|              |
                 +--------------+

*/
var states = {
    connected: [
        'reconnecting',
        'disconnected'
    ],
    reconnecting: [
        'connected',
        'disconnected'
    ],
    disconnected: []
};
/**
 * A {@link Room} implementation
 * @extends StateMachine
 * @property {RTCPeerConnectionState} connectionState
 * @property {?Participant.SID} dominantSpeakerSid
 * @property {ParticipantSignaling} localParticipant
 * @property {RTCIceConnectionState} iceConnectionState
 * @property {string} name
 * @property {Map<string, RemoteParticipantSignaling>} participants
 * @property {RecordingSignaling} recording
 * @property {Room.SID} sid
 * @property {string} state - "connected", "reconnecting", or "disconnected"
 * @property {string} signalingConnectionState - "connected",
 *   "reconnecting", or "disconnected"
 * @emits RoomSignaling#connectionStateChanged
 * @emits RoomSignaling#dominantSpeakerChanged
 * @emits RoomSignaling#iceConnectionStateChanged
 * @emits RoomSignaling#signalingConnectionStateChanged
 */
var RoomSignaling = /** @class */ (function (_super) {
    __extends(RoomSignaling, _super);
    /**
     * Construct a {@link RoomSignaling}.
     * @param {ParticipantSignaling} localParticipant
     * @param {Room.SID} sid
     * @param {string} name
     * @param {object} options
     */
    function RoomSignaling(localParticipant, sid, name, options) {
        var _this = this;
        options = Object.assign({
            logLevel: DEFAULT_LOG_LEVEL,
            RecordingSignaling: DefaultRecordingSignaling,
            Timeout: DefaultTimeout
        }, options);
        var logLevels = buildLogLevels(options.logLevel);
        _this = _super.call(this, 'connected', states) || this;
        var RecordingSignaling = options.RecordingSignaling;
        var sessionTimeout = new options.Timeout(function () {
            _this._disconnect(_this._reconnectingError);
        }, options.sessionTimeout, false);
        Object.defineProperties(_this, {
            _instanceId: {
                value: nInstances++
            },
            _log: {
                value: options.log
                    ? options.log.createLog('default', _this)
                    : new Log('default', _this, logLevels, options.loggerName)
            },
            _mediaConnectionIsReconnecting: {
                writable: true,
                value: false
            },
            _options: {
                value: options
            },
            _reconnectingError: {
                value: null,
                writable: true
            },
            _sessionTimeout: {
                value: sessionTimeout
            },
            dominantSpeakerSid: {
                enumerable: true,
                value: null,
                writable: true
            },
            localParticipant: {
                enumerable: true,
                value: localParticipant
            },
            name: {
                enumerable: true,
                value: name
            },
            participants: {
                enumerable: true,
                value: new Map()
            },
            recording: {
                enumerable: true,
                value: new RecordingSignaling()
            },
            sid: {
                enumerable: true,
                value: sid
            }
        });
        _this.on('connectionStateChanged', function () {
            if (_this.connectionState === 'failed'
                && !['disconnected', 'failed'].includes(_this.iceConnectionState)) {
                _this._disconnect(new MediaDTLSTransportFailedError());
            }
        });
        _this.on('iceConnectionStateChanged', function () { return maybeUpdateState(_this); });
        _this.on('signalingConnectionStateChanged', function () { return maybeUpdateState(_this); });
        // NOTE(mmalavalli): In case "iceConnectionState" is already failed, update
        // the RoomSignaling state. setTimeout() ensures that the state is updated
        // after RoomV2's constructor is fully executed, thereby making "signalingConnectionState"
        // available here.
        setTimeout(function () { return maybeUpdateState(_this); });
        return _this;
    }
    /**
     * Disconnect, possibly with an Error.
     * @private
     * @param {Error} [error]
     * @returns {boolean}
     */
    RoomSignaling.prototype._disconnect = function (error) {
        if (this.state !== 'disconnected') {
            this.preempt('disconnected', null, [error]);
            return true;
        }
        return false;
    };
    RoomSignaling.prototype.toString = function () {
        return "[RoomSignaling #" + this._instanceId + ": " + (this.localParticipant ? this.localParticipant.sid : 'null') + "]";
    };
    /**
     * Connect {@link RemoteParticipantSignaling} to the {@link RoomSignaling}.
     * @param {RemoteParticipantSignaling} participant
     * @returns {boolean}
     */
    RoomSignaling.prototype.connectParticipant = function (participant) {
        var self = this;
        if (participant.state === 'disconnected') {
            return false;
        }
        if (this.participants.has(participant.sid)) {
            return false;
        }
        this.participants.set(participant.sid, participant);
        participant.on('stateChanged', function stateChanged(state) {
            if (state === 'disconnected') {
                participant.removeListener('stateChanged', stateChanged);
                self.participants.delete(participant.sid);
                self.emit('participantDisconnected', participant);
            }
        });
        this.emit('participantConnected', participant);
        return true;
    };
    /**
     * Disconnect.
     * @returns {boolean}
     */
    RoomSignaling.prototype.disconnect = function () {
        return this._disconnect();
    };
    /**
     * Set (or unset) the Dominant Speaker.
     * @param {?Participant.SID} dominantSpeakerSid
     * @returns {void}
     */
    RoomSignaling.prototype.setDominantSpeaker = function (dominantSpeakerSid) {
        this.dominantSpeakerSid = dominantSpeakerSid;
        this.emit('dominantSpeakerChanged');
    };
    return RoomSignaling;
}(StateMachine));
/**
 * @event RoomSignaling#event:connectionStateChanged
 */
/**
 * @event RoomSignaling#event:dominantSpeakerChanged
 */
/**
 * {@link RemoteParticipantSignaling} connected to the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantConnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */
/**
 * {@link RemoteParticipantSignaling} disconnected from the {@link RoomSignaling}.
 * @event RoomSignaling#event:participantDisconnected
 * @param {RemoteParticipantSignaling} participantSignaling
 */
/**
 * @event RoomSignaling#event:iceConnectionStateChanged
 */
/**
 * @event RoomSignaling#event:signalingConnectionStateChanged
 */
/**
 * Maybe update the {@link RoomSignaling} state.
 * @param {RoomSignaling} roomSignaling
 */
function maybeUpdateState(roomSignaling) {
    if (roomSignaling.state === 'disconnected' || roomSignaling.signalingConnectionState === 'disconnected') {
        roomSignaling._sessionTimeout.clear();
        return;
    }
    var newState;
    if (roomSignaling.signalingConnectionState === 'reconnecting') {
        newState = roomSignaling.signalingConnectionState;
    }
    else if (roomSignaling.iceConnectionState === 'failed') {
        roomSignaling._mediaConnectionIsReconnecting = true;
        newState = 'reconnecting';
    }
    else if (roomSignaling.iceConnectionState === 'new' || roomSignaling.iceConnectionState === 'checking') {
        newState = roomSignaling._mediaConnectionIsReconnecting ? 'reconnecting' : 'connected';
    }
    else {
        roomSignaling._mediaConnectionIsReconnecting = false;
        roomSignaling._reconnectingError = null;
        roomSignaling._sessionTimeout.clear();
        newState = 'connected';
    }
    if (newState === roomSignaling.state) {
        return;
    }
    if (newState === 'reconnecting') {
        roomSignaling._reconnectingError = roomSignaling.signalingConnectionState === 'reconnecting'
            ? new SignalingConnectionDisconnectedError()
            : new MediaConnectionError();
        roomSignaling._sessionTimeout.start();
        roomSignaling.preempt(newState, null, [roomSignaling._reconnectingError]);
    }
    else {
        roomSignaling.preempt(newState);
    }
}
module.exports = RoomSignaling;
//# sourceMappingURL=room.js.map