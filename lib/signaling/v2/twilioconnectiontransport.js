/* eslint-disable no-console */
'use strict';

const { getSdpFormat } = require('@twilio/webrtc/lib/util/sdp');
const packageInfo = require('../../../package.json');
const InsightsPublisher = require('../../util/insightspublisher');
const NullInsightsPublisher = require('../../util/insightspublisher/null');
const StateMachine = require('../../statemachine');
const TwilioConnection = require('../../twilioconnection');

const {
  createBandwidthProfilePayload,
  createMediaSignalingPayload,
  createSubscribePayload,
  getUserAgent,
  withJitter
} = require('../../util');

const {
  createTwilioError,
  RoomCompletedError,
  SignalingConnectionError
} = require('../../util/twilio-video-errors');

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BACKOFF_JITTER = 100;
const RECONNECT_BACKOFF_MS = 100;
const RSP_VERSION = 2;
const SDK_NAME = `${packageInfo.name}.js`;
const SDK_VERSION = packageInfo.version;
const ROOM_SERVICE_SUPPORTS_ICE = true;
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


const util = require('../../util');
const constants = require('../../util/constants');
const ECS = require('../../ecs');
const { getDefaultIceServers, getECSEndpoint } = require('../../util/endpoints');
function getTurnServers(token, { ecsServer, realm, environment }) {
  console.log('makarand', 'getTurnServers', arguments);
  ecsServer = ecsServer || getECSEndpoint(environment, realm);
  // eslint-disable-next-line new-cap
  const defaultIceServers = getDefaultIceServers(environment);
  const options = {
    configUrl: `${ecsServer}/v2/Configuration`,
    body: {
      service: 'video',
      sdk_version: SDK_VERSION
    }
  };

  return ECS.getConfiguration(token, options).then(config => {
    console.log('makarand', 'getTurnServers: got config', arguments);
    let { iceServers, ttl } = parseECSConfig(config);
    const status = 'success';
    ttl = ttl || constants.ICE_SERVERS_DEFAULT_TTL;
    return { status, iceServers, ttl };
  }).catch(e => {
    console.group('makarand', 'error retrieving ECS config:', e.message);
    return { status: 'failure', iceServers: defaultIceServers, ttl: constants.ICE_SERVERS_DEFAULT_TTL };
  });
}

/**
 * Parse an ECS configuration value, log any warnings, and return a tuple of
 * ICE servers and TTL.
 * @param {NTSIceServerSource} client
 * @param {object} config
 * @returns {Array<Array<RTCIceServerInit>|Number>} iceServersAndTTL
 * @throws {Error}
 */
