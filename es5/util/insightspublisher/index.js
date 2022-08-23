/* eslint-disable camelcase */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var EventEmitter = require('events').EventEmitter;
var getUserAgent = require('..').getUserAgent;
var MAX_RECONNECT_ATTEMPTS = 5;
var RECONNECT_INTERVAL_MS = 50;
var WS_CLOSE_NORMAL = 1000;
var toplevel = globalThis;
var WebSocket = toplevel.WebSocket ? toplevel.WebSocket : require('ws');
var _a = require('../constants'), hardwareDevicePublisheriPad = _a.hardwareDevicePublisheriPad, hardwareDevicePublisheriPhone = _a.hardwareDevicePublisheriPhone;
var util = require('../../util');
var browserdetection = require('../browserdetection');
/**
 * Publish events to the Insights gateway.
 * @extends EventEmitter
 * @emits InsightsPublisher#connected
 * @emits InsightsPublisher#disconnected
 * @emits InsightsPublisher#reconnecting
 */
var InsightsPublisher = /** @class */ (function (_super) {
    __extends(InsightsPublisher, _super);
    /**
     * @param {string} token - Insights gateway token
     * @param {string} sdkName - Name of the SDK using the {@link InsightsPublisher}
     * @param {string} sdkVersion - Version of the SDK using the {@link InsightsPublisher}
     * @param {string} environment - One of 'dev', 'stage' or 'prod'
     * @param {string} realm - Region identifier
     * @param {InsightsPublisherOptions} options - Override default behavior
     */
    function InsightsPublisher(token, sdkName, sdkVersion, environment, realm, options) {
        var _this = _super.call(this) || this;
        options = Object.assign({
            gateway: createGateway(environment, realm) + "/v1/VideoEvents",
            maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS,
            reconnectIntervalMs: RECONNECT_INTERVAL_MS,
            userAgent: getUserAgent(),
            WebSocket: WebSocket,
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
        _this._readyToConnect.promise.then(function (_a) {
            var roomSid = _a.roomSid, participantSid = _a.participantSid;
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
    InsightsPublisher.prototype.connect = function (roomSid, participantSid) {
        this._readyToConnect.resolve({ roomSid: roomSid, participantSid: participantSid });
    };
    /**
     * Publish an event to the Insights gateway.
     * @private
     * @param {*} event
     */
    InsightsPublisher.prototype._publish = function (event) {
        event.session = this._session;
        this._ws.send(JSON.stringify(event));
    };
    /**
     * Disconnect from the Insights gateway.
     * @returns {boolean} true if called when connecting/open, false if not
     */
    InsightsPublisher.prototype.disconnect = function () {
        if (this._ws === null
            || this._ws.readyState === this._WebSocket.CLOSING
            || this._ws.readyState === this._WebSocket.CLOSED) {
            return false;
        }
        try {
            this._ws.close();
        }
        catch (error) {
            // Do nothing.
        }
        this.emit('disconnected');
        return true;
    };
    /**
     * Publish (or queue, if not connected) an event to the Insights gateway.
     * @param {string} groupName - Event group name
     * @param {string} eventName - Event name
     * @param {object} payload - Event payload
     * @returns {boolean} true if queued or published, false if disconnect() called
     */
    InsightsPublisher.prototype.publish = function (groupName, eventName, payload) {
        if (this._ws !== null
            && (this._ws.readyState === this._WebSocket.CLOSING
                || this._ws.readyState === this._WebSocket.CLOSED)) {
            return false;
        }
        var publishOrEnqueue = typeof this._session === 'string'
            ? this._publish.bind(this)
            : this._eventQueue.push.bind(this._eventQueue);
        publishOrEnqueue({
            group: groupName,
            name: eventName,
            payload: payload,
            timestamp: Date.now(),
            type: 'event',
            version: 1
        });
        return true;
    };
    return InsightsPublisher;
}(EventEmitter));
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
        publisher.emit('disconnected', new Error("WebSocket Error " + event.code + ": " + event.reason));
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
            roomSid: roomSid,
        };
        if (browserdetection.isIpad()) {
            connectRequest.publisher = __assign(__assign({}, connectRequest.publisher), hardwareDevicePublisheriPad);
        }
        else if (browserdetection.isIphone()) {
            connectRequest.publisher = __assign(__assign({}, connectRequest.publisher), hardwareDevicePublisheriPhone);
        }
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
    return environment === 'prod' ? "wss://sdkgw." + realm + ".twilio.com"
        : "wss://sdkgw." + environment + "-" + realm + ".twilio.com";
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
//# sourceMappingURL=index.js.map