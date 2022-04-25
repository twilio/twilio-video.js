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
  | waiting  | --------> |  open  | ---------------
  +----------+           +--------+
 */

const states = {
  closed: [],
  connecting: ['closed', 'open', 'waiting'],
  early: ['closed', 'connecting'],
  open: ['closed'],
  waiting: ['closed', 'connecting', 'early', 'open']
};

const events = {
  closed: 'close',
  open: 'open',
  waiting: 'waiting'
};

const TCMP_VERSION = 2;

const DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 3;
const DEFAULT_MAX_CONSECUTIVE_FAILED_HELLOS = 3;
const DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
const DEFAULT_OPEN_TIMEOUT = 15000;
const DEFAULT_WELCOME_TIMEOUT = 5000;
const OUTGOING_HEARTBEAT_OFFSET = 200;

const WS_CLOSE_NORMAL = 1000;
const WS_CLOSE_WELCOME_TIMEOUT = 3000;
const WS_CLOSE_HEARTBEATS_MISSED = 3001;
const WS_CLOSE_HELLO_FAILED = 3002;
const WS_CLOSE_SEND_FAILED = 3003;
const WS_CLOSE_NETWORK_CHANGED = 3004;
const WS_CLOSE_BUSY_WAIT = 3005;
const WS_CLOSE_SERVER_BUSY = 3006;
const WS_CLOSE_OPEN_TIMEOUT = 3007;

const toplevel = global.window || global;
const WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

const CloseReason = {
  BUSY: 'busy',
  FAILED: 'failed',
  LOCAL: 'local',
  REMOTE: 'remote',
  TIMEOUT: 'timeout'
};

const wsCloseCodesToCloseReasons = new Map([
  [WS_CLOSE_WELCOME_TIMEOUT, CloseReason.TIMEOUT],
  [WS_CLOSE_HEARTBEATS_MISSED, CloseReason.TIMEOUT],
  [WS_CLOSE_HELLO_FAILED, CloseReason.FAILED],
  [WS_CLOSE_SEND_FAILED, CloseReason.FAILED],
  [WS_CLOSE_NETWORK_CHANGED, CloseReason.TIMEOUT],
  [WS_CLOSE_SERVER_BUSY, CloseReason.BUSY],
  [WS_CLOSE_OPEN_TIMEOUT, CloseReason.TIMEOUT]
]);

/**
 * A {@link TwilioConnection} represents a WebSocket connection
 * to a Twilio Connections Messaging Protocol (TCMP) server.
 * @fires TwilioConnection#close
 * @fires TwilioConnection#error
 * @fires TwilioConnection#message
 * @fires TwilioConnection#open
 * @fires TwilioConnection#waiting
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
      openTimeout: DEFAULT_OPEN_TIMEOUT,
      welcomeTimeout: DEFAULT_WELCOME_TIMEOUT,
      Log,
      WebSocket
    }, options);

    const logLevels = buildLogLevels(options.logLevel);
    const log = new options.Log('default', this, logLevels, options.loggerName);

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

    const eventsToLevels = {
      connecting: 'info',
      early: 'info',
      open: 'info',
      waiting: 'warning',
      closed: 'info'
    };

    this.on('stateChanged', (state, ...args) => {
      if (state in events) {
        this.emit(events[state], ...args);
      }
      const event = { name: state, group: 'signaling', level: eventsToLevels[this.state] };
      if (state === 'closed') {
        const [reason] = args;
        event.payload = { reason };
        event.level = reason === CloseReason.LOCAL ? 'info' : 'error';
      }
      this._eventObserver.emit('event', event);
    });

    this._eventObserver.emit('event', { name: this.state, group: 'signaling', level: eventsToLevels[this.state] });
    this._connect();
  }

  toString() {
    return `[TwilioConnection #${this._instanceId}: ${this._ws.url}]`;
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
    const log = this._log;

    if (code === WS_CLOSE_NORMAL) {
      log.debug('Closed');
      this.transition('closed', null, [CloseReason.LOCAL]);
    } else {
      log.warn(`Closed: ${code} - ${reason}`);
      if (code !== WS_CLOSE_BUSY_WAIT) {
        this.transition('closed', null, [
          wsCloseCodesToCloseReasons.get(code) || CloseReason.REMOTE
        ]);
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
    if (this.state === 'waiting') {
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

    const { openTimeout } = this._options;
    // Add a timeout for getting the onopen event on the WebSocket (15 sec). After that, attempt to reconnect only if this is not the first attempt.
    this._openTimeout = new Timeout(() => {
      const reason = `Failed to open in ${openTimeout} ms`;
      this._close({ code: WS_CLOSE_OPEN_TIMEOUT, reason });
    }, openTimeout);

    ws.addEventListener('open', () => {
      log.debug('WebSocket opened:', ws);
      this._openTimeout.clear();
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
        case 'msg':
          this._handleMessage(message);
          // NOTE(mpatwardhan): Each incoming message should be treated as an incoming
          // heartbeat intentionally falling through to 'heartbeat' case.
          // eslint-disable-next-line no-fallthrough
        case 'heartbeat':
          this._handleHeartbeat();
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
    if (!['connecting', 'waiting'].includes(this.state)) {
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

    this.transition('waiting', null, [keepAlive, retryAfter]);
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
    const log = this._log;
    const { maxConsecutiveMissedHeartbeats } = this._options;

    log.debug(`Consecutive heartbeats missed: ${maxConsecutiveMissedHeartbeats}`);
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
    const log = this._log;

    if (!['connecting', 'waiting'].includes(this.state)) {
      log.warn(`Unexpected state "${this.state}" for handling a "welcome"`
        + ' message from the TCMP server.');
      return;
    }

    if (this.state === 'waiting') {
      log.debug('Received "welcome" message, no need to retry connection.');
      this._busyWaitTimeout.clear();
    }

    const { maxConsecutiveMissedHeartbeats } = this._options;
    const heartbeatTimeout = negotiatedTimeout * maxConsecutiveMissedHeartbeats;
    const outgoingHeartbeatTimeout = negotiatedTimeout - OUTGOING_HEARTBEAT_OFFSET;

    this._welcomeTimeout.clear();
    this._heartbeatTimeout = new Timeout(() => this._handleHeartbeatTimeout(), heartbeatTimeout);
    this._messageQueue.splice(0).forEach(message => this._send(message));
    this._sendHeartbeatTimeout = new Timeout(() => this._sendHeartbeat(), outgoingHeartbeatTimeout);
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
        if (this._sendHeartbeatTimeout) {
          // Each outgoing message is to be treated as an outgoing heartbeat.
          this._sendHeartbeatTimeout.reset();
        }
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
    if (['early', 'waiting'].includes(this.state)) {
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
