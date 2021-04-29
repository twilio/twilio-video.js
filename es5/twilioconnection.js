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
var NetworkMonitor = require('./util/networkmonitor');
var Timeout = require('./util/timeout');

var nInstances = 0;

/*
  TwilioConnection states
  -----------------------

       ------------------------------------------
       |                                        |
       |                                        v
  +---------+       +--------------+       +----------+
  |  early  | ----> |  connecting  | ----> |  closed  |
  +---------+       +--------------+       +----------+
    ^                     | ^ |                 ^ ^
    | --------------------- | |                 | |
    | | --------------------- |                 | |
    | | | --------------------|------------------ |
    | v | |                   v                   |
  +----------+           +--------+               |
  | waiting  | --------> |  open  | ---------------
  +----------+           +--------+
 */

var states = {
  closed: [],
  connecting: ['closed', 'open', 'waiting'],
  early: ['closed', 'connecting'],
  open: ['closed'],
  waiting: ['closed', 'connecting', 'early', 'open']
};

var events = {
  closed: 'close',
  open: 'open',
  waiting: 'waiting'
};

var TCMP_VERSION = 2;

var DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 3;
var DEFAULT_MAX_CONSECUTIVE_FAILED_HELLOS = 3;
var DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
var DEFAULT_OPEN_TIMEOUT = 15000;
var DEFAULT_WELCOME_TIMEOUT = 5000;
var OUTGOING_HEARTBEAT_OFFSET = 200;

var WS_CLOSE_NORMAL = 1000;
var WS_CLOSE_WELCOME_TIMEOUT = 3000;
var WS_CLOSE_HEARTBEATS_MISSED = 3001;
var WS_CLOSE_HELLO_FAILED = 3002;
var WS_CLOSE_SEND_FAILED = 3003;
var WS_CLOSE_NETWORK_CHANGED = 3004;
var WS_CLOSE_BUSY_WAIT = 3005;
var WS_CLOSE_SERVER_BUSY = 3006;
var WS_CLOSE_OPEN_TIMEOUT = 3007;

var toplevel = global.window || global;
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

var CloseReason = {
  BUSY: 'busy',
  FAILED: 'failed',
  LOCAL: 'local',
  REMOTE: 'remote',
  TIMEOUT: 'timeout'
};

var wsCloseCodesToCloseReasons = new Map([[WS_CLOSE_WELCOME_TIMEOUT, CloseReason.TIMEOUT], [WS_CLOSE_HEARTBEATS_MISSED, CloseReason.TIMEOUT], [WS_CLOSE_HELLO_FAILED, CloseReason.FAILED], [WS_CLOSE_SEND_FAILED, CloseReason.FAILED], [WS_CLOSE_NETWORK_CHANGED, CloseReason.TIMEOUT], [WS_CLOSE_SERVER_BUSY, CloseReason.BUSY], [WS_CLOSE_OPEN_TIMEOUT, CloseReason.TIMEOUT]]);

