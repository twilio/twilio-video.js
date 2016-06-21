'use strict';

var inherits = require('util').inherits;
var OutgoingInviteSignaling = require('../outgoinginvite');
var SIP = require('sip.js');

function OutgoingInviteV2(session, to) {
  if (!(this instanceof OutgoingInviteV2)) {
    return new OutgoingInviteV2(to);
  }
  OutgoingInviteSignaling.call(this, to);

  var extraHeaders = [
    'Contact: ' + session.contact,
    'Allow: ' + SIP.UA.C.ALLOWED_METHODS.toString(),
    'Refer-To: ' + session.ua.normalizeTarget(to),
    'Allow-Events: refer',
    'Event: refer;id=' + Math.floor((Math.random() * 1000) + 1)
  ];

  var self = this;
  session.sendRequest('REFER', {
    extraHeaders: extraHeaders,
    receiveResponse: function receiveResponse(response) {
      if (response.status_code === 202) {
        // Do nothing; we need to wait for the setParticipant call.
      } else {
        self._deferred.reject(response);
      }
    }
  });
}

inherits(OutgoingInviteV2, OutgoingInviteSignaling);

OutgoingInviteV2.prototype.setParticipant = function setParticipant(participantSignaling) {
  this._deferred.resolve(participantSignaling);
};

module.exports = OutgoingInviteV2;
