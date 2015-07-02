'use strict';

var assert = require('assert');
var Q = require('q');

var Endpoint = require('lib/endpoint');
var SIPJSUserAgent = require('lib/signaling/sipjsuseragent');

var credentials = require('../../../test.json');
var getToken = require('test/lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Invite (SIPJSUserAgent)', function() {
  // Alice is an Endpoint.
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getToken({ address: bobName });
  var bob = null;

  // Charlie is a UserAgent.
  var charlieName = randomName();
  var charlieToken = getToken({ address: charlieName });
  var charlie = null;

  var conversation = null;
  var dialog = null;

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;

  before(function allRegister(done) {
    alice = new Endpoint(aliceToken, options);
    bob = new SIPJSUserAgent(bobToken, options);
    charlie = new SIPJSUserAgent(charlieToken, options);

    return Q.all([alice.listen(), bob.register(), charlie.register()])
      .then(function() { done(); }, done);
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
