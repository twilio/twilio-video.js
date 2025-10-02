/* eslint-disable no-console, no-undefined */
'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const { getUserMedia } = require('../../../es5/webrtc/index');
const sinon = require('sinon');

const { connect, createLocalTracks, createLocalAudioTrack, createLocalVideoTrack } = require('../../../es5');
const LocalDataTrack = require('../../../es5/media/track/es5/localdatatrack');
const Room = require('../../../es5/room');
const { flatMap } = require('../../../es5/util');
const CancelablePromise = require('../../../es5/util/cancelablepromise');
const { createCodecMapForMediaSection, createPtToCodecName, getMediaSections } = require('../../../es5/util/sdp');
const TwilioError = require('../../../es5/util/twilioerror');

const {
  MediaConnectionError,
  SignalingConnectionError,
  TrackNameIsDuplicatedError,
  TrackNameTooLongError,
  MediaServerRemoteDescFailedError
} = require('../../../es5/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  capitalize,
  combinationContext,
  createFileAudioMedia,
  isRTCRtpSenderParamsSupported,
  participantsConnected,
  pairs,
  randomName,
  setup,
  setupAliceAndBob,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
  waitFor
} = require('../../lib/util');

const { trackPriority: { PRIORITY_STANDARD } } = require('../../../es5/util/constants');

const safariVersion = isSafari && Number(navigator.userAgent.match(/Version\/([0-9.]+)/)[1]);

