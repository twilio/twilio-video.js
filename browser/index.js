'use strict';

var Endpoint = require('../lib/endpoint');
var Stream = require('../lib/media/stream');

/**
 * The {@link Twilio} namespace exposes {@link Endpoint} and {@link Stream}.
 * @class
 * @property {Endpoint} Endpoint
 * @property {Stream} Stream
 */
function Twilio() {
  if (!(this instanceof Twilio)) {
    return new Twilio();
  }
  Object.defineProperties(this, {
    'Endpoint': {
      value: Endpoint
    },
    'Stream': {
      value: Stream
    }
  });
  return Object.freeze(this);
}

global.Twilio = module.exports = new Twilio();
