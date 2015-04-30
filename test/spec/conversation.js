'use strict';

require('../mockwebrtc')();

var assert = require('assert');
var Q = require('q');
var util = require('./util');

var Endpoint = require('../../lib/endpoint');
var SIPJSUserAgent = require('../../lib/signaling/sipjsuseragent');

var config = require('../../test');
var accountSid = config['accountSid'];
var authToken = config['authToken'];
var wsServer = config['wsServer'];
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

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;

  before(function setupConversaton(done) {
    alice = new Endpoint(aliceToken, options);
    bob = new SIPJSUserAgent(bobToken, options);
    Q.all([alice.listen(), bob.register()]).then(function() {
      bob.on('invite', function(ist) {
        ist.accept().then(function(_dialog) {
          dialog = _dialog;
        });
      });
      return alice.createConversation(bobName);
    }).then(function(_conversation) {
      conversation = _conversation;
      assert(conversation.participants.map(function(participant) { return participant.address; }).has(bobName));
      assert.equal(1, conversation.participants.size);
    }).then(done, done);
  });

  it.skip('.sid', function() {
    assert(conversation.sid);
  });

  it('.participants contains Participant address', function() {
    assert(conversation.participants.map(function(participant) { return participant.address; }).has(bobName));
    assert.equal(1, conversation.participants.size);
  });

  it('.localStream', function() {
    assert(conversation.localStream);
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
