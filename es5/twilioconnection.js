'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StateMachine = require('./statemachine');

var _require = require('./util'),
    buildLogLevels = _require.buildLogLevels,
    makeUUID = _require.makeUUID;

var Log = require('./util/log');
var Timeout = require('./util/timeout');

var nInstances = 0;

/*
  TwilioConnection states
  -----------------------

  +--------------+       +----------+
  |  connecting  | ----> |  closed  |
  +--------------+       +----------+
         |                    ^
         v                    |
     +--------+               |
     |  open  | ---------------
     +--------+
 */

var states = {
  closed: [],
  connecting: ['closed', 'open'],
  open: ['closed']
};

var DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 3;
var DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
var DEFAULT_WELCOME_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT_OFFSET = 100;
var WS_CLOSE_NORMAL = 1000;
var WS_CLOSE_WELCOME_TIMEOUT = 3000;
var WS_CLOSE_HEARTBEATS_MISSED = 3001;
var WS_CLOSE_HELLO_FAILED = 3002;
var WS_CLOSE_SEND_FAILED = 3003;

var toplevel = global.window || global;
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

/**
 * A {@link TwilioConnection} represents a WebSocket connection
 * to a Twilio Connections Messaging Protocol (TCMP) server.
 * @fires TwilioConnection#close
 * @fires TwilioConnection#error
 * @fires TwilioConnection#message
 * @fires TwilioConnection#open
 */

