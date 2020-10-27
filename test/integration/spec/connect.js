/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');
const { getUserMedia } = require('@twilio/webrtc');

const connect = require('../../../lib/connect');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const createLocalTracks = require('../../../lib/createlocaltracks');
const LocalDataTrack = require('../../../lib/media/track/es5/localdatatrack');
const Room = require('../../../lib/room');
const { flatMap } = require('../../../lib/util');
const CancelablePromise = require('../../../lib/util/cancelablepromise');
const { createCodecMapForMediaSection, createPtToCodecName, getMediaSections } = require('../../../lib/util/sdp');
const TwilioError = require('../../../lib/util/twilioerror');

const {
  MediaConnectionError,
  SignalingConnectionError,
  TrackNameIsDuplicatedError,
  TrackNameTooLongError,
  MediaServerRemoteDescFailedError
} = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');

const {
  capitalize,
  combinationContext,
  isRTCRtpSenderParamsSupported,
  participantsConnected,
  pairs,
  randomName,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
  waitFor
} = require('../../lib/util');

const { trackPriority: { PRIORITY_STANDARD } } = require('../../../lib/util/constants');

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

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          return completeRoom(sid);
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
      rooms.forEach(room => room.disconnect());
      sid = sid || (rooms[0] && rooms[0].sid);
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

    after(() => {
      rooms.forEach(room => room && room.disconnect());
      return completeRoom(sid);
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

    after(() => completeRoom(sid));

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
        [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
      });
    });
  });

  describe('called with EncodingParameters', () => {
    combinationContext([
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 20000, 0],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 40000, 0],
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

      let peerConnections;
      let sid;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        [sid, thisRoom, thoseRooms, peerConnections] = await setup({
          testOptions: encodingParameters,
          otherOptions: { tracks: [] },
          nTracks: 0
        });

        // NOTE(mmalavalli): If applying bandwidth constraints using RTCRtpSender.setParameters(),
        // which is an asynchronous operation, wait for a little while until the changes are applied.
        if (isRTCRtpSenderParamsSupported) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
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
      });

      after(() => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        return completeRoom(sid);
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

      after(() => {
        [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
        return completeRoom(sid);
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

    after(() => {
      [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
      return completeRoom(sid);
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

        after(() => {
          (tracks || []).forEach(track => track.kind !== 'data' && track.stop());
          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          return completeRoom(sid);
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

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          return completeRoom(sid);
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

        after(() => {
          (tracks || []).forEach(track => track.stop && track.stop());
          if (room) {
            room.disconnect();
          }
          return completeRoom(sid);
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

    after(() => {
      (tracks || []).forEach(track => track.kind !== 'data' && track.stop());
      if (room) {
        room.disconnect();
      }
      return completeRoom(sid);
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

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          return completeRoom(sid);
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

          after(() => {
            if (thisRoom) {
              thisRoom.disconnect();
            }
            return completeRoom(sid);
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

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room && room.disconnect());
          return completeRoom(sid);
        });
      });
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
