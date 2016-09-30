'use strict';

var inherits = require('util').inherits;
var InviteClientTransaction = require('./inviteclienttransaction');
var C = require('../../util/constants');
var SIPJSDialog = require('./sipjsdialog');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var headers = require('../../util/constants').headers;
var util = require('../../util');

var Media = require('../../media');
var LocalMedia = require('../../media/localmedia');

/**
 * Construct a {@link SIPJSInviteClientTransaction}.
 * @class
 * @classdesc A {@link SIPJSInviteClientTransaction} is an
 *   {@link InviteClientTransaction} powered by the SIP.js library.
 * @param {SIPJSUserAgent} userAgent - the sender of the
 *   {@link SIPJSInviteClientTransaction}
 * @param {Array<string>} to - the recipient(s) of the
 *   {@link SIPJSInviteClientTransaction}
 * @property {?object} session - the SIP.js Session object
 * @augments InviteClientTransaction
 */
function SIPJSInviteClientTransaction(userAgent, to, options) {
  if (!(this instanceof SIPJSInviteClientTransaction)) {
    return new SIPJSInviteClientTransaction(userAgent, to, options);
  }
  var self = this;
  options = options || {};
  InviteClientTransaction.call(this, userAgent, options);

  var isMultiInvite = to.length > 1;
  var isRejected = false;
  var session = null;

  // Get LocalMedia, if necessary, then ask SIP.js to place an INVITE. If the
  // outgoing Session is accepted, resolve the promise with a SIPJSDialog.
  userAgent.connect().then(function() {
    return LocalMedia.getLocalMedia(options);
  }).then(function(localMedia) {
    self._media = localMedia;

    if (self.isCanceled) {
      return self._deferred.reject(self);
    }

    session = startSession(userAgent, to, options, localMedia);

    var inviteTime = Date.now();
    var _180Time = null;
    session.on('progress', function(response) {
      if (response.statusCode === 180) {
        _180Time = Date.now();
      }
    });

    session.once('accepted', function(response) {
      var callSid = response.getHeader('X-Twilio-CallSid');
      var peerConnection = session.mediaHandler.peerConnection;
      var remoteMedia = new Media();
      session.mediaHandler.on('addStream', function addStream(event) {
        remoteMedia._addRemoteStream(event.stream);
      });
      session.mediaHandler.dequeue('addStream');
      var inviteTo180 = _180Time ? _180Time - inviteTime : null;
      var conversationSid = util.parseConversationSIDFromContactHeader(
        response.getHeader('Contact'));
      var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
      participantInfo = participantInfo ? participantInfo.split(';') : null;
      var participantSid = participantInfo ? participantInfo[0] : null;
      var dialog = new SIPJSDialog(userAgent, to[0], conversationSid, callSid, localMedia, remoteMedia, peerConnection, participantSid, session, inviteTo180);
      self._deferred.resolve(dialog);
    });

    session.once('rejected', function(res) {
      if (isMultiInvite) {
        isRejected = true;
        return;
      }

      if (res && res.status_code === 600 && self._setRejected()) {
        self._deferred.reject(self);
      } else if (self._setFailed()) {
        self._deferred.reject(self);
      }
    });

    session.once('failed', function() {
      if (isRejected) { return; }

      if (self._setFailed()) {
        self._deferred.reject(self);
      }
    });
  }).then(null, function() {
    if (self._setFailed()) {
      self._deferred.reject(self);
    }
  });

  /* istanbul ignore next */
  Object.defineProperties(this, {
    _cookie: {
      value: options.cookie
    },
    session: {
      enumerable: true,
      get: function() {
        return session;
      }
    }
  });

  return this;
}

inherits(SIPJSInviteClientTransaction, InviteClientTransaction);

function startSession(userAgent, to, options, localMedia) {
  var token = userAgent.accessManager.token;

  var participants = to.slice();
  var target = participants.shift();

  var extraHeaders = [
    util.selectTokenHeader(token)    + ': ' + token,
    C.headers.X_TWILIO_CLIENT        + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_CLIENTVERSION + ': ' + C.CLIENT_VERSION
  ];

  if (participants.length) {
    var participantsHeader = participants.join(',') + ';cookie=' + options.cookie;
    extraHeaders.push(C.headers.X_TWILIO_PARTICIPANTS + ': ' + participantsHeader);
  }

  extraHeaders.push('Session-Expires: 120');

  var mediaStreams = [];
  localMedia.mediaStreams.forEach(function(mediaStream) {
    mediaStreams.push(mediaStream);
  });

  var configuration = {
    iceServers: userAgent.iceServers,
    iceTransportPolicy: userAgent.iceTransportPolicy
  };

  if ('iceServers' in options) {
    configuration.iceServers = options.iceServers;
  }

  if ('iceTransportPolicy' in options) {
    configuration.iceTransportPolicy = options.iceTransportPolicy;
  }

  function mediaHandlerFactory(session, options) {
    var mediaHandler = new SIPJSMediaHandler(session, options);
    mediaHandler.createPeerConnection(configuration);
    return mediaHandler;
  }

  mediaHandlerFactory.isSupported = SIPJSMediaHandler.defaultFactory.isSupported;

  return userAgent._ua.invite(target, {
    extraHeaders: extraHeaders,
    inviteWithoutSdp: options.inviteWithoutSdp,
    media: { stream: mediaStreams[0] },
    mediaHandlerFactory: mediaHandlerFactory,
    RTCConstraints: C.DEFAULT_OFFER_OPTIONS
  });
}

SIPJSInviteClientTransaction.prototype.cancel = function cancel(failed) {
  var setStatus = failed ? this._setFailed : this._setCanceled;
  if (!setStatus.call(this)) {
    throw new Error('SIPJSInviteClientTransaction already in state: ' + this._state);
  }

  this._deferred.reject(this);

  if (this.session) {
    this.session.terminate();
  }

  return this;
};

Object.freeze(SIPJSInviteClientTransaction.prototype);

module.exports = SIPJSInviteClientTransaction;
