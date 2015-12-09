'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');

var Client = require('lib/client');
var SIPJSUserAgent = require('lib/signaling/sipjsuseragent');

var credentials = require('test/env');
var getToken = require('test/lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

var useConversationEvents = process.env.USE_CONVERSATION_EVENTS;

describe('IncomingInvite (SIPJSUserAgent)', function() {
  // Alice is an Client.
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var aliceManager = new AccessManager(aliceToken);
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getToken({ address: bobName });
  var bobManager = new AccessManager(bobToken);
  var bob = null;

  // Charlie is a UserAgent.
  var charlieName = randomName();
  var charlieToken = getToken({ address: charlieName });
  var charlieManager = new AccessManager(charlieToken);
  var charlie = null;

  var conversation = null;
  var dialog = null;

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;
  options['useConversationEvents'] = useConversationEvents;

  before(function allRegister(done) {
    alice = new Client(aliceManager, options);
    bob = new SIPJSUserAgent(bobManager, options);
    charlie = new SIPJSUserAgent(charlieManager, options);

    return Promise.all([alice.listen(), bob.register(), charlie.register()])
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
