'use strict';

var Dialog = require('./dialog');
var inherits = require('util').inherits;
var getStatistics = require('../webrtc/getstatistics');

/**
 * Constructs a {@link SIPJSDialog}.
 * @class
 * @classdesc
 * @extends {Dialog}
 * @param {SIPJSUserAgent} userAgent
 * @param {Session} session
 * @param {Participant} participant
 * @param {object} sipjsSession
 * @param {Stream} stream
 * @property {Session} session
 * @property {UserAgent} userAgent
 * @property {Participant} participant
 * @fires Dialog#hangup
 * @fires Dialog#statistics
 */
function SIPJSDialog(userAgent, session, participant, sipjsSession, stream) {
  if (!(this instanceof SIPJSDialog)) {
    return new SIPJSDialog(userAgent, session, participant, sipjsSession, stream);
  }
  Dialog.call(this, userAgent, session, participant, stream);
  var publishInterval = null;
  var sampleInterval = null;
  var queuedStatistics = [];
  var callSid = null;
  Object.defineProperties(this, {
    _callSid: {
      set: function(_callSid) {
        callSid = _callSid;
      }
    },
    _publishInterval: {
      get: function() {
        return publishInterval;
      },
      set: function(_publishInterval) {
        publishInterval = _publishInterval;
      }
    },
    _sampleInterval: {
      get: function() {
        return sampleInterval;
      },
      set: function(_sampleInterval) {
        sampleInterval = _sampleInterval;
      }
    },
    _sipjsSession: {
      value: sipjsSession
    },
    callSid: {
      get: function() {
        return callSid;
      }
    }
  });
  var self = this;
  sipjsSession.once('accepted', function(response) {
    if (!self.callSid) {
      var callSid = response.getHeader('X-Twilio-CallSid');
      self._callSid = callSid;
    }
    if (!self._sampleInterval) {
      self._sampleInterval = setInterval(function() {
        var peerConnection = sipjsSession.mediaHandler.peerConnection;
        getStatistics(peerConnection, function(error, statistics) {
          if (error) {
            // TODO(mroberts): Figure out how we want to handle this error.
            return;
          }
          self.emit('statistics', statistics);
          queuedStatistics.push(statistics);
        });
      }, 1000);
    }
    if (!self._publishInterval) {
      self._publishInterval = setInterval(function() {
        var statistics = {
          callsid: self.callSid,
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
      }, 10000);
    }
  });
  sipjsSession.once('failed', function() {
    if (self._publishInterval) {
      clearInterval(self._publishInterval);
      self._publishInterval = null;
    }
    if (self._sampleInterval) {
      clearInterval(self._sampleInterval);
      self._sampleInterval = null;
    }
  });
  sipjsSession.once('bye', function() {
    if (self._publishInterval) {
      clearInterval(self._publishInterval);
      self._publishInterval = null;
    }
    if (self._sampleInterval) {
      clearInterval(self._sampleInterval);
      self._sampleInterval = null;
    }
    session._left(participant);
  });
  return Object.freeze(this);
}

inherits(SIPJSDialog, Dialog);

module.exports = SIPJSDialog;
