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
var StateMachine = require('../../statemachine');
var TwilioConnection = require('../../twilioconnection');
var DefaultBackoff = require('../../util/backoff');
var reconnectBackoffConfig = require('../../util/constants').reconnectBackoffConfig;
var Timeout = require('../../util/timeout');
var _a = require('../../util/constants'), SDK_NAME = _a.SDK_NAME, SDK_VERSION = _a.SDK_VERSION, SDP_FORMAT = _a.SDP_FORMAT;
var _b = require('../../util'), createBandwidthProfilePayload = _b.createBandwidthProfilePayload, createMediaSignalingPayload = _b.createMediaSignalingPayload, createMediaWarningsPayload = _b.createMediaWarningsPayload, createSubscribePayload = _b.createSubscribePayload, getUserAgent = _b.getUserAgent, isNonArrayObject = _b.isNonArrayObject;
var _c = require('../../util/twilio-video-errors'), createTwilioError = _c.createTwilioError, RoomCompletedError = _c.RoomCompletedError, SignalingConnectionError = _c.SignalingConnectionError, SignalingServerBusyError = _c.SignalingServerBusyError;
var ICE_VERSION = 1;
var RSP_VERSION = 2;
/*
TwilioConnectionTransport States
----------------

                      +-----------+
                      |           |
                      |  syncing  |---------+
                      |           |         |
                      +-----------+         |
                         ^     |            |
                         |     |            |
                         |     v            v
    +------------+    +-----------+    +--------------+
    |            |    |           |    |              |
    | connecting |--->| connected |--->| disconnected |
    |            |    |           |    |              |
    +------------+    +-----------+    +--------------+
             |                              ^
             |                              |
             |                              |
             +------------------------------+

*/
var states = {
    connecting: [
        'connected',
        'disconnected'
    ],
    connected: [
        'disconnected',
        'syncing'
    ],
    syncing: [
        'connected',
        'disconnected'
    ],
    disconnected: []
};
/**
 * A {@link TwilioConnectionTransport} supports sending and receiving Room Signaling Protocol
 * (RSP) messages. It also supports RSP requests, such as Sync and Disconnect.
 * @extends StateMachine
 * @emits TwilioConnectionTransport#connected
 * @emits TwilioConnectionTransport#message
 */
var TwilioConnectionTransport = /** @class */ (function (_super) {
    __extends(TwilioConnectionTransport, _super);
    /**
     * Construct a {@link TwilioConnectionTransport}.
     * @param {?string} name
     * @param {string} accessToken
     * @param {ParticipantSignaling} localParticipant
     * @param {PeerConnectionManager} peerConnectionManager
     * @param {string} wsServer
     * @param {object} [options]
     */
    function TwilioConnectionTransport(name, accessToken, localParticipant, peerConnectionManager, wsServer, options) {
        var _this = this;
        options = Object.assign({
            Backoff: DefaultBackoff,
            TwilioConnection: TwilioConnection,
            iceServers: null,
            trackPriority: true,
            trackSwitchOff: true,
            renderHints: true,
            userAgent: getUserAgent()
        }, options);
        _this = _super.call(this, 'connecting', states) || this;
        Object.defineProperties(_this, {
            _accessToken: {
                value: accessToken
            },
            _automaticSubscription: {
                value: options.automaticSubscription
            },
            _bandwidthProfile: {
                value: options.bandwidthProfile
            },
            _dominantSpeaker: {
                value: options.dominantSpeaker
            },
            _adaptiveSimulcast: {
                value: options.adaptiveSimulcast
            },
            _eventObserver: {
                value: options.eventObserver,
                writable: false
            },
            _renderHints: {
                value: options.renderHints
            },
            _iceServersStatus: {
                value: Array.isArray(options.iceServers)
                    ? 'overrode'
                    : 'acquire'
            },
            _localParticipant: {
                value: localParticipant
            },
            _name: {
                value: name,
            },
            _networkQuality: {
                value: isNonArrayObject(options.networkQuality) || options.networkQuality
            },
            _notifyWarnings: {
                value: options.notifyWarnings
            },
            _options: {
                value: options
            },
            _peerConnectionManager: {
                value: peerConnectionManager
            },
            _sessionTimer: {
                value: null,
                writable: true
            },
            _sessionTimeoutMS: {
                value: 0,
                writable: true
            },
            _reconnectBackoff: {
                value: new options.Backoff(reconnectBackoffConfig)
            },
            _session: {
                value: null,
                writable: true
            },
            _trackPriority: {
                value: options.trackPriority
            },
            _trackSwitchOff: {
                value: options.trackSwitchOff
            },
            _twilioConnection: {
                value: null,
                writable: true
            },
            _updatesReceived: {
                value: []
            },
            _updatesToSend: {
                value: []
            },
            _userAgent: {
                value: options.userAgent
            },
            _wsServer: {
                value: wsServer
            }
        });
        setupTransport(_this);
        return _this;
    }
    /**
     * Create a Connect, Sync or Disconnect RSP message.
     * @private
     * @returns {?object}
     */
    TwilioConnectionTransport.prototype._createConnectOrSyncOrDisconnectMessage = function () {
        if (this.state === 'connected') {
            return null;
        }
        if (this.state === 'disconnected') {
            return {
                session: this._session,
                type: 'disconnect',
                version: RSP_VERSION
            };
        }
        var type = {
            connecting: 'connect',
            syncing: 'sync'
        }[this.state];
        var message = {
            name: this._name,
            participant: this._localParticipant.getState(),
            peer_connections: this._peerConnectionManager.getStates(),
            type: type,
            version: RSP_VERSION
        };
        if (message.type === 'connect') {
            message.ice_servers = this._iceServersStatus;
            message.publisher = {
                name: SDK_NAME,
                sdk_version: SDK_VERSION,
                user_agent: this._userAgent
            };
            if (this._bandwidthProfile) {
                message.bandwidth_profile = createBandwidthProfilePayload(this._bandwidthProfile);
            }
            if (this._notifyWarnings) {
                message.participant.media_warnings = createMediaWarningsPayload(this._notifyWarnings);
            }
            message.media_signaling = createMediaSignalingPayload(this._dominantSpeaker, this._networkQuality, this._trackPriority, this._trackSwitchOff, this._adaptiveSimulcast, this._renderHints);
            message.subscribe = createSubscribePayload(this._automaticSubscription);
            message.format = SDP_FORMAT;
            message.token = this._accessToken;
        }
        else if (message.type === 'sync') {
            message.session = this._session;
            message.token = this._accessToken;
        }
        else if (message.type === 'update') {
            message.session = this._session;
        }
        return message;
    };
    /**
     * Create an "ice" message.
     * @private
     */
    TwilioConnectionTransport.prototype._createIceMessage = function () {
        return {
            edge: 'roaming',
            token: this._accessToken,
            type: 'ice',
            version: ICE_VERSION
        };
    };
    /**
     * Send a Connect, Sync or Disconnect RSP message.
     * @private
     */
    TwilioConnectionTransport.prototype._sendConnectOrSyncOrDisconnectMessage = function () {
        var message = this._createConnectOrSyncOrDisconnectMessage();
        if (message) {
            this._twilioConnection.sendMessage(message);
        }
    };
    /**
     * Disconnect the {@link TwilioConnectionTransport}. Returns true if calling the method resulted
     * in disconnection.
     * @param {TwilioError} [error]
     * @returns {boolean}
     */
    TwilioConnectionTransport.prototype.disconnect = function (error) {
        if (this.state !== 'disconnected') {
            this.preempt('disconnected', null, [error]);
            this._sendConnectOrSyncOrDisconnectMessage();
            this._twilioConnection.close();
            return true;
        }
        return false;
    };
    /**
     * Publish an RSP Update. Returns true if calling the method resulted in
     * publishing (or eventually publishing) the update.
     * @param {object} update
     * @returns {boolean}
     */
    TwilioConnectionTransport.prototype.publish = function (update) {
        switch (this.state) {
            case 'connected':
                this._twilioConnection.sendMessage(Object.assign({
                    session: this._session,
                    type: 'update',
                    version: RSP_VERSION
                }, update));
                return true;
            case 'connecting':
            case 'syncing':
                this._updatesToSend.push(update);
                return true;
            case 'disconnected':
            default:
                return false;
        }
    };
    /**
     * Publish (or queue) an event to the Insights gateway.
     * @param {string} group - Event group name
     * @param {string} name - Event name
     * @param {string} level - Event level
     * @param {object} payload - Event payload
     * @returns {void}
     */
    TwilioConnectionTransport.prototype.publishEvent = function (group, name, level, payload) {
        this._eventObserver.emit('event', { group: group, name: name, level: level, payload: payload });
    };
    /**
     * Sync the {@link TwilioConnectionTransport}. Returns true if calling the method resulted in
     * syncing.
     * @returns {boolean}
     */
    TwilioConnectionTransport.prototype.sync = function () {
        if (this.state === 'connected') {
            this.preempt('syncing');
            this._sendConnectOrSyncOrDisconnectMessage();
            return true;
        }
        return false;
    };
    /**
     * @private
     * @returns {void}
     */
    TwilioConnectionTransport.prototype._setSession = function (session, sessionTimeout) {
        this._session = session;
        this._sessionTimeoutMS = sessionTimeout * 1000;
    };
    /**
     * Determines if we should attempt reconnect.
     * returns a Promise to wait on before attempting to
     * reconnect. returns null if its not okay to reconnect.
     * @private
     * @returns {Promise<void>}
     */
    TwilioConnectionTransport.prototype._getReconnectTimer = function () {
        var _this = this;
        if (this._sessionTimeoutMS === 0) {
            // this means either we have never connected.
            // or we timed out while trying to reconnect
            // In either case we do not want to reconnect.
            return null;
        }
        // start session timer
        if (!this._sessionTimer) {
            this._sessionTimer = new Timeout(function () {
                // ensure that _clearReconnectTimer wasn't
                // called while we were waiting.
                if (_this._sessionTimer) {
                    // do not allow any more reconnect attempts.
                    _this._sessionTimeoutMS = 0;
                }
            }, this._sessionTimeoutMS);
        }
        // return promise that waits with exponential backoff.
        return new Promise(function (resolve) {
            _this._reconnectBackoff.backoff(resolve);
        });
    };
    /**
     * clears the session reconnect timer.
     *
     * @private
     * @returns {void}
     */
    TwilioConnectionTransport.prototype._clearReconnectTimer = function () {
        this._reconnectBackoff.reset();
        if (this._sessionTimer) {
            this._sessionTimer.clear();
            this._sessionTimer = null;
        }
    };
    return TwilioConnectionTransport;
}(StateMachine));
/**
 * @event TwilioConnectionTransport#connected
 * @param {object} initialState
 */
