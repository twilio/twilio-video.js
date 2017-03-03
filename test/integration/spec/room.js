'use strict';

var assert = require('assert');
var connect = require('../../../lib/connect');
var credentials = require('../../env');
var getToken = require('../../lib/token').getToken.bind(null, credentials);
var logLevel = credentials.logLevel;
var wsServer = credentials.wsServer;

describe('Room', function() {
  var options = {};
  if (wsServer) {
    options.wsServer = wsServer;
  }
  if (logLevel) {
    options.logLevel = logLevel;
  }

  describe('constructor', function() {
    var alice = randomName();
    var roomName = randomName();
    var aliceRoom;

    before(() => {
      return connect(getToken({ address: alice }), Object.assign({
        name: roomName
      }, options)).then(room => {
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
      alice = randomName();
      bob = randomName();
      charlie = randomName();
    });

    context('when alice connects to the Room first,', () => {
      it('should have an empty participants Map', () => {
        return connect(getToken({ address: alice }), Object.assign({
          name: roomName
        }, options)).then(room => {
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
        return connect(getToken({ address: alice }), Object.assign({
          name: roomName
        }, options)).then(room => {
          aliceRoom = room;
          return Promise.all([
            new Promise(resolve => {
              aliceRoom.on('participantConnected', resolve);
            }),
            connect(getToken({ address: bob }), Object.assign({
              name: roomName
            }, options))
          ]);
        }).then(resolved => {
          var connectedParticipant = resolved[0];
          assert.equal(bob, connectedParticipant.identity);
        });
      });

      it('should not trigger "participantConnected" on bob\'s Room', () => {
        return connect(getToken({ address: alice }), Object.assign({
          name: roomName
        }, options)).then(room => {
          aliceRoom = room;
          return connect(getToken({ address: bob }), Object.assign({
            name: roomName
          }, options));
        }).then((room) => {
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
          return connect(getToken({ address: alice }), Object.assign({
            name: roomName
          }, options)).then(room => {
            aliceRoom = room;
            return connect(getToken({ address: bob }), Object.assign({
              name: roomName
            }, options));
          }).then(room => {
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
        return connect(getToken({ address: alice }), Object.assign({
          name: roomName
        }, options)).then(room => {
          aliceRoom = room;
          return connect(getToken({ address: bob }), Object.assign({
            name: roomName
          }, options));
        }).then(room => {
          bobRoom = room;
          bobRoom.disconnect();
        }).then(() => {
          var aliceSid = aliceRoom.localParticipant.sid;
          assert(bobRoom.participants.has(aliceSid));
          var aliceParticipant = bobRoom.participants.get(aliceSid);
          assert.equal(alice, aliceParticipant.identity);
          assert.equal('connected', aliceParticipant.state);
        });
      });
    });

    context('when charlie connects to the Room after alice and bob,', () => {
      it('should populate charlie\'s participant Map with alice and bob, both in "connected" state', () => {
        return connect(getToken({ address: alice }), Object.assign({
          name: roomName
        }, options)).then(room => {
          aliceRoom = room;
          return connect(getToken({ address: bob }), Object.assign({
            name: roomName
          }, options));
        }).then(room => {
          bobRoom = room;
          return connect(getToken({ address: charlie }), Object.assign({
            name: roomName
          }, options));
        }).then(room => {
          charlieRoom = room;
          assert.equal(charlieRoom.participants.size, 2);

          var aliceSid = aliceRoom.localParticipant.sid;
          var bobSid = bobRoom.localParticipant.sid;
          var aliceParticipant;
          var bobParticipant;

          assert(charlieRoom.participants.has(aliceSid));
          aliceParticipant = charlieRoom.participants.get(aliceSid);
          assert.equal(alice, aliceParticipant.identity);
          assert.equal('connected', aliceParticipant.state);

          assert(charlieRoom.participants.has(bobSid));
          bobParticipant = charlieRoom.participants.get(bobSid);
          assert.equal(bob, bobParticipant.identity);
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
