'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var accountSid = process.env['ACCOUNT_SID'];
var authToken = process.env['AUTH_TOKEN'];
var getCapabilityToken =
  require('../token').getCapabilityToken.bind(null, accountSid, authToken);

describe('Invite (SIPJSUserAgent)', function() {
  // Alice is an Endpoint.
  var aliceName = randomName();
  var aliceToken = getCapabilityToken(aliceName);
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getCapabilityToken(bobName);
  var bob = null;

  // Charlie is a UserAgent.
  var charlieName = randomName();
  var charlieToken = getCapabilityToken(charlieName);
  var charlie = null;

  var conversation = null;
  var dialog = null;

  before(function allRegister(done) {
    alice = new Endpoint(aliceToken);
    bob = new SIPJSUserAgent(bobToken);
    charlie = new SIPJSUserAgent(charlieToken);

    Q.all([alice.listen(), bob.register(), charlie.register()]).then(function() {
      done();
    }, done);
  });

  describe('Receive multiple invitations to a Conversation', function() {
    var invite = null;
    var bobIct = null;
    var charlieIct = null;
    
    before(function bothInvite(done) {
      bobIct = bob.invite(aliceName).then(null, done);
      charlieIct = charlie.invite(aliceName).then(null, done);
      alice.once('invite', function(_invite) {
        invite = _invite;
        done();
      });
    });

    it('emits "invite"', function() {
      assert(invite);
    });

    it.skip('._inviteServerTransactions contains multiple InviteServerTransactions', function() {
      assert.equal(2, invite._inviteServerTransactions.length);
    });
  });

});

function randomName() {
  return Math.random().toString(36).slice(2);
}
