var util = require('util');

var Session = require('./');

/**
 * A TwiML {@link Session} represents your {@link Peer}'s connection to a TwiML application.
 * @augments Session
 * @class
 * @param {string} appSid - The TwiML application's SID
 * @property {string} appSid - The TwiML application's SID
 * @property {string} id - The {@link Session} id
 */
function TwiMLSession(peer, appSid) {
  var self = this instanceof TwiMLSession ? this : Object.create(TwiMLSession.prototype);
  Session.call(self);
  Object.defineProperty(self, 'appSid', {
    value: appSid
  });
  return self;
}

util.inherits(TwiMLSession, Session);

module.exports = TwiMLSession;
