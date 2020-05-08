'use strict';

const StateMachine = require('./statemachine');
const { buildLogLevels, makeUUID } = require('./util');
const Log = require('./util/log');
const NetworkMonitor = require('./util/networkmonitor');
const Timeout = require('./util/timeout');

let nInstances = 0;

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
  |   wait   |           |  open  | ---------------
  +----------+           +--------+
 */

const states = {
  closed: [],
  connecting: ['closed', 'open', 'wait'],
  early: ['closed', 'connecting'],
  open: ['closed'],
  wait: ['closed', 'connecting', 'early']
};

const events = {
  closed: 'close',
  open: 'open',
  wait: 'wait'
};

const TCMP_VERSION = 2;

const DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 3;
const DEFAULT_MAX_CONSECUTIVE_FAILED_HELLOS = 3;
const DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
const DEFAULT_WELCOME_TIMEOUT = 5000;
const HEARTBEAT_TIMEOUT_OFFSET = 100;
const WS_CLOSE_NORMAL = 1000;
const WS_CLOSE_WELCOME_TIMEOUT = 3000;
const WS_CLOSE_HEARTBEATS_MISSED = 3001;
const WS_CLOSE_HELLO_FAILED = 3002;
const WS_CLOSE_SEND_FAILED = 3003;
const WS_CLOSE_NETWORK_CHANGED = 3004;
const WS_CLOSE_BUSY_WAIT = 3005;
const WS_CLOSE_SERVER_BUSY = 3006;

const toplevel = global.window || global;
const WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

/**
 * A {@link TwilioConnection} represents a WebSocket connection
 * to a Twilio Connections Messaging Protocol (TCMP) server.
 * @fires TwilioConnection#close
 * @fires TwilioConnection#error
 * @fires TwilioConnection#message
 * @fires TwilioConnection#open
 * @fires TwilioConnection#wait
 */
