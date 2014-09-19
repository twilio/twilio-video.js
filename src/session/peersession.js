var util = require('util');


var Session = require('./');

/**
 * A Peer {@link Session} represents your {@link Peer}'s peer-to-peer connection to another {@link Peer}.
 * @augments Session
 * @class
 * @param {string} peerName - The name of the {@link Peer}
 * @property {string} id - The {@link Session} id
 * @property {string} peerName - The name of the {@link Peer}
 */
function PeerSession(peerName) {
  var self = this instanceof PeerSession ? this : Object.create(PeerSession.prototype);
  Session.call(self);
  Object.defineProperty(self, 'peerName', {
    value: peerName
  });
  return self;
}

util.inherits(PeerSession, Session);

module.exports = PeerSession;
