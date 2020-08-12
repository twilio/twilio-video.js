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
var DefaultBackoff = require('backoff');

var _require2 = require('../../util/constants'),
    reconnectBackoffConfig = _require2.reconnectBackoffConfig;

var Timeout = require('../../util/timeout');

var _require3 = require('../../util'),
    createBandwidthProfilePayload = _require3.createBandwidthProfilePayload,
    createMediaSignalingPayload = _require3.createMediaSignalingPayload,
    createSubscribePayload = _require3.createSubscribePayload,
    getUserAgent = _require3.getUserAgent;

var _require4 = require('../../util/twilio-video-errors'),
    createTwilioError = _require4.createTwilioError,
    RoomCompletedError = _require4.RoomCompletedError,
    SignalingConnectionError = _require4.SignalingConnectionError,
    SignalingServerBusyError = _require4.SignalingServerBusyError;

var ICE_VERSION = 1;
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
      Backoff: DefaultBackoff,
      InsightsPublisher: InsightsPublisher,
      NullInsightsPublisher: NullInsightsPublisher,
      TwilioConnection: TwilioConnection,
      iceServers: null,
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
      _iceServersStatus: {
        value: Array.isArray(options.iceServers) ? 'overrode' : 'acquire'
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
      _sessionTimer: {
        value: null,
        writable: true
      },
      _sessionTimeoutMS: {
        value: 0, // initially 0, set only after 1st successful connection.
        writable: true
      },
      _reconnectBackoff: {
        value: options.Backoff.exponential(reconnectBackoffConfig)
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

    if (options.eventObserver) {
      options.eventObserver.setPublisher(_this._eventPublisher);
    }

    setupTransport(_this);

    _this.once('connected', function (_ref) {
      var sid = _ref.sid,
          participant = _ref.participant;

      _this._eventPublisher.connect(sid, participant.sid);
    });
    return _this;
  }

  /**
   * Create a Connect, Sync or Disconnect RSP message.
   * @private
   * @returns {?object}
   */


  _createClass(TwilioConnectionTransport, [{
    key: '_createConnectOrSyncOrDisconnectMessage',
    value: function _createConnectOrSyncOrDisconnectMessage() {
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

      return message;
    }

    /**
     * Create an "ice" message.
     * @private
     */

  }, {
    key: '_createIceMessage',
    value: function _createIceMessage() {
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

  }, {
    key: '_sendConnectOrSyncOrDisconnectMessage',
    value: function _sendConnectOrSyncOrDisconnectMessage() {
      var message = this._createConnectOrSyncOrDisconnectMessage();
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

    /**
     * @private
     * @returns {void}
     */

  }, {
    key: '_setSession',
    value: function _setSession(session, sessionTimeout) {
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

  }, {
    key: '_getReconnectTimer',
    value: function _getReconnectTimer() {
      var _this2 = this;

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
          if (_this2._sessionTimer) {
            // do not allow any more reconnect attempts.
            _this2._sessionTimeoutMS = 0;
          }
        }, this._sessionTimeoutMS);
      }

      // return promise that waits with exponential backoff.
      return new Promise(function (resolve) {
        _this2._reconnectBackoff.once('ready', resolve);
        _this2._reconnectBackoff.backoff();
      });
    }

    /**
     * clears the session reconnect timer.
     *
     * @private
     * @returns {void}
     */

  }, {
    key: '_clearReconnectTimer',
    value: function _clearReconnectTimer() {
      this._reconnectBackoff.reset();
      if (this._sessionTimer) {
        this._sessionTimer.clear();
        this._sessionTimer = null;
      }
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
 * @param {object} peerConnections
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

function setupTransport(transport) {
  function createOrResetTwilioConnection() {
    if (transport.state === 'disconnected') {
      return;
    }
    if (transport._twilioConnection) {
      transport._twilioConnection.removeListener('message', handleMessage);
    }
    var _iceServersStatus = transport._iceServersStatus,
        _options = transport._options,
        _wsServer = transport._wsServer,
        state = transport.state;
    var TwilioConnection = _options.TwilioConnection;


    var twilioConnection = new TwilioConnection(_wsServer, Object.assign({
      helloBody: state === 'connecting' && _iceServersStatus === 'acquire' ? transport._createIceMessage() : transport._createConnectOrSyncOrDisconnectMessage()
    }, _options));

    twilioConnection.once('close', function (reason) {
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

    var reconnectTimer = transport._getReconnectTimer();
    if (!reconnectTimer) {
      var twilioError = error.message === TwilioConnection.CloseReason.BUSY ? new SignalingServerBusyError() : new SignalingConnectionError();
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
            transport._clearReconnectTimer();
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

  var _options = transport._options,
      _iceServersStatus = transport._iceServersStatus;
  var iceServers = _options.iceServers,
      onIced = _options.onIced;


  if (_iceServersStatus === 'overrode') {
    onIced(iceServers).then(createOrResetTwilioConnection);
  } else {
    createOrResetTwilioConnection();
  }
}

module.exports = TwilioConnectionTransport;