class TwilioConnection extends StateMachine {
  /**
   * Construct a {@link TwilioConnection}.
   * @param {string} serverUrl - TCMP server url
   * @param {TwilioConnectionOptions} options - {@link TwilioConnection} options
   */
  constructor(serverUrl, options) {
    super('early', states);

    options = Object.assign({
      helloBody: null,
      maxConsecutiveFailedHellos: DEFAULT_MAX_CONSECUTIVE_FAILED_HELLOS,
      maxConsecutiveMissedHeartbeats: DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS,
      requestedHeartbeatTimeout: DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT,
      welcomeTimeout: DEFAULT_WELCOME_TIMEOUT,
      Log,
      WebSocket
    }, options);

    const logLevels = buildLogLevels(options.logLevel);
    const log = new options.Log('default', this, logLevels);

    const networkMonitor = options.networkMonitor ? new NetworkMonitor(() => {
      const { type } = networkMonitor;
      const reason = `Network changed${type ? ` to ${type}` : ''}`;
      log.debug(reason);
      this._close({ code: WS_CLOSE_NETWORK_CHANGED, reason });
    }) : null;

    Object.defineProperties(this, {
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

    this.on('stateChanged', (state, ...args) => {
      if (state in events) {
        this.emit(events[state], ...args);
      }
      const event = { name: state };
      if (state === 'closed') {
        const [error] = args;
        if (error) {
          const { code, reason } = error;
          event.payload = { code, message: reason };
        }
      }
      this._eventObserver.emit('event', event);
    });

    this._eventObserver.emit('event', { name: this.state });
    this._connect();
  }

  toString() {
    return `[TwilioConnection #${this._instanceId}: ${this._ws.url}]`;
  }

  /**
   * The number of consecutive "hearbeat" messages missed.
   * @property {number}
   */
  get consecutiveHeartbeatsMissed() {
    return this._consecutiveHeartbeatsMissed;
  }

  /**
   * Close the {@link TwilioConnection}.
   * @param {{code: number, reason: string}} event
   * @private
   */
  _close({ code, reason }) {
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
    if (this._networkMonitor) {
      this._networkMonitor.stop();
    }
    if (this._busyWaitTimeout && code !== WS_CLOSE_BUSY_WAIT) {
      this._busyWaitTimeout.clear();
    }
    this._messageQueue.splice(0);
    const log = this._log;

    if (code === WS_CLOSE_NORMAL) {
      log.debug('Closed');
      this.transition('closed', null, [null]);
    } else {
      log.warn(`Closed: ${code} - ${reason}`);
      if (code !== WS_CLOSE_BUSY_WAIT) {
        const error = new Error(`WebSocket Error ${code}: ${reason}`);
        error.code = code;
        error.reason = reason;
        this.transition('closed', null, [error]);
      }
    }
    const { readyState } = this._ws;
    const { WebSocket } = this._options;

    if (readyState !== WebSocket.CLOSING && readyState !== WebSocket.CLOSED) {
      this._ws.close(code, reason);
    }
  }

  /**
   * Connect to the TCMP server.
   * @private
   */
  _connect() {
    const log = this._log;
    if (this.state === 'wait') {
      this.transition('early');
    } else if (this.state !== 'early') {
      log.warn(`Unexpected state "${this.state}" for connecting to the`
        + ' TCMP server.');
      return;
    }
    this._ws = new this._options.WebSocket(this._serverUrl);
    const ws = this._ws;
    log.debug('Created a new WebSocket:', ws);
    ws.addEventListener('close', event => this._close(event));

    ws.addEventListener('open', () => {
      log.debug('WebSocket opened:', ws);
      this._startHandshake();
      if (this._networkMonitor) {
        this._networkMonitor.start();
      }
    });

    ws.addEventListener('message', message => {
      log.debug(`Incoming: ${message.data}`);
      try {
        message = JSON.parse(message.data);
      } catch (error) {
        this.emit('error', error);
        return;
      }
      switch (message.type) {
        case 'bad':
          this._handleBad(message);
          break;
        case 'busy':
          this._handleBusy(message);
          break;
        case 'bye':
          // Do nothing.
          break;
        case 'heartbeat':
          this._handleHeartbeat();
          break;
        case 'msg':
          this._handleMessage(message);
          break;
        case 'welcome':
          this._handleWelcome(message);
          break;
        default:
          this._log.debug(`Unknown message type: ${message.type}`);
          this.emit('error', new Error(`Unknown message type: ${message.type}`));
          break;
      }
    });
  }

  /**
   * Handle an incoming "bad" message.
   * @param {{reason: string}} message
   * @private
   */
  _handleBad({ reason }) {
    const log = this._log;
    if (!['connecting', 'open'].includes(this.state)) {
      log.warn(`Unexpected state "${this.state}" for handling a "bad" message`
        + ' from the TCMP server.');
      return;
    }
    if (this.state === 'connecting') {
      log.warn(`Closing: ${WS_CLOSE_HELLO_FAILED} - ${reason}`);
      this._close({ code: WS_CLOSE_HELLO_FAILED, reason });
      return;
    }
    log.debug(`Error: ${reason}`);
    this.emit('error', new Error(reason));
  }

  /**
   * Handle an incoming "busy" message.
   * @param {{cookie: ?string, keepAlive: boolean, retryAfter: number}} message
   * @private
   */
  _handleBusy({ cookie, keepAlive, retryAfter }) {
    const log = this._log;
    if (!['connecting', 'wait'].includes(this.state)) {
      log.warn(`Unexpected state "${this.state}" for handling a "busy" message`
        + ' from the TCMP server.');
      return;
    }
    if (this._busyWaitTimeout) {
      this._busyWaitTimeout.clear();
    }
    if (this._welcomeTimeout) {
      this._welcomeTimeout.clear();
    }
    const reason = retryAfter < 0
      ? 'Received terminal "busy" message'
      : `Received "busy" message, retrying after ${retryAfter} ms`;

    if (retryAfter < 0) {
      log.warn(`Closing: ${WS_CLOSE_SERVER_BUSY} - ${reason}`);
      this._close({ code: WS_CLOSE_SERVER_BUSY, reason });
      return;
    }
    const { maxConsecutiveFailedHellos } = this._options;
    this._hellosLeft = maxConsecutiveFailedHellos;
    this._cookie = cookie || null;

    if (keepAlive) {
      log.warn(reason);
      this._busyWaitTimeout = new Timeout(() => this._startHandshake(), retryAfter);
    } else {
      log.warn(`Closing: ${WS_CLOSE_BUSY_WAIT} - ${reason}`);
      this._close({ code: WS_CLOSE_BUSY_WAIT, reason });
      this._busyWaitTimeout = new Timeout(() => this._connect(), retryAfter);
    }

    this.transition('wait', null, [keepAlive, retryAfter]);
  }

  /**
   * Handle an incoming "heartbeat" message.
   * @private
   */
  _handleHeartbeat() {
    if (this.state !== 'open') {
      this._log.warn(`Unexpected state "${this.state}" for handling a "heartbeat"`
        + ' message from the TCMP server.');
      return;
    }
    this._consecutiveHeartbeatsMissed = 0;
    this._heartbeatTimeout.reset();
  }

  /**
   * Handle a missed "heartbeat" message.
   * @private
   */
  _handleHeartbeatTimeout() {
    if (this.state !== 'open') {
      return;
    }
    this._consecutiveHeartbeatsMissed++;
    const log = this._log;
    const { maxConsecutiveMissedHeartbeats } = this._options;

    log.debug(`Consecutive heartbeats missed: ${this._consecutiveHeartbeatsMissed}`);
    if (this._consecutiveHeartbeatsMissed < maxConsecutiveMissedHeartbeats) {
      this._heartbeatTimeout.reset();
      return;
    }

    const reason = `Missed ${maxConsecutiveMissedHeartbeats} "heartbeat" messages`;
    log.warn(`Closing: ${WS_CLOSE_HEARTBEATS_MISSED} - ${reason}`);
    this._close({ code: WS_CLOSE_HEARTBEATS_MISSED, reason });
  }

  /**
   * Handle an incoming "msg" message.
   * @param {{body: object}} message
   * @private
   */
  _handleMessage({ body }) {
    if (this.state !== 'open') {
      this._log.warn(`Unexpected state "${this.state}" for handling a "msg" message`
        + ' from the TCMP server.');
      return;
    }
    this.emit('message', body);
  }

  /**
   * Handle an incoming "welcome" message.
   * @param {{ negotiatedTimeout: number }} message
   * @private
   */
  _handleWelcome({ negotiatedTimeout }) {
    if (this.state !== 'connecting') {
      this._log.warn(`Unexpected state "${this.state}" for handling a "welcome"`
        + ' message from the TCMP server.');
      return;
    }
    const heartbeatTimeout = negotiatedTimeout + HEARTBEAT_TIMEOUT_OFFSET;
    this._welcomeTimeout.clear();
    this._heartbeatTimeout = new Timeout(() => this._handleHeartbeatTimeout(), heartbeatTimeout);
    this._messageQueue.splice(0).forEach(message => this._send(message));
    this._sendHeartbeatTimeout = new Timeout(() => this._sendHeartbeat(), negotiatedTimeout);
    this.transition('open');
  }

  /**
   * Handle a missed "welcome" message.
   * @private
   */
  _handleWelcomeTimeout() {
    if (this.state !== 'connecting') {
      return;
    }
    const log = this._log;

    if (this._hellosLeft <= 0) {
      const reason = 'All handshake attempts failed';
      log.warn(`Closing: ${WS_CLOSE_WELCOME_TIMEOUT} - ${reason}`);
      this._close({ code: WS_CLOSE_WELCOME_TIMEOUT, reason });
      return;
    }

    const { maxConsecutiveFailedHellos } = this._options;
    log.warn(`Handshake attempt ${maxConsecutiveFailedHellos - this._hellosLeft} failed`);
    this._startHandshake();
  }

  /**
   * Send a message to the TCMP server.
   * @param {*} message
   * @private
   */
  _send(message) {
    const { readyState } = this._ws;
    const { WebSocket } = this._options;
    if (readyState === WebSocket.OPEN) {
      const data = JSON.stringify(message);
      this._log.debug(`Outgoing: ${data}`);
      try {
        this._ws.send(data);
      } catch (error) {
        const reason = 'Failed to send message';
        this._log.warn(`Closing: ${WS_CLOSE_SEND_FAILED} - ${reason}`);
        this._close({ code: WS_CLOSE_SEND_FAILED, reason });
      }
    }
  }

  /**
   * Send a "heartbeat" message.
   * @private
   */
  _sendHeartbeat() {
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
  _sendHello() {
    const { helloBody, requestedHeartbeatTimeout: timeout } = this._options;
    const hello = {
      id: makeUUID(),
      timeout,
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
  _sendOrEnqueue(message) {
    if (this.state === 'closed') {
      return;
    }
    const sendOrEnqueue = this.state === 'open'
      ? message => this._send(message)
      : message => this._messageQueue.push(message);

    sendOrEnqueue(message);
  }

  /**
   * Start the TCMP handshake.
   * @private
   */
  _startHandshake() {
    if (['early', 'wait'].includes(this.state)) {
      this.transition('connecting');
    }
    if (this.state !== 'connecting') {
      return;
    }
    this._hellosLeft--;
    this._sendHello();
    const { welcomeTimeout } = this._options;
    this._welcomeTimeout = new Timeout(() => this._handleWelcomeTimeout(), welcomeTimeout);
  }

  /**
   * Close the {@link TwilioConnection}.
   * @returns {void}
   */
  close() {
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
  sendMessage(body) {
    this._sendOrEnqueue({ body, type: 'msg' });
  }
}

/**
 * A unique number depicting the reason for an inadvertent closing of
 * the {@link TwilioConnection}.
 * @enum {number}
 */
TwilioConnection.CloseCode = {
  WELCOME_TIMEOUT: WS_CLOSE_NORMAL,
  HEARTBEATS_MISSED: WS_CLOSE_HEARTBEATS_MISSED,
  HELLO_FAILED: WS_CLOSE_HELLO_FAILED,
  SEND_FAILED: WS_CLOSE_SEND_FAILED,
  NETWORK_CHANGED: WS_CLOSE_NETWORK_CHANGED,
  SERVER_BUSY: WS_CLOSE_SERVER_BUSY
};

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
 * A {@link TwilioConnection} received a "busy" message from the TCMP server.
 * @event TwilioConnection#wait
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
 * @property {number} [maxConsecutiveMissedHeartbeats=3] - Max. number of consecutive "heartbeat" messages that can be missed
 * @property {number} [requestedHeartbeatTimeout=5000] - "heartbeat" timeout (ms) requested by the {@link TwilioConnection}
 * @property {number} [welcomeTimeout=5000] - Time (ms) to wait for the "welcome" message after sending the "hello" message
 */

module.exports = TwilioConnection;
