'use strict';

var Dialog = require('./dialog');
var inherits = require('util').inherits;
var Q = require('q');
var C = require('../util/constants');
var E = C.twilioErrors;
var SIPJS = require('sip.js');

/**
 * Construct a {@link SIPJSDialog}.
 * @class
 * @classdesc A {@link SIPJSDialog} is a {@link Dialog} powered by the SIP.js
 *   library.
 * @augments Dialog
 * @param {SIPJSUserAgent} userAgent - the {@link SIPJSUserAgent} that owns
 *   this {@link SIPJSDialog}
 * @param {string} remote - the remote participant in the {@link SIPJSDialog}
 * @param {string} conversationSid - the {@link Dialog}'s conversation SID
 * @param {string} callSid - the {@link Dialog}'s call SID
 * @param {LocalMedia} localMedia - the {@link LocalMedia}
 * @param {Media} remoteMedia - the remote {@link Media}
 * @param {object} PeerConnection - the PeerConnection
 * @param {object} session - the SIP.js Session object
 * @param {?number} inviteTo180 - the time between INVITE and 180 in milliseconds
 * @property {?number} inviteTo180 - the time between INVITE and 180 in milliseconds
 * @property {Session} session - the SIP.js Session object
 * @fires Dialog#ended
 * @fires Dialog#statistics
 */
function SIPJSDialog(userAgent, remote, conversationSid, callSid, localStream,
    remoteStream, peerConnection, session, inviteTo180)
{
  if (!(this instanceof SIPJSDialog)) {
    return new SIPJSDialog(userAgent, remote, conversationSid, callSid,
      localStream, remoteStream, peerConnection, session, inviteTo180);
  }
  var self = this;
  Dialog.call(this, userAgent, remote, conversationSid, callSid, localStream,
    remoteStream, peerConnection);

  /* istanbul ignore next */
  Object.defineProperties(this, {
    'inviteTo180': {
      enumerable: true,
      value: inviteTo180
    },
    'session': {
      enumerable: true,
      value: session
    }
  });

  peerConnection.oniceconnectionstatechange = function(res) {
    var peerConnection = res.target;
    switch(peerConnection.iceConnectionState) {
      case 'failed':
        return self.emit('failed', E.ICE_CONNECT_FAILED);
      case 'disconnected':
        return self.emit('disconnected', E.ICE_DISCONNECTED);
    }
  };

  session.once('failed', function() {
    self._ended = true;
    self.emit('failed', self);
  });

  session.once('bye', function() {
    self._ended = true;
    self.emit('ended', self);
  });

  session.mediaHandler.on('getDescription', function() {
    self.remoteMedia._refreshTracks();
  });

  return Object.freeze(this);
}

inherits(SIPJSDialog, Dialog);

SIPJSDialog.prototype.end = function end() {
  if (this.ended) {
    return Promise.reject(new Error('Dialog already ended'));
  }
  this._ended = true;
  var self = this;
  var deferred = Q.defer();
  // setTimeout(function() {
    self.session.once('bye', function() {
      deferred.resolve(self);
      self.emit('ended', self);
    });
    self.session.bye();
  // });
  return deferred.promise;
};

SIPJSDialog.prototype._reinvite = function _reinvite() {
  // FIXME(mroberts): Until we have a proper API for overriding RTCOfferOptions.
  this.session.mediaHandler.RTCConstraints = C.DEFAULT_OFFER_OPTIONS;
  this.session.sendReinvite();
};

/**
 * @returns {Promise<SIPJSDialog>} when received 202 Notify for REFER.
 */
SIPJSDialog.prototype._refer = function _refer(target) {
  if (typeof target !== 'string') {
    throw new Error('Target is not a string');
  }

  var self = this;
  var deferred = Q.defer();

  var extraHeaders = [
    'Contact: ' + this.session.contact,
    'Allow: ' + SIPJS.Utils.getAllowedMethods(this.session.ua),
    'Refer-To: ' + this.session.ua.normalizeTarget(target),
    'Allow-Events: refer',
    'Event: refer;id=' + Math.floor((Math.random() * 1000) + 1)
  ];

  self.session.sendRequest('REFER', {
    extraHeaders: extraHeaders,
    receiveResponse: function receiveResponse(response) {
      if (response.status_code == 202) {
        deferred.resolve(self);
      } else {
        deferred.reject(response);
      }
    }
  });

  return deferred.promise;
};

Object.freeze(SIPJSDialog.prototype);

module.exports = SIPJSDialog;
