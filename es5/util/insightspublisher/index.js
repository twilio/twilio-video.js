'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var EventEmitter = require('events').EventEmitter;

var _require = require('..'),
    getUserAgent = _require.getUserAgent;

var MAX_RECONNECT_ATTEMPTS = 5;
var RECONNECT_INTERVAL_MS = 50;
var WS_CLOSE_NORMAL = 1000;

var toplevel = global.window || global;
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
var util = require('../../util');

/**
 * Publish events to the Insights gateway.
 * @extends EventEmitter
 * @emits InsightsPublisher#connected
 * @emits InsightsPublisher#disconnected
 * @emits InsightsPublisher#reconnecting
 */

var InsightsPublisher = function (_EventEmitter) {
  _inherits(InsightsPublisher, _EventEmitter);

  /**
   * @param {string} token - Insights gateway token
   * @param {string} sdkName - Name of the SDK using the {@link InsightsPublisher}
   * @param {string} sdkVersion - Version of the SDK using the {@link InsightsPublisher}
   * @param {string} environment - One of 'dev', 'stage' or 'prod'
   * @param {string} realm - Region identifier
   * @param {InsightsPublisherOptions} options - Override default behavior
   */
  function InsightsPublisher(token, sdkName, sdkVersion, environment, realm, options) {
    _classCallCheck(this, InsightsPublisher);

    var _this = _possibleConstructorReturn(this, (InsightsPublisher.__proto__ || Object.getPrototypeOf(InsightsPublisher)).call(this));

    options = Object.assign({
      gateway: createGateway(environment, realm) + '/v1/VideoEvents',
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectIntervalMs: RECONNECT_INTERVAL_MS,
      userAgent: getUserAgent(),
      WebSocket: WebSocket
    }, options);

    Object.defineProperties(_this, {
      _connectTimestamp: {
        value: 0,
        writable: true
      },
      _eventQueue: {
        value: []
      },
      _readyToConnect: {
        value: util.defer()
      },
      _reconnectAttemptsLeft: {
        value: options.maxReconnectAttempts,
        writable: true
      },
      _ws: {
        value: null,
        writable: true
      },
      _WebSocket: {
        value: options.WebSocket
      }
    });

    _this._readyToConnect.promise.then(function (_ref) {
      var roomSid = _ref.roomSid,
          participantSid = _ref.participantSid;

      var self = _this;
      _this.on('disconnected', function maybeReconnect(error) {
        self._session = null;
        if (error && self._reconnectAttemptsLeft > 0) {
          self.emit('reconnecting');
          reconnect(self, token, sdkName, sdkVersion, roomSid, participantSid, options);
          return;
        }
        self.removeListener('disconnected', maybeReconnect);
      });
      connect(_this, token, sdkName, sdkVersion, roomSid, participantSid, options);
    }).catch(function () {
      // ignore failures to connect
    });
    return _this;
  }

  /**
   * Start connecting to the Insights gateway.
   * @param {string} roomSid
   * @param {string} participantSid
   * @returns {void}
   */


  _createClass(InsightsPublisher, [{
    key: 'connect',
    value: function connect(roomSid, participantSid) {
      this._readyToConnect.resolve({ roomSid: roomSid, participantSid: participantSid });
    }

    /**
     * Publish an event to the Insights gateway.
     * @private
     * @param {*} event
     */

  }, {
    key: '_publish',
    value: function _publish(event) {
      event.session = this._session;
      this._ws.send(JSON.stringify(event));
    }

    /**
     * Disconnect from the Insights gateway.
     * @returns {boolean} true if called when connecting/open, false if not
     */

  }, {
    key: 'disconnect',
    value: function disconnect() {
      if (this._ws === null || this._ws.readyState === this._WebSocket.CLOSING || this._ws.readyState === this._WebSocket.CLOSED) {
        return false;
      }

      try {
        this._ws.close();
      } catch (error) {
        // Do nothing.
      }
      this.emit('disconnected');

      return true;
    }

    /**
     * Publish (or queue, if not connected) an event to the Insights gateway.
     * @param {string} groupName - Event group name
     * @param {string} eventName - Event name
     * @param {object} payload - Event payload
     * @returns {boolean} true if queued or published, false if disconnect() called
     */

  }, {
    key: 'publish',
    value: function publish(groupName, eventName, payload) {
      if (this._ws !== null && (this._ws.readyState === this._WebSocket.CLOSING || this._ws.readyState === this._WebSocket.CLOSED)) {
        return false;
      }

      var publishOrEnqueue = typeof this._session === 'string' ? this._publish.bind(this) : this._eventQueue.push.bind(this._eventQueue);

      publishOrEnqueue({
        group: groupName,
        name: eventName,
        payload: payload,
        timestamp: Date.now(),
        type: 'event',
        version: 1
      });

      return true;
    }
  }]);

  return InsightsPublisher;
}(EventEmitter);

