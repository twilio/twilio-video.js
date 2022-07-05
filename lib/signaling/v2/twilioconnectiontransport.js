'use strict';

const StateMachine = require('../../statemachine');
const TwilioConnection = require('../../twilioconnection');
const DefaultBackoff = require('../../util/backoff');
const { reconnectBackoffConfig } = require('../../util/constants');
const Timeout = require('../../util/timeout');
const { SDK_NAME, SDK_VERSION, SDP_FORMAT } = require('../../util/constants');

const {
  createBandwidthProfilePayload,
  createMediaSignalingPayload,
  createMediaWarningsPayload,
  createSubscribePayload,
  getUserAgent,
  isNonArrayObject
} = require('../../util');

const {
  createTwilioError,
  RoomCompletedError,
  SignalingConnectionError,
  SignalingServerBusyError,
} = require('../../util/twilio-video-errors');

const ICE_VERSION = 1;
const RSP_VERSION = 2;

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

const states = {
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
class TwilioConnectionTransport extends StateMachine {
  /**
   * Construct a {@link TwilioConnectionTransport}.
   * @param {?string} name
   * @param {string} accessToken
   * @param {ParticipantSignaling} localParticipant
   * @param {PeerConnectionManager} peerConnectionManager
   * @param {string} wsServer
   * @param {object} [options]
   */
  constructor(name, accessToken, localParticipant, peerConnectionManager, wsServer, options) {
    options = Object.assign({
      Backoff: DefaultBackoff,
      TwilioConnection,
      iceServers: null,
      trackPriority: true,
      trackSwitchOff: true,
      renderHints: true,
      userAgent: getUserAgent()
    }, options);
    super('connecting', states);


    Object.defineProperties(this, {
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
        value: 0, // initially 0, set only after 1st successful connection.
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


    setupTransport(this);
  }

  /**
   * Create a Connect, Sync or Disconnect RSP message.
   * @private
   * @returns {?object}
   */
  _createConnectOrSyncOrDisconnectMessage() {
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

    const type = {
      connecting: 'connect',
      syncing: 'sync'
    }[this.state];

    const message = {
      name: this._name,
      participant: this._localParticipant.getState(),
      peer_connections: this._peerConnectionManager.getStates(),
      type,
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
        message.bandwidth_profile = createBandwidthProfilePayload(
          this._bandwidthProfile);
      }

      if (this._notifyWarnings) {
        message.participant.media_warnings = createMediaWarningsPayload(
          this._notifyWarnings);
      }

      message.media_signaling = createMediaSignalingPayload(
        this._dominantSpeaker,
        this._networkQuality,
        this._trackPriority,
        this._trackSwitchOff,
        this._adaptiveSimulcast,
        this._renderHints);

      message.subscribe = createSubscribePayload(this._automaticSubscription);
      message.format = SDP_FORMAT;
      message.token = this._accessToken;
    } else if (message.type === 'sync') {
      message.session = this._session;
      message.token = this._accessToken;
    } else if (message.type === 'update') {
      message.session = this._session;
    }

    return message;
  }

  /**
   * Create an "ice" message.
   * @private
   */
  _createIceMessage() {
    return {
      edge: 'roaming', // roaming here means use same edge as signaling.
      token: this._accessToken,
      type: 'ice',
      version: ICE_VERSION
    };
  }

  /**
   * Send a Connect, Sync or Disconnect RSP message.
   * @private
   */
  _sendConnectOrSyncOrDisconnectMessage() {
    const message = this._createConnectOrSyncOrDisconnectMessage();
    if (message) {
      this._twilioConnection.sendMessage(message);
    }
  }

  /**
   * Disconnect the {@link TwilioConnectionTransport}. Returns true if calling the method resulted
   * in disconnection.
   * @param {TwilioError} [error]
   * @returns {boolean}
   */
  disconnect(error) {
    if (this.state !== 'disconnected') {
      this.preempt('disconnected', null, [error]);
      this._sendConnectOrSyncOrDisconnectMessage();
      this._twilioConnection.close();
      return true;
    }
    return false;
  }

  /**
   * Publish an RSP Update. Returns true if calling the method resulted in
   * publishing (or eventually publishing) the update.
   * @param {object} update
   * @returns {boolean}
   */
  publish(update) {
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
  }

  /**
   * Publish (or queue) an event to the Insights gateway.
   * @param {string} group - Event group name
   * @param {string} name - Event name
   * @param {string} level - Event level
   * @param {object} payload - Event payload
   * @returns {void}
   */
  publishEvent(group, name, level, payload) {
    this._eventObserver.emit('event', { group, name, level, payload });
  }

  /**
   * Sync the {@link TwilioConnectionTransport}. Returns true if calling the method resulted in
   * syncing.
   * @returns {boolean}
   */
  sync() {
    if (this.state === 'connected') {
      this.preempt('syncing');
      this._sendConnectOrSyncOrDisconnectMessage();
      return true;
    }
    return false;
  }

  /**
   * @private
   * @returns {void}
   */
  _setSession(session, sessionTimeout) {
    this._session = session;
    this._sessionTimeoutMS = sessionTimeout * 1000;
  }

  /**
   * Determines if we should attempt reconnect.
   * returns a Promise to wait on before attempting to
   * reconnect. returns null if its not okay to reconnect.
   * @private
   * @returns {Promise<void>}
   */
  _getReconnectTimer() {
    if (this._sessionTimeoutMS === 0) {
      // this means either we have never connected.
      // or we timed out while trying to reconnect
      // In either case we do not want to reconnect.
      return null;
    }

    // start session timer
    if (!this._sessionTimer) {
      this._sessionTimer = new Timeout(() => {
        // ensure that _clearReconnectTimer wasn't
        // called while we were waiting.
        if (this._sessionTimer) {
          // do not allow any more reconnect attempts.
          this._sessionTimeoutMS = 0;
        }
      }, this._sessionTimeoutMS);
    }

    // return promise that waits with exponential backoff.
    return new Promise(resolve => {
      this._reconnectBackoff.backoff(resolve);
    });
  }

  /**
   * clears the session reconnect timer.
   *
   * @private
   * @returns {void}
   */
  _clearReconnectTimer() {
    this._reconnectBackoff.reset();
    if (this._sessionTimer) {
      this._sessionTimer.clear();
      this._sessionTimer = null;
    }
  }
}

/**
 * @event TwilioConnectionTransport#connected
 * @param {object} initialState
 */

/**
 * @event TwilioConnectionTransport#message
 * @param {object} peerConnections
 */

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce((peerConnectionsById, update) => {
    const reduced = peerConnectionsById.get(update.id) || update;

    // First, reduce the top-level `description` property.
    if (!reduced.description && update.description) {
      reduced.description = update.description;
    } else if (reduced.description && update.description) {
      if (update.description.revision > reduced.description.revision) {
        reduced.description = update.description;
      }
    }

    // Then, reduce the top-level `ice` property.
    if (!reduced.ice && update.ice) {
      reduced.ice = update.ice;
    } else if (reduced.ice && update.ice) {
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
  return updates.reduce((reduced, update) => {
    // First, reduce the top-level `participant` property.
    if (!reduced.participant && update.participant) {
      reduced.participant = update.participant;
    } else if (reduced.participant && update.participant) {
      if (update.participant.revision > reduced.participant.revision) {
        reduced.participant = update.participant;
      }
    }

    // Then, reduce the top-level `peer_connections` property.
    /* eslint camelcase:0 */
    if (!reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(update.peer_connections);
    } else if (reduced.peer_connections && update.peer_connections) {
      reduced.peer_connections = reducePeerConnections(
        reduced.peer_connections.concat(update.peer_connections));
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
    const { _iceServersStatus, _options, _wsServer, state } = transport;
    const { TwilioConnection } = _options;

    const twilioConnection = new TwilioConnection(_wsServer, Object.assign({
      helloBody: state === 'connecting' && _iceServersStatus === 'acquire'
        ? transport._createIceMessage()
        : transport._createConnectOrSyncOrDisconnectMessage()
    }, _options));

    twilioConnection.once('close', reason => {
      if (reason === TwilioConnection.CloseReason.LOCAL) {
        disconnect();
      } else {
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

    const reconnectTimer = transport._getReconnectTimer();
    if (!reconnectTimer) {
      const twilioError = error.message === TwilioConnection.CloseReason.BUSY
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
            transport._options.onIced(message.ice_servers).then(() => {
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
        const updates = transport._updatesToSend.splice(0);
        if (updates.length) {
          transport.publish(reduceUpdates(updates));
        }
        transport._updatesReceived.splice(0).forEach(update => transport.emit('message', update));
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

  const { _options, _iceServersStatus } = transport;
  const { iceServers, onIced } = _options;

  if (_iceServersStatus === 'overrode') {
    onIced(iceServers).then(createOrResetTwilioConnection);
  } else {
    createOrResetTwilioConnection();
  }
}

module.exports = TwilioConnectionTransport;
