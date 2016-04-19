'use strict';

var ConversationV2 = require('./conversation');
var headers = require('../../util/constants').headers;
var IncomingInviteSignaling = require('../incominginvite');
var inherits = require('util').inherits;
var util = require('../../util');

function IncomingInviteV2(session, options) {
  if (!(this instanceof IncomingInviteV2)) {
    return new IncomingInviteV2(session, options);
  }
  options = Object.assign({}, options);

  var request = session.request;

  var conversationSid = util.parseConversationSIDFromContactHeader(request.getHeader('Contact'));
  var from = util.getUser(request.from.uri.toString());

  var participantInfo = request.getHeader(headers.X_TWILIO_PARTICIPANTSID);
  participantInfo = participantInfo ? participantInfo.split(';') : null;
  var participantSid = participantInfo ? participantInfo[0] : null;

  IncomingInviteSignaling.call(this, conversationSid, from, participantSid, options);

  Object.defineProperties(this, {
    _session: {
      value: session
    }
  });

  handleSessionEvents(this, session);
}

inherits(IncomingInviteV2, IncomingInviteSignaling);

IncomingInviteV2.prototype._accept = function _accept(localMedia, options) {
  options = Object.assign({}, this._options, options);

  localMedia.mediaStreams.forEach(function addStream(stream) {
    this._session.mediaHandler.peerConnectionManager.addStream(stream);
  }, this);

  var self = this;

  return this._session.mediaHandler.peerConnectionManager.setConfiguration(options).then(function() {
    return new Promise(function accept(resolve, reject) {
      function accepted() {
        var conversationV2 = new ConversationV2(localMedia, self.participantSid, self.conversationSid, self._session, options);

        resolve(conversationV2);
      }

      function failed() {
        switch (self.state) {
          case 'canceled':
            return reject(new Error('IncomingInvite canceled'));
          case 'failed':
            return reject(new Error('IncomingInvite failed'));
          case 'rejected':
            return reject(new Error('IncomingInvite rejected'));
        }
      }

      self._session.once('accepted', accepted);
      self._session.once('failed', failed);

      self._session.accept({
        media: { stream: {} },
        infoHandler: function infoHandler(request) {
          self._session.emit('info', request);
          request.reply(200);
        }
      });
    });
  });
};

IncomingInviteV2.prototype._reject = function _reject() {
  this._session.terminate();
};

function handleSessionEvents(incomingInviteV2, session) {
  session.once('canceled', function canceled() {
    incomingInviteV2.preempt('canceled');
  });

  session.once('failed', function failed() {
    try {
      incomingInviteV2.preempt('failed');
    } catch (error) {
      // Do nothing
    }
  });
}

module.exports = IncomingInviteV2;