describe('connect', function() {
  // eslint-disable-next-line no-invalid-this
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
      'with an expired Access Token',
      { ttl: 60 * -1000 },
      20104
    ],
    [
      'without a grant',
      { grant: null },
      20106
    ]
  ].forEach(([description, extraOptions, expectedCode]) => {
    describe(`called ${description}`, () => {
      let token;
      let cancelablePromise;

      beforeEach(() => {
        const identity = randomName();
        token = getToken(identity, Object.assign({}, defaults, extraOptions));
        // NOTE(mroberts): We expect this to print errors, so disable logging.
        cancelablePromise = connect(token, Object.assign({}, defaults, extraOptions, { logLevel: 'off', tracks: [] }));
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

  // eslint-disable-next-line require-await
  describe('called with an invalid LogLevel', async () => {
    const logLevel = 'foo';

    let token;
    let cancelablePromise;

    beforeEach(() => {
      const identity = randomName();
      token = getToken(identity);
      cancelablePromise = connect(token, Object.assign({}, defaults, { logLevel, tracks: [] }));
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

  describe('preferredVideoCodecs = auto', () => {
    it('should rejects with a TypeError when maxVideoBitrate is specified at connect', async () => {
      const identity = randomName();
      const token = getToken(identity);
      const cancelablePromise = connect(token, Object.assign({}, defaults, {
        tracks: [],
        preferredVideoCodecs: 'auto',
        maxVideoBitrate: 10000,
      }));

      let errorThrown = null;
      try {
        await cancelablePromise;
      } catch (error) {
        errorThrown = error;
      }
      assert(errorThrown instanceof TypeError);
      assert(cancelablePromise instanceof CancelablePromise);
    });

    it('should throw on subsequent setParameters if maxVideoBitrate is specified', async () => {
      const identity = randomName();
      const token = getToken(identity);
      const room = await connect(token, Object.assign({}, defaults, {
        tracks: [],
        preferredVideoCodecs: 'auto'
      }));

      let errorThrown = null;
      try {
        room.localParticipant.setParameters({ maxAudioBitrate: 100 });
      } catch (error) {
        errorThrown = error;
      }
      assert(!errorThrown);

      try {
        room.localParticipant.setParameters({ maxVideoBitrate: 100 });
      } catch (error) {
        errorThrown = error;
      }
      assert(errorThrown);
      assert.equal(errorThrown.message, 'encodingParameters must be an encodingParameters.maxVideoBitrate is not compatible with "preferredVideoCodecs=auto"');
      assert(errorThrown instanceof TypeError);
    });
  });

  describe('should return a CancelablePromise that rejects when called with invalid bandwidth Profile options: ', () => {
    [
      {
        name: 'both maxTracks and subscriberTrackSwitchOffMode=auto specified',
        bandwidthProfile: { video: { maxTracks: 5,  clientTrackSwitchOffControl: 'auto' } }
      },
      {
        name: 'both maxTracks and subscriberTrackSwitchOffMode=manual specified',
        bandwidthProfile: { video: { maxTracks: 5,  clientTrackSwitchOffControl: 'manual' } }
      },
      {
        name: 'both renderDimensions and contentPreferencesMode=auto specified',
        bandwidthProfile: { video: { renderDimensions: {},  contentPreferencesMode: 'auto' } }
      },
      {
        name: 'both renderDimensions and contentPreferencesMode=manual specified',
        bandwidthProfile: { video: { renderDimensions: {},  contentPreferencesMode: 'manual' } }
      },
    ].forEach(testCase => {
      it(testCase.name, async () => {
        try {
          const identity = randomName();
          const token = getToken(identity);
          const room = await connect(token, Object.assign({}, defaults, { bandwidthProfile: testCase.bandwidthProfile }));
          room.disconnect();
          throw new Error(`Connected to ${room.sid} with an invalid bandwidthProfile`);
        } catch (error) {
          assert(error instanceof TypeError);
        }
      });
    });
  });

  describe(`automaticSubscription (${defaults.topology} topology)`, () => {
    [undefined, true, false].forEach(automaticSubscription => {
      const automaticSubscriptionOptions = typeof automaticSubscription === 'boolean'
        ? { automaticSubscription }
        : {};

      context(`when automaticSubscription is ${typeof automaticSubscription === 'undefined' ? 'not set' : automaticSubscription}`, () => {
        const shouldSubscribe = defaults.topology === 'peer-to-peer' || automaticSubscription !== false;
        let sid;
        let thisRoom;
        let thoseRooms;

        before(async () => {
          [sid, thisRoom, thoseRooms] = await setup({
            testOptions: Object.assign({ tracks: [] }, automaticSubscriptionOptions),
            otherOptions: null,
            nTracks: 0
          });
        });

        it(`should ${shouldSubscribe ? '' : 'not '}subscribe to the RemoteTracks in the Room`, async () => {
          const participants = [...thisRoom.participants.values()];
          await waitFor(participants.map(participant => tracksPublished(participant, 2)), 'tracksPublished');

          // Wait for a second for any "trackSubscribed" events.
          await Promise.race([
            new Promise(resolve => setTimeout(resolve, 1000)),
            Promise.all(participants.map(participant => tracksSubscribed(participant, 2)))
          ]);

          const publications = flatMap(participants, participant => [...participant.tracks.values()]);
          publications.forEach(publication => {
            assert.equal(publication.isSubscribed, shouldSubscribe);
            assert(shouldSubscribe ? publication.track : publication.track === null);
          });
        });

        after(async () => {
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room && room.disconnect());
          }
          if (sid) {
            await completeRoom(sid);
          }
        });
      });
    });
  });

  describe('insights option', () => {
    let sid = null;
    let token = null;
    let error = null;

    beforeEach(async () => {
      const identity = randomName();
      token = getToken(identity);
      sid = await createRoom(randomName(), defaults.topology);
    });

    [true, false].forEach(insights => {
      it(`when set to  ${insights}`, async () => {
        let cancelablePromise = null;
        let room = null;
        const regionOptions = {
          insights
        };

        try {
          const connectOptions = Object.assign({ name: sid }, defaults, regionOptions, { tracks: [] });
          cancelablePromise = connect(token, connectOptions);
          assert(cancelablePromise instanceof CancelablePromise);
          room = await cancelablePromise;
        } catch (error_) {
          error = error_;
        } finally {
          if (room) {
            room.disconnect();
            await completeRoom(sid);
          }
        }
        assert.equal(error, null);
      });
    });
  });

  describe('signaling events', () => {
    let sid;
    let room = null;
    beforeEach(async () => {
      sid = await createRoom(randomName(), defaults.topology);
    });

    afterEach(async () => {
      if (room) {
        room.disconnect();
        room = null;
      }
      await  completeRoom(sid);
    });

    it('are emitted on eventListener specified', async () => {
      const eventListener = new EventEmitter();
      const signalingEventsFired = [];
      eventListener.on('event', event => {
        if (event.group === 'signaling') {
          assert(typeof event.elapsedTime === 'number');
          assert(typeof event.timestamp === 'number');
          assert(typeof event.level === 'string');
          assert(typeof event.name === 'string');
          signalingEventsFired.push(event);
        }
      });
      const token = getToken(randomName());
      room = await connect(token, Object.assign({ name: sid, eventListener, tracks: [] }, defaults));

      // verify that we received early/connecting/open events.
      assert(signalingEventsFired.find(event => event.name === 'early'));
      assert(signalingEventsFired.find(event => event.name === 'connecting'));
      assert(signalingEventsFired.find(event => event.name === 'open'));
    });
  });

  describe('media region', () => {
    let sid = null;
    let token = null;

    const validRegions = defaults.regions ? defaults.regions.split(',') : ['au1', 'br1', 'de1', 'ie1', 'in1', 'jp1', 'sg1', 'us1', 'us2'];
    const mediaRegions = ['without', 'gll', ...validRegions];

    mediaRegions.forEach(mediaRegion => {
      let scenario = 'when called ';
      if (mediaRegion === 'without') {
        scenario += 'without a mediaRegion ';
      } else {
        scenario += `with a valid mediaRegion: ${mediaRegion}`;
      }

      context(scenario, () => {
        let room = null;

        beforeEach(async () => {
          const identity = randomName();
          token = getToken(identity);
          const extraOptions = {};
          if (mediaRegion !== 'without') {
            extraOptions.MediaRegion = mediaRegion;
          }
          sid = await createRoom(randomName(), defaults.topology, extraOptions);
        });

        afterEach(async () => {
          if (room) {
            room.disconnect();
            await completeRoom(sid);
          }
        });
        it(`should return a CancelablePromise that ${defaults.topology === 'peer-to-peer' ? 'returns null on Room.mediaRegion' : 'resolves with a Room'}`, async () => {
          const cancelablePromise = connect(token, Object.assign({ name: sid, tracks: [] }, defaults));
          assert(cancelablePromise instanceof CancelablePromise);

          let error = null;

          try {
            room = await cancelablePromise;
          } catch (error_) {
            error = error_;
          } finally {
            if (defaults.topology === 'peer-to-peer') {
              assert.equal(room.mediaRegion, null);
            } else if (error) {
              assert(error instanceof MediaServerRemoteDescFailedError);
            } else if (['gll', 'without'].includes(mediaRegion)) {
              assert.equal(typeof room.mediaRegion, 'string');
            } else {
              assert('mediaRegion' in room);
              assert.equal(room.mediaRegion, mediaRegion);
            }
          }
        });
      });
    });
  });

  // eslint-disable-next-line require-await
  describe('signaling region', async () => {
    let sid;
    let token;
    beforeEach(async () => {
      const identity = randomName();
      token = getToken(identity);
      sid = await createRoom(randomName(), defaults.topology);
    });

    const invalidRegions = ['foo', '34', '$abc', 'abc!'];
    const validRegions = defaults.regions ? defaults.regions.split(',') : ['au1', 'br1', 'de1', 'ie1', 'in1', 'jp1', 'sg1', 'us1', 'us2'];
    const regions = ['without', ...invalidRegions, ...validRegions];

    regions.forEach(region => {
      const isInvalidRegion = invalidRegions.includes(region);
      const regionOptions = region === 'without' ? {} : { region };
      let scenario = 'when called ';
      if (isInvalidRegion) {
        scenario += `with an invalid region : ${region}`;
      } else if (region === 'without') {
        scenario += 'without a region ';
      } else {
        scenario += `with a valid region: ${region}`;
      }
      context(scenario, () => {

        it(`should return a CancelablePromise that ${isInvalidRegion ? 'rejects with a SignalingConnectionError' : 'resolves with a Room'}`, async () => {
          const cancelablePromise = connect(token, Object.assign({ name: sid }, defaults, regionOptions, { tracks: [] }));
          assert(cancelablePromise instanceof CancelablePromise);

          let error = null;
          let room = null;
          try {
            room = await cancelablePromise;
          } catch (error_) {
            error = error_;
          } finally {
            if (room) {
              room.disconnect();
              await completeRoom(sid);
            }
            if (isInvalidRegion) {
              assert.equal(room, null, `Connected to Room ${room && room.sid} with an invalid signaling region "${region}"`);
              assert(error instanceof SignalingConnectionError);
            } else {
              assert.equal(error, null);
              if (['without', 'gll'].includes(region)) {
                assert.equal(typeof room.localParticipant.signalingRegion, 'string');
              } else {
                assert.equal(room.localParticipant.signalingRegion, region);
              }
              assert(room instanceof Room);
            }
          }
        });
      });
    });
  });

  describe('called with an incorrect RTCIceServer url', () => {
    let cancelablePromise;

    beforeEach(() => {
      const iceServers = [{ urls: 'turn159.148.17.9:3478', credential: 'foo' }];
      const options = Object.assign({}, defaults, { iceServers, tracks: [] });
      const token = getToken(randomName());
      cancelablePromise = connect(token, options);
    });

    it('should return a CancelablePromise that rejects with a MediaConnectionError', async () => {
      try {
        const room = await cancelablePromise;
        room.disconnect();
        throw new Error(`Connected to ${room.sid} with an incorrect RTCIceServer url`);
      } catch (error) {
        assert(error instanceof MediaConnectionError);
        assert.equal(error.code, 53405);
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
      // eslint-disable-next-line no-warning-comments
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
    let sid;
    let tracks;

    before(async () => {
      identities = Array.from(Array(n).keys()).map(() => randomName());
      tracks = await createLocalTracks();
      const tokens = identities.map(getToken);
      const options = Object.assign({ tracks }, defaults);
      if (withoutTracks) {
        options.tracks = [];
      } else {
        options.audio = true;
        options.video = smallVideoConstraints;
      }
      if (withName) {
        name = randomName();
        sid = await createRoom(name, options.topology);
        // eslint-disable-next-line require-atomic-updates
        options.name = sid;
      }
      cancelablePromises = tokens.map(token => connect(token, options));
      rooms = await waitFor(cancelablePromises, 'connecting to rooms');
    });

    after(() => {
      tracks.forEach(track => track.kind !== 'data' && track.stop());
      if (rooms) {
        rooms.forEach(room => room.disconnect());
      }
      sid = sid || (rooms && rooms[0] && rooms[0].sid);
      return sid ? completeRoom(sid) : Promise.resolve();
    });

    // eslint-disable-next-line require-await
    it(`should return ${n === 1 ? 'a ' : ''}CancelablePromise${n === 1 ? '' : 's'} that resolve${n === 1 ? 's' : ''} to ${howManyRooms}`, async () => {
      cancelablePromises.forEach(cancelablePromise => assert(cancelablePromise instanceof CancelablePromise));
      rooms.forEach(room => assert(room instanceof Room));
    });

    // eslint-disable-next-line require-await
    describe(`should return ${n === 1 ? 'a ' : ''}CancelablePromise${n === 1 ? '' : 's'} that resolve${n === 1 ? 's' : ''} to ${howManyRooms} and`, async () => {
      it(`should set ${n === 1 ? 'the' : 'each'} Room's .sid to ${n > 1 ? (withName ? 'the same' : 'a unique') : 'a'} Room SID`, () => {
        const sids = new Set(rooms.map(room => room.sid));
        assert.equal(sids.size, withName ? 1 : n);
        sids.forEach(sid => assert(sid.match(/^RM[a-f0-9]{32}$/)));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's .name to ${withName ? 'the specified name' : 'its SID'}`, () => {
        rooms.forEach(room => assert.equal(room.name, withName ? name : room.sid));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .state to "connected"`, () => {
        rooms.forEach(room => assert.equal(room.localParticipant.state, 'connected'));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .sid to a ${n === 1 ? '' : 'unique '}Participant SID`, () => {
        const sids = new Set(rooms.map(room => room.localParticipant.sid));
        assert.equal(sids.size, n);
        sids.forEach(sid => assert(sid.match(/^PA[a-f0-9]{32}$/)));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .identity to the specified ${n === 1 ? 'identity' : 'identities'}`, () => {
        rooms.forEach((room, i) => assert.equal(room.localParticipant.identity, identities[i]));
      });

      if (!withoutTracks) {
        it(`should update ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's ._tracks Map with the LocalTracks`, () => {
          rooms.forEach(room => assert.deepEqual(Array.from(room.localParticipant._tracks.values()), tracks));
        });

        ['_tracks', '_audioTracks', '_videoTracks'].forEach(tracks => {
          const trackPublications = `${tracks.slice(1)}`;

          it(`should update ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .${trackPublications} Map with the corresponding ${capitalize(trackPublications)}`, () => {
            rooms.forEach(room => {
              assert.equal(room.localParticipant[tracks].size, room.localParticipant[trackPublications].size);
              room.localParticipant[tracks].forEach(track => {
                const localTrackPublication = [...room.localParticipant[trackPublications].values()].find(
                  localTrackPublication => localTrackPublication.track === track);
                assert(localTrackPublication);
              });
            });
          });

          it(`should set ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's ${capitalize(trackPublications)}' .trackSid to a unique Track SID`, () => {
            rooms.forEach(room => {
              const publications = room.localParticipant[trackPublications];
              publications.forEach(publication => assert(publication.trackSid.match(/^MT[a-f0-9]{32}$/)));
            });
          });
        });
      }

      if (n === 1 || !withName) {
        it(`should set ${n === 1 ? 'the' : 'each'} Room's .participants Map to an empty Map`, () => {
          rooms.forEach(room => assert.equal(room.participants.size, 0));
        });
        return;
      }

      it('should eventually update each Room\'s .participants Map to contain a Participant for every other Room\'s LocalParticipant', async () => {
        await waitFor(rooms.map(room => participantsConnected(room, n - 1)), 'participantsConnected');
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
          it('should set each Participant\'s ._tracks Map to an empty Map', () => {
            rooms.forEach(room => [...room.participants.values()].map(participant => assert.equal(participant._tracks.size, 0)));
          });

          return;
        }

        it('should eventually update each Participant\'s ._tracks Map to contain a RemoteTrack for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          await waitFor(flatMap(rooms, ({ participants }) => {
            return [...participants.values()].map(participant => tracksSubscribed(participant, 2));
          }), 'tracksSubscribed');
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              const trackSids = [...participant._tracks.values()].map(track => track.sid).sort();
              const localTrackPublicationSids = [...localParticipant.tracks.values()].map(publication => publication.trackSid).sort();
              assert.equal(trackSids.length, localTrackPublicationSids.length);
              assert.deepEqual(trackSids, localTrackPublicationSids);
            });
          });
        });

        // eslint-disable-next-line require-await
        it('should eventually update each Participant\'s .tracks Map to contain a RemoteTrackPublication for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              const trackSids = [...participant.tracks.values()].map(publication => publication.trackSid).sort();
              const localTrackPublicationSids = [...localParticipant.tracks.values()].map(publication => publication.trackSid).sort();
              const publishPriorities = [...participant.tracks.values()].map(publication => publication.publishPriority);
              assert.equal(trackSids.length, localTrackPublicationSids.length);
              assert.deepEqual(trackSids, localTrackPublicationSids);
              publishPriorities.forEach(priority => assert.equal(priority, PRIORITY_STANDARD));
            });
          });
        });
      });
    });
  });

  describe('called with the name of a Room to which other Participants have already connected', () => {
    let cancelablePromise;
    let room;
    let rooms;
    let sid;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: sid, tracks: [] }, defaults);
      const identities = [randomName(), randomName()];
      const tokens = identities.map(getToken);
      rooms = await waitFor(tokens.map(token => connect(token, options)), 'rooms to connect');
      cancelablePromise = connect(getToken(randomName()), options);
      room = await cancelablePromise;
    });

    after(async () => {
      rooms.forEach(room => room && room.disconnect());
      if (sid) {
        await completeRoom(sid);
      }
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
    let sid;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: sid, tracks: [] }, defaults);
      cancelablePromise = connect(getToken(randomName()), options);
      cancelablePromise.cancel();
    });

    after(async () => {
      if (sid) {
        await completeRoom(sid);
      }
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

  describe('called with a Room name and', () => {
    let sid;
    let cancelablePromise;

    before(async () => {
      sid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: sid, tracks: [] }, defaults);
      cancelablePromise = connect(getToken(randomName()), options);
    });

    after(async () => {
      if (sid) {
        await completeRoom(sid);
      }
    });

    it('should return a promise', async () => {
      const onFinally = sinon.stub();
      await cancelablePromise.finally(onFinally);
      sinon.assert.calledOnce(onFinally);
    });

    it('should resolve with a room and finally is called', async () => {
      const onFinally = sinon.stub();
      let room;
      let errorThrown = null;
      try {
        room = await cancelablePromise.finally(onFinally);
      } catch (error) {
        errorThrown = error;
      }
      sinon.assert.calledOnce(onFinally);
      assert(!errorThrown);
      assert(room instanceof Room);
    });

    it('should reject and finally is called', async () => {
      const onFinally = sinon.stub();
      let err;
      try {
        await cancelablePromise.finally(onFinally);
        throw new Error('Connecting to room, but expecting to cancel');
      } catch (error) {
        err = error;
      }
      assert(err);
      sinon.assert.calledOnce(onFinally);
    });
  });

  (isRTCRtpSenderParamsSupported ? describe : describe.skip)('DSCP tagging', () => {
    combinationContext([
      [
        ['dscpTagging', 'enableDscp'],
        x => x
      ],
      [
        [true, false, undefined],
        x => `when ${typeof x === 'boolean' ? `set to ${x}` : 'not set'}`
      ],
      [
        [true, false],
        x => `when VP8 simulcast is ${x ? 'enabled' : 'not enabled'}`
      ]
    ], ([dscpTaggingOption, shouldEnableDscp, shouldEnableVP8Simulcast]) => {
      let peerConnections;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        const dscpOptions = typeof shouldEnableDscp === 'boolean'
          ? { [dscpTaggingOption]: shouldEnableDscp }
          : {};
        const vp8SimulcastOptions = shouldEnableVP8Simulcast
          ? { preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }] }
          : {};
        const testOptions = Object.assign({}, dscpOptions, vp8SimulcastOptions);

        [, thisRoom, thoseRooms, peerConnections] = await setup({
          otherOptions: { tracks: [] },
          testOptions,
          nTracks: 0
        });

        // NOTE(mpatwardhan): RTCRtpSender.setParameters() is an asynchronous operation,
        // so wait for a little while until the changes are applied.
        await new Promise(resolve => setTimeout(resolve, 5000));
      });

      const expectedNetworkPriority = isChrome
        ? { false: 'low', true: 'high' }[!!shouldEnableDscp]
        : undefined;

      it(`networkPriority should ${expectedNetworkPriority ? `be set to "${expectedNetworkPriority}"` : 'not be set'} for RTCRtpEncodingParameters of the first encoding layer`, () => {
        flatMap(peerConnections, pc => pc.getSenders()).filter(sender => sender.track).forEach(sender => {
          if (typeof expectedNetworkPriority === 'string') {
            sender.getParameters().encodings.forEach((encoding, i) => {
              assert.equal(encoding.networkPriority, i === 0 ? expectedNetworkPriority : 'low');
            });
          } else {
            sender.getParameters().encodings.forEach(encoding => {
              assert(!('networkPriority' in encoding));
            });
          }
        });
      });

      after(() => {
        if (thisRoom) {
          thisRoom.disconnect();
        }
        if (thoseRooms) {
          thoseRooms.forEach(room => room && room.disconnect());
        }
      });
    });
  });

  // eslint-disable-next-line no-warning-comments
  // TODO: The following tests verifies bitrates using default codec, OPUS.
  // We should also verify other codecs like ISAC, PCMU and PCMA.
  describe('called with EncodingParameters', () => {
    const minAudioBitrate = 6000;
    const minVideoBitrate = 20000;
    combinationContext([
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, minAudioBitrate, 0],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, minVideoBitrate, 0],
        x => `when .maxVideoBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ]
    ], ([maxAudioBitrate, maxVideoBitrate]) => {
      const encodingParameters = [
        ['maxAudioBitrate', maxAudioBitrate],
        ['maxVideoBitrate', maxVideoBitrate]
      ].reduce((params, [prop, value]) => {
        if (typeof value !== 'undefined') {
          params[prop] = value;
        }
        return params;
      }, {
        audio: true,
        video: smallVideoConstraints
      });

      const maxBitrates = {
        audio: encodingParameters.maxAudioBitrate,
        video: encodingParameters.maxVideoBitrate
      };

      // NOTE(lrivas): Skip entire test on Firefox when any maxBitrate is set
      // Firefox times out during room setup with bitrate constraints
      // [maxBitrate not working for audio RTCRtpSender (opus)](https://bugzilla.mozilla.org/show_bug.cgi?id=1573726)
      if (isFirefox && (maxBitrates.audio !== undefined || maxBitrates.video !== undefined)) {
        return;
      }

      let averageAudioBitrate;
      let averageVideoBitrate;
      let peerConnections;
      let sid;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        [sid, thisRoom, thoseRooms, peerConnections] = await waitFor(setup({
          testOptions: encodingParameters,
          otherOptions: { tracks: [] },
          nTracks: 0
        }), 'setting up room');

        // Grab 10 samples. This is also enough time for RTCRtpSender.setParameters() to take effect
        // if applying bandwidth constraints, which is an asynchronous operation
        const bitrates = await waitFor(pollOutgoingBitrate(thisRoom, 10), `polling outgoing bitrate: ${thisRoom.sid}`);

        const average = items => {
          let avg = items.reduce((x, y) => x + y) / items.length;
          // Round down to the nearest thousand. This is to help test flakiness because browsers'
          // actual bitrates exceeds a little over (by a few hundreds) the maxBitrate that was set
          return Math.floor(avg / 1000) * 1000;
        };
        // Ignore the first sample. Max average bitrate usually normalizes after 1 sec
        averageAudioBitrate = average(bitrates.audio.slice(1));
        averageVideoBitrate = average(bitrates.video.slice(1));
      });

      ['audio', 'video'].forEach(kind => {
        it(`should ${maxBitrates[kind] ? '' : 'not '}set the .max${capitalize(kind)}Bitrate`, () => {
          if (isRTCRtpSenderParamsSupported) {
            flatMap(peerConnections, pc => {
              return pc.getSenders().filter(({ track }) => track && track.kind === kind);
            }).forEach(sender => {
              const { encodings } = sender.getParameters();
              if (maxBitrates[kind]) {
                encodings.forEach(encoding => assert.equal(encoding.maxBitrate, maxBitrates[kind]));
              } else {
                encodings.forEach(encoding => assert.equal('maxBitrate' in encoding, false));
              }
            });
            return;
          }

          flatMap(peerConnections, pc => {
            assert(pc.remoteDescription.sdp);
            return getMediaSections(pc.remoteDescription.sdp, kind, '(recvonly|sendrecv)');
          }).forEach(section => {
            const modifier = isFirefox
              ? 'TIAS'
              : 'AS';
            const maxBitrate = maxBitrates[kind]
              ? isFirefox
                ? maxBitrates[kind]
                : Math.round((maxBitrates[kind] + 16000) / 950)
              : null;
            const bLinePattern = maxBitrate
              ? new RegExp(`\r\nb=${modifier}:${maxBitrate}`)
              : /\r\nb=(AS|TIAS)/;
            assert(maxBitrate ? bLinePattern.test(section) : !bLinePattern.test(section));
          });
        });

        it(`should ${maxBitrates[kind] ? '' : 'not '}limit the ${kind} bitrate`, () => {
          const averageBitrate = kind === 'audio' ? averageAudioBitrate : averageVideoBitrate;
          const minBitrate = kind === 'audio' ? minAudioBitrate : minVideoBitrate;
          if (maxBitrates[kind]) {
            const hasLessBitrate = averageBitrate <= maxBitrates[kind];
            assert(hasLessBitrate, `maxBitrate exceeded. desired: ${maxBitrates[kind]}, actual: ${averageBitrate}`);
          } else {
            const hasUnlimitedBitrate = averageBitrate > minBitrate;
            assert(hasUnlimitedBitrate, `Bitrate is unexpectedly low. ${maxBitrates[kind]}, actual: ${averageBitrate}`);
          }
        });
      });

      after(() => {
        if (thisRoom) {
          thisRoom.disconnect();
        }
        if (thoseRooms) {
          thoseRooms.forEach(room => room && room.disconnect());
        }
        if (sid) {
          return completeRoom(sid);
        }
        return Promise.resolve();
      });
    });
  });

  describe('called with preferred audio and video codecs', () => {
    combinationContext([
      [
        ['name', 'setting'],
        x => `video codec ${x}s`
      ]
    ], ([codecType]) => {
      let peerConnections;
      let sid;
      let thisRoom;
      let thoseRooms;

      const testOptions = {
        preferredAudioCodecs: ['PCMU', 'invalid', 'PCMA'],
        preferredVideoCodecs: codecType === 'name' ? ['invalid', 'H264', 'VP8'] : [
          { codec: 'invalid' }, { codec: 'H264' }, { codec: 'VP8' }
        ]
      };

      before(async () => {
        [sid, thisRoom, thoseRooms, peerConnections] = await setup({ testOptions });
      });

      it('should apply the codec preferences to all remote descriptions', () => {
        flatMap(peerConnections, pc => {
          assert(pc.remoteDescription.sdp);
          return getMediaSections(pc.remoteDescription.sdp);
        }).forEach(section => {
          const codecMap = createCodecMapForMediaSection(section);
          const expectedPayloadTypes = /m=audio/.test(section)
            ? flatMap(testOptions.preferredAudioCodecs, codec => codecMap.get(codec.toLowerCase()) || [])
            : flatMap(testOptions.preferredVideoCodecs, codec => codecMap.get((codec.codec || codec).toLowerCase()) || []);
          const actualPayloadTypes = getPayloadTypes(section);
          expectedPayloadTypes.forEach((expectedPayloadType, i) => assert.equal(expectedPayloadType, actualPayloadTypes[i]));
        });
      });

      after(async () => {
        if (thisRoom) {
          thisRoom.disconnect();
        }
        if (thoseRooms) {
          thoseRooms.forEach(room => room && room.disconnect());
        }
        if (sid) {
          await completeRoom(sid);
        }
      });
    });
  });

  describe('when called with a fixed bitrate preferred audio codec', () => {
    let peerConnections;
    let sid;
    let thisRoom;
    let thoseRooms;

    const testOptions = {
      maxAudioBitrate: 10000,
      preferredAudioCodecs: ['PCMA', 'isac', 'opus']
    };

    before(async () => {
      [sid, thisRoom, thoseRooms, peerConnections] = await setup({ testOptions });
    });

    it('should not apply the audio bitrate limit to the remote descriptions', () => {
      flatMap(peerConnections, pc => {
        assert(pc.remoteDescription.sdp);
        return getMediaSections(pc.remoteDescription.sdp, 'audio');
      }).forEach(section => {
        const codecMap = createCodecMapForMediaSection(section);
        const payloadTypes = getPayloadTypes(section);
        const fixedBitratePayloadTypes = new Set([
          ...(codecMap.get('pcma') || []),
          ...(codecMap.get('pcmu') || [])
        ]);
        if (fixedBitratePayloadTypes.has(payloadTypes[0])) {
          assert(!/b=(AS|TIAS):([0-9]+)/.test(section));
        }
      });
    });

    after(async () => {
      if (thisRoom) {
        thisRoom.disconnect();
      }
      if (thoseRooms) {
        thoseRooms.forEach(room => room && room.disconnect());
      }
      await completeRoom(sid);
    });
  });

  describe('Track names', () => {
    describe('when called with pre-created Tracks', () => {
      combinationContext([
        [
          [{ audio: 'foo', video: 'bar', data: 'baz' }, null],
          x => `when called with${x ? '' : 'out'} Track names`
        ],
        [
          [
            {
              source: 'createLocalTracks',
              async getTracks(names) {
                const options = names && { audio: { name: names.audio }, video: { name: names.video } };
                // eslint-disable-next-line no-return-await
                return await (options ? createLocalTracks(options) : createLocalTracks());
              }
            },
            {
              source: 'MediaStreamTracks from getUserMedia()',
              async getTracks() {
                const mediaStream = await getUserMedia({ audio: true, video: true, fake: true });
                return mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());
              }
            }
          ],
          ({ source }) => `when Tracks are pre-created using ${source}`
        ]
      ], ([names, { source, getTracks }]) => {
        if (source === 'MediaStreamTracks from getUserMedia()' && !!names) {
          return;
        }

        let sid;
        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;
        let tracks;

        before(async () => {
          tracks = await getTracks(names);

          // eslint-disable-next-line no-warning-comments
          // TODO(mmalavalli): Disabling DataTracks for Firefox P2P due to this
          // bug: JSDK-2630. Re-enable once fixed.
          if (!(isFirefox && defaults.topology === 'peer-to-peer')) {
            tracks.push(names ? new LocalDataTrack({ name: names.data }) : new LocalDataTrack());
          }

          [sid, thisRoom, thoseRooms] = await setup({
            testOptions: { tracks },
            otherOptions: { tracks: [] },
            nTracks: 0
          });
          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await waitFor(thisParticipants.map(participant => tracksSubscribed(participant, tracks.length)), 'tracksSubscribed');
        });

        it(`should set each LocalTrack's .name to its ${names ? 'given name' : 'ID'}`, () => {
          thisParticipant._tracks.forEach(track => {
            assert.equal(track.name, names ? names[track.kind] : track.id);
          });
        });

        it(`should set each LocalTrackPublication's .trackName to its ${names ? 'given name' : 'ID'}`, () => {
          thisParticipant.tracks.forEach(trackPublication => {
            assert.equal(trackPublication.trackName, names ? names[trackPublication.kind] : trackPublication.track.id);
          });
        });

        it(`should set each RemoteTrackPublication's .trackName to its ${names ? 'given name' : 'LocalTrack\'s ID'}`, () => {
          flatMap(thisParticipants, participant => [...participant.tracks.values()]).forEach(publication => {
            if (names) {
              assert.equal(publication.trackName, names[publication.kind]);
            } else {
              assert(tracks.find(track => track.id === publication.trackName));
            }
          });
        });

        it(`should set each RemoteTrack's .name to its ${names ? 'given name' : 'LocalTrack\'s ID'}`, () => {
          flatMap(thisParticipants, participant => [...participant._tracks.values()]).forEach(track => {
            if (names) {
              assert.equal(track.name, names[track.kind]);
            } else {
              assert(tracks.find(localTrack => localTrack.id === track.name));
            }
          });
        });

        after(async () => {
          if (tracks) {
            tracks.forEach(track => track.kind !== 'data' && track.stop());
          }
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room && room.disconnect());
          }
          await completeRoom(sid);
        });
      });
    });

    describe('when called with constraints', () => {
      combinationContext([
        [
          [{}, { audio: 'foo' }, { video: 'bar' }, { audio: 'foo', video: 'bar' }],
          x => [
            () => 'when called without Track names',
            () => `when called with only ${x.audio ? 'an audio' : 'a video'} Track name`,
            () => 'when called with both audio and video Track names'
          ][Object.keys(x).length]()
        ]
      ], ([names]) => {
        let sid;
        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;

        before(async () => {
          const options = {
            audio: names.audio ? { name: names.audio } : true,
            video: names.video ? { name: names.video } : true,
          };
          [sid, thisRoom, thoseRooms] = await setup({
            testOptions: options,
            otherOptions: { tracks: [] },
            nTracks: 0
          });
          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await waitFor(thisParticipants.map(participant => tracksSubscribed(participant, thisParticipant._tracks.size)), 'tracksSubscribed');
        });

        ['audio', 'video'].forEach(kind => {
          it(`should set the Local${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`_${kind}Tracks`].forEach(track => {
              assert.equal(track.name, names[kind] || track.id);
            });
          });

          it(`should set the Local${capitalize(kind)}TrackPublication's .trackName to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`${kind}Tracks`].forEach(trackPublication => {
              assert.equal(trackPublication.trackName, names[kind] || trackPublication.track.id);
            });
          });

          it(`should set each Remote${capitalize(kind)}TrackPublication's .trackName to its ${names[kind] ? 'given name' : 'LocalTrack\'s ID'}`, () => {
            flatMap(thisParticipants, participant => [...participant[`${kind}Tracks`].values()]).forEach(publication => {
              if (names && names[kind]) {
                assert.equal(publication.trackName, names[kind]);
              } else {
                const tracks = [...thisParticipant._tracks.values()];
                assert(tracks.find(track => track.id === publication.trackName));
              }
            });
          });

          it(`should set each Remote${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'LocalTrack\'s ID'}`, () => {
            flatMap(thisParticipants, participant => [...participant[`_${kind}Tracks`].values()]).forEach(track => {
              if (names && names[kind]) {
                assert.equal(track.name, names[kind]);
              } else {
                const tracks = [...thisParticipant._tracks.values()];
                assert(tracks.find(localTrack => localTrack.id === track.name));
              }
            });
          });
        });

        after(async () => {
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room && room.disconnect());
          }
          if (sid) {
            await completeRoom(sid);
          }
        });
      });
    });

    describe('"trackPublicationFailed" event', () => {
      combinationContext([
        [
          [
            {
              createLocalTracks() {
                const name = 'foo';
                return waitFor([
                  createLocalAudioTrack({ name }),
                  createLocalVideoTrack(Object.assign({ name }, smallVideoConstraints)),
                  new LocalDataTrack()
                ], 'local tracks');
              },
              scenario: 'Tracks whose names are the same',
              TwilioError: TrackNameIsDuplicatedError
            },
            {
              createLocalTracks() {
                const name = '0'.repeat(129);
                return waitFor([
                  createLocalAudioTrack(),
                  createLocalVideoTrack(Object.assign({ name }, smallVideoConstraints)),
                  new LocalDataTrack()
                ], 'local tracks');
              },
              scenario: 'a Track whose name is too long',
              TwilioError: TrackNameTooLongError
            }
          ],
          ({ scenario }) => `called with ${scenario}`
        ]
      ], ([{ createLocalTracks, scenario, TwilioError }]) => {
        // eslint-disable-next-line no-void
        void scenario;

        let room;
        let sid;
        let tracks;
        let trackPublicationFailed;

        before(async () => {
          tracks = await createLocalTracks();
          [sid, room] = await setup({
            testOptions: { tracks },
            otherOptions: {},
            nTracks: 0,
            alone: true
          });
          trackPublicationFailed = await new Promise(resolve => room.localParticipant.once('trackPublicationFailed', resolve));
        });

        it(`should emit "trackPublicationFailed on the Room's LocalParticipant with a ${TwilioError.name}`, () => {
          assert(trackPublicationFailed instanceof TwilioError);
        });

        after(async () => {
          (tracks || []).forEach(track => track.stop && track.stop());
          if (room) {
            room.disconnect();
          }
          if (sid) {
            await completeRoom(sid);
          }
        });
      });
    });
  });

  describe('called with a single LocalDataTrack in the tracks Array', () => {
    let dataTrack;
    let room;
    let sid;
    let tracks;

    before(async () => {
      const identity = randomName();
      const token = getToken(identity);
      dataTrack = new LocalDataTrack();
      tracks = [dataTrack];
      sid = await createRoom(randomName(), defaults.topology);
      const options = Object.assign({ name: sid, tracks }, defaults);
      room = await connect(token, options);
    });

    after(async () => {
      (tracks || []).forEach(track => track.kind !== 'data' && track.stop());
      if (room) {
        room.disconnect();
      }
      if (sid) {
        await completeRoom(sid);
      }
    });

    it('eventually results in a LocalDataTrackPublication', async () => {
      await tracksPublished(room.localParticipant, 1, 'data');
      const publication = Array.from(room.localParticipant.dataTracks.values()).find(publication => {
        return publication.track === dataTrack;
      });
      assert(publication);
    });
  });

  (isChrome || safariVersion >= 12.1 ? describe : describe.skip)('VP8 simulcast', () => {
    [
      ['VP8', true],
      ['H264', false]
    ].forEach(([roomCodec, shouldAddSSRCs]) => {
      describe(`in ${roomCodec} only room`, () => {
        let peerConnections;
        let sid;
        let thisRoom;
        let thoseRooms;

        before(async () => {
          [sid, thisRoom, thoseRooms, peerConnections] = await setup({
            testOptions: { preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }] },
            roomOptions: { VideoCodecs: [roomCodec] }
          });

          // NOTE(mmalavalli): Ensuring that the local RTCSessionDescription is set
          // before verifying that simulcast has been enabled. This was added to remove
          // flakiness of this test in Travis.
          await Promise.all(peerConnections.map(pc => pc.localDescription ? Promise.resolve() : new Promise(resolve => {
            pc.addEventListener('signalingstatechange', () => pc.localDescription && resolve());
          })));
        });

        it(`should ${shouldAddSSRCs ? '' : 'not '}add Simulcast SSRCs to the video m= section of all local descriptions`, () => {
          flatMap(peerConnections, pc => {
            assert(pc.localDescription.sdp);
            return getMediaSections(pc.localDescription.sdp, 'video', '(sendonly|sendrecv)');
          }).forEach(section => {
            const flowSSRCs = new Set(flatMap(section.match(/^a=ssrc-group:FID .+$/gm), line => {
              return line.split(' ').slice(1);
            }));
            if (shouldAddSSRCs || defaults.topology === 'peer-to-peer') {
              const simSSRCs = new Set(flatMap(section.match(/^a=ssrc-group:SIM .+$/gm), line => {
                return line.split(' ').slice(1);
              }));
              const trackSSRCs = new Set(section.match(/^a=ssrc:.+$/gm).map(line => {
                return line.match(/a=ssrc:([0-9]+)/)[1];
              }));
              assert.equal(flowSSRCs.size, 6);
              assert.equal(simSSRCs.size, 3);
              assert.equal(trackSSRCs.size, 6);
              simSSRCs.forEach(ssrc => assert(trackSSRCs.has(ssrc)));
              flowSSRCs.forEach(ssrc => assert(trackSSRCs.has(ssrc)));
            } else {
              assert.equal(flowSSRCs.size, 2);
              assert.equal(section.match(/^a=ssrc-group:SIM .+$/gm), null);
              const ssrcsWithAttributes = new Set(flatMap(section.match(/^a=ssrc:.+$/gm), line => {
                return line.match(/a=ssrc:([0-9]+)/)[1];
              }));
              assert.deepEqual(Array.from(flowSSRCs), Array.from(ssrcsWithAttributes));
            }
          });
        });

        after(async () => {
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room && room.disconnect());
          }
          if (sid) {
            await completeRoom(sid);
          }
        });
      });

      if (roomCodec === 'VP8' && defaults.topology !== 'peer-to-peer') {
        describe('JSDK-2463: two simulcast groups in SDP instead of one after a rollback (glare)', () => {
          let peerConnections;
          let sid;
          let thisRoom;

          before(async () => {
            const localVideoTrack = await createLocalVideoTrack(smallVideoConstraints);

            [sid, thisRoom] = await setup({
              alone: true,
              testOptions: { preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }], video: false },
              roomOptions: { VideoCodecs: [roomCodec] }
            });

            peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
            // NOTE(mmalavalli): Glare is induced by publishing the LocalVideoTrack
            // soon after joining the Room.
            await thisRoom.localParticipant.publishTrack(localVideoTrack);

            // NOTE(mmalavalli): Ensuring that the local RTCSessionDescription is set
            // before verifying that simulcast has been enabled. This was added to remove
            // flakiness of this test in Travis.
            await Promise.all(peerConnections.map(pc => pc.localDescription ? Promise.resolve() : new Promise(resolve => {
              pc.addEventListener('signalingstatechange', () => pc.localDescription && resolve());
            })));
          });

          it('is fixed', () => {
            flatMap(peerConnections, pc => {
              assert(pc.localDescription.sdp);
              return getMediaSections(pc.localDescription.sdp, 'video', '(sendonly|sendrecv)');
            }).forEach(section => {
              const simSSRCs = new Set(flatMap(section.match(/^a=ssrc-group:SIM .+$/gm), line => {
                return line.split(' ').slice(1);
              }));

              const trackSSRCs = new Set(section.match(/^a=ssrc:.+$/gm).map(line => {
                return line.match(/a=ssrc:([0-9]+)/)[1];
              }));

              // NOTE(mmalavalli): The bug manifests itself as 2 "a=ssrc-group:SIM..." lines in
              // the m= section as follows:
              // 1. a=ssrc-group:SIM <ssrc1> <ssrc4> <ssrc3>
              // 2. a=ssrc-group:SIM <ssrc1> <ssrc2> <ssrc3>
              // This results in 4 unique simulcast SSRCs as opposed to the expected 3.
              assert.equal(simSSRCs.size, 3);
              simSSRCs.forEach(ssrc => assert(trackSSRCs.has(ssrc)));
            });
          });

          after(async () => {
            if (thisRoom) {
              thisRoom.disconnect();
            }
            if (sid) {
              await completeRoom(sid);
            }
          });
        });
      }
    });
  });

  describe('opus dtx', () => {
    [
      [{}, 'when preferredAudioCodecs is not specified'],
      [{ preferredAudioCodecs: ['isac', { codec: 'PCMU' }] }, 'when opus is not specified in preferredAudioCodecs'],
      [{ preferredAudioCodecs: ['opus'] }, 'when opus is specified as a string'],
      [{ preferredAudioCodecs: [{ codec: 'opus' }, 'isac'] }, 'when opus is specified as a setting and dtx is not specified'],
      [{ preferredAudioCodecs: [{ codec: 'isac' }, { codec: 'opus', dtx: true }] }, 'when opus is specified as a setting and dtx is true'],
      [{ preferredAudioCodecs: [{ codec: 'opus', dtx: false }, 'isac'] }, 'when opus is specified as a setting and dtx is false']
    ].forEach(([preferredAudioCodecOptions, description]) => {
      context(description, () => {
        let peerConnections;
        let sid;
        let thisRoom;
        let thoseRooms;

        before(async () => {
          [sid, thisRoom, thoseRooms, peerConnections] = await setup({
            testOptions: preferredAudioCodecOptions
          });

          // NOTE(mmalavalli): Ensuring that the RTCPeerConnections are stable before
          // verifying that opus DTX has been enabled/disabled. This was added to remove
          // flakiness of this test in Circle.
          await Promise.all(peerConnections.map(pc => pc.signalingState === 'stable' ? Promise.resolve() : new Promise(resolve => {
            pc.addEventListener('signalingstatechange', () => pc.signalingState === 'stable' && resolve());
          })));
        });

        const shouldApplyDtx = !(preferredAudioCodecOptions.preferredAudioCodecs
          && preferredAudioCodecOptions.preferredAudioCodecs.some(codecOrSetting =>
            codecOrSetting.codec === 'opus' && codecOrSetting.dtx === false));

        it(`should ${shouldApplyDtx ? '' : 'not '}add "usedtx=1" to opus's fmtp line`, () => {
          ['local', 'remote'].forEach(localOrRemote => {
            flatMap(peerConnections, pc => getMediaSections(pc[`${localOrRemote}Description`].sdp, 'audio'))
              .forEach(section => checkOpusDtxInMediaSection(section, shouldApplyDtx));
          });
        });

        after(async () => {
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room && room.disconnect());
          }
          if (sid) {
            await completeRoom(sid);
          }
        });
      });
    });

    // NOTE(mmalavalli): Skipping this test on Firefox because AudioContext.decodeAudioData()
    // does not complete resulting in the test timing out.
    // eslint-disable-next-line no-warning-comments
    // TODO(mmalavalli): Enable on Firefox after figuring out and fixing the cause.
    if (isFirefox) {
      return;
    }

    combinationContext([
      [
        [true, false],
        x => `When Alice ${x ? 'enables' : 'disables'} DTX`
      ],
      [
        [true, false],
        x => `When Bob ${x ? 'enables' : 'disables'} DTX`
      ],
    ], ([aliceDtx, bobDtx]) => {
      let aliceBitratesSilence;
      let aliceBitratesSpeech;
      let aliceRoom;
      let bobBitratesSilence;
      let bobBitratesSpeech;
      let bobRoom;
      let roomSid;
      let tracks;

      before(async () => {
        const { source, track } = await waitFor(
          createFileAudioMedia('/static/speech.m4a'),
          'Creating speech recording track');

        tracks = [
          track,
          await waitFor(
            createLocalVideoTrack(smallVideoConstraints),
            'Creating video track')
        ];

        ({ aliceRoom, bobRoom, roomSid } = await waitFor(setupAliceAndBob({
          aliceOptions: {
            preferredAudioCodecs: [{ codec: 'opus', dtx: aliceDtx }],
            tracks
          },
          bobOptions: {
            preferredAudioCodecs: [{ codec: 'opus', dtx: bobDtx }],
            tracks
          }
        }), 'Alice and Bob to join the Room'));

        source.start();

        // NOTE(mmalavalli): The recorded speech Track contains speech for the first 5 seconds,
        // so the below bitrate samples represent speech.
        [aliceBitratesSpeech, bobBitratesSpeech] = (await waitFor(
          [aliceRoom, bobRoom].map(room => pollOutgoingBitrate(room, 5)),
          'Alice and Bob to collect outgoing speech bitrate samples')).map(samples => samples.audio);

        // NOTE(mmalavalli): The recorded speech Track contains silence for the next 5 seconds,
        // so the below bitrate samples represent silence.
        [aliceBitratesSilence, bobBitratesSilence] = (await waitFor(
          [aliceRoom, bobRoom].map(room => pollOutgoingBitrate(room, 5)),
          'Alice and Bob to collect outgoing silence bitrate samples')).map(samples => samples.audio);
      });

      it(`Alice should ${aliceDtx ? '' : 'not '}drastically reduce outgoing audio bitrate during silence and Bob should ${bobDtx ? '' : 'not '}drastically reduce outgoing audio bitrate during silence`, () => {
        const bitrateTests = {
          true: (bitrateSpeech, bitrateSilence) => {
            return Math.round(100 * bitrateSilence / bitrateSpeech) <= 20;
          },
          false: (bitrateSpeech, bitrateSilence) => {
            return Math.round(100 * bitrateSilence / bitrateSpeech) >= 80;
          }
        };

        const aliceBitrateSilenceAvg = Math.round(aliceBitratesSilence.reduce((sum, bitrate) => sum + bitrate, 0) / aliceBitratesSpeech.length);
        const aliceBitrateSpeechAvg = Math.round(aliceBitratesSpeech.reduce((sum, bitrate) => sum + bitrate, 0) / aliceBitratesSpeech.length);
        console.log(`Avg. bitrate reduction during silence (Alice): ${Math.round(100 * aliceBitrateSilenceAvg / aliceBitrateSpeechAvg)}`);
        assert(bitrateTests[aliceDtx](aliceBitrateSpeechAvg, aliceBitrateSilenceAvg));

        const bobBitrateSilenceAvg = Math.round(bobBitratesSilence.reduce((sum, bitrate) => sum + bitrate, 0) / bobBitratesSpeech.length);
        const bobBitrateSpeechAvg = Math.round(bobBitratesSpeech.reduce((sum, bitrate) => sum + bitrate, 0) / bobBitratesSpeech.length);
        console.log(`Avg. bitrate reduction during silence (Bob): ${Math.round(100 * bobBitrateSilenceAvg / bobBitrateSpeechAvg)}`);
        assert(bitrateTests[bobDtx](bobBitrateSpeechAvg, bobBitrateSilenceAvg));
      });

      after(async () => {
        [aliceRoom, bobRoom].forEach(room => room && room.disconnect());
        if (tracks) {
          tracks.forEach(track => track.stop());
        }
        if (roomSid) {
          await completeRoom(roomSid);
        }
      });
    });
  });

  describe('custom RTCPeerConnection', () => {
    let room;
    let sid;
    let customPeerConnectionsCreated;
    let senderRoom;
    let tracks;

    class CustomRTCPeerConnection extends RTCPeerConnection {
      constructor(configuration) {
        super(configuration);
        customPeerConnectionsCreated++;
      }
    }

    beforeEach(async () => {
      customPeerConnectionsCreated = 0;
      sid = await createRoom(randomName(), defaults.topology);
    });

    afterEach(async () => {
      [room, senderRoom].forEach(currentRoom => currentRoom && currentRoom.disconnect());
      if (tracks) {
        tracks.forEach(track => track.stop());
      }
      if (sid) {
        await completeRoom(sid);
      }
      room = null;
      senderRoom = null;
      tracks = null;
    });

    function setupParticipants() {
      const senderIdentity = randomName();
      const receiverIdentity = randomName();
      const senderToken = getToken(senderIdentity);
      const receiverToken = getToken(receiverIdentity);

      return {
        senderIdentity,
        receiverIdentity,
        senderToken,
        receiverToken
      };
    }

    it('should use CustomRTCPeerConnection', async () => {
      const { receiverToken } = setupParticipants();

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        RTCPeerConnection: CustomRTCPeerConnection
      });

      assert.equal(customPeerConnectionsCreated, 1, 'Expected one custom peer connection to be created');
      assert(room.localParticipant, 'Local participant should be defined');
    });

    it('should receive remote tracks when using CustomRTCPeerConnection', async () => {
      const { senderIdentity, senderToken, receiverToken } = setupParticipants();

      const stream = await getUserMedia({ audio: true, video: true });
      tracks = stream.getTracks();

      senderRoom = await connect(senderToken, { ...defaults, name: sid, tracks });

      // Connect receiver with custom RTCPeerConnection
      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        RTCPeerConnection: CustomRTCPeerConnection
      });


      // Wait for tracks to be published and received
      await new Promise(resolve => setTimeout(resolve, 2000));

      const remoteParticipant = Array.from(room.participants.values()).find(({ identity }) => identity === senderIdentity);
      assert(remoteParticipant && remoteParticipant.state === 'connected', 'Remote participant should be connected');

      const remoteTracks = Array.from(remoteParticipant.tracks.values()).map(pub => pub.track);
      assert.equal(remoteTracks.length, 2, 'Expected two remote tracks');
      assert(remoteTracks.some(t => t.kind === 'audio'), 'Expected a remote audio track');
      assert(remoteTracks.some(t => t.kind === 'video'), 'Expected a remote video track');

    });

    it('should handle reconnection with CustomRTCPeerConnection', async () => {
      const { receiverToken } = await setupParticipants();

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        RTCPeerConnection: CustomRTCPeerConnection
      });

      room.disconnect();
      await new Promise(resolve => setTimeout(resolve, 1000));

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        RTCPeerConnection: CustomRTCPeerConnection
      });

      assert.equal(customPeerConnectionsCreated, 2, 'Expected two custom peer connections to be created');
      assert(room.localParticipant.state === 'connected', 'Participant should be connected after reconnection');
    });

    it('should pass custom configuration to RTCPeerConnection', async () => {
      const { receiverToken } = await setupParticipants();

      const expected = {
        iceTransportPolicy: 'relay',
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require',
        iceServers: [{ urls: 'stun:stun.twilio.test:3478' }]
      };

      let passedConfigurantion;

      class ConfigTestRTCPeerConnection extends RTCPeerConnection {
        constructor(configuration) {
          super(configuration);
          passedConfigurantion = configuration;
        }
      }

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        RTCPeerConnection: ConfigTestRTCPeerConnection,
        ...expected
      });

      assert(room.localParticipant, 'Room should connect with custom configuration');
      assert.equal(passedConfigurantion.iceTransportPolicy, expected.iceTransportPolicy, 'iceTransportPolicy should match custom config');
      assert.equal(passedConfigurantion.bundlePolicy, expected.bundlePolicy,
        'bundlePolicy should match custom config');
      assert.equal(passedConfigurantion.rtcpMuxPolicy, expected.rtcpMuxPolicy,
        'rtcpMuxPolicy should match custom config');
      assert.deepEqual(passedConfigurantion.iceServers, expected.iceServers,
        'iceServers should match custom config');
    });

    it('should use rtcConfiguration and ConnectOptions to configure RTCPeerConnection', async () => {
      const { receiverToken } = await setupParticipants();

      // Previous way of configuring RTCPeerConnection
      const connectOptions = {
        iceServers: [{ urls: 'stun:stun.custom.example.com:3478' }],
        iceTransportPolicy: 'all'
      };

      // New custom rtcConfiguration
      const rtcConfiguration = {
        bundlePolicy: 'balanced',
        iceCandidatePoolSize: 5,
      };

      let passedConfiguration;

      class RTCConfigTestPeerConnection extends RTCPeerConnection {
        constructor(configuration) {
          super(configuration);
          passedConfiguration = configuration;
        }
      }

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        ...connectOptions,
        RTCPeerConnection: RTCConfigTestPeerConnection,
        rtcConfiguration
      });

      assert(room.localParticipant, 'Room should connect with rtcConfiguration option');

      assert.equal(passedConfiguration.bundlePolicy, rtcConfiguration.bundlePolicy,
        'bundlePolicy should match rtcConfiguration');
      assert.equal(passedConfiguration.iceCandidatePoolSize, rtcConfiguration.iceCandidatePoolSize,
        'iceCandidatePoolSize should match rtcConfiguration');
      assert.equal(passedConfiguration.iceTransportPolicy, connectOptions.iceTransportPolicy,
        'iceTransportPolicy should match previousRTCConfiguration');
      assert.deepEqual(passedConfiguration.iceServers, connectOptions.iceServers,
        'iceServers should match previousRTCConfiguration');
    });

    it('should prefer rtcConfiguration over previous ConnectOptions to configure RTCPeerConnection when both are provided', async () => {
      const { receiverToken } = await setupParticipants();

      // Previous way of configuring RTCPeerConnection
      const connectOptions = {
        iceServers: [{ urls: 'stun:stun.custom.example.com:3478' }],
        iceTransportPolicy: 'all'
      };

      // New custom rtcConfiguration
      const rtcConfiguration = {
        iceServers: [{ urls: 'stun:stun.custom.example.net:3478' }],
        iceTransportPolicy: 'relay'
      };

      let passedConfiguration;

      class RTCConfigTestPeerConnection extends RTCPeerConnection {
        constructor(configuration) {
          super(configuration);
          passedConfiguration = configuration;
        }
      }

      room = await connect(receiverToken, {
        ...defaults,
        name: sid,
        ...connectOptions,
        RTCPeerConnection: RTCConfigTestPeerConnection,
        rtcConfiguration
      });

      assert(room.localParticipant, 'Room should connect with rtcConfiguration option');

      assert.equal(passedConfiguration.iceTransportPolicy, rtcConfiguration.iceTransportPolicy,
        'iceTransportPolicy should match rtcConfiguration');
      assert.deepEqual(passedConfiguration.iceServers, rtcConfiguration.iceServers,
        'iceServers should match rtcConfiguration');
    });
  });
});

function checkOpusDtxInMediaSection(section, shouldApplyDtx) {
  const codecMap = createCodecMapForMediaSection(section);
  const opusPts = codecMap.get('opus');
  if (!opusPts) {
    assert(!/usedtx=1/.test(section));
    return;
  }
  const fmtpAttributes = section.match(new RegExp(`^a=fmtp:${opusPts[0]} (.+)$`, 'm'))[1].split(';');
  assert(shouldApplyDtx ? fmtpAttributes.includes('usedtx=1') : !fmtpAttributes.includes('usedtx=1'));
}

function getPayloadTypes(mediaSection) {
  return [...createPtToCodecName(mediaSection).keys()];
}

async function pollOutgoingBitrate(room, nSamples) {
  if (nSamples <= 0) { return { audio: [], video: [] }; }

  const getBytesSent = async () => {
    const roomStats = await room.getStats();
    return ['audio', 'video'].reduce((returnedStats, kind) => {
      const [{ [`local${capitalize(kind)}TrackStats`]: [stats] }] = roomStats;
      const bytesSent = stats ? stats.bytesSent : 0;
      return { [kind]: bytesSent, ...returnedStats };
    }, {});
  };

  const samples = [];
  let curBytesSent = await getBytesSent();
  let pollInterval;

  return new Promise((resolve, reject) => {
    pollInterval = setInterval(async () => {
      try {
        const bytesSent = await getBytesSent();
        samples.push({
          audio: (bytesSent.audio - curBytesSent.audio) * 8,
          video: (bytesSent.video - curBytesSent.video) * 8,
        });
        curBytesSent = bytesSent;
        nSamples--;
        if (nSamples <= 0) {
          clearInterval(pollInterval);
          // Flatten out
          resolve({
            audio: samples.map(b => b.audio),
            video: samples.map(b => b.video),
          });
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, 1000);
  });
}
