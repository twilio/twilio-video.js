var util = require('util');

var Session = require('./');

/**
 * A PSTN {@link Session} represents your {@link Peer}'s connection to the publicly-switched telephone network.
 * @augments Session
 * @class
 * @param {string} phoneNumber - The phone number
 * @property {string} id - The {@link Session} id
 * @property {string} phoneNumber - The phone number
 */
function PSTNSession(phoneNumber) {
  var self = this instanceof PSTNSession ? this : Object.create(PSTNSession.prototype);
  Session.call(self);
  Object.defineProperty(self, 'phoneNumber', {
    value: phoneNumber
  });
  return self;
}

util.inherits(PSTNSession, Session);

module.exports = PSTNSession;
