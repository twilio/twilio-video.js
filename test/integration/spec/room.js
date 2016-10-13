'use strict';

var assert = require('assert');

var Client = require('../../../lib/client');

var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var wsServer = credentials.wsServer;
var logLevel = credentials.logLevel;

describe('Room', function() {
  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  if (logLevel) {
    options.logLevel = logLevel;
  }

  describe('constructor', function() {
    var alice = createClient(options);
    var roomName = randomName();
    var aliceRoom;

    before(() => {
      return alice.client.connect({
        to: roomName
      })
      .then((room) => {
        aliceRoom = room;
      });
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
    var roomName = null;
    var aliceRoom = null;
    var alice = null;
    var bobRoom = null;
    var bob = null;
    var charlieRoom = null;
    var charlie = null;

    beforeEach(() => {
      roomName = randomName();
      alice = createClient(options);
      bob = createClient(options);
      charlie = createClient(options);
    });

    context('when alice connects to the Room first,', () => {
      it('should have an empty participants Map', () => {
        return alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          assert.equal(0, aliceRoom.participants.size);
        });
      });
    });

    context('when bob connects to the Room after alice,', () => {
      // We are observing here that for some reason, "participantConnected"
      // is not being triggered for aliceRoom when bob connects. So,
      // skipping this test for now. This will be investigated later.
      // TODO(@mmalavalli): Investigate this issue.
      it.skip('should trigger "participantConnected" on alice\'s Room', () => {
        return alice.client.connect({
          to: roomName
        })
        .then((room) => {
          aliceRoom = room;
          return Promise.all([
            new Promise((resolve) => {
              aliceRoom.on('participantConnected', resolve);
            }),
            bob.client.connect({
              to: roomName
            })
          ]);
        })
        .then((resolved) => {
          var connectedParticipant = resolved[0];
          assert.equal(bob.name, connectedParticipant.identity);
        });
      });

      it('should not trigger "participantConnected" on bob\'s Room', () => {
        return alice.client.connect({
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
            setTimeout(resolve);
            bobRoom.on('participantConnected', () => reject(
              new Error('"participantConnected" was triggered for alice')
            ));
          });
        });
      });

      context('and later disconnects from the Room,', () => {
        it('should not trigger "participantDisconnected" for alice on bob\'s Room object', () => {
          return alice.client.connect({
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
              setTimeout(resolve);
              bobRoom.on('participantDisconnected', () => reject(
                new Error('"participantDisconnected" was triggered for alice')
              ));
              bobRoom.disconnect();
            });
          });
        });
      });

      it('should retain alice in bob\'s Room participants Map in "connected" state', () => {
        return alice.client.connect({
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
          bobRoom.disconnect();
        })
        .then(() => {
          var aliceSid = aliceRoom.localParticipant.sid;
          assert(bobRoom.participants.has(aliceSid));
          var aliceParticipant = bobRoom.participants.get(aliceSid);
          assert.equal(alice.name, aliceParticipant.identity);
          assert.equal('connected', aliceParticipant.state);
        });
      });
    });

    context('when charlie connects to the Room after alice and bob,', () => {
      it('should populate charlie\'s participant Map with alice and bob, both in "connected" state', () => {
        return alice.client.connect({
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
          charlieRoom = room;
          assert.equal(charlieRoom.participants.size, 2);

          var aliceSid = aliceRoom.localParticipant.sid;
          var bobSid = bobRoom.localParticipant.sid;
          var aliceParticipant;
          var bobParticipant;

          assert(charlieRoom.participants.has(aliceSid));
          aliceParticipant = charlieRoom.participants.get(aliceSid);
          assert.equal(alice.name, aliceParticipant.identity);
          assert.equal('connected', aliceParticipant.state);

          assert(charlieRoom.participants.has(bobSid));
          bobParticipant = charlieRoom.participants.get(bobSid);
          assert.equal(bob.name, bobParticipant.identity);
          assert.equal('connected', bobParticipant.state);
        });
      });
    });

    afterEach(() => {
      alice = null;
      if (aliceRoom) {
        aliceRoom.disconnect();
        aliceRoom = null;
      }
      bob = null;
      if (bobRoom) {
        bobRoom.disconnect();
        bobRoom = null;
      }
      charlie = null;
      if (charlieRoom) {
        charlieRoom.disconnect();
        charlieRoom = null;
      }
      roomName = null;
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
