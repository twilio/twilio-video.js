'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const connect = require('../../../lib/connect');
const getToken = require('../../lib/token');
const CancelablePromise = require('../../../lib/util/cancelablepromise');
const { combinationContext, participantsConnected, pairs, randomName, tracksAdded } = require('../../lib/util');
const env = require('../../env');
const Room = require('../../../lib/room');
const { flatMap } = require('../../../lib/util');
const TwilioError = require('../../../lib/util/twilioerror');

const defaultOptions = ['ecsServer', 'logLevel', 'wsServer', 'wsServerInsights'].reduce((defaultOptions, option) => {
  if (env[option] !== undefined) {
    defaultOptions[option] = env[option];
  }
  return defaultOptions;
}, {});

describe('connect', function() {
  this.timeout(60000);

  [
    [
      'with an invalid API Key secret',
      { apiKeySecret: 'foo' },
      20107
    ],
    [
      'with an invalid API Key SID',
      { apiKeySid: 'foo' },
      20103
    ],
    [
      'with an invalid Configuration Profile SID',
      { configurationProfileSid: 'foo' },
      20101
    ],
    [
      'with an expired Access Token',
      { ttl: 60 * -1000 },
      20104
    ],
    [
      'without a grant',
      { grant: null },
      20101
    ]
  ].forEach(([description, defaultOptions, expectedCode]) => {
    describe(`called ${description}`, () => {
      let token;
      let cancelablePromise;

      beforeEach(() => {
        const identity = randomName();
        token = getToken(identity, defaultOptions);
        // NOTE(mroberts): We expect this to print errors, so disable logging.
        cancelablePromise = connect(token, Object.assign({}, defaultOptions, { logLevel: 'off', tracks: [] }));
      });

      it(`should return a CancelablePromise that rejects with a TwilioError with .code ${expectedCode}`, async () => {
        assert(cancelablePromise instanceof CancelablePromise);
        try {
          const room = await cancelablePromise;
          room.disconnect();
          throw new Error(`Connected to ${room.sid} with an invalid Access Token`);
        } catch (error) {
          assert(error instanceof TwilioError);
          assert.equal(error.code, expectedCode);
        }
      });
    });
  });

  describe('called with an invalid LogLevel', async () => {
    const logLevel = 'foo';

    let token;
    let cancelablePromise;

    beforeEach(() => {
      const identity = randomName();
      token = getToken(identity);
      cancelablePromise = connect(token, Object.assign({}, defaultOptions, { logLevel, tracks: [] }));
    });

    it('should return a CancelablePromise that rejects with a RangeError', async () => {
      try {
        const room = await cancelablePromise;
        room.disconnect();
        throw new Error(`Connected to ${room.sid} with an invalid LogLevel`);
      } catch (error) {
        assert(error instanceof RangeError);
        assert(/level must be one of/.test(error.message));
      }
      assert(cancelablePromise instanceof CancelablePromise);
    });
  });

  combinationContext([
    [
      [true, false],
      x => `called with${x ? '' : 'out'} a Room name and`
    ],
    [
      [true, false],
      x => x ? 'no LocalTracks' : 'the default, automatically-acquired LocalTracks'
    ],
    [
      // TODO(mroberts): Run this with 10 Participants.
      // NOTE(mroberts): It's important that we specify "with unique identities", because, in the future, we may
      // enforce uniqueness of Participant identity within a Room (and therefore, connect should fail with a well-
      // defined TwilioError).
      [1, 2, 3],
      x => ({
        1: 'once',
        2: 'twice with unique identities',
        3: 'thrice with unique identities',
        10: 'ten times with unique identities'
      })[x]
    ]
  ], ([withName, withoutTracks, n]) => {
    const howManyRooms = {
      1: 'a Room',
      2: 'two Rooms',
      3: 'three Rooms',
      10: 'ten Rooms'
    }[n];

    let identities;
    let name;
    let cancelablePromises;
    let rooms;

    before(async () => {
      identities = Array.from(Array(n).keys()).map(() => randomName());
      const tokens = identities.map(getToken);
      const options = Object.assign({}, defaultOptions);
      if (withoutTracks) {
        options.tracks = [];
      }
      if (withName) {
        name = randomName();
        options.name = name;
      }
      cancelablePromises = tokens.map(token => connect(token, options));
      rooms = await Promise.all(cancelablePromises);
    });

    after(async () => {
      rooms.forEach(room => room.disconnect);
    });

    it(`should return ${n === 1 ? 'a ' : ''}CancelablePromise${n === 1 ? '' : 's'} that resolve${n === 1 ? 's' : ''} to ${howManyRooms}`, async () => {
      cancelablePromises.forEach(cancelablePromise => assert(cancelablePromise instanceof CancelablePromise));
      rooms.forEach(room => assert(room instanceof Room));
    });

    describe(`should return ${n === 1 ? 'a ' : ''}CancelablePromise${n === 1 ? '' : 's'} that resolve${n === 1 ? 's' : ''} to ${howManyRooms} and`, async () => {
      it(`should set ${n === 1 ? 'the' : 'each'} Room's .sid to ${n > 1 ? (withName ? 'the same' : 'a unique') : 'a'} Room SID`, () => {
        const sids = new Set(rooms.map(room => room.sid));
        assert.equal(sids.size, withName ? 1 : n);
        sids.forEach(sid => assert(sid.match(/^RM[a-f0-9]{32}$/)));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's .name to ${withName ? 'the specified name' : 'its SID'}`, () => {
        rooms.forEach(room => assert.equal(room.name, withName ? name : room.sid));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room\'s LocalParticipant's .sid to a ${n === 1 ? '' : 'unique '}Participant SID`, () => {
        const sids = new Set(rooms.map(room => room.localParticipant.sid));
        assert.equal(sids.size, n);
        sids.forEach(sid => sid.match(/^PA[a-f0-9]{32}$/));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .identity to the specified ${n === 1 ? 'identity' : 'identities'}`, () => {
        rooms.forEach((room, i) => assert.equal(room.localParticipant.identity, identities[i]));
      });

      if (n === 1 || !withName) {
        it(`should set ${n === 1 ? 'the' : 'each'} Room's .participants Map to an empty Map`, () => {
          rooms.forEach(room => assert.equal(room.participants.size, 0));
        });

        return;
      }

      it('should eventually update each Room\'s .participants Map to contain a Participant for every other Room\'s LocalParticipant', async () => {
        await Promise.all(rooms.map(room => participantsConnected(room, n - 1)));
        pairs(rooms).forEach(([{ participants }, otherRooms]) => {
          otherRooms.forEach(({ localParticipant }) => {
            const participant = participants.get(localParticipant.sid);
            assert(participant);
            assert.equal(participant.identity, localParticipant.identity);
          });
        });
      });

      describe('should eventually update each Room\'s .participants Map to contain a Participant for every other Room\'s LocalParticipant and', () => {
        if (withoutTracks) {
          it('should set each Participant\'s .tracks Map to an empty Map', () => {
            rooms.forEach(room => [...room.participants.values()].map(participant => assert.equal(participant.tracks.size, 0)));
          });

          return;
        }

        // NOTE(mroberts): We don't actually raise Track events in Node, so skip these.
        (navigator.userAgent === 'Node'
          ? it.skip
          : it
        )('should eventually update each Participant\'s .tracks Map to contain a Track for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          await Promise.all(flatMap(rooms, ({ participants }) => {
            return [...participants.values()].map(participant => tracksAdded(participant, 2));
          }));
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              // WARN(mroberts): Eventually, this property will change; MediaStreamTrack IDs will not be preserved,
              // and will be supplanted by Track IDs.
              const tracks = [...participant.tracks.keys()].sort();
              const localTracks = [...localParticipant.tracks.keys()].sort();
              assert.equal(tracks.length, localTracks.length);
              tracks.forEach((track, i) => assert.equal(track, localTracks[i]));
            });
          });
        });
      });
    });
  });

  describe('called with the name of a Room to which other Participants have already connected', () => {
    let rooms;
    let cancelablePromise;
    let room;

    before(async () => {
      const options = Object.assign({ name: randomName(), tracks: [] }, defaultOptions);

      const identities = [randomName(), randomName()];
      const tokens = identities.map(getToken);
      rooms = await Promise.all(tokens.map(token => connect(token, options)));

      cancelablePromise = connect(getToken(randomName()), options);
      room = await cancelablePromise;
    });

    after(() => {
      rooms.forEach(room => room.disconnect());
      room.disconnect();
    });

    it('should return a CancelablePromise that resolves to a Room', () => {
      assert(cancelablePromise instanceof CancelablePromise);
      assert(room instanceof Room);
    });

    describe('should return a CancelablePromise that resolves to a Room and', () => {
      it('should pre-populate the Room\'s .participants Map with the Participants already connected to the Room', () => {
        rooms.forEach(({ localParticipant }) => {
          const participant = room.participants.get(localParticipant.sid);
          assert(participant);
          assert.equal(participant.sid, localParticipant.sid);
          assert.equal(participant.identity, localParticipant.identity);
        });
      });
    });
  });

  describe('called with a Room name and canceled before connecting', () => {
    let cancelablePromise;

    before(async () => {
      const options = Object.assign({ tracks: [] }, defaultOptions);
      cancelablePromise = connect(getToken(randomName(), options));
      cancelablePromise.cancel();
    });

    it('should return a CancelablePromise that rejects with a "Canceled" Error', async () => {
      assert(cancelablePromise instanceof CancelablePromise);
      try {
        const room = await cancelablePromise;
        room.disconnect();
        throw new Error(`Connected to ${room.sid}, but expected to cancel`);
      } catch (error) {
        assert(error instanceof Error);
        assert.equal(error.message, 'Canceled');
      }
    });
  });
});
