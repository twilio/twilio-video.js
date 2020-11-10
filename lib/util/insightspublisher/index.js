'use strict';

const EventEmitter = require('events').EventEmitter;

const { getUserAgent } = require('..');

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL_MS = 50;
const WS_CLOSE_NORMAL = 1000;

const toplevel = global.window || global;
const WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
const util = require('../../util');

/**
 * Publish events to the Insights gateway.
 * @extends EventEmitter
 * @emits InsightsPublisher#connected
 * @emits InsightsPublisher#disconnected
 * @emits InsightsPublisher#reconnecting
 */
class InsightsPublisher extends EventEmitter {
  /**
   * @param {string} token - Insights gateway token
   * @param {string} sdkName - Name of the SDK using the {@link InsightsPublisher}
   * @param {string} sdkVersion - Version of the SDK using the {@link InsightsPublisher}
   * @param {string} environment - One of 'dev', 'stage' or 'prod'
   * @param {string} realm - Region identifier
   * @param {InsightsPublisherOptions} options - Override default behavior
   */
  constructor(token, sdkName, sdkVersion, environment, realm, options) {
    super();

    options = Object.assign({
      gateway: `${createGateway(environment, realm)}/v1/VideoEvents`,
      maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      reconnectIntervalMs: RECONNECT_INTERVAL_MS,
      userAgent: getUserAgent(),
      WebSocket
    }, options);

    Object.defineProperties(this, {
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

    this._readyToConnect.promise.then(({ roomSid, participantSid }) => {
      const self = this;
      this.on('disconnected', function maybeReconnect(error) {
        self._session = null;
        if (error && self._reconnectAttemptsLeft > 0) {
          self.emit('reconnecting');
          reconnect(self, token, sdkName, sdkVersion, roomSid, participantSid, options);
          return;
        }
        self.removeListener('disconnected', maybeReconnect);
      });
      connect(this, token, sdkName, sdkVersion, roomSid, participantSid, options);
    }).catch(() => {
      // ignore failures to connect
    });
  }

  /**
   * Start connecting to the Insights gateway.
   * @param {string} roomSid
   * @param {string} participantSid
   * @returns {void}
   */
  connect(roomSid, participantSid) {
    this._readyToConnect.resolve({ roomSid, participantSid });
  }

  /**
   * Publish an event to the Insights gateway.
   * @private
   * @param {*} event
   */
  _publish(event) {
    event.session = this._session;
    this._ws.send(JSON.stringify(event));
  }

  /**
   * Disconnect from the Insights gateway.
   * @returns {boolean} true if called when connecting/open, false if not
   */
  disconnect() {
    if (this._ws === null
      || this._ws.readyState === this._WebSocket.CLOSING
      || this._ws.readyState === this._WebSocket.CLOSED) {
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
  publish(groupName, eventName, payload) {
    if (this._ws !== null
      && (this._ws.readyState === this._WebSocket.CLOSING
        || this._ws.readyState === this._WebSocket.CLOSED)) {
      return false;
    }

    const publishOrEnqueue = typeof this._session === 'string'
      ? this._publish.bind(this)
      : this._eventQueue.push.bind(this._eventQueue);

    publishOrEnqueue({
      group: groupName,
      name: eventName,
      payload,
      timestamp: Date.now(),
      type: 'event',
      version: 1
    });

    return true;
  }
}

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
  const ws = publisher._ws;

  ws.addEventListener('close', event => {
    if (event.code === WS_CLOSE_NORMAL) {
      publisher.emit('disconnected');
      return;
    }
    publisher.emit('disconnected', new Error(`WebSocket Error ${event.code}: ${event.reason}`));
  });

  ws.addEventListener('message', message => {
    handleConnectResponse(publisher, JSON.parse(message.data), options);
  });

  ws.addEventListener('open', () => {
    const connectRequest = {
      type: 'connect',
      token,
      version: 1
    };

    connectRequest.publisher = {
      name: sdkName,
      sdkVersion,
      userAgent: options.userAgent,
      participantSid: participantSid,
      roomSid: roomSid,
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
  return environment === 'prod' ? `wss://sdkgw.${realm}.twilio.com`
    : `wss://sdkgw.${environment}-${realm}.twilio.com`;
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
  const connectInterval = Date.now() - publisher._connectTimestamp;
  const timeToWait = options.reconnectIntervalMs - connectInterval;

  if (timeToWait > 0) {
    setTimeout(() => {
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
