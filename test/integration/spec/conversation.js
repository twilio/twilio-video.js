'use strict';

var AccessManager = require('twilio-common').AccessManager;
var assert = require('assert');

var Client = require('../../../lib/client');
var LocalMedia = require('../../../lib/media/localmedia');
var SignalingV2 = require('../../../lib/signaling/v2');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Conversation', function() {
  var aliceName = randomName();
  var aliceToken = getToken({ address: aliceName });
  var aliceManager = new AccessManager(aliceToken);
  var alice = null;

  var bobName = randomName();
  var bobToken = getToken({ address: bobName });
  var bobManager = new AccessManager(bobToken);
  var bob = null;

  var charlieName = randomName();
  var charlieToken = getToken({ address: charlieName });
  var charlieManager = new AccessManager(charlieToken);
  var charlie = null;

  var donaldName = randomName();
  var donaldToken = getToken({ address: donaldName });
  var donaldManager = new AccessManager(donaldToken);
  var donald = null;

  var conversation = null;

  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  options['logLevel'] = 'off';

  var localMedia = new LocalMedia();

  describe('constructor', function() {
    before(function setupClient(done) {
      this.timeout(10000);
      alice = new Client(aliceManager, options);
      bob = new SignalingV2(bobManager, options);

      Promise.all([alice.listen(), bob.listen()])
        .then(function() {
          bob.on('invite', function(invite) {
            invite.accept(localMedia);
          });
          return alice.inviteToConversation(bobName);
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
  });

  describe('#invite', function() {
    before(function setupClientsAndAgents(done) {
      this.timeout(10000);
      alice = new Client(aliceManager, options);
      bob = new SignalingV2(bobManager, options);
      charlie = new SignalingV2(charlieManager, options);
      donald = new SignalingV2(donaldManager, options);

      bob.on('invite', function(invite) {
        invite.accept(localMedia);
      });
      charlie.on('invite', function(invite) {
        invite.accept(localMedia);
      });

      donald.on('invite', function(invite) {
        invite.accept(localMedia);
      });

      Promise.all([alice.listen(), bob.listen(), charlie.listen(), donald.listen()])
        .then(function() {
          return Promise.all([bob.listen(), charlie.listen(), donald.listen()]);
        }).then(function() {
          return alice.inviteToConversation(bobName);
        }).then(function(_conversation) {
          conversation = _conversation;
          return new Promise(function(resolve) {
            conversation.once('participantConnected', function() {
              resolve();
            });
          });
        }).then(done, done);
    });

    it('should work for one identity', function(done) {
      conversation.invite(charlieName);
      conversation.on('participantConnected', function(participant) {
        if (participant.identity === charlieName && done) {
          done();
          done = null;
        }
      });
    });

    it('should work for one identity in an array', function(done) {
      conversation.invite([charlieName]);
      conversation.on('participantConnected', function(participant) {
        if (participant.identity === charlieName && done) {
          done();
          done = null;
        }
      });
    });

    it('should work for multiple identities in an array', function(done) {
      this.timeout(10000);
      conversation.invite([charlieName, donaldName]);
      Promise.all([
        new Promise(function(resolve, reject) {
          conversation.on('participantConnected', function(participant) {
            if (participant.identity === charlieName) {
              resolve();
            }
          });
        }),
        new Promise(function(resolve, reject) {
          conversation.on('participantConnected', function(participant) {
            if (participant.identity === donaldName) {
              resolve();
            }
          });
        })
      ]).then(function() { done(); }, done);
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}
