'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _require = require('@twilio/webrtc/lib/util/sdp'),
    getSdpFormat = _require.getSdpFormat;

var packageInfo = require('../../../package.json');
var InsightsPublisher = require('../../util/insightspublisher');
var NullInsightsPublisher = require('../../util/insightspublisher/null');
var StateMachine = require('../../statemachine');
var TwilioConnection = require('../../twilioconnection');

var _require2 = require('../../util'),
    createBandwidthProfilePayload = _require2.createBandwidthProfilePayload,
    createMediaSignalingPayload = _require2.createMediaSignalingPayload,
    createSubscribePayload = _require2.createSubscribePayload,
    getUserAgent = _require2.getUserAgent,
    withJitter = _require2.withJitter;

var _require3 = require('../../util/twilio-video-errors'),
    createTwilioError = _require3.createTwilioError,
    RoomCompletedError = _require3.RoomCompletedError,
    SignalingConnectionError = _require3.SignalingConnectionError;

var MAX_RECONNECT_ATTEMPTS = 5;
var RECONNECT_BACKOFF_JITTER = 100;
var RECONNECT_BACKOFF_MS = 100;
var RSP_VERSION = 2;
var SDK_NAME = packageInfo.name + '.js';
var SDK_VERSION = packageInfo.version;

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
  connecting: ['connected', 'disconnected'],
  connected: ['disconnected', 'syncing'],
  syncing: ['connected', 'disconnected'],
  disconnected: []
};

/**
 * A {@link TwilioConnectionTransport} supports sending and receiving Room Signaling Protocol
 * (RSP) messages. It also supports RSP requests, such as Sync and Disconnect.
 * @extends StateMachine
 * @emits TwilioConnectionTransport#connected
 * @emits TwilioConnectionTransport#message
 */

var TwilioConnectionTransport = function (_StateMachine) {
  _inherits(TwilioConnectionTransport, _StateMachine);

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
    _classCallCheck(this, TwilioConnectionTransport);

    options = Object.assign({
      InsightsPublisher: InsightsPublisher,
      NullInsightsPublisher: NullInsightsPublisher,
      TwilioConnection: TwilioConnection,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectBackOffJitter: RECONNECT_BACKOFF_JITTER,
      reconnectBackOffMs: RECONNECT_BACKOFF_MS,
      sdpFormat: getSdpFormat(options.sdpSemantics),
      trackPriority: true,
      trackSwitchOff: true,
      userAgent: getUserAgent()
    }, options);

    var _this = _possibleConstructorReturn(this, (TwilioConnectionTransport.__proto__ || Object.getPrototypeOf(TwilioConnectionTransport)).call(this, 'connecting', states));

    var eventPublisherOptions = {};
    if (options.wsServerInsights) {
      eventPublisherOptions.gateway = options.wsServerInsights;
    }

    var EventPublisher = options.insights ? options.InsightsPublisher : options.NullInsightsPublisher;
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
      _eventPublisher: {
        value: new EventPublisher(accessToken, SDK_NAME, SDK_VERSION, options.environment, options.realm, eventPublisherOptions)
      },
      _iceServerSourceStatus: {
        value: options.iceServerSourceStatus
      },
      _localParticipant: {
        value: localParticipant
      },
      _name: {
        value: name
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
      }
    });
    setupEventListeners(_this);

    _this.once('connected', function (_ref) {
      var sid = _ref.sid,
          participant = _ref.participant;

      _this._eventPublisher.connect(sid, participant.sid);
    });
    return _this;
  }

  /**
   * Send a Connect, Sync or Disconnect RSP message.
   * @private
   */


  _createClass(TwilioConnectionTransport, [{
    key: '_sendConnectOrSyncOrDisconnectMessage',
    value: function _sendConnectOrSyncOrDisconnectMessage() {
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
        message.ice_servers = this._iceServerSourceStatus;

        message.publisher = {
          name: SDK_NAME,
          sdk_version: SDK_VERSION,
          user_agent: this._userAgent
        };

        if (this._bandwidthProfile) {
          message.bandwidth_profile = createBandwidthProfilePayload(this._bandwidthProfile);
        }

        message.media_signaling = createMediaSignalingPayload(this._dominantSpeaker, this._networkQuality, this._trackPriority, this._trackSwitchOff);

        message.subscribe = createSubscribePayload(this._automaticSubscription);

        var sdpFormat = this._options.sdpFormat;
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

  }, {
    key: 'disconnect',
    value: function disconnect(error) {
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

  }, {
    key: 'publish',
    value: function publish(update) {
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

  }, {
    key: 'publishEvent',
    value: function publishEvent(groupName, eventName, payload) {
      return this._eventPublisher.publish(groupName, eventName, payload);
    }

    /**
     * Sync the {@link TwilioConnectionTransport}. Returns true if calling the method resulted in
     * syncing.
     * @returns {boolean}
     */

  }, {
    key: 'sync',
    value: function sync() {
      if (this.state === 'connected') {
        this.preempt('syncing');
        this._sendConnectOrSyncOrDisconnectMessage();
        return true;
      }
      return false;
    }
  }]);

  return TwilioConnectionTransport;
}(StateMachine);

/**
 * @event TwilioConnectionTransport#connected
 * @param {object} initialState
 */

/**
 * @event TwilioConnectionTransport#message
 * @param {object} state
 */

function reducePeerConnections(peerConnections) {
  return Array.from(peerConnections.reduce(function (peerConnectionsById, update) {
    var reduced = peerConnectionsById.get(update.id) || update;

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
  return updates.reduce(function (reduced, update) {
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
      reduced.peer_connections = reducePeerConnections(reduced.peer_connections.concat(update.peer_connections));
    }
    return reduced;
  }, {});
}

function setupEventListeners(transport) {
  function connect() {
    transport._sendConnectOrSyncOrDisconnectMessage();
  }

  function createOrResetTwilioConnection() {
    if (transport._twilioConnection) {
      transport._twilioConnection.removeListener('message', handleMessage);
    }
    var _options = transport._options,
        _wsServer = transport._wsServer;
    var TwilioConnection = transport._options.TwilioConnection;

    transport._twilioConnection = new TwilioConnection(_wsServer, _options);
    return transport._twilioConnection;
  }

  function disconnect(error) {
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
    var maxReconnectAttempts = transport._options.maxReconnectAttempts;

    var reconnectAttempts = maxReconnectAttempts - transport._reconnectAttemptsLeft;
    var backOffMs = (1 << reconnectAttempts) * transport._reconnectBackOffMs;
    setTimeout(startConnect, withJitter(backOffMs, transport._reconnectBackOffJitter));
  }

  function resetReconnectAttemptsLeft() {
    var maxReconnectAttempts = transport._options.maxReconnectAttempts;

    transport._reconnectAttemptsLeft = maxReconnectAttempts;
  }

  function startConnect() {
    if (transport.state === 'disconnected') {
      return;
    }
    var twilioConnection = createOrResetTwilioConnection();
    twilioConnection.once('close', disconnect);
    twilioConnection.on('message', handleMessage);
    twilioConnection.once('open', connect);
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
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
            return;
          default:
            // Do nothing.
            return;
        }
      case 'connecting':
        switch (message.type) {
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
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
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
            transport.disconnect(message.status === 'completed' ? new RoomCompletedError() : null);
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
      case 'connected':
        {
          var updates = transport._updatesToSend.splice(0);
          if (updates.length) {
            transport.publish(reduceUpdates(updates));
          }
          transport._updatesReceived.splice(0).forEach(function (update) {
            return transport.emit('message', update);
          });
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