/**
 * @event TwilioConnectionTransport#message
 * @param {object} peerConnections
 */
function reducePeerConnections(peerConnections) {
    return Array.from(peerConnections.reduce(function (peerConnectionsById, update) {
        var reduced = peerConnectionsById.get(update.id) || update;
        // First, reduce the top-level `description` property.
        if (!reduced.description && update.description) {
            reduced.description = update.description;
        }
        else if (reduced.description && update.description) {
            if (update.description.revision > reduced.description.revision) {
                reduced.description = update.description;
            }
        }
        // Then, reduce the top-level `ice` property.
        if (!reduced.ice && update.ice) {
            reduced.ice = update.ice;
        }
        else if (reduced.ice && update.ice) {
            if (update.ice.revision > reduced.ice.revision) {
                reduced.ice = update.ice;
            }
        }
        // Finally, update the map.
        peerConnectionsById.set(reduced.id, reduced);
        return peerConnectionsById;
    }, new Map()).values());
}
function reduceUpdates(updates) {
    return updates.reduce(function (reduced, update) {
        // First, reduce the top-level `participant` property.
        if (!reduced.participant && update.participant) {
            reduced.participant = update.participant;
        }
        else if (reduced.participant && update.participant) {
            if (update.participant.revision > reduced.participant.revision) {
                reduced.participant = update.participant;
            }
        }
        // Then, reduce the top-level `peer_connections` property.
        /* eslint camelcase:0 */
        if (!reduced.peer_connections && update.peer_connections) {
            reduced.peer_connections = reducePeerConnections(update.peer_connections);
        }
        else if (reduced.peer_connections && update.peer_connections) {
            reduced.peer_connections = reducePeerConnections(reduced.peer_connections.concat(update.peer_connections));
        }
        return reduced;
    }, {});
}
function setupTransport(transport) {
    function createOrResetTwilioConnection() {
        if (transport.state === 'disconnected') {
            return;
        }
        if (transport._twilioConnection) {
            transport._twilioConnection.removeListener('message', handleMessage);
        }
        var _iceServersStatus = transport._iceServersStatus, _options = transport._options, _wsServer = transport._wsServer, state = transport.state;
        var TwilioConnection = _options.TwilioConnection;
        var twilioConnection = new TwilioConnection(_wsServer, Object.assign({
            helloBody: state === 'connecting' && _iceServersStatus === 'acquire'
                ? transport._createIceMessage()
                : transport._createConnectOrSyncOrDisconnectMessage()
        }, _options));
        twilioConnection.once('close', function (reason) {
            if (reason === TwilioConnection.CloseReason.LOCAL) {
                disconnect();
            }
            else {
                disconnect(new Error(reason));
            }
        });
        twilioConnection.on('message', handleMessage);
        transport._twilioConnection = twilioConnection;
    }
    function disconnect(error) {
        if (transport.state === 'disconnected') {
            return;
        }
        if (!error) {
            transport.disconnect();
            return;
        }
        var reconnectTimer = transport._getReconnectTimer();
        if (!reconnectTimer) {
            var twilioError = error.message === TwilioConnection.CloseReason.BUSY
                ? new SignalingServerBusyError()
                : new SignalingConnectionError();
            transport.disconnect(twilioError);
            return;
        }
        if (transport.state === 'connected') {
            transport.preempt('syncing');
        }
        reconnectTimer.then(createOrResetTwilioConnection);
    }
    function handleMessage(message) {
        if (transport.state === 'disconnected') {
            return;
        }
        if (message.type === 'error') {
            transport.disconnect(createTwilioError(message.code, message.message));
            return;
        }
        switch (transport.state) {
            case 'connected':
                switch (message.type) {
                    case 'connected':
                    case 'synced':
                    case 'update':
                    case 'warning':
                        transport.emit('message', message);
                        return;
                    case 'disconnected':
                        transport.disconnect(message.status === 'completed'
                            ? new RoomCompletedError()
                            : null);
                        return;
                    default:
                        // Do nothing.
                        return;
                }
            case 'connecting':
                switch (message.type) {
                    case 'iced':
                        transport._options.onIced(message.ice_servers).then(function () {
                            transport._sendConnectOrSyncOrDisconnectMessage();
                        });
                        return;
                    case 'connected':
                        transport._setSession(message.session, message.options.session_timeout);
                        transport.emit('connected', message);
                        transport.preempt('connected');
                        return;
                    case 'synced':
                    case 'update':
                        transport._updatesReceived.push(message);
                        return;
                    case 'disconnected':
                        transport.disconnect(message.status === 'completed'
                            ? new RoomCompletedError()
                            : null);
                        return;
                    default:
                        // Do nothing.
                        return;
                }
            case 'syncing':
                switch (message.type) {
                    case 'connected':
                    case 'update':
                        transport._updatesReceived.push(message);
                        return;
                    case 'synced':
                        transport._clearReconnectTimer();
                        transport.emit('message', message);
                        transport.preempt('connected');
                        return;
                    case 'disconnected':
                        transport.disconnect(message.status === 'completed'
                            ? new RoomCompletedError()
                            : null);
                        return;
                    default:
                        // Do nothing.
                        return;
                }
            default:
                // Impossible
                return;
        }
    }
    transport.on('stateChanged', function stateChanged(state) {
        switch (state) {
            case 'connected': {
                var updates = transport._updatesToSend.splice(0);
                if (updates.length) {
                    transport.publish(reduceUpdates(updates));
                }
                transport._updatesReceived.splice(0).forEach(function (update) { return transport.emit('message', update); });
                return;
            }
            case 'disconnected':
                transport._twilioConnection.removeListener('message', handleMessage);
                transport.removeListener('stateChanged', stateChanged);
                return;
            case 'syncing':
                // Do nothing.
                return;
            default:
                // Impossible
                return;
        }
    });
    var _options = transport._options, _iceServersStatus = transport._iceServersStatus;
    var iceServers = _options.iceServers, onIced = _options.onIced;
    if (_iceServersStatus === 'overrode') {
        onIced(iceServers).then(createOrResetTwilioConnection);
    }
    else {
        createOrResetTwilioConnection();
    }
}
module.exports = TwilioConnectionTransport;
//# sourceMappingURL=twilioconnectiontransport.js.map