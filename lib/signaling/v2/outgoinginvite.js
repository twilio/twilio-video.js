'use strict';

var C = require('../../util/constants');
var ConversationV2 = require('./conversation');
var headers = require('../../util/constants').headers;
var inherits = require('util').inherits;
var OutgoingInviteSignaling = require('../outgoinginvite');
var PeerConnectionManager = require('./peerconnectionmanager');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

function OutgoingInviteV2(accountSid, token, ua, identities, labelOrSid, localMedia, options) {
  if (!(this instanceof OutgoingInviteV2)) {
    return new OutgoingInviteV2(accountSid, token, ua, identities, labelOrSid, localMedia, options);
  }
  options = Object.assign({}, options);

  OutgoingInviteSignaling.call(this, identities, labelOrSid, localMedia, options);

  Object.defineProperties(this, {
    _session: {
      value: null,
      writable: true
    }
  });

  var self = this;
  createSession(this, accountSid, token, ua, labelOrSid).then(function createSessionSucceeded(session) {
    if (session) {
      self._session = session;
      handleSessionEvents(self, session);
    }
  });
}

inherits(OutgoingInviteV2, OutgoingInviteSignaling);

OutgoingInviteV2.prototype._cancel = function _cancel() {
  if (this._session) {
    this._session.terminate();
  }
};

function createSession(outgoingInviteV2, accountSid, token, ua, labelOrSid) {
  var addresses = outgoingInviteV2.identities.map(function(identity) {
    return 'sip:' + util.makeSIPURI(accountSid, identity);
  });

  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');

  var extraHeaders = [
    util.selectTokenHeader(token)   + ': ' + token,
    C.headers.X_TWILIO_CLIENT       + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_PARTICIPANTS + ': ' + addresses.join(',') +
      (labelOrSid ? ';label=' + labelOrSid : ''),
    'Session-Expires: 120'
  ];

  var options = outgoingInviteV2._options;

  var localMedia = outgoingInviteV2.localMedia;
  var peerConnectionManager = new PeerConnectionManager();

  localMedia.mediaStreams.forEach(peerConnectionManager.addStream, peerConnectionManager);

  return peerConnectionManager.setConfiguration(options).then(function setConfigurationSucceeded() {
    if (outgoingInviteV2.state === 'canceled') {
      return null;
    }

    var session = ua.invite(target, {
      extraHeaders: extraHeaders,
      media: { stream: {} },
      mediaHandlerFactory: function mediaHandlerFactory() {
        return new SIPJSMediaHandler(peerConnectionManager);
      },
      infoHandler: function infoHandler(request) {
        session.emit('info', request);
        request.reply(200);
      }
    });

    return session;
  });
}

function handleSessionEvents(outgoingInviteV2, session) {
  session.once('accepted', function accepted(response) {
    outgoingInviteV2.preempt('accepted');

    var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
    participantInfo = participantInfo ? participantInfo.split(';') : null;
    var participantSid = participantInfo ? participantInfo[0] : null;

    var conversationSid = util.parseConversationSIDFromContactHeader(
      response.getHeader('Contact'));

    var conversationV2 = new ConversationV2(outgoingInviteV2.localMedia, participantSid, conversationSid, session, outgoingInviteV2._options);

    outgoingInviteV2._deferred.resolve(conversationV2);
  });

  session.once('canceled', function canceled() {
    outgoingInviteV2.preempt('canceled');
    outgoingInviteV2._deferred.reject(new Error('OutgoingInvite canceled'));
  });

  session.once('failed', function failed() {
    try {
      outgoingInviteV2.preempt('failed');
      outgoingInviteV2._deferred.reject(new Error('OutgoingInvite failed'));
    } catch (error) {
      // Do nothing
    }
  });

  session.once('rejected', function rejected() {
    outgoingInviteV2.preempt('rejected');
    outgoingInviteV2._deferred.reject(new Error('OutgoingInvite rejected'));
  });
}

module.exports = OutgoingInviteV2;
