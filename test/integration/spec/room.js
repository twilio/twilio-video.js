'use strict';

var assert = require('assert');

var Client = require('../../../lib/client');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;

describe('Room', function() {
  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  options['logLevel'] = 'debug';

  describe('constructor', function() {
    var alice = createClient(options);
    var roomName = randomName();
    var aliceRoom;

    before(function setupClient(done) {
      this.timeout(10000);
      return alice.client.connect({
        to: roomName
      })
      .then((room) => {
        aliceRoom = room;
        done();
      }, done);
    });

    it('should set the .sid property', function() {
      assert(aliceRoom.sid);
    });

    it('should set the .localParticipant property', function() {
      assert(aliceRoom.localParticipant);
    });

    after(() => {
      if (aliceRoom) {
        aliceRoom.disconnect();
      }
    });
  });

  describe('participant events:', () => {
    context('when alice joins room first,', () => {
      it('should have an empty participants list', (done) => {
        var alice = createClient(options);
        var roomName = randomName();
        var aliceRoom;

        var teardown = function teardown() {
          if (aliceRoom) {
            aliceRoom.disconnect();
          }
          done.apply(this, arguments);
        };

        alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          assert.equal(0, aliceRoom.participants.size);
        })
        .then(teardown, teardown);
      });
    });

    context('when bob joins room after alice,', () => {
      it('should trigger "participantConnected" on alice\'s room', function(done) {
        var alice = createClient(options);
        var bob = createClient(options);
        var roomName = randomName();
        var aliceRoom;
        var bobRoom;

        var teardown = function teardown() {
          if (aliceRoom) {
            aliceRoom.disconnect();
          }
          if (bobRoom) {
            bobRoom.disconnect();
          }
          done.apply(this, arguments);
        };

        this.timeout(20000);
        alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          return new Promise((resolve, reject) => {
            var participantConnectedTimeout = setTimeout(
              reject.bind(null, new Error(
                'Failed to trigger "participantConnected ' +
                'on alice\'s room'
              )),
              5000
            );

            aliceRoom.once('participantConnected', (participant) => {
              clearTimeout(participantConnectedTimeout);
              assert.equal(bob.name, participant.identity);
              resolve();
            });

            bob.client.connect({
              to: roomName
            })
            .then((room) => {
              bobRoom = room;
            }, reject);
          });
        })
        .then(teardown, teardown);
      });

      it('should not trigger "participantConnected" on bob\'s room', function(done) {
        var alice = createClient(options);
        var bob = createClient(options);
        var roomName = randomName();
        var aliceRoom;
        var bobRoom;

        var teardown = function teardown() {
          if (aliceRoom) {
            aliceRoom.disconnect();
          }
          if (bobRoom) {
            bobRoom.disconnect();
          }
          done.apply(this, arguments);
        };

        this.timeout(20000);
        alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          return bob.client.connect({
            to: roomName
          });
        })
        .then((room) => {
          bobRoom = room;

          return new Promise((resolve, reject) => {
            var participantConnectedTimeout = setTimeout(resolve, 5000);
            bobRoom.on('participantConnected', () => {
              clearTimeout(participantConnectedTimeout);
              reject(new Error(
                'Triggered "participantConnected"' +
                'on bob\'s room'
              ));
            });
          });
        })
        .then(teardown, teardown);
      });
    });

    context('when charlie joins room after alice and bob,', () => {
      it('should populate charlie\'s participant list with alice and bob, both in "connected" state', (done) => {
        var alice = createClient(options);
        var bob = createClient(options);
        var charlie = createClient(options);
        var roomName = randomName();
        var aliceRoom;
        var bobRoom;
        var charlieRoom;

        var teardown = function teardown() {
          if (aliceRoom) {
            aliceRoom.disconnect();
          }
          if (bobRoom) {
            bobRoom.disconnect();
          }
          if (charlieRoom) {
            charlieRoom.disconnect();
          }
          done.apply(this, arguments);
        };

        alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          return bob.client.connect({
            to: roomName
          });
        })
        .then((room) => {
          bobRoom = room;
          return charlie.client.connect({
            to: roomName
          });
        })
        .then((room) => {
          var aliceSid = aliceRoom.localParticipant.sid;
          var bobSid = bobRoom.localParticipant.sid;
          var aliceParticipant;
          var bobParticipant;

          charlieRoom = room;
          assert.equal(2, charlieRoom.participants.size);

          assert(charlieRoom.participants.has(aliceSid));
          aliceParticipant = charlieRoom.participants.get(aliceSid);
          assert.equal(alice.name, aliceParticipant.identity);
          assert.equal('connected', aliceParticipant.state);

          assert(charlieRoom.participants.has(bobSid));
          bobParticipant = charlieRoom.participants.get(bobSid);
          assert.equal(bob.name, bobParticipant.identity);
          assert.equal('connected', bobParticipant.state);
        })
        .then(teardown, teardown);
      });
    });
  });
});

function randomName() {
  return Math.random().toString(36).slice(2);
}

function createClient(options) {
  var name = randomName();
  var token = getToken({ address: name });
  var client = new Client(token, options);

  return {
    name: name,
    client: client
  };
}
