var util = require('util');

var Session = require('./');

/**
 * A SIP {@link Session} represents your {@link Peer}'s connection to a SIP endpoint.
 * @augments Session
 * @class
 * @param {string} sipURI - The SIP URI
 * @property {string} id - The {@link Session} id
 * @property {string} sipURI - The SIP URI
 */
function SIPSession(sipURI) {
  var self = this instanceof SIPSession ? this : Object.create(SIPSession.prototype);
  Session.call(self);
  Object.defineProperty(self, 'sipURI', {
    value: sipURI
  });
  return self;
}

util.inherits(SIPSession, Session);

module.exports = SIPSession;
