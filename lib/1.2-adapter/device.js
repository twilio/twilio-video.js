'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var Connection = require('./connection');
var Endpoint = require('../endpoint');
var SoundManager = function(){}; // require('./soundmanager');

/**
 * Constructs a new {@link Device}.
 * @class
 * @classdesc {@link Device} provides a twilio.js 1.2-compatible wrapper around
 *   the new {@link Endpoint}.
 * @property {SoundManager} sounds - the {@link SoundManager} for this {@link
 *   Device}
 */
function Device() {
  if (!(this instanceof Device)) {
    return new Device();
  }

  EventEmitter.call(this);

  var connections = [];
  var endpoint = null;
  var self = this;
  var soundManager = new SoundManager();
  var status = 'offline';
  Object.defineProperties(this, {
    // Private
    _connections: {
      value: connections
    },
    _endpoint: {
      get: function() {
        return endpoint;
      },
      set: function(_endpoint) {
        endpoint = _endpoint;
      }
    },
    _status: {
      get: function() {
        return status;
      },
      set: function(_status) {
        status = _status;
      }
    },
    // Public
    'instance': {
      value: self
    },
    'sounds': {
      value: soundManager
    }
  });

  return this;
}

function setupEndpoint(device, endpoint) {
  device._endpoint = endpoint;

  endpoint.on('error', device.emit.bind(device, 'error'));

  endpoint.on('incoming', function(incomingCall) {
    console.log('Device emitting "incoming"');
    device.emit('incoming', new Connection(device, incomingCall));
  });

  endpoint.on('ready', device.emit.bind(device, 'ready', device));

  endpoint.on('offline', device.emit.bind(device, 'offline', device));
}

inherits(Device, EventEmitter);

/**
 * Setup the {@link Device} with the given capability token string.
 * @instance
 * @param {string} capabilityToken - the capability token string
 * @param {?object} options
 * @returns {Device}
 */
Device.prototype.setup = function setup(capabilityToken, options) {
  // Convert between 1.2-style options and new Endpoint options.
  var endpointOptions = {};
  [ ['audioConstraints', 'audioConstraints']
  , ['chunderm',         'wsServer']
  , ['debug',            'debug']
  , ['encrypt',          'encrypt']
  , ['warnings',         'warnings']
  ].forEach(function(pair) {
    var deviceOption = pair[0];
    var endpointOption = pair[1];
    if (deviceOption in options) {
      endpointOptions[endpointOption] = options[deviceOption];
    }
  });

  // Here's a little hack until I get around to adding a "chunderm" field to
  // chunder-interactive.
  if (!('chunderm' in options)) {
    var chunder = options['host'] || '';
    var chunderw = options['chunderw'] || '';
    if (chunder.match(/dev/) || chunderw.match(/dev/)) {
      endpointOptions['wsServer'] = 'chunderm.dev.twilio.com';
    } else if (chunder.match(/stage/) || chunderw.match(/stage/)) {
      endpointOptions['wsServer'] = 'chunderm.stage.twilio.com';
    } else {
      endpointOptions['wsServer'] = 'chunderm.twilio.com';
    }
  }

  setupEndpoint(this, new Endpoint(endpointOptions));
  this._endpoint.auth(capabilityToken);
  return this;
};

/**
 * Register a handler to be called when the "ready" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.ready = function ready(handler) {
  return this.on('ready', handler);
};

/**
 * Register a handler to be called when the "offline" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.offline = function offline(handler) {
  return this.on('offline', handler);
};

/**
 * Register a handler to be called when the "incoming" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.incoming = function incoming(handler) {
  return this.on('incoming', handler);
};

/**
 * Register a handler to be called when the "cancel" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.cancel = function cancel(handler) {
  return this.on('cancel', handler);
};

/**
 * Register a handler to be called when the "connect" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 *//**
 * Attempts a new connection to the Twilio application that you associated with
 * this {@link Device}'s capability token when you called {@link Device#setup}
 * (see Twilio Capability Tokens for more information).
 * @instance
 * @param {?object} params - the application parameters, if any
 * @returns {Connection}
 */
Device.prototype.connect = function connect() {
  var args = [].slice.call(arguments);
  if (args.length === 1 && typeof args[0] === 'function') {
    return this.on('connect', args[0]);
  } else if (this._endpoint) {
    return new Connection(this, this._endpoint.call.apply(this._endpoint, args));
  } else {
    throw new Error('You must first call Device.setup()');
  }
};

/**
 * Returns the active {@link Connection}.
 * @instance
 * @returns {?Connection}
 */
Device.prototype.activeConnection = function activeConnection() {
  var connections = this._connections;
  return connections.length > 0 ? new connections[0] : null;
};

/**
 * Terminates the active {@link Connection}. This will trigger the disconnect
 * event handler. It will not prevent new incoming {@link Connection}s.
 * @returns {Device}
 */
Device.prototype.disconnectAll = function disconnectAll() {
  this._connections.forEach(function(connection) {
    connection.disconnect();
  });
  return this;
};

/**
 * Register a handler to be called when the "disconnect" event is fired.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.disconnect = function disconnect(handler) {
  return this.on('disconnect', handler);
};

/**
 * Register a handler to be called when the availability state changes for any
 * client currently associated with your Twilio account. When the device is
 * ready, this handler is invoked once for each available client. Thereafter it
 * is invoked as clients become available or unavailable.
 * <br><br>
 * Presence is disabled for the twilio.js 1.2-compatible wrapper around {@link
 * Endpoint}.
 * @instance
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.presence = function presence() {
  console.warn('Presence is not supported in the 1.2-adapter version of twilio.js');
  return this;
};

/**
 * Register a handler to be called when the "error" event is fired.
 * @param {function} handler
 * @returns {Device}
 */
Device.prototype.error = function error(handler) {
  return this.on('error', handler);
};

/**
 * Return the status of the device. The status will be one of the following
 * strings: "offline", "ready", or "busy".
 * @instance
 * @returns {string}
 */
Device.prototype.status = function status() {
  return this._status;
};

/**
 * Return the media engine in use. The media engine will be either "WebRTC" or
 * "Flash".
 * <br><br>
 * The media engine is always "WebRTC" for the twilio.js 1.2-compatible wrapper
 * around {@link Endpoint}.
 * @instance
 * @returns {string}
 */
Device.prototype.getMediaEngine = function getMediaEngine() {
  return Device.prototype.getMediaEngine.WEBRTC;
};

Device.prototype.getMediaEngine.FLASH = 'Flash';
Device.prototype.getMediaEngine.WEBRTC = 'WebRTC';

module.exports = Device;
