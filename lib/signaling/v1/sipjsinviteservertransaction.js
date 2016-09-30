'use strict';

var E = require('../../util/constants').twilioErrors;
var headers = require('../../util/constants').headers;
var inherits = require('util').inherits;
var InviteServerTransaction = require('./inviteservertransaction');
var SIPJSDialog = require('./sipjsdialog');
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = require('../../media/localmedia');

/**
 * Construct a {@link SIPJSInviteServerTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteServerTransactions} is an
 *   {@link InviteServerTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the recipient of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} from - the sender of the
 *   {@link SIPJSInviteServerTransaction}
 * @param {string} conversationSid - the {@link SIPJSDialog}'s {@link Conversation} SID, if accepted
 * @param {string} callSid - the {@link SIPJSDialog}'s call SID, if accepted
 * @param {object} session - the SIP.js Session object
 * @property {object} session the SIP.js Session object
 * @augments InviteServerTransaction
 */
function SIPJSInviteServerTransaction(userAgent, session) {
  if (!(this instanceof SIPJSInviteServerTransaction)) {
    return new SIPJSInviteServerTransaction(userAgent, session);
  }

  var request = session.request;
  var from = request.from.uri.toString();
  var conversationSid = util.parseConversationSIDFromContactHeader(request.getHeader('Contact'));
  var callSid = request.getHeader(headers.X_TWILIO_CALLSID);

  var participantInfo = request.getHeader(headers.X_TWILIO_PARTICIPANTSID);
  participantInfo = participantInfo ? participantInfo.split(';') : null;
  var participantSid = participantInfo ? participantInfo[0] : null;

  var cookieRegex = /^cookie=([^\s]+)/i;
  var cookie = participantInfo
    && participantInfo[1]
    && cookieRegex.test(participantInfo[1])
    && participantInfo[1].match(cookieRegex)[1];

  InviteServerTransaction.call(this, userAgent, from, conversationSid, callSid, participantSid, cookie);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    session: {
      enumerable: true,
      value: session
    }
  });

  var self = this;
  session.once('cancel', function() {
    if (self._setCanceled()) {
      var error = E.CONVERSATION_JOIN_FAILED.clone('Incoming Invite was canceled by the sender');
      self._deferred.reject(error);
    }
  });
  session.once('failed', function(response) {
    if (self._setFailed()) {
      var message = util.getOrNull(response, 'headers.X-Twilio-Error.0.raw') || 'An unknown error occurred';
      var error = E.CONVERSATION_JOIN_FAILED.clone(message);
      self._deferred.reject(error);
    }
  });

  return this;
}

inherits(SIPJSInviteServerTransaction, InviteServerTransaction);

SIPJSInviteServerTransaction.prototype.accept = function accept(options) {
  options = Object.assign({
    media: {}
  }, options);

  var getLocalMedia = LocalMedia.getLocalMedia(options);
  var localMedia = null;
  var self = this;
  var session = self.session;

  var configuration = {
    iceServers: this.userAgent.iceServers,
    iceTransportPolicy: this.userAgent.iceTransportPolicy
  };

  if ('iceServers' in options) {
    configuration.iceServers = options.iceServers;
  }

  if ('iceTransportPolicy' in options) {
    configuration.iceTransportPolicy = options.iceTransportPolicy;
  }

  session.mediaHandler.createPeerConnection(configuration);

  var supportedOptions = session.request.parseHeader('Supported') || [];
  if (supportedOptions.indexOf('timer') >= 0) {
    options.extraHeaders = ['Session-Expires: 120;refresher=uas', 'Require: timer'];
  }

  return getLocalMedia.then(function(_localMedia) {
    localMedia = _localMedia;

    var mediaStreams = [];
    localMedia.mediaStreams.forEach(function(mediaStream) {
      mediaStreams.push(mediaStream);
    });

    options.media.stream = mediaStreams[0];

    function accepted() {
      var peerConnection = session.mediaHandler.peerConnection;
      var remoteMedia = new Media();

      session.mediaHandler.on('addStream', function addStream(event) {
        if (event) { remoteMedia._addRemoteStream(event.stream); }
      });
      session.mediaHandler.dequeue('addStream');

      var remoteStreams = peerConnection.getRemoteStreams() || [];
      remoteStreams.forEach(remoteMedia._addRemoteStream, remoteMedia);

      function createDialog() {
        setTimeout(function setAccepted() {
          if (self._setAccepted()) {
            var dialog = new SIPJSDialog(self.userAgent, self.from, self.conversationSid, self.callSid, localMedia, remoteMedia, peerConnection, self.participantSid, self.session);
            self._deferred.resolve(dialog);
          }
        });
      }

      session.once('confirmed', createDialog);
    }

    session.once('accepted', accepted);

    // NOTE(mroberts): Accepting a Session can throw if it's in the wrong state,
    // but we trust the SIPJSInviteServerTransaction to track that for us. So
    // do nothing if this throws.
    try {
      session.accept(options);
    } catch (error) {
      // Do nothing.
      session.removeListener('accepted', accepted);
    }

    return self._promise;
  });
};

SIPJSInviteServerTransaction.prototype.reject = function reject() {
  if (!this._setRejected()) {
    throw new Error('SIPJSInviteServerTransaction already in state: ' + this._state);
  }

  this._deferred.reject(this);

  if (this.session) {
    this.session.reject({ statusCode: 600 });
  }

  return this;
};

Object.freeze(SIPJSInviteServerTransaction.prototype);

module.exports = SIPJSInviteServerTransaction;
