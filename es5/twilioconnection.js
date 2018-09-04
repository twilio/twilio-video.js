'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var StateMachine = require('./statemachine');

var _require = require('./util'),
    makeUUID = _require.makeUUID;

var Timeout = require('./util/timeout');

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

var DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 5;
var DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
var DEFAULT_WELCOME_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT_OFFSET = 100;
var WS_CLOSE_NORMAL = 1000;
var WS_CLOSE_WELCOME_TIMEOUT = 3000;
var WS_CLOSE_HEARTBEATS_MISSED = 3001;
var WS_CLOSE_HELLO_FAILED = 3002;

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

    Object.defineProperties(_this, {
      _consecutiveHeartbeatsMissed: {
        value: 0,
        writable: true
      },
      _heartbeatTimeout: {
        value: null,
        writable: true
      },
      _messageQueue: {
        value: []
      },
      _options: {
        value: Object.assign({
          maxConsecutiveMissedHeartbeats: DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS,
          requestedHeartbeatTimeout: DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT,
          welcomeTimeout: DEFAULT_WELCOME_TIMEOUT,
          WebSocket: WebSocket
        }, options)
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

  /**
   * The number of consecutive "hearbeat" messages missed.
   * @property {number}
   */


  _createClass(TwilioConnection, [{
    key: '_connect',


    /**
     * Connect to the TCMP server.
     * @param {string} serverUrl
     * @private
     */
    value: function _connect(serverUrl) {
      var _this2 = this;

      this._ws = new this._options.WebSocket(serverUrl);
      var ws = this._ws;

      ws.addEventListener('close', function (event) {
        if (_this2._welcomeTimeout) {
          _this2._welcomeTimeout.clear();
        }
        if (_this2._heartbeatTimeout) {
          _this2._heartbeatTimeout.clear();
        }
        if (_this2._sendHeartbeatTimeout) {
          _this2._sendHeartbeatTimeout.clear();
        }
        _this2._messageQueue.splice(0);
        _this2.transition('closed', null, event.code !== WS_CLOSE_NORMAL ? new Error('WebSocket Error ' + event.code + ': ' + event.reason) : null);
      });

      ws.addEventListener('message', function (message) {
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
            _this2.emit('error', new Error('Unknown message type: ' + message.type));
            break;
        }
      });

      ws.addEventListener('open', function () {
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
    value: function _handleBad(_ref) {
      var reason = _ref.reason;

      if (this.state === 'connecting') {
        this._ws.close(WS_CLOSE_HELLO_FAILED, reason);
        return;
      }
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
      var maxConsecutiveMissedHeartbeats = this._options.maxConsecutiveMissedHeartbeats;


      if (this._consecutiveHeartbeatsMissed < maxConsecutiveMissedHeartbeats) {
        this._heartbeatTimeout.reset();
        return;
      }
      this._ws.close(WS_CLOSE_HEARTBEATS_MISSED, 'Missed ' + maxConsecutiveMissedHeartbeats + ' "heartbeat" messages');
    }

    /**
     * Handle an incoming "msg" message.
     * @param {{body: object}} message
     * @private
     */

  }, {
    key: '_handleMessage',
    value: function _handleMessage(_ref2) {
      var body = _ref2.body;

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
    value: function _handleWelcome(_ref3) {
      var _this3 = this;

      var negotiatedTimeout = _ref3.negotiatedTimeout;

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
      this._ws.close(WS_CLOSE_WELCOME_TIMEOUT, '"welcome" message timeout expired');
    }

    /**
     * Send a message to the TCMP server.
     * @param {*} message
     * @private
     */

  }, {
    key: '_send',
    value: function _send(message) {
      this._ws.send(JSON.stringify(message));
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
      this._ws.close();
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
 * @property {number} [maxConsecutiveMissedHeartbeats=5] - Max. number of consecutive "heartbeat" messages that can be missed
 * @property {number} [requestedHeartbeatTimeout=5000] - "heartbeat" timeout (ms) requested by the {@link TwilioConnection}
 * @property {number} [welcomeTimeout=5000] - Time (ms) to wait for the "welcome" message after sending the "hello" message
 */

module.exports = TwilioConnection;