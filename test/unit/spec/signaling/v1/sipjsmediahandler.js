'use strict';

var assert = require('assert');
var SIPJSMediaHandler = require('../../../../../lib/signaling/v1/sipjsmediahandler');

// NOTE(mroberts): sinon makes this a pain in the ass--we can't just use the
// mockwebrtc.js that the integration tests use.
var SIP = require('sip.js');
SIP.WebRTC.RTCPeerConnection = function RTCPeerConnection() { return {}; };

describe('SIPJSMediaHandler', function() {
  describe('"notification" events', function() {
    var notification = { foo: 'bar' };
    var session = { ua: {} };
    var sipjsMediaHandler;

    beforeEach(function() {
      sipjsMediaHandler = new SIPJSMediaHandler(session);
    });

    it('should be queued until an event listener is attached', function(done) {
      sipjsMediaHandler.queue('notification', notification);
      sipjsMediaHandler.on('notification', function(_notification) {
        assert.equal(notification, _notification);
        done();
      });
      sipjsMediaHandler.dequeue('notification');
    });
  });
});
