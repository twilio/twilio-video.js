'use strict';

const assert = require('assert');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const { flatMap } = require('../../../lib/util');
const env = require('../../env');
const { participantsConnected, randomName, tracksAdded } = require('../../lib/util');
const Participant = require('../../../lib/participant');

const options = ['ecsServer', 'logLevel', 'wsServer', 'wsServerInsights'].reduce((options, option) => {
  if (env[option] !== undefined) {
    options[option] = env[option];
  }
  return options;
}, {});

describe('Room', function() {
  this.timeout(30000);

  describe('disconnect', () => {
    let rooms;

    beforeEach(async () => {
      const identities = [randomName(), randomName(), randomName()];
      const tokens = identities.map(getToken);
      const name = randomName();
      rooms = await Promise.all(tokens.map(token => connect(token, Object.assign({ name }, options))));
      await Promise.all(rooms.map(room => participantsConnected(room, rooms.length - 1)));
    });

    afterEach(() => {
      rooms.forEach(room => room.disconnect());
    });

    it('should set the Room\'s LocalParticipant\'s .state to "disconnected"', () => {
      const room = rooms[0];
      room.disconnect();
      assert.equal(room.localParticipant.state, 'disconnected');
    });

    it('should not change the Room\'s .participants Map', () => {
      const room = rooms[0];
      const participantsBefore = [...room.participants.keys()];
      room.disconnect();
      const participantsAfter = [...room.participants.keys()];
      assert.deepEqual(participantsBefore, participantsAfter);
    });

    it('should not change Room\'s Participant\'s .states', () => {
      const room = rooms[0];
      room.disconnect();
      room.participants.forEach(participant => assert.equal(participant.state, 'connected'));
    });

    it('should not change Room\'s Participant\'s .tracks', () => {
      const room = rooms[0];
      const tracksBefore = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());
      room.disconnect();
      const tracksAfter = [...room.participants.values()].sort().map(participant => [...participant.tracks.keys()].sort());
      assert.deepEqual(tracksAfter, tracksBefore);
    });

    it('should raise a "participantDisconnected" event for every other Participant connected to the Room', async () => {
      const room = rooms[0];
      const participantsDisconnected = rooms.slice(1).map(room => {
        return new Promise(resolve => room.once('participantDisconnected', resolve));
      });
      room.disconnect();
      await participantsDisconnected;
    });
  });

  describe('getStats', () => {
    it.skip('TODO', () => {});
  });

  describe('"disconnected" event', () => {
    it.skip('is raised whenever the LocalParticipant is disconnected via the REST API', () => {
      // TODO(mroberts): POST to the REST API to disconnect the LocalParticipant from the Room.
    });
  });

  describe('"participantConnected" event', () => {
    let thisRoom;
    let thatRoom;
    let thisParticipant;
    let thatParticipant;

    before(async () => {
      thisRoom = await connect(getToken(randomName()), options);
    });

    after(() => {
      thisRoom.disconnect();
      if (thatRoom) {
        thatRoom.disconnect();
      }
    });

    it('is raised whenever a Participant connects to the Room', async () => {
      const participantConnected = new Promise(resolve => thisRoom.once('participantConnected', resolve));
      thatRoom = await connect(getToken(randomName()), Object.assign({ name: thisRoom.name }, options));
      thisParticipant = await participantConnected;
      thatParticipant = thatRoom.localParticipant;
      assert(thatParticipant instanceof Participant);
      assert.equal(thisParticipant.sid, thatParticipant.sid);
      assert.equal(thisParticipant.identity, thatParticipant.identity);
    });

    describe('is raised whenever a Participant connects to the Room and', () => {
      it('should add the Participant to the Room\'s .participants Map', () => {
        assert.equal(thisRoom.participants.get(thisParticipant.sid), thisParticipant);
      });

      it('should set the Participant\'s .state to "connected"', () => {
        assert(thisParticipant.state, 'connected');
      });
    });
  });

  describe('"participantDisconnected" event', () => {
    let thisRoom;
    let thatRoom;
    let thisParticipant;
    let thatParticipant;

    beforeEach(async () => {
      const identities = [randomName(), randomName()];
      const tokens = identities.map(getToken);
      const name = randomName();
      [thisRoom, thatRoom] = await Promise.all(tokens.map(token => connect(token, Object.assign({ name }, options))));
      thisParticipant = thisRoom.localParticipant;
    });

    afterEach(() => {
      thisRoom.disconnect();
      thatRoom.disconnect();
    });

    it('is raised whenever a Participant disconnects from the Room', async () => {
      const participantDisconnected = new Promise(resolve => thatRoom.once('participantDisconnected', resolve));
      thisRoom.disconnect();
      thatParticipant = await participantDisconnected;

      assert(thatParticipant instanceof Participant);
      assert.equal(thatParticipant.sid, thisParticipant.sid);
      assert.equal(thatParticipant.identity, thisParticipant.identity);
    });

    describe('is raised whenever a Participant disconnects from the Room and', () => {
      let tracksBefore;
      let tracksAfter;

      beforeEach(async () => {
        tracksBefore = [...thisParticipant.tracks.keys()].sort();

        // NOTE(mroberts): We don't actually raise Track events in Node, so skip these.
        if (navigator.userAgent !== 'Node') {
          await Promise.all(flatMap([...thatRoom.participants.values()], participant =>
            tracksAdded(participant, thisParticipant.tracks.size)));
        }

        const participantDisconnected = new Promise(resolve => thatRoom.once('participantDisconnected', resolve));
        thisRoom.disconnect();
        thatParticipant = await participantDisconnected;

        tracksAfter = [...thatParticipant.tracks.keys()].sort();
      });

      it('should delete the Participant from the Room\'s .participants Map', () => {
        assert(!thatRoom.participants.has(thatParticipant.sid));
      });

      it('should set the Participant\'s .state to "disconnected"', () => {
        assert.equal(thatParticipant.state, 'disconnected');
      });

      it('should not change the Participant\'s .tracks', () => {
        assert.deepEqual(tracksAfter, tracksBefore);
      });
    });
  });

  describe('"recordingStarted" event', () => {
    it.skip('is raised whenever recording is started on the Room via the REST API', () => {
      // TODO(mroberts): POST to the REST API to start recording on the Room.
    });
  });

  describe('"recordingStopped" event', () => {
    it.skip('is raised whenever recording is stopped on the Room via the REST API', () => {
      // TODO(mroberts): POST to the REST API to stop recording on the Room.
    });
  });
});
