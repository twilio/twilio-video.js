'use strict';

var Device = require('../lib/1.2-adapter/device');
var EventStream = require('../lib/1.2-adapter/eventstream');

/**
 * The {@link Twilio} namespace exposes {@link Device}.
 * @class
 * @property {Device} Device
 */
function Twilio() {
  if (!(this instanceof Twilio)) {
    return new Twilio();
  }
  var device = new Device();
  var eventStream = new EventStream();
  Object.defineProperties(this, {
    // Public
    'Device': {
      value: device
    },
    'EventStream': {
      value: eventStream
    }
  });
  return this;
}

var twilio = new Twilio();
module.exports = global.Twilio = twilio;
