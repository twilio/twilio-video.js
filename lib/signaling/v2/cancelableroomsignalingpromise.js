'use strict';

var C = require('../../util/constants');
var CancelablePromise = require('../../util/cancelablepromise');
var RoomV2 = require('./room');
var headers = require('../../util/constants').headers;
var inherits = require('util').inherits;
var PeerConnectionManager = require('./peerconnectionmanager');
var SIPJSMediaHandler = require('./sipjsmediahandler');
var util = require('../../util');

function CancelableRoomSignalingPromise(accountSid, token, ua, identities, labelOrSid, localMedia, options) {
  if (!(this instanceof CancelableRoomSignalingPromise)) {
    return new CancelableRoomSignalingPromise(accountSid, token, ua, identities, labelOrSid, localMedia, options);
  }
  CancelablePromise.call(this);

  options = Object.assign({}, options);

  Object.defineProperties(this, {
    _session: {
      writable: true,
      value: null
    }
  });

  var addresses = identities.map(function(identity) {
    return 'sip:' + util.makeSIPURI(accountSid, identity);
  });

  var target = 'sip:' + util.makeSIPURI(accountSid, 'orchestrator');

  var extraHeaders = [
    C.headers.X_TWILIO_ACCESSTOKEN  + ': ' + token,
    C.headers.X_TWILIO_CLIENT       + ': ' + JSON.stringify({ p: 'browser' }),
    C.headers.X_TWILIO_PARTICIPANTS + ': ' + addresses.join(',') +
      (labelOrSid ? ';label=' + labelOrSid : ''),
    'Session-Expires: 120'
  ];

  var peerConnectionManager = new PeerConnectionManager();
  localMedia.mediaStreams.forEach(peerConnectionManager.addStream, peerConnectionManager);

  var cancelationError = new Error('Canceled');
  var self = this;

  peerConnectionManager.setConfiguration(options).then(function setConfigurationSucceeded() {
    if (self._isCanceled) {
      throw cancelationError;
    }

    return new Promise(function createRoomSignaling(resolve, reject) {
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

      self._session = session;

      session.once('accepted', function accepted(response) {
        if (self._isCanceled) {
          session.terminate();
          reject(cancelationError);
          return;
        }

        var participantInfo = response.getHeader(headers.X_TWILIO_PARTICIPANTSID);
        participantInfo = participantInfo ? participantInfo.split(';') : null;
        var participantSid = participantInfo ? participantInfo[0] : null;
        var roomSid = util.parseRoomSIDFromContactHeader(response.getHeader('Contact'));
        var roomV2 = new RoomV2(localMedia, participantSid, roomSid, session, options);

        resolve(roomV2);
      });

      session.once('failed', function failed() {
        reject(new Error('Connect failed'));
      });
    });
  }).then(function createRoomSignalingSucceeded(roomSignaling) {
    if (self._isCanceled) {
      roomSignaling.disconnect();
      throw cancelationError;
    }
    self._isCancelable = false;
    self._deferred.resolve(roomSignaling);
  }).catch(function onError(error) {
    peerConnectionManager.close();
    self._isCancelable = false;
    self._deferred.reject(error);
  });
}

inherits(CancelableRoomSignalingPromise, CancelablePromise);

CancelableRoomSignalingPromise.prototype._cancel = function _cancel() {
  if (this._session) {
    this._session.terminate();
  }
};

module.exports = CancelableRoomSignalingPromise;