/**
 * Start connecting to the Insights gateway.
 * @private
 * @param {InsightsPublisher} publisher
 * @param {string} name
 * @param {string} token
 * @param {string} sdkName
 * @param {string} sdkVersion
 * @param {string} roomSid
 * @param {string} participantSid
 * @param {InsightsPublisherOptions} options
 */


function connect(publisher, token, sdkName, sdkVersion, roomSid, participantSid, options) {
  publisher._connectTimestamp = Date.now();
  publisher._reconnectAttemptsLeft--;
  publisher._ws = new options.WebSocket(options.gateway);
  var ws = publisher._ws;

  ws.addEventListener('close', function (event) {
    if (event.code === WS_CLOSE_NORMAL) {
      publisher.emit('disconnected');
      return;
    }
    publisher.emit('disconnected', new Error('WebSocket Error ' + event.code + ': ' + event.reason));
  });

  ws.addEventListener('message', function (message) {
    handleConnectResponse(publisher, JSON.parse(message.data), options);
  });

  ws.addEventListener('open', function () {
    var connectRequest = {
      type: 'connect',
      token: token,
      version: 1
    };

    connectRequest.publisher = {
      name: sdkName,
      sdkVersion: sdkVersion,
      userAgent: options.userAgent,
      participantSid: participantSid,
      roomSid: roomSid
    };

    ws.send(JSON.stringify(connectRequest));
  });
}

/**
 * Create the Insights Websocket gateway URL.
 * @param {string} environment
 * @param {string} realm
 * @returns {string}
 */
function createGateway(environment, realm) {
  return environment === 'prod' ? 'wss://sdkgw.' + realm + '.twilio.com' : 'wss://sdkgw.' + environment + '-' + realm + '.twilio.com';
}

/**
 * Handle connect response from the Insights gateway.
 * @param {InsightsPublisher} publisher
 * @param {*} response
 * @param {InsightsPublisherOptions} options
 */
function handleConnectResponse(publisher, response, options) {
  switch (response.type) {
    case 'connected':
      publisher._session = response.session;
      publisher._reconnectAttemptsLeft = options.maxReconnectAttempts;
      publisher._eventQueue.splice(0).forEach(publisher._publish, publisher);
      publisher.emit('connected');
      break;
    case 'error':
      publisher._ws.close();
      publisher.emit('disconnected', new Error(response.message));
      break;
  }
}

/**
 * Start re-connecting to the Insights gateway with an appropriate delay based
 * on InsightsPublisherOptions#reconnectIntervalMs.
 * @private
 * @param {InsightsPublisher} publisher
 * @param {string} token
 * @param {string} sdkName
 * @param {string} sdkVersion
 * @param {string} roomSid
 * @param {string} participantSid
 * @param {InsightsPublisherOptions} options
 */
function reconnect(publisher, token, sdkName, sdkVersion, roomSid, participantSid, options) {
  var connectInterval = Date.now() - publisher._connectTimestamp;
  var timeToWait = options.reconnectIntervalMs - connectInterval;

  if (timeToWait > 0) {
    setTimeout(function () {
      connect(publisher, token, sdkName, sdkVersion, roomSid, participantSid, options);
    }, timeToWait);
    return;
  }

  connect(publisher, token, sdkName, sdkVersion, roomSid, participantSid, options);
}

/**
 * The {@link InsightsPublisher} is connected to the gateway.
 * @event InsightsPublisher#connected
 */

/**
 * The {@link InsightsPublisher} is disconnected from the gateway.
 * @event InsightsPublisher#disconnected
 * @param {Error} [error] - Optional error if disconnected unintentionally
 */

/**
 * The {@link InsightsPublisher} is re-connecting to the gateway.
 * @event InsightsPublisher#reconnecting
 */

/**
 * {@link InsightsPublisher} options.
 * @typedef {object} InsightsPublisherOptions
 * @property {string} [gateway=sdkgw.{environment}-{realm}.twilio.com] - Insights WebSocket gateway url
 * @property {number} [maxReconnectAttempts=5] - Max re-connect attempts
 * @property {number} [reconnectIntervalMs=50] - Re-connect interval in ms
 */

module.exports = InsightsPublisher;