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
  var interval = null;
  Object.defineProperties(this, {
    _interval: {
      get: function() {
        return interval;
      },
      set: function(_interval) {
        interval = _interval;
      }
    },
    _sipjsSession: {
      value: sipjsSession
    }
  });
  var self = this;
  sipjsSession.once('accepted', function() {
    if (!self._interval) {
      self._interval = setInterval(function() {
        var peerConnection = sipjsSession.mediaHandler.peerConnection;
        getStatistics(peerConnection, function(error, statistics) {
          if (error) {
            // TODO(mroberts): Figure out how we want to handle this error.
            return;
          }
          self.emit('statistics', statistics);
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
        });
      }, 10000);
    }
  });
  sipjsSession.once('failed', function() {
    if (self._interval) {
      clearInterval(self._interval);
      self._interval = null;
    }
  });
  sipjsSession.once('bye', function() {
    if (self._interval) {
      clearInterval(self._interval);
      self._interval = null;
    }
    session._left(participant);
  });
  return Object.freeze(this);
}

inherits(SIPJSDialog, Dialog);

module.exports = SIPJSDialog;
