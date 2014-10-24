'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

var IncomingCall = require('../calls').IncomingCall;
var util = require('../util');

/**
 * Constructs a new {@link Connection}.
 * @class
 * @classdesc {@link Connection} provides a twilio.js 1.2-compatible wrapper
 *   around the new {@link Call}.
 * @param {Device} device - the {@link Device} that owns this {@link
 *   Connection}
 * @param {Call} call - the {@link Call} that this {@link Connection} wraps
 */
function Connection(device, call) {
  if (!(this instanceof Connection)) {
    return new Connection(device, call);
  }

  EventEmitter.call(this);

  var parameters = {};
  if (call.sid) {
    parameters['CallSid'] = call.sid;
  }
  if (call.accountSid) {
    parameters['AccountSid'] = call.accountSid;
  }
  if (call.from) {
    parameters['From'] = call.from;
  }
  if (call.to) {
    parameters['To'] = call.to;
  }
  if (call.apiVersion) {
    parameters['ApiVersion'] = call.apiVersion;
  }

  var self = this;
  var status = 'pending';
  Object.defineProperties(this, {
    // Private
    _call: {
      value: call
    },
    _device: {
      value: device
    },
    _parameters: {
      value: parameters
    },
    _status: {
      value: status
    },
    // Public
    'parameters': {
      get: function() {
        return util.deepClone(self._parameters);
      }
    }
  });

  call.on('accept', function() {
    device._connections.unshift(self);
    self.emit('accept', self);
    device.emit('connect', self);
  });

  call.on('cancel', function() {
    self.emit('cancel', self);
    device.emit('cancel', self);
  });

  call.on('disconnect', function() {
    var connections = device._connections;
    for (var i = 0; i < connections.length; i++) {
      if (self === connections[i]) {
        connections.splice(i, 1);
        break;
      }
    }
    self.emit('disconnect', self);
    device.emit('disconnect', self);
  });

  call.on('error', function() {
    self.emit('error', self);
    device.emit('error', self);
  });

  call.on('mute', self.emit.bind(self, 'mute', self));
  call.on('unmute', self.emit.bind(self, 'unmute', self));

  return this;
}

inherits(Connection, EventEmitter);

Connection.prototype.accept = function accept() {
  var args = [].slice.call(arguments);
  if (args.length === 1 && typeof args[0] === 'function') {
    return this.on('accept', args[0]);
  }
  
  if (this._call instanceof IncomingCall) {
    this._call.accept();
  } else {
    throw new Error('Cannot call .accept() on an outgoing Connection');
  }
  return this;
};

Connection.prototype.reject = function reject() {
  if (this._call instanceof IncomingCall) {
    this._call.reject();
  } else {
    throw new Error('Cannot call .reject() on an outgoing Connection');
  }
  return this;
};

Connection.prototype.ignore = function ignore() {
  if (this._call instanceof IncomingCall) {
    console.warn('.ignore() is not yet supported');
  } else {
    throw new Error('Cannot call .ignore() on an outgoing Connection');
  }
  return this;
};

Connection.prototype.disconnect = function disconnect() {
  var args = [].slice.call(arguments);
  if (args.length === 1 && typeof args[0] === 'function') {
    return this.on('disconnect', args[0]);
  }

  this._call.hangup();
  return this;
};

Connection.prototype.error = function error(handler) {
  return this.on('error', handler);
};

Connection.prototype.mute = function mute() {
  var args = [].slice.call(arguments);
  if (args.length === 1 && typeof args[0] === 'function') {
    var self = this;
    this.on('mute', function() {
      args[0](true, self);
    });
    this.on('unmute', function() {
      args[0](false, self);
    });
  } else if (args.length === 0 && typeof args[0] === 'boolean') {
    this._call.mute(args[0]);
  } else {
    console.warn('.mute() is deprecated; please use .mute(true) instead');
    this._call.mute(true);
  }
  return this;
}

Connection.prototype.unmute = function unmute() {
  console.warn('.unmute() is deprecated; please use .mute(false) instead');
  return this.mute(false);
};

Connection.prototype.isMuted = function isMuted() {
  return this._call.mute();
};

Connection.prototype.sendDigits = function sendDigits(digits) {
  this._call.sendDigits(digits);
  return this;
};

Connection.prototype.status = function status() {
  return this._status;
};

module.exports = Connection;
