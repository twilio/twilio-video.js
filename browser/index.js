'use strict';

var Endpoint = require('../lib/endpoint');

/**
 * The {@link Twilio} namespace exposes {@link Endpoint}.
 * @class
 * @property {Endpoint} Endpoint
 */
function Twilio() {
  if (!(this instanceof Twilio)) {
    return new Twilio();
  }
  this.Endpoint = Endpoint;
  return this;
}

global.Twilio = module.exports = new Twilio();
