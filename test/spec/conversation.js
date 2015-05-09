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

var Token = require('../../lib/scopedauthenticationtoken');

describe('Conversation (SIPJSUserAgent)', function() {
  // Alice is an Endpoint.
  var aliceName = randomName();
  var aliceToken = getToken(aliceName);
  var alice = null;

  // Bob is a UserAgent.
  var bobName = randomName();
  var bobToken = getToken(bobName);
  var bob = null;

  var conversation = null;
  var dialog = null;

  var options = {};
  options['debug'] = false;
  options['wsServer'] = wsServer;

  before(function setupConversaton(done) {
    alice = new Endpoint(aliceToken, options);
    bob = new SIPJSUserAgent(bobToken, options);
    bob.connect().then(function() {
      return Q.all([alice.listen(), bob.register()]).then(function() {
        bob.on('invite', function(ist) {
          ist.accept().then(function(_dialog) {
            dialog = _dialog;
          });
        });
        return alice.createConversation(bobName);
      });
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
