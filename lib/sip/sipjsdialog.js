'use strict';

var Dialog = require('./dialog');
var inherits = require('util').inherits;

/**
 * Constructs a {@link SIPJSDialog}.
 * @class
 * @classdesc
 * @extends {Dialog}
 * @param {SIPJSUserAgent} userAgent
 * @param {Session} session
 * @param {Participant} participant
 * @param {object} sipjsSession
 * @property {Session} session
 * @property {UserAgent} userAgent
 * @property {Participant} participant
 * @fires Dialog#hangup
 */
function SIPJSDialog(userAgent, session, participant, sipjsSession) {
  if (!(this instanceof SIPJSDialog)) {
    return new SIPJSDialog(userAgent, session, participant, sipjsSession);
  }
  Dialog.call(this, userAgent, session, participant);
  Object.defineProperties(this, {
    _sipjsSession: {
      value: sipjsSession
    }
  });
  var self = this;
  sipjsSession.on('bye', function() {
    self.emit('hangup', self);
  });
  return Object.freeze(this);
}

inherits(SIPJSDialog, Dialog);

module.exports = SIPJSDialog;
