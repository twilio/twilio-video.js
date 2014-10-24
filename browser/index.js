'use strict';

var Peer = require('../lib/peer');

/**
 * The {@link Twilio} namespace exposes {@link Peer}.
 * @class
 * @property {Peer} Peer
 */
function Twilio() {
  if (!(this instanceof Twilio)) {
    return new Twilio();
  }
  this.Peer = Peer;
  return this;
}

module.exports = new Twilio();