/**
 * A {@link TwilioConnection} represents a WebSocket connection
 * to a Twilio Connections Messaging Protocol (TCMP) server.
 * @fires TwilioConnection#close
 * @fires TwilioConnection#error
 * @fires TwilioConnection#message
 * @fires TwilioConnection#open
 * @fires TwilioConnection#waiting
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

    var _this = _possibleConstructorReturn(this, (TwilioConnection.__proto__ || Object.getPrototypeOf(TwilioConnection)).call(this, 'early', states));

    options = Object.assign({
      helloBody: null,
      maxConsecutiveFailedHellos: DEFAULT_MAX_CONSECUTIVE_FAILED_HELLOS,
      maxConsecutiveMissedHeartbeats: DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS,
      requestedHeartbeatTimeout: DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT,
      openTimeout: DEFAULT_OPEN_TIMEOUT,
      welcomeTimeout: DEFAULT_WELCOME_TIMEOUT,
      Log: Log,
      WebSocket: WebSocket
    }, options);

    var logLevels = buildLogLevels(options.logLevel);
    var log = new options.Log('default', _this, logLevels, options.loggerName);

    var networkMonitor = options.networkMonitor ? new NetworkMonitor(function () {
      var type = networkMonitor.type;

      var reason = 'Network changed' + (type ? ' to ' + type : '');
      log.debug(reason);
      _this._close({ code: WS_CLOSE_NETWORK_CHANGED, reason: reason });
    }) : null;

    Object.defineProperties(_this, {
      _busyWaitTimeout: {
        value: null,
        writable: true
      },
      _consecutiveHeartbeatsMissed: {
        value: 0,
        writable: true
      },
      _cookie: {
        value: null,
        writable: true
      },
      _eventObserver: {
        value: options.eventObserver
      },
      _heartbeatTimeout: {
        value: null,
        writable: true
      },
      _hellosLeft: {
        value: options.maxConsecutiveFailedHellos,
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
      _networkMonitor: {
        value: networkMonitor
      },
      _options: {
        value: options
      },
      _openTimeout: {
        value: null,
        writable: true
      },
      _sendHeartbeatTimeout: {
        value: null,
        writable: true
      },
      _serverUrl: {
        value: serverUrl
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

    var eventsToLevels = {
      connecting: 'info',
      early: 'info',
      open: 'info',
      waiting: 'warning',
      closed: 'info'
    };

    _this.on('stateChanged', function (state) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      if (state in events) {
        _this.emit.apply(_this, [events[state]].concat(args));
      }
      var event = { name: state, group: 'signaling', level: eventsToLevels[_this.state] };
      if (state === 'closed') {
        var reason = args[0];

        event.payload = { reason: reason };
        event.level = reason === CloseReason.LOCAL ? 'info' : 'error';
      }
      _this._eventObserver.emit('event', event);
    });

    _this._eventObserver.emit('event', { name: _this.state, group: 'signaling', level: eventsToLevels[_this.state] });
    _this._connect();
    return _this;
  }

  _createClass(TwilioConnection, [{
    key: 'toString',
    value: function toString() {
      return '[TwilioConnection #' + this._instanceId + ': ' + this._ws.url + ']';
    }

    /**
     * Close the {@link TwilioConnection}.
     * @param {{code: number, reason: string}} event
     * @private
     */

  }, {
    key: '_close',
    value: function _close(_ref) {
      var code = _ref.code,
          reason = _ref.reason;

      if (this.state === 'closed') {
        return;
      }
      if (this._openTimeout) {
        this._openTimeout.clear();
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
      if (this._networkMonitor) {
        this._networkMonitor.stop();
      }
      if (this._busyWaitTimeout && code !== WS_CLOSE_BUSY_WAIT) {
        this._busyWaitTimeout.clear();
      }
      this._messageQueue.splice(0);
      var log = this._log;

      if (code === WS_CLOSE_NORMAL) {
        log.debug('Closed');
        this.transition('closed', null, [CloseReason.LOCAL]);
      } else {
        log.warn('Closed: ' + code + ' - ' + reason);
        if (code !== WS_CLOSE_BUSY_WAIT) {
          this.transition('closed', null, [wsCloseCodesToCloseReasons.get(code) || CloseReason.REMOTE]);
        }
      }
      var readyState = this._ws.readyState;
      var WebSocket = this._options.WebSocket;


      if (readyState !== WebSocket.CLOSING && readyState !== WebSocket.CLOSED) {
        this._ws.close(code, reason);
      }
    }

    /**
     * Connect to the TCMP server.
     * @private
     */

  }, {
    key: '_connect',
    value: function _connect() {
      var _this2 = this;

      var log = this._log;
      if (this.state === 'waiting') {
        this.transition('early');
      } else if (this.state !== 'early') {
        log.warn('Unexpected state "' + this.state + '" for connecting to the' + ' TCMP server.');
        return;
      }
      this._ws = new this._options.WebSocket(this._serverUrl);
      var ws = this._ws;
      log.debug('Created a new WebSocket:', ws);
      ws.addEventListener('close', function (event) {
        return _this2._close(event);
      });

      var openTimeout = this._options.openTimeout;
      // Add a timeout for getting the onopen event on the WebSocket (15 sec). After that, attempt to reconnect only if this is not the first attempt.

      this._openTimeout = new Timeout(function () {
        var reason = 'Failed to open in ' + openTimeout + ' ms';
        _this2._close({ code: WS_CLOSE_OPEN_TIMEOUT, reason: reason });
      }, openTimeout);

      ws.addEventListener('open', function () {
        log.debug('WebSocket opened:', ws);
        _this2._openTimeout.clear();
        _this2._startHandshake();
        if (_this2._networkMonitor) {
          _this2._networkMonitor.start();
        }
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
          case 'busy':
            _this2._handleBusy(message);
            break;
          case 'bye':
            // Do nothing.
            break;
          case 'msg':
            _this2._handleMessage(message);
          // NOTE(mpatwardhan): Each incoming message should be treated as an incoming
          // heartbeat intentionally falling through to 'heartbeat' case.
          // eslint-disable-next-line no-fallthrough
          case 'heartbeat':
            _this2._handleHeartbeat();
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
      if (!['connecting', 'open'].includes(this.state)) {
        log.warn('Unexpected state "' + this.state + '" for handling a "bad" message' + ' from the TCMP server.');
        return;
      }
      if (this.state === 'connecting') {
        log.warn('Closing: ' + WS_CLOSE_HELLO_FAILED + ' - ' + reason);
        this._close({ code: WS_CLOSE_HELLO_FAILED, reason: reason });
        return;
      }
      log.debug('Error: ' + reason);
      this.emit('error', new Error(reason));
    }

    /**
     * Handle an incoming "busy" message.
     * @param {{cookie: ?string, keepAlive: boolean, retryAfter: number}} message
     * @private
     */

  }, {
    key: '_handleBusy',
    value: function _handleBusy(_ref3) {
      var _this3 = this;

      var cookie = _ref3.cookie,
          keepAlive = _ref3.keepAlive,
          retryAfter = _ref3.retryAfter;

      var log = this._log;
      if (!['connecting', 'waiting'].includes(this.state)) {
        log.warn('Unexpected state "' + this.state + '" for handling a "busy" message' + ' from the TCMP server.');
        return;
      }
      if (this._busyWaitTimeout) {
        this._busyWaitTimeout.clear();
      }
      if (this._welcomeTimeout) {
        this._welcomeTimeout.clear();
      }
      var reason = retryAfter < 0 ? 'Received terminal "busy" message' : 'Received "busy" message, retrying after ' + retryAfter + ' ms';

      if (retryAfter < 0) {
        log.warn('Closing: ' + WS_CLOSE_SERVER_BUSY + ' - ' + reason);
        this._close({ code: WS_CLOSE_SERVER_BUSY, reason: reason });
        return;
      }
      var maxConsecutiveFailedHellos = this._options.maxConsecutiveFailedHellos;

      this._hellosLeft = maxConsecutiveFailedHellos;
      this._cookie = cookie || null;

      if (keepAlive) {
        log.warn(reason);
        this._busyWaitTimeout = new Timeout(function () {
          return _this3._startHandshake();
        }, retryAfter);
      } else {
        log.warn('Closing: ' + WS_CLOSE_BUSY_WAIT + ' - ' + reason);
        this._close({ code: WS_CLOSE_BUSY_WAIT, reason: reason });
        this._busyWaitTimeout = new Timeout(function () {
          return _this3._connect();
        }, retryAfter);
      }

      this.transition('waiting', null, [keepAlive, retryAfter]);
    }

    /**
     * Handle an incoming "heartbeat" message.
     * @private
     */

  }, {
    key: '_handleHeartbeat',
    value: function _handleHeartbeat() {
      if (this.state !== 'open') {
        this._log.warn('Unexpected state "' + this.state + '" for handling a "heartbeat"' + ' message from the TCMP server.');
        return;
      }
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
      var log = this._log;
      var maxConsecutiveMissedHeartbeats = this._options.maxConsecutiveMissedHeartbeats;


      log.debug('Consecutive heartbeats missed: ' + maxConsecutiveMissedHeartbeats);
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
    value: function _handleMessage(_ref4) {
      var body = _ref4.body;

      if (this.state !== 'open') {
        this._log.warn('Unexpected state "' + this.state + '" for handling a "msg" message' + ' from the TCMP server.');
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
    value: function _handleWelcome(_ref5) {
      var _this4 = this;

      var negotiatedTimeout = _ref5.negotiatedTimeout;

      var log = this._log;

      if (!['connecting', 'waiting'].includes(this.state)) {
        log.warn('Unexpected state "' + this.state + '" for handling a "welcome"' + ' message from the TCMP server.');
        return;
      }

      if (this.state === 'waiting') {
        log.debug('Received "welcome" message, no need to retry connection.');
        this._busyWaitTimeout.clear();
      }

      var maxConsecutiveMissedHeartbeats = this._options.maxConsecutiveMissedHeartbeats;

      var heartbeatTimeout = negotiatedTimeout * maxConsecutiveMissedHeartbeats;
      var outgoingHeartbeatTimeout = negotiatedTimeout - OUTGOING_HEARTBEAT_OFFSET;

      this._welcomeTimeout.clear();
      this._heartbeatTimeout = new Timeout(function () {
        return _this4._handleHeartbeatTimeout();
      }, heartbeatTimeout);
      this._messageQueue.splice(0).forEach(function (message) {
        return _this4._send(message);
      });
      this._sendHeartbeatTimeout = new Timeout(function () {
        return _this4._sendHeartbeat();
      }, outgoingHeartbeatTimeout);
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
      var log = this._log;

      if (this._hellosLeft <= 0) {
        var reason = 'All handshake attempts failed';
        log.warn('Closing: ' + WS_CLOSE_WELCOME_TIMEOUT + ' - ' + reason);
        this._close({ code: WS_CLOSE_WELCOME_TIMEOUT, reason: reason });
        return;
      }

      var maxConsecutiveFailedHellos = this._options.maxConsecutiveFailedHellos;

      log.warn('Handshake attempt ' + (maxConsecutiveFailedHellos - this._hellosLeft) + ' failed');
      this._startHandshake();
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
          if (this._sendHeartbeatTimeout) {
            // Each outgoing message is to be treated as an outgoing heartbeat.
            this._sendHeartbeatTimeout.reset();
          }
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
    }

    /**
     * Send a "hello" message.
     * @private
     */

  }, {
    key: '_sendHello',
    value: function _sendHello() {
      var _options = this._options,
          helloBody = _options.helloBody,
          timeout = _options.requestedHeartbeatTimeout;

      var hello = {
        id: makeUUID(),
        timeout: timeout,
        type: 'hello',
        version: TCMP_VERSION
      };
      if (this._cookie) {
        hello.cookie = this._cookie;
      }
      if (helloBody) {
        hello.body = helloBody;
      }
      this._send(hello);
    }

    /**
     * Send or enqueue a message.
     * @param {*} message
     * @private
     */

  }, {
    key: '_sendOrEnqueue',
    value: function _sendOrEnqueue(message) {
      var _this5 = this;

      if (this.state === 'closed') {
        return;
      }
      var sendOrEnqueue = this.state === 'open' ? function (message) {
        return _this5._send(message);
      } : function (message) {
        return _this5._messageQueue.push(message);
      };

      sendOrEnqueue(message);
    }

    /**
     * Start the TCMP handshake.
     * @private
     */

  }, {
    key: '_startHandshake',
    value: function _startHandshake() {
      var _this6 = this;

      if (['early', 'waiting'].includes(this.state)) {
        this.transition('connecting');
      }
      if (this.state !== 'connecting') {
        return;
      }
      this._hellosLeft--;
      this._sendHello();
      var welcomeTimeout = this._options.welcomeTimeout;

      this._welcomeTimeout = new Timeout(function () {
        return _this6._handleWelcomeTimeout();
      }, welcomeTimeout);
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
      this._close({ code: WS_CLOSE_NORMAL, reason: 'Normal' });
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
  }]);

  return TwilioConnection;
}(StateMachine);

/**
 * A unique string depicting the reason for the {@link TwilioConnection} being closed.
 * @enum {string}
 */


TwilioConnection.CloseReason = CloseReason;

/**
 * A {@link TwilioConnection} was closed.
 * @event TwilioConnection#close
 * @param {CloseReason} reason - The reason for the {@link TwilioConnection} being closed
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
 * A {@link TwilioConnection} received a "busy" message from the TCMP server.
 * @event TwilioConnection#waiting
 * @param {boolean} keepAlive - true if the WebSocket connection is retained
 * @param {number} retryAfter - delay in milliseconds after which a retry is attempted
 */

/**
 * {@link TwilioConnection} options
 * @typedef {object} TwilioConnectionOptions
 * @property {EventObserver} [eventObserver] - Optional event observer
 * @property {*} [helloBody=null] - Optional body for "hello" message
 * @property {LogLevel} [logLevel=warn] - Log level of the {@link TwilioConnection}
 * @property {number} [maxConsecutiveFailedHellos=3] - Max. number of consecutive failed "hello"s
 * @property {number} [maxConsecutiveMissedHeartbeats=3] - Max. number of (effective) consecutive "heartbeat" messages that can be missed
 * @property {number} [requestedHeartbeatTimeout=5000] - "heartbeat" timeout (ms) requested by the {@link TwilioConnection}
 * @property {number} [welcomeTimeout=5000] - Time (ms) to wait for the "welcome" message after sending the "hello" message
 */

module.exports = TwilioConnection;