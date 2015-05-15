'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var config = require('../../test');
var accountSid = config['accountSid'];
var accountSid = config['accountSid'];
var signingKeySid = config['signingKeySid'];
var signingKeySecret = config['signingKeySecret'];
var wsServer = config['wsServer'];
var getToken = require('../token').getToken.bind(null, accountSid,
  signingKeySid, signingKeySecret);

var Token = require('../../lib/accesstoken');

describe('Conversation (SIPJSUserAgent)', function() {
  // Alice is an Endpoint.
  var aliceName = randomName();
  var aliceToken = getToken(aliceName);
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getToken(bobName);
  var bob = null;

  // Charlie is a UserAgent.
  var charlieName = randomName();
  var charlieToken = getToken(charlieName);
  var charlie = null;
  var charlieDialogs = [];

  // Donald is a UserAgent.
  var donaldName = randomName();
  var donaldToken = getToken(donaldName);
  var donald = null;
  var donaldDialogs = [];

  var conversation = null;
  var dialog = null;

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;
  options['logLevel'] = 'off';

  describe('constructor', function() {
    before(function setupEndpoint(done) {
      this.timeout(10000);
      alice = new Endpoint(aliceToken, options);
      bob = new SIPJSUserAgent(bobToken, options);

      Q.all([alice.listen(), bob.connect()])
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

    it('should set the .participants property to Participant address', function() {
      var hasBob = false;
      conversation.participants.forEach(function(participant) {
        hasBob = hasBob || participant.address === bobName;
      });
      assert(hasBob);
      assert.equal(1, conversation.participants.size);
    });
  });

  describe('#invite', function() {
    before(function setupEndpointsAndAgents(done) {
      this.timeout(10000);
      alice = new Endpoint(aliceToken, options);
      bob = new SIPJSUserAgent(bobToken, options);
      charlie = new SIPJSUserAgent(charlieToken, options);
      donald = new SIPJSUserAgent(donaldToken, options);
  
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

      Q.all([alice.listen(), bob.connect(), charlie.connect(), donald.connect()])
        .then(function() {
          return Q.all([bob.register(), charlie.register(), donald.register()]);
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

    it('should throw an exception if no participantAddress is passed', function() {
      assert.throws(conversation.invite.bind(conversation));
    });

    it('should throw an exception if participantAddress is not a string', function() {
      assert.throws(conversation.invite.bind(conversation, charlie));
    });

    it('should return a Promise<Participant> for one address', function(done) {
      conversation.invite(charlieName)
        .then(
          function(participant) { assert.equal(participant.address, charlieName); },
          function() { assert.fail(null, null, 'promise was rejected'); })
        .then(done, done);
    });

    it('should return an Array<Promise<Participant>> for one address in an array', function(done) {
      conversation.invite([charlieName])[0]
        .then(
          function(participant) { assert.equal(participant.address, charlieName); },
          function() { assert.fail(null, null, 'promise was rejected'); })
        .then(done, done);
    });

    // NOTE(mroberts): Disabled until this works in prod.
    it.skip('should return an Array<Promise<Participant>> for multiple addresses in an array', function(done) {
      this.timeout(10000);
      Q.all(conversation.invite([charlieName, donaldName])).then(
          function(participants) {
            var names = participants.map(function(participant) {
              return participant.address;
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
