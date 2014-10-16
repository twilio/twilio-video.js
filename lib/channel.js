'use strict';

var events = require('events');
var util = require('util');

function Channel(transport, name) {
  if (!(this instanceof Channel)) {
    return new Channel(transport, name);
  }
  events.EventEmitter.call(this);
  Object.defineProperties(this, {
    transport: {
      value: transport
    },
    name: {
      value: name
    }
  });
  tansport._send('sub,' + name);
  return Object.freeze(this);
}

util.inherits(Channel, events.EventEmitter);

Channel.prototype.close = function close() {
  removeChannel(this.transport, this.name);
  this.transport = null;
};

Channel.prototype.send = function send(message) {
  sendChannel(this.transport, this.name, message);
  return this;
};

module.exports = Channel;
