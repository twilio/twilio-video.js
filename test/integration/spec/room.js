'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const credentials = require('../../env');
const getToken = require('../../lib/token').getToken.bind(null, credentials);
const logLevel = credentials.logLevel;
const randomName = require('../../lib/util').randomName;

describe('Room', function() {
  this.timeout(30000);

  let options;

  beforeEach(() => {
    options = {};

    [ 'ecsServer', 'wsServer', 'wsServerInsights' ].forEach(server => {
      if (credentials[server]) {
        options[server] = credentials[server];
      }
    });

    if (logLevel) {
      options.logLevel = logLevel;
    }
  });

  describe('constructor', () => {
    let alice;
    let roomName;
    let aliceRoom;

    beforeEach(async () => {
      alice = randomName();
      roomName = randomName();

      const aliceToken = getToken({ address: alice });
      aliceRoom = await connect(aliceToken, Object.assign({
        name: roomName
      }, options));
    });

    it('should set the .sid property', () => {
      assert(aliceRoom.sid);
    });

    it('should set the .localParticipant property', () => {
      assert(aliceRoom.localParticipant);
    });

    afterEach(() => {
      if (aliceRoom) {
        aliceRoom.disconnect();
      }
    });
  });

  describe('participant events:', () => {
    let roomName;
    let alice;
    let aliceToken;
    let aliceRoom;
    let bob;
    let bobToken;
    let bobRoom;
    let charlie;
    let charlieRoom;
    let charlieToken;

    beforeEach(() => {
      roomName = randomName();
      alice = randomName();
      aliceToken = getToken({ address: alice });
      bob = randomName();
      bobToken = getToken({ address: bob });
      charlie = randomName();
      charlieToken = getToken({ address: charlie });
    });

    context('when alice connects to the Room first,', () => {
      it('should have an empty participants Map', async () => {
        aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName
        }, options));
        assert.equal(0, aliceRoom.participants.size);
      });
    });

    context('when bob connects to the Room after alice,', () => {
      // We are observing here that for some reason, "participantConnected"
      // is not being triggered for aliceRoom when bob connects. So,
      // skipping this test for now. This will be investigated later.
      // TODO(@mmalavalli): Investigate this issue.
      it.skip('should trigger "participantConnected" on alice\'s Room', async () => {
        aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName
        }, options));

        const [connectedParticipant, bobRoom] = await Promise.all([
          new Promise(resolve => aliceRoom.once('participantConnected', resolve)),
          connect(bobToken, Object.assign({
              name: roomName
          }, options))
        ]);

        assert.equal(bob, connectedParticipant.identity);
      });

      it('should not trigger "participantConnected" on bob\'s Room', async () => {
        aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName
        }, options));

        bobRoom = await connect(bobToken, Object.assign({
          name: roomName
        }, options));

        await new Promise((resolve, reject) => {
          setTimeout(resolve);
          bobRoom.on('participantConnected', () => reject(
            new Error('"participantConnected" was triggered for alice')
          ));
        });
      });

      context('and later disconnects from the Room,', () => {
        it('should not trigger "participantDisconnected" for alice on bob\'s Room object', async () => {
          aliceRoom = await connect(aliceToken, Object.assign({
            name: roomName
          }, options));

          bobRoom = await connect(bobToken, Object.assign({
            name: roomName
          }, options));

          await new Promise((resolve, reject) => {
            setTimeout(resolve);
            bobRoom.on('participantDisconnected', () => reject(
              new Error('"participantDisconnected" was triggered for alice')
            ));
            bobRoom.disconnect();
          });
        });
      });

      it('should retain alice in bob\'s Room participants Map in "connected" state', async () => {
        aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName
        }, options));

        bobRoom = await connect(bobToken, Object.assign({
          name: roomName
        }, options));
        bobRoom.disconnect();

        const aliceSid = aliceRoom.localParticipant.sid;
        assert(bobRoom.participants.has(aliceSid));

        const aliceParticipant = bobRoom.participants.get(aliceSid);
        assert.equal(alice, aliceParticipant.identity);
        assert.equal('connected', aliceParticipant.state);
      });
    });

    context('when charlie connects to the Room after alice and bob,', () => {
      it('should populate charlie\'s participant Map with alice and bob, both in "connected" state', async () => {
        aliceRoom = await connect(aliceToken, Object.assign({
          name: roomName
        }, options));

        bobRoom = await connect(bobToken, Object.assign({
          name: roomName
        }, options));

        charlieRoom = await connect(charlieToken, Object.assign({
          name: roomName
        }, options));
        assert.equal(charlieRoom.participants.size, 2);

        const aliceSid = aliceRoom.localParticipant.sid;
        const bobSid = bobRoom.localParticipant.sid;

        assert(charlieRoom.participants.has(aliceSid));
        const aliceParticipant = charlieRoom.participants.get(aliceSid);
        assert.equal(alice, aliceParticipant.identity);
        assert.equal('connected', aliceParticipant.state);

        assert(charlieRoom.participants.has(bobSid));
        const bobParticipant = charlieRoom.participants.get(bobSid);
        assert.equal(bob, bobParticipant.identity);
        assert.equal('connected', bobParticipant.state);
      });
    });

    afterEach(() => {
      if (aliceRoom) {
        aliceRoom.disconnect();
      }

      if (bobRoom) {
        bobRoom.disconnect();
      }

      if (charlieRoom) {
        charlieRoom.disconnect();
      }
    });
  });
});
