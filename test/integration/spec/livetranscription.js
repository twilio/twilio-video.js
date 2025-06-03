'use strict';

const assert = require('assert');
const { connect } = require('../../../es5');
const defaults = require('../../lib/defaults');
const getToken = require('../../lib/token');
const { createRoom, completeRoom } = require('../../lib/rest');
const {
  randomName,
  setupAliceAndBob,
  waitForEvent,
  waitForSometime,
  waitForNot,
} = require('../../lib/util');

describe('LiveTranscription', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(15000);

  // Helper function to create a room with transcription enabled
  async function createTranscriptionRoom(options = {}) {
    const roomName = randomName();
    const roomSid = await createRoom(roomName, 'group', {
      TranscribeParticipantsOnConnect: true,
      TranscriptionsConfiguration: { languageCode: 'EN-us', profanityFilter: true },
      ...options
    });
    return { roomName, roomSid };
  }

  // Helper function to connect to a room with transcription
  async function connectToRoom(roomName, roomOptions = {}) {
    const options = {
      audio: { fake: true },
      ...roomOptions
    };
    const token = getToken(randomName());
    const room = await connect(token, {
      ...defaults,
      name: roomName,
      ...options
    });
    await waitForSometime(1000); // NOTE(lrivas): Wait for MSP to be ready (1 second)
    return room;
  }

  describe('Room Configuration', () => {
    let room;
    let roomSid;
    let roomName;

    beforeEach(async () => {
      ({ roomName, roomSid } = await createTranscriptionRoom());
    });

    afterEach(async () => {
      if (room) {
        room.disconnect();
      }
      if (roomSid) {
        await completeRoom(roomSid);
      }
    });

    describe('when room is created with transcription enabled', () => {
      it('should set isLiveTranscriptionEnabled based on connection options', async () => {
        room = await connectToRoom(roomName);
        assert.equal(room.isLiveTranscriptionEnabled, false, 'isLiveTranscriptionEnabled should be false by default');
        room.disconnect();
        room = await connectToRoom(roomName, { enableLiveTranscription: true });
        assert.equal(room.isLiveTranscriptionEnabled, true, 'isLiveTranscriptionEnabled should be true when enabled');
      });

      it('should not receive transcription if isLiveTranscriptionEnabled is false', async () => {
        room = await connectToRoom(roomName, { enableLiveTranscription: false });
        assert.equal(room.isLiveTranscriptionEnabled, false, 'isLiveTranscriptionEnabled should be false when disabled');
        await waitForNot(waitForEvent(room, 'liveTranscription', 10000));
      });
    });
  });

  describe('Transcription Behavior', () => {
    let aliceRoom;
    let bobRoom;
    let roomSid;

    beforeEach(async () => {
      ({ aliceRoom, bobRoom, roomSid } = await setupAliceAndBob({
        aliceOptions: {
          enableLiveTranscription: true,
          audio: { fake: true }
        },
        bobOptions: {
          enableLiveTranscription: true,
          audio: { fake: true }
        },
        roomOptions: {
          TranscribeParticipantsOnConnect: true,
          TranscriptionsConfiguration: { languageCode: 'EN-us', profanityFilter: true }
        }
      }));
      await waitForSometime(1000);
    });

    afterEach(async () => {
      [aliceRoom, bobRoom].forEach(room => room?.disconnect());
      if (roomSid) {
        await completeRoom(roomSid);
      }
    });

    it('should receive transcription events with the expected format', async () => {
      let transcription;
      aliceRoom.on('liveTranscription', event => { transcription = event; });
      await waitForEvent(aliceRoom, 'liveTranscription');

      const expectedFields = {
        type: 'string',
        language_code: 'string', // eslint-disable-line camelcase
        partial_results: 'boolean', // eslint-disable-line camelcase
        participant: 'string',
        sequence_number: 'number', // eslint-disable-line camelcase
        timestamp: 'string',
        track: 'string',
        transcription: 'string'
      };

      Object.entries(expectedFields).forEach(([field, type]) => {
        assert(transcription[field] !== undefined, `Transcription should have ${field}`);
        assert.equal(typeof transcription[field], type, `${field} should be a ${type}`);
      });
    });

    it('should not receive transcription when no audio is published', async () => {
      const room = await connectToRoom(aliceRoom.name, {
        enableLiveTranscription: true,
        audio: false
      });
      assert.equal(room.localParticipant.audioTracks.size, 0, 'No audio tracks should be published');
      await waitForNot(waitForEvent(room, 'liveTranscription', 10000));
      room.disconnect();
    });

    it('should receive transcription events from all participants in the room', async () => {
      const transcriptionCounts = { alice: 0, bob: 0 };
      const transcriptionPromises = {
        alice: new Promise(resolve => {
          aliceRoom.on('liveTranscription', () => {
            transcriptionCounts.alice++;
            if (transcriptionCounts.alice > 0 && transcriptionCounts.bob > 0) {
              resolve();
            }
          });
        }),
        bob: new Promise(resolve => {
          bobRoom.on('liveTranscription', () => {
            transcriptionCounts.bob++;
            if (transcriptionCounts.alice > 0 && transcriptionCounts.bob > 0) {
              resolve();
            }
          });
        })
      };

      await Promise.all([transcriptionPromises.alice, transcriptionPromises.bob]);
    });
  });
});
