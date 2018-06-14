'use strict';

const packageInfo = require('../../../package.json');
const InsightsPublisher = require('../../util/insightspublisher');
const NullInsightsPublisher = require('../../util/insightspublisher/null');
const StateMachine = require('../../statemachine');
const TwilioConnection = require('../../twilioconnection');
const util = require('../../util');

const {
  createTwilioError,
  SignalingConnectionError
} = require('../../util/twilio-video-errors');

const SDK_NAME = `${packageInfo.name}.js`;
const SDK_VERSION = packageInfo.version;
const VERSION = 1;

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
      InsightsPublisher,
      NullInsightsPublisher,
      TwilioConnection,
      userAgent: util.getUserAgent()
    }, options);
    super('connecting', states);

    const eventPublisherOptions = {};
    if (options.wsServerInsights) {
      eventPublisherOptions.gateway = options.wsServerInsights;
    }

    const EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;
    Object.defineProperties(this, {
      _accessToken: {
        value: accessToken
      },
      _eventPublisher: {
        value: new EventPublisher(
          accessToken,
          SDK_NAME,
          SDK_VERSION,
          options.environment,
          options.realm,
          eventPublisherOptions)
      },
      _localParticipant: {
        value: localParticipant
      },
      _name: {
        value: name,
      },
      _peerConnectionManager: {
        value: peerConnectionManager
      },
      _session: {
        value: null,
        writable: true
      },
      _twilioConnection: {
        value: new options.TwilioConnection(wsServer, options)
      },
      _updatesReceived: {
        value: []
      },
      _updatesToSend: {
        value: []
      },
      _userAgent: {
        value: options.userAgent
      }
    });
    setupEventListeners(this);
  }

  /**
   * Send a Connect, Sync or Disconnect RSP message.
   * @private
   */
  _sendConnectOrSyncOrDisconnectMessage() {
    if (this.state === 'connected') {
      return;
    }

    if (this.state === 'disconnected') {
      this._twilioConnection.sendMessage({
        type: 'disconnect',
        version: VERSION
      });
      return;
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
      version: VERSION
    };

    if (message.type === 'connect') {
      message.publisher = {
        name: SDK_NAME,
        sdk_version: SDK_VERSION,
        user_agent: this._userAgent
      };
      message.token = this._accessToken;
    } else if (message.type === 'sync') {
      message.session = this._session;
      message.token = this._accessToken;
    } else if (message.type === 'update') {
      message.session = this._session;
    }

    const sdpFormat = util.getSdpFormat();
    if (type === 'connect' && sdpFormat) {
      message.format = sdpFormat;
    }
    this._twilioConnection.sendMessage(message);
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
      this._eventPublisher.disconnect();
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
          version: VERSION
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
   * @param {string} groupName - Event group name
   * @param {string} eventName - Event name
   * @param {object} payload - Event payload
   * @returns {boolean} true if queued or published, false if disconnected from the Insights gateway
   */
  publishEvent(groupName, eventName, payload) {
    return this._eventPublisher.publish(groupName, eventName, payload);
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
}

/**
 * @event TwilioConnectionTransport#connected
 * @param {object} initialState
 */

/**
 * @event TwilioConnectionTransport#message
 * @param {object} state
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

function setupEventListeners(transport) {
  function connect() {
    transport._sendConnectOrSyncOrDisconnectMessage();
  }

  function disconnect(error) {
    if (!error) {
      transport.disconnect();
      return;
    }
    transport.disconnect(new SignalingConnectionError());
  }

  function handleMessage(message) {
    switch (transport.state) {
      case 'connected':
        switch (message.type) {
          case 'connected':
          case 'synced':
          case 'update':
            transport.emit('message', message);
            return;
          case 'disconnected':
            transport.preempt('disconnected');
            return;
          default:
            // Do nothing.
            return;
        }
      case 'connecting':
        switch (message.type) {
          case 'error':
            transport.disconnect(createTwilioError(message.code, message.message));
            return;
          case 'connected':
            transport._session = message.session;
            transport.emit('connected', message);
            transport.preempt('connected');
            return;
          case 'synced':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'disconnected':
            transport.preempt('disconnected');
            return;
          default:
            // Do nothing.
            return;
        }
      case 'disconnected':
        // Do nothing.
        return;
      case 'syncing':
        switch (message.type) {
          case 'connected':
          case 'update':
            transport._updatesReceived.push(message);
            return;
          case 'synced':
            transport.emit('message', message);
            transport.preempt('connected');
            return;
          case 'disconnected':
            transport.preempt('disconnected');
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

  const twilioConnection = transport._twilioConnection;
  twilioConnection.once('close', disconnect);
  twilioConnection.on('message', handleMessage);
  twilioConnection.once('open', connect);

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
        twilioConnection.removeListener('message', handleMessage);
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
}

module.exports = TwilioConnectionTransport;