function parseECSConfig(config) {
  console.log('makarand: parseECSConfig', config);
  const nts = util.getOrNull(config, 'video.network_traversal_service');
  if (!nts) {
    throw new Error('network_traversal_service not available');
  } else if (nts.warning) {
    console.log(nts.warning);
  }

  const iceServers = nts.ice_servers;
  if (!iceServers) {
    throw new Error('ice_servers not available');
  }
  console.log(`Got ICE servers: ${JSON.stringify(iceServers)}`);
  const ttl = nts.ttl;
  return { iceServers, ttl, status: 'success' };
  /*
  SAMPLE ICED MESSAGE.
  {
    "ice_servers": [
      {
        "urls": "turns:global.turn.twilio.com:443?transport=tcp",
        "username": "cool-user-name",
        "credential": "secret-turn-creds"
      },
      {
        "urls": "stun:global.stun.twilio.com:3478?transport=udp"
      }
    ],
    "type": "iced",
    "version": 1
  }
  */
//  {
//   "video": {
//       "network_traversal_service": {
//           "ttl": 14400,
//           "date_created": "Wed, 26 Feb 2020 00:10:11 +0000",
//           "date_updated": "Wed, 26 Feb 2020 00:10:11 +0000",
//           "capability_token": "video",
//           "ice_servers": [
//               {
//                   "urls": "turn:global.turn.twilio.com:3478?transport=udp",
//                   "username": "a725458b4dbb1d73f34917e4081baebfe102cf4ffef833a4cac359aeab8ef106",
//                   "credential": "K7qkG8wTdsquOGJNV5O8jJqWSGg0PhFheESc8bFVsF0="
//               },
//               {
//                   "urls": "turns:global.turn.twilio.com:443?transport=tcp",
//                   "username": "a725458b4dbb1d73f34917e4081baebfe102cf4ffef833a4cac359aeab8ef106",
//                   "credential": "K7qkG8wTdsquOGJNV5O8jJqWSGg0PhFheESc8bFVsF0="
//               }
//           ]
//       }
//   }
//   }
}

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
      overrideIceServers: null, // iceServers to use (if null we will send acquire them via ice)
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectBackOffJitter: RECONNECT_BACKOFF_JITTER,
      reconnectBackOffMs: RECONNECT_BACKOFF_MS,
      sdpFormat: getSdpFormat(options.sdpSemantics),
      trackPriority: true,
      trackSwitchOff: true,
      userAgent: getUserAgent()
    }, options);
    super('connecting', states);

    const { ecsServer, realm, environment } = options;
    const ecsOptions = { ecsServer, realm, environment };
    const eventPublisherOptions = {};
    if (options.wsServerInsights) {
      eventPublisherOptions.gateway = options.wsServerInsights;
    }

    const EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;

    const iceServerSource = options.overrideIceServers ? { status: 'override', iceServers: options.overrideIceServers } : null;
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
      _eventPublisher: {
        value: new EventPublisher(
          accessToken,
          SDK_NAME,
          SDK_VERSION,
          options.environment,
          options.region,
          eventPublisherOptions)
      },
      _localParticipant: {
        value: localParticipant
      },
      _name: {
        value: name,
      },
      _networkQuality: {
        value: options.networkQuality
      },
      _options: {
        value: options
      },
      _peerConnectionManager: {
        value: peerConnectionManager
      },
      _reconnectAttemptsLeft: {
        value: options.maxReconnectAttempts,
        writable: true
      },
      _reconnectBackOffJitter: {
        value: options.reconnectBackOffJitter
      },
      _reconnectBackOffMs: {
        value: options.reconnectBackOffMs
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
      },
      _iceServerSource: {
        value: iceServerSource,
        writable: true
      },
      ecsOptions: {
        value: ecsOptions
      }
    });
    setupEventListeners(this);

    this.once('connected', ({ sid, participant }) => {
      this._eventPublisher.connect(sid, participant.sid);
    });
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
        session: this._session,
        type: 'disconnect',
        version: RSP_VERSION
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
      version: RSP_VERSION
    };

    if (message.type === 'connect') {
      // if iceServer were specified in option use
      // overrode
      // otherwise success.
      message.ice_servers =  this._iceServerSource.status; //  this._iceServerSourceStatus; // TODO: check this

      message.publisher = {
        name: SDK_NAME,
        sdk_version: SDK_VERSION,
        user_agent: this._userAgent
      };

      if (this._bandwidthProfile) {
        message.bandwidth_profile = createBandwidthProfilePayload(
          this._bandwidthProfile);
      }

      message.media_signaling = createMediaSignalingPayload(
        this._dominantSpeaker,
        this._networkQuality,
        this._trackPriority,
        this._trackSwitchOff);

      message.subscribe = createSubscribePayload(
        this._automaticSubscription);

      const sdpFormat = this._options.sdpFormat;
      if (sdpFormat) {
        message.format = sdpFormat;
      }
      message.token = this._accessToken;
    } else if (message.type === 'sync') {
      message.session = this._session;
      message.token = this._accessToken;
    } else if (message.type === 'update') {
      message.session = this._session;
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

  resumeConnect() {
    this._sendConnectOrSyncOrDisconnectMessage();
  }

  _sendIceMessage() {
    if (ROOM_SERVICE_SUPPORTS_ICE) {
      this._twilioConnection.sendMessage({
        edge: this._options.region,
        token: this._accessToken,
        type: 'ice',
        version: 1
      });
    } else {
      // makarand: TODO: remove this once room service implements.
      // for now its using out of band request to get turn servers, and
      // then simulates the 'iced' message.
      getTurnServers(this._accessToken, this.ecsOptions)
        .then(({ iceServers }) => {
          this._twilioConnection.emit('message', { type: 'iced', ice_servers: iceServers });
        }).catch(e => {
          console.log('error getting turn servers:' + e.message, e);
        });
    }
  }

  connect() {
    // sends 'ice' message if don't have _iceServers already
    if (!this._iceServerSource) {
      this._sendIceMessage();
    } else {
      this.resumeConnect();
    }
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
  function createOrResetTwilioConnection() {
    if (transport._twilioConnection) {
      transport._twilioConnection.removeListener('message', handleMessage);
    }
    const { _options, _wsServer } = transport;
    const { TwilioConnection } = transport._options;
    transport._twilioConnection = new TwilioConnection(_wsServer, _options);
    return transport._twilioConnection;
  }

  function disconnect(error) {
    console.log('makarand: socket disconnected: ', error);
    if (transport.state === 'disconnected') {
      return;
    }
    if (!error) {
      transport.disconnect();
      return;
    }
    if (transport._reconnectAttemptsLeft <= 0) {
      transport.disconnect(new SignalingConnectionError());
      return;
    }
    reconnect();
  }

  function reconnect() {
    if (transport.state === 'connected') {
      transport.preempt('syncing');
    }
    transport._reconnectAttemptsLeft--;
    const { maxReconnectAttempts } = transport._options;
    const reconnectAttempts = maxReconnectAttempts - transport._reconnectAttemptsLeft;
    const backOffMs = (1 << reconnectAttempts) * transport._reconnectBackOffMs;
    setTimeout(startConnect, withJitter(backOffMs, transport._reconnectBackOffJitter));
  }

  function resetReconnectAttemptsLeft() {
    const { maxReconnectAttempts } = transport._options;
    transport._reconnectAttemptsLeft = maxReconnectAttempts;
  }

  function startConnect() {
    if (transport.state === 'disconnected') {
      return;
    }
    const twilioConnection = createOrResetTwilioConnection();
    twilioConnection.once('close', disconnect);
    twilioConnection.on('message', handleMessage);
    twilioConnection.once('open', () => transport.connect());
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
            transport._iceServerSource = {
              status: ROOM_SERVICE_SUPPORTS_ICE ? 'acquire' : 'success',
              iceServers: message.ice_servers
            };
            transport.emit('iced', transport._iceServerSource.iceServers);
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
            resetReconnectAttemptsLeft();
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

  startConnect();
}

module.exports = TwilioConnectionTransport;