var TwilioConnection = function (_StateMachine) {
  _inherits(TwilioConnection, _StateMachine);

  /**
   * Construct a {@link TwilioConnection}.
   * @param {string} serverUrl - TCMP server url
   * @param {TwilioConnectionOptions} options - {@link TwilioConnection} options
   */
  function TwilioConnection(serverUrl, options) {
    _classCallCheck(this, TwilioConnection);

    var _this = _possibleConstructorReturn(this, (TwilioConnection.__proto__ || Object.getPrototypeOf(TwilioConnection)).call(this, 'connecting', states));

    options = Object.assign({
      maxConsecutiveMissedHeartbeats: DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS,
      requestedHeartbeatTimeout: DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT,
      welcomeTimeout: DEFAULT_WELCOME_TIMEOUT,
      Log: Log,
      WebSocket: WebSocket
    }, options);

    var logLevels = buildLogLevels(options.logLevel);
    var log = new options.Log('default', _this, logLevels);

    Object.defineProperties(_this, {
      _consecutiveHeartbeatsMissed: {
        value: 0,
        writable: true
      },
      _heartbeatTimeout: {
        value: null,
        writable: true
      },
      _instanceId: {
        value: ++nInstances
      },
      _log: {
        value: log
      },
      _messageQueue: {
        value: []
      },
      _options: {
        value: options
      },
      _sendHeartbeatTimeout: {
        value: null,
        writable: true
      },
      _welcomeTimeout: {
        value: null,
        writable: true
      },
      _ws: {
        value: null,
        writable: true
      }
    });

    _this.on('stateChanged', function (state, error) {
      return {
        closed: function closed() {
          return _this.emit('close', error);
        },
        open: function open() {
          return _this.emit('open');
        }
      }[state]();
    });

    _this._connect(serverUrl);
    return _this;
  }

  _createClass(TwilioConnection, [{
    key: 'toString',
    value: function toString() {
      return '[TwilioConnection #' + this._instanceId + ': ' + this._ws.url + ']';
    }

    /**
     * The number of consecutive "hearbeat" messages missed.
     * @property {number}
     */

  }, {
    key: '_close',


    /**
     * Close the {@link TwilioConnection}.
     * @param {{code: number, reason: string}} event
     * @private
     */
    value: function _close(_ref) {
      var code = _ref.code,
          reason = _ref.reason;

      if (this.state === 'closed') {
        return;
      }
      if (this._welcomeTimeout) {
        this._welcomeTimeout.clear();
      }
      if (this._heartbeatTimeout) {
        this._heartbeatTimeout.clear();
      }
      if (this._sendHeartbeatTimeout) {
        this._sendHeartbeatTimeout.clear();
      }
      this._messageQueue.splice(0);

      var log = this._log;
      if (code === WS_CLOSE_NORMAL) {
        log.debug('Closed');
      } else {
        log.warn('Closed: ' + code + ' - ' + reason);
      }

      this.transition('closed', null, code !== WS_CLOSE_NORMAL ? new Error('WebSocket Error ' + code + ': ' + reason) : null);

      var readyState = this._ws.readyState;
      var WebSocket = this._options.WebSocket;

      if (readyState !== WebSocket.CLOSING && readyState !== WebSocket.CLOSED) {
        this._ws.close(code, reason);
      }
    }

    /**
     * Connect to the TCMP server.
     * @param {string} serverUrl
     * @private
     */

  }, {
    key: '_connect',
    value: function _connect(serverUrl) {
      var _this2 = this;

      this._ws = new this._options.WebSocket(serverUrl);
      var log = this._log;
      var ws = this._ws;

      log.debug('Created a new WebSocket:', ws);
      ws.addEventListener('close', function (event) {
        return _this2._close(event);
      });

      ws.addEventListener('message', function (message) {
        log.debug('Incoming: ' + message.data);
        try {
          message = JSON.parse(message.data);
        } catch (error) {
          _this2.emit('error', error);
          return;
        }
        switch (message.type) {
          case 'bad':
            _this2._handleBad(message);
            break;
          case 'bye':
            // Do nothing.
            break;
          case 'heartbeat':
            _this2._handleHeartbeat();
            break;
          case 'msg':
            _this2._handleMessage(message);
            break;
          case 'welcome':
            _this2._handleWelcome(message);
            break;
          default:
            _this2._log.debug('Unknown message type: ' + message.type);
            _this2.emit('error', new Error('Unknown message type: ' + message.type));
            break;
        }
      });

      ws.addEventListener('open', function () {
        log.debug('WebSocket opened:', ws);
        _this2._sendHello();
        var welcomeTimeout = _this2._options.welcomeTimeout;

        _this2._welcomeTimeout = new Timeout(function () {
          return _this2._handleWelcomeTimeout();
        }, welcomeTimeout);
      });
    }

    /**
     * Handle an incoming "bad" message.
     * @param {{reason: string}} message
     * @private
     */

  }, {
    key: '_handleBad',
    value: function _handleBad(_ref2) {
      var reason = _ref2.reason;

      var log = this._log;
      if (this.state === 'connecting') {
        log.warn('Closing: ' + WS_CLOSE_HELLO_FAILED + ' - ' + reason);
        this._close({ code: WS_CLOSE_HELLO_FAILED, reason: reason });
        return;
      }
      log.debug('Error: ' + reason);
      this.emit('error', new Error(reason));
    }

    /**
     * Handle an incoming "heartbeat" message.
     * @private
     */

  }, {
    key: '_handleHeartbeat',
    value: function _handleHeartbeat() {
      if (this.state !== 'open') {
        return;
      }
      this._consecutiveHeartbeatsMissed = 0;
      this._heartbeatTimeout.reset();
    }

    /**
     * Handle a missed "heartbeat" message.
     * @private
     */

  }, {
    key: '_handleHeartbeatTimeout',
    value: function _handleHeartbeatTimeout() {
      if (this.state !== 'open') {
        return;
      }
      this._consecutiveHeartbeatsMissed++;
      var log = this._log;
      var maxConsecutiveMissedHeartbeats = this._options.maxConsecutiveMissedHeartbeats;


      log.debug('Consecutive heartbeats missed: ' + this._consecutiveHeartbeatsMissed);
      if (this._consecutiveHeartbeatsMissed < maxConsecutiveMissedHeartbeats) {
        this._heartbeatTimeout.reset();
        return;
      }

      var reason = 'Missed ' + maxConsecutiveMissedHeartbeats + ' "heartbeat" messages';
      log.warn('Closing: ' + WS_CLOSE_HEARTBEATS_MISSED + ' - ' + reason);
      this._close({ code: WS_CLOSE_HEARTBEATS_MISSED, reason: reason });
    }

    /**
     * Handle an incoming "msg" message.
     * @param {{body: object}} message
     * @private
     */

  }, {
    key: '_handleMessage',
    value: function _handleMessage(_ref3) {
      var body = _ref3.body;

      if (this.state !== 'open') {
        return;
      }
      this.emit('message', body);
    }

    /**
     * Handle an incoming "welcome" message.
     * @param {{ negotiatedTimeout: number }} message
     * @private
     */

  }, {
    key: '_handleWelcome',
    value: function _handleWelcome(_ref4) {
      var _this3 = this;

      var negotiatedTimeout = _ref4.negotiatedTimeout;

      if (this.state !== 'connecting') {
        return;
      }
      var heartbeatTimeout = negotiatedTimeout + HEARTBEAT_TIMEOUT_OFFSET;
      this._welcomeTimeout.clear();
      this._heartbeatTimeout = new Timeout(function () {
        return _this3._handleHeartbeatTimeout();
      }, heartbeatTimeout);
      this._messageQueue.splice(0).forEach(function (message) {
        return _this3._send(message);
      });
      this._sendHeartbeatTimeout = new Timeout(function () {
        return _this3._sendHeartbeat();
      }, negotiatedTimeout);
      this.transition('open');
    }

    /**
     * Handle a missed "welcome" message.
     * @private
     */

  }, {
    key: '_handleWelcomeTimeout',
    value: function _handleWelcomeTimeout() {
      if (this.state !== 'connecting') {
        return;
      }
      var reason = '"welcome" message timeout expired';
      this._log.warn('Closing: ' + WS_CLOSE_WELCOME_TIMEOUT + ' - ' + reason);
      this._close({ code: WS_CLOSE_WELCOME_TIMEOUT, reason: reason });
    }

    /**
     * Send a message to the TCMP server.
     * @param {*} message
     * @private
     */

  }, {
    key: '_send',
    value: function _send(message) {
      var readyState = this._ws.readyState;
      var WebSocket = this._options.WebSocket;

      if (readyState === WebSocket.OPEN) {
        var data = JSON.stringify(message);
        this._log.debug('Outgoing: ' + data);
        try {
          this._ws.send(data);
        } catch (error) {
          var reason = 'Failed to send message';
          this._log.warn('Closing: ' + WS_CLOSE_SEND_FAILED + ' - ' + reason);
          this._close({ code: WS_CLOSE_SEND_FAILED, reason: reason });
        }
      }
    }

    /**
     * Send a "heartbeat" message.
     * @private
     */

  }, {
    key: '_sendHeartbeat',
    value: function _sendHeartbeat() {
      if (this.state === 'closed') {
        return;
      }
      this._send({ type: 'heartbeat' });
      this._sendHeartbeatTimeout.reset();
    }

    /**
     * Send a "hello" message.
     * @private
     */

  }, {
    key: '_sendHello',
    value: function _sendHello() {
      var requestedHeartbeatTimeout = this._options.requestedHeartbeatTimeout;

      this._send({
        id: makeUUID(),
        timeout: requestedHeartbeatTimeout,
        type: 'hello'
      });
    }

    /**
     * Send or enqueue a message.
     * @param {*} message
     * @private
     */

  }, {
    key: '_sendOrEnqueue',
    value: function _sendOrEnqueue(message) {
      var _this4 = this;

      if (this.state === 'closed') {
        return;
      }
      var sendOrEnqueue = this.state === 'open' ? function (message) {
        return _this4._send(message);
      } : function (message) {
        return _this4._messageQueue.push(message);
      };

      sendOrEnqueue(message);
    }

    /**
     * Close the {@link TwilioConnection}.
     * @returns {void}
     */

  }, {
    key: 'close',
    value: function close() {
      if (this.state === 'closed') {
        return;
      }
      this._sendOrEnqueue({ type: 'bye' });
      this._ws.close(WS_CLOSE_NORMAL);
    }

    /**
     * Send a "msg" message.
     * @param {*} body
     * @returns {void}
     */

  }, {
    key: 'sendMessage',
    value: function sendMessage(body) {
      this._sendOrEnqueue({ body: body, type: 'msg' });
    }
  }, {
    key: 'consecutiveHeartbeatsMissed',
    get: function get() {
      return this._consecutiveHeartbeatsMissed;
    }
  }]);

  return TwilioConnection;
}(StateMachine);

/**
 * A {@link TwilioConnection} was closed.
 * @event TwilioConnection#close
 * @param {?Error} error - If closed by the client, then this is null
 */

/**
 * A {@link TwilioConnection} received an error from the TCMP server.
 * @event TwilioConnection#error
 * @param {Error} error - The TCMP server error
 */

/**
 * A {@link TwilioConnection} received a message from the TCMP server.
 * @event TwilioConnection#message
 * @param {*} body - Message body
 */

/**
 * A {@link TwilioConnection} completed a hello/welcome handshake with the TCMP server.
 * @event TwilioConnection#open
 */

/**
 * {@link TwilioConnection} options
 * @typedef {object} TwilioConnectionOptions
 * @property {LogLevel} [logLevel=warn] - Log level of the {@link TwilioConnection}
 * @property {number} [maxConsecutiveMissedHeartbeats=5] - Max. number of consecutive "heartbeat" messages that can be missed
 * @property {number} [requestedHeartbeatTimeout=5000] - "heartbeat" timeout (ms) requested by the {@link TwilioConnection}
 * @property {number} [welcomeTimeout=5000] - Time (ms) to wait for the "welcome" message after sending the "hello" message
 */

module.exports = TwilioConnection;