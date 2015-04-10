'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var config = require('../../test');
var accountSid = config['accountSid'];
var authToken = config['authToken'];
var getCapabilityToken =
  require('../token').getCapabilityToken.bind(null, accountSid, authToken);

describe('Endpoint (SIPJSUserAgent)', function() {
  var aliceName = randomName();
  var aliceToken = getCapabilityToken(aliceName);
  var alice = null;

  describe('constructor', function() {
    before(function(done) {
      alice = new Endpoint(aliceToken, { debug: false });
      alice.listen().then(function() {
        done();
      }, done);
    });

    it('sets .listening', function() {
      assert(alice.listening);
    });

    it('sets .address', function() {
      assert.equal(aliceName, alice.address);
    });

    describe('#unlisten', function() {
      before(function(done) {
        alice.unlisten().then(function() {
          done();
        }, done);
      });

      it('updates .listening', function() {
        assert(!alice.listening);
      });

      it('does not update .address', function() {
        assert.equal(aliceName, alice.address);
      });

      describe('#listen (with new Token)', function() {
        var aliceName = null;
        var aliceToken = null;

        before(function(done) {
          aliceName = randomName();
          aliceToken = getCapabilityToken(aliceName);
          alice.listen(aliceToken).then(function() {
            done();
          }, done);
        });

        it('updates .listening', function() {
          assert(alice.listening);
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

    it.skip('invite.conversationSid', function() {
      assert(invite.conversationSid);
    });

    describe('Invite#accept', function() {
      var conversation = null;

      it('updates .conversations', function(done) {
        invite.accept().then(function(_conversation) {
          conversation = _conversation;
          assert(alice.conversations.has(conversation));
        }).then(done, done);
      });

      describe('Conversation#leave', function() {
        it('updates .conversations', function(done) {
          conversation.leave().then(function() {
            assert(!alice.conversations.has(conversation));
          }).then(done, done);
        });
      });
    });
  });

  describe('#invite', function() {
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

    describe('Conversation#leave', function() {
      it('updates .conversations', function(done) {
        conversation.leave().then(function() {
          assert(!alice.conversations.has(conversation));
        }).then(done, done);
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
