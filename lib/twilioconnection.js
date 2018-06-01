'use strict';

const StateMachine = require('./statemachine');
const { makeUUID } = require('./util');
const Timeout = require('./util/timeout');

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

const states = {
  closed: [],
  connecting: ['closed', 'open'],
  open: ['closed']
};

const DEFAULT_MAX_CONSECUTIVE_MISSED_HEARTBEATS = 5;
const DEFAULT_MAX_REQUESTED_HEARTBEAT_TIMEOUT = 5000;
const DEFAULT_WELCOME_TIMEOUT = 5000;
const HEARTBEAT_TIMEOUT_OFFSET = 100;
const WS_CLOSE_NORMAL = 1000;
const WS_CLOSE_WELCOME_TIMEOUT = 3000;
const WS_CLOSE_HEARTBEATS_MISSED = 3001;
const WS_CLOSE_HELLO_FAILED = 3002;

const toplevel = global.window || global;
const WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');

/**
 * A {@link TwilioConnection} represents a WebSocket connection
 * to a Twilio Connections Messaging Protocol (TCMP) server.
 * @fires TwilioConnection#close
 * @fires TwilioConnection#error
 * @fires TwilioConnection#message
 * @fires TwilioConnection#open
 */
class TwilioConnection extends StateMachine {
  /**
   * Construct a {@link TwilioConnection}.
   * @param {string} serverUrl - TCMP server url
   * @param {TwilioConnectionOptions} options - {@link TwilioConnection} options
   */
  constructor(serverUrl, options) {
    super('connecting', states);

    Object.defineProperties(this, {
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
          WebSocket
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

    this.on('stateChanged', (state, error) => ({
      closed: () => this.emit('close', error),
      open: () => this.emit('open')
    }[state]()));

    this._connect(serverUrl);
  }

  /**
   * The number of consecutive "hearbeat" messages missed.
   * @property {number}
   */
  get consecutiveHeartbeatsMissed() {
    return this._consecutiveHeartbeatsMissed;
  }

  /**
   * Connect to the TCMP server.
   * @param {string} serverUrl
   * @private
   */
  _connect(serverUrl) {
    this._ws = new this._options.WebSocket(serverUrl);
    const ws = this._ws;

    ws.addEventListener('close', event => {
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
      this.transition('closed', null, event.code !== WS_CLOSE_NORMAL
        ? new Error(`WebSocket Error ${event.code}: ${event.reason}`)
        : null);
    });

    ws.addEventListener('message', message => {
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
          this.emit('error', new Error(`Unknown message type: ${message.type}`));
          break;
      }
    });

    ws.addEventListener('open', () => {
      this._sendHello();
      const { welcomeTimeout } = this._options;
      this._welcomeTimeout = new Timeout(() => this._handleWelcomeTimeout(), welcomeTimeout);
    });
  }

  /**
   * Handle an incoming "bad" message.
   * @param {{reason: string}} message
   * @private
   */
  _handleBad({ reason }) {
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
  _handleHeartbeat() {
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
  _handleHeartbeatTimeout() {
    if (this.state !== 'open') {
      return;
    }
    this._consecutiveHeartbeatsMissed++;
    const { maxConsecutiveMissedHeartbeats } = this._options;

    if (this._consecutiveHeartbeatsMissed < maxConsecutiveMissedHeartbeats) {
      this._heartbeatTimeout.reset();
      return;
    }
    this._ws.close(WS_CLOSE_HEARTBEATS_MISSED,
      `Missed ${maxConsecutiveMissedHeartbeats} "heartbeat" messages`);
  }

  /**
   * Handle an incoming "msg" message.
   * @param {{body: object}} message
   * @private
   */
  _handleMessage({ body }) {
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
  _handleWelcome({ negotiatedTimeout }) {
    if (this.state !== 'connecting') {
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
    this._ws.close(WS_CLOSE_WELCOME_TIMEOUT, '"welcome" message timeout expired');
  }

  /**
   * Send a message to the TCMP server.
   * @param {*} message
   * @private
   */
  _send(message) {
    this._ws.send(JSON.stringify(message));
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
    const { requestedHeartbeatTimeout } = this._options;
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
   * Close the {@link TwilioConnection}.
   */
  close() {
    if (this.state === 'closed') {
      return;
    }
    this._sendOrEnqueue({ type: 'bye' });
    this._ws.close();
  }

  /**
   * Send a "msg" message.
   * @param {*} body
   */
  sendMessage(body) {
    this._sendOrEnqueue({ body: JSON.stringify(body), type: 'msg' });
  }
}

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
