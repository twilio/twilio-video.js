'use strict';

var Dialog = require('./dialog');
var inherits = require('util').inherits;
var getStatistics = require('../webrtc/getstatistics');
var Q = require('q');

/**
 * Construct a {@link SIPJSDialog}.
 * @class
 * @classdesc A {@link SIPJSDialog} is a {@link Dialog} powered by the SIP.js
 * library.
 * @param {SIPJSUserAgent} userAgent - the {@link SIPJSUserAgent} that owns
 *   this {@link SIPJSDialog}
 * @param {(RemoteEndpoint|SIPJSUserAgent)} from - the sender of the
 *   {@link Dialog}
 * @param {(RemoteEndpoint|SIPJSUserAgent)} to - the recipient of the
 *   {@link Dialog}
 * @param {string} sid - the {@link Dialog}'s SID
 * @param {object} session - the SIP.js Session object
 * @property {Session} session - the SIP.js Session object
 * @augments Dialog
 * @fires Dialog#ended
 * @fires Dialog#statistics
 */
function SIPJSDialog(userAgent, from, to, sid, session) {
  if (!(this instanceof SIPJSDialog)) {
    return new SIPJSDialog(userAgent, from, to, sid, session);
  }
  var self = this;
  Dialog.call(this, userAgent, from, to, sid);

  var publishInterval = null;
  var sampleInterval = null;
  var queuedStatistics = [];

  Object.defineProperties(this, {
    '_publishInterval': {
      get: function() {
        return publishInterval;
      },
      set: function(_publishInterval) {
        publishInterval = _publishInterval;
      }
    },
    '_sampleInterval': {
      get: function() {
        return sampleInterval;
      },
      set: function(_sampleInterval) {
        sampleInterval = _sampleInterval;
      }
    },
    'session': {
      value: session
    }
  });

  this._sampleInterval = setInterval(function() {
    var peerConnection = session.mediaHandler.peerConnection;
    getStatistics(peerConnection, function(error, statistics) {
      if (error) {
        // TODO(mroberts): Figure out how we want to handle this error.
        return;
      }
      self.emit('statistics', statistics);
      queuedStatistics.push(statistics);
    });
  }, 1000);

  this._publishInterval = null; /* setInterval(function() {
    var statistics = {
      callsid: self.sid,
      quality: queuedStatistics.slice()
    };
    queuedStatistics = [];
    var recipient = {
      receiveResponse: function() {
        // Do nothing
      }
    };
    var extraHeaders = [
      'Content-Type: application/json'
    ];
    var body = JSON.stringify(statistics);
    recipient.request
      = sipjsSession.dialog.sendRequest(recipient, 'INFO', {
        extraHeaders: extraHeaders,
        body: body
      });
  }, 10000);*/

  this.once('ended', function() {
    if (self._publishInterval) {
      clearInterval(self._publishInterval);
      self._publishInterval = null;
    }
    if (self._sampleInterval) {
      clearInterval(self._sampleInterval);
      self._sampleInterval = null;
    }
  });

  session.once('failed', function() {
    self._ended = true;
    self.emit('ended', self);
  });

  session.once('bye', function() {
    self._ended = true;
    self.emit('ended', self);
  });

  return Object.freeze(this);
}

inherits(SIPJSDialog, Dialog);

SIPJSDialog.prototype.end = function end(deferred) {
  if (this.ended) {
    throw new Error('Dialog already ended');
  }
  this._ended = true;
  var self = this;
  var deferred = Q.defer();
  setTimeout(function() {
    self.session.once('bye', function() {
      deferred.resolve(self);
      self.emit('ended', self);
    });
    self.session.bye();
  });
  return deferred.promise;
};

Object.freeze(SIPJSDialog.prototype);

module.exports = SIPJSDialog;
