'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var accountSid = process.env['ACCOUNT_SID'];
var authToken = process.env['AUTH_TOKEN'];
var getCapabilityToken =
  require('../token').getCapabilityToken.bind(null, accountSid, authToken);

describe('Endpoint (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getCapabilityToken(aliceName);
  var alice = null;

  describe('constructor', function() {
    var receivedEvent = false;

    it('emits "registered"', function(done) {
      alice = new Endpoint(aliceToken, { debug: false });
      alice.once('registered', function() {
        receivedEvent = true;
        done();
      });
      alice.once('registrationFailed', function(error) {
        done(error);
      });
    });

    it('sets .address', function() {
      assert.equal(aliceName, alice.address);
    });

    describe('#unregister', function() {
      var receivedEvent = false;

      it('updates .registered', function(done) {
        alice.unregister().then(function() {
          assert(!alice.registered);
        }).then(null, done);
        alice.once('unregistered', function() {
          receivedEvent = true;
          done();
        });
      });

      it('emits "unregistered"', function() {
        assert(receivedEvent);
      });

      it('does not update .address', function() {
        assert.equal(aliceName, alice.address);
      });

      describe('#register (with new Token)', function() {
        var aliceName = null;
        var aliceToken = null;
        var receiveEvent = false;

        it('updates .registered', function(done) {
          aliceName = randomName();
          aliceToken = getCapabilityToken(aliceName);
          alice.register(aliceToken).then(function() {
            assert(alice.registered);
          }).then(done, done);
          alice.once('registered', function() {
            receivedEvent = true;
          });
        });

        it('emits "registered"', function() {
          assert(receivedEvent);
        });

        it('updates .address', function() {
          assert.equal(aliceName, alice.address);
        });
      });
    });
  });

  var uaName = null;
  var uaToken = null;
  var ua = null;

  describe('Receive incoming call', function() {
    var ict = null;
    var invite = null;

    it('emits "invite"', function(done) {
      uaName = randomName();
      uaToken = getCapabilityToken(uaName);
      ua = new SIPJSUserAgent(uaToken, { debug: false });
      ua.register().then(function() {
        ict = ua.invite(alice.address);
      }, function(error) {
        done(error);
      });
      alice.once('invite', function(_invite) {
        invite = _invite;
        done();
      });
    });

    describe('Invite#accept', function() {
      var conversation = null;

      it('updates .conversations', function(done) {
        invite.accept().then(function(_conversation) {
          conversation = _conversation;
          assert(alice.conversations.has(conversation));
        }).then(done, done);
      });

      describe('#leave', function() {
        it('updates .conversations', function(done) {
          alice.leave(conversation).then(function() {
            assert(!alice.conversations.has(conversation));
          }).then(done, done);
        });
      });
    });
  });

  describe('#createConversation', function() {
    var conversation = null;

    it('updates .conversations', function(done) {
      alice.createConversation(uaName).then(function(_conversation) {
        conversation = _conversation;
        assert(alice.conversations.has(conversation));
      }).then(done, done);
      ua.once('invite', function(ist) {
        ist.accept();
      });
    });

    describe('#leave', function() {
      it('updates .conversations', function(done) {
        alice.leave(conversation).then(function() {
          assert(!alice.conversations.has(conversation));
        }).then(done, done);
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
