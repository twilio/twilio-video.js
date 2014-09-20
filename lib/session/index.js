var events = require('events');
var util = require('util');

/**
 * Represents your {@link Peer}'s connection to a Twilio endpoint. {@link Session} is an abstract class with instances
 * {@link TwiMLSession}, {@link PSTNSession}, {@link SIPSession}, and {@link PeerSession}.
 * @class
 * @fires Session#mediaStreamAdded
 * @property {string} id - The {@link Session} id
 */
function Session(id) {
  var self = this;
  events.EventEmitter.call(self);
  Object.defineProperty(self, 'id', {
    get: function() { return sessionToId[self]; }
  });
}

util.inherits(Session, events.EventEmitter);

/**
 * Accepts an incoming {@link Session}.
 * @instance
 * @returns Session
 */
Session.prototype.accept = function accept() {
  // TODO(mroberts): Implement me.
};

/**
 * Rejects an incoming {@link Session}.
 * @instance
 * @returns Session
 */
Session.prototype.reject = function reject() {
  // TODO(mroberts): Implement me.
};

module.exports = Session;
