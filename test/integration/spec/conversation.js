'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');

var Client = require('lib/client');
var SIPJSUserAgent = require('lib/signaling/sipjsuseragent');

var credentials = require('../../../test.json');
var getToken = require('test/lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

var useConversationEvents = process.env.USE_CONVERSATION_EVENTS;

describe('Conversation (SIPJSUserAgent)', function() {
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
  var charlieDialogs = [];

  // Donald is a UserAgent.
  var donaldName = randomName();
  var donaldToken = getToken({ address: donaldName });
  var donaldManager = new AccessManager(donaldToken);
  var donald = null;
  var donaldDialogs = [];

  var conversation = null;
  var dialog = null;

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;
  options['logLevel'] = 'off';
  options['useConversationEvents'] = useConversationEvents;

  describe('constructor', function() {
    before(function setupClient(done) {
      this.timeout(10000);
      alice = new Client(aliceManager, options);
      bob = new SIPJSUserAgent(bobManager, options);

      Promise.all([alice.listen(), bob.connect()])
        .then(function() {
          return bob.register();
        }).then(function() {
          bob.on('invite', function(ist) {
            ist.accept().then(function(_dialog) { dialog = _dialog; });
          });
          return alice.createConversation(bobName);
        }).then(function(_conversation) {
          conversation = _conversation;
        }).then(done, done);
    });

    it('should set the .sid property', function() {
      assert(conversation.sid);
    });

    it('should set the .localMedia property', function() {
      assert(conversation.localMedia);
    });

    it('should set the .participants property to Participant identity', function() {
      var hasBob = false;
      conversation.participants.forEach(function(participant) {
        hasBob = hasBob || participant.identity === bobName;
      });
      assert(hasBob);
      assert.equal(1, conversation.participants.size);
    });
  });

  describe('#invite', function() {
    before(function setupClientsAndAgents(done) {
      this.timeout(10000);
      alice = new Client(aliceManager, options);
      bob = new SIPJSUserAgent(bobManager, options);
      charlie = new SIPJSUserAgent(charlieManager, options);
      donald = new SIPJSUserAgent(donaldManager, options);

      bob.on('invite', function(ist) {
        ist.accept().then(function(_dialog) { dialog = _dialog; });
      });
      charlie.on('invite', function(ist) {
        ist.accept().then(function(_dialog) {
          charlieDialogs.push(_dialog);
        });

        ist.session.once('accepted', function() {
          setTimeout(function() { ist.session.mediaHandler.emit('addStream'); });
        });
      });

      donald.on('invite', function(ist) {
        ist.accept().then(function(_dialog) {
          donaldDialog.push(_dialog);
        });

        ist.session.mediaHandler.emit('addStream');
      });

      Promise.all([alice.listen(), bob.connect(), charlie.connect(), donald.connect()])
        .then(function() {
          return Promise.all([bob.register(), charlie.register(), donald.register()]);
        }).then(function() {
          return alice.createConversation(bobName);
        }).then(function(_conversation) {
          conversation = _conversation;
          assert.equal(1, conversation.participants.size);
        }).then(done, done);
    });

    // TODO: Revisit this and make sure it's working after stale registrants are fixed
    // server-side.
    afterEach(function() {
      charlieDialogs.forEach(function(dialog) { dialog.end(); });
      donaldDialogs.forEach(function(dialog) { dialog.end(); });

      charlieDialogs = [];
      donaldDialogs = [];
    });

    it('should throw an exception if no identity is passed', function() {
      assert.throws(conversation.invite.bind(conversation));
    });

    it('should throw an exception if identity is not a string', function() {
      assert.throws(conversation.invite.bind(conversation, charlie));
    });

    it('should return a Promise<Participant> for one identity', function(done) {
      conversation.invite(charlieName)
        .then(
          function(participant) { assert.equal(participant.identity, charlieName); },
          function() { assert.fail(null, null, 'promise was rejected'); })
        .then(done, done);
    });

    it('should return an Array<Promise<Participant>> for one identity in an array', function(done) {
      conversation.invite([charlieName])[0]
        .then(
          function(participant) { assert.equal(participant.identity, charlieName); },
          function() { assert.fail(null, null, 'promise was rejected'); })
        .then(done, done);
    });

    // NOTE(mroberts): Disabled until this works in prod.
    it('should return an Array<Promise<Participant>> for multiple identities in an array', function(done) {
      this.timeout(10000);
      Promise.all(conversation.invite([charlieName, donaldName])).then(
          function(participants) {
            var names = participants.map(function(participant) {
              return participant.identity;
            });
            assert(names.indexOf(charlieName) !== -1);
            assert(names.indexOf(donaldName) !== -1);
          }, function() { assert.fail(null, null, 'promise was rejected'); })
        .then(done, done);
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
