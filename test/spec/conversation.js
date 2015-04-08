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

describe('Conversation (SIPJSUserAgent)', function() {
  // Alice is an Endpoint.
  var aliceName = randomName();
  var aliceToken = getCapabilityToken(aliceName);
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getCapabilityToken(bobName);
  var bob = null;

  var conversation = null;
  var dialog = null;

  before(function setupConversaton(done) {
    alice = new Endpoint(aliceToken);
    var aliceListensDeferred = Q.defer();
    alice.once('listen', function() {
      aliceListensDeferred.resolve();
    });
    var aliceListens = aliceListensDeferred.promise;

    bob = new SIPJSUserAgent(bobToken);
    var bobRegisters = bob.register();

    Q.all([aliceListens, bobRegisters]).then(function() {
      bob.on('invite', function(ist) {
        ist.accept().then(function(_dialog) {
          dialog = _dialog;
        });
      });
      return alice.invite(bobName);
    }).then(function(_conversation) {
      conversation = _conversation;
      assert(conversation.participants.has(bobName));
      assert.equal(1, conversation.participants.size);
    }).then(done, done);
  });

  it('.sid', function() {
    assert(conversation.sid);
  });

  it('.participants contains Participant address', function() {
    assert(conversation.participants.has(bobName));
    assert.equal(1, conversation.participants.size);
  });

  it('.getLocalStream() works', function() {
    var localStream = conversation.getLocalStream();
    assert(localStream);
  });

  it('.getRemoteStream() works', function() {
    var remoteStream = conversation.getRemoteStream(bobName);
    assert(remoteStream);
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
