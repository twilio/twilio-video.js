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
  TrackNameTooLongError
} = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { capitalize, combinationContext, participantsConnected, pairs, randomName, smallVideoConstraints, tracksSubscribed, tracksPublished } = require('../../lib/util');

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

  describe.only('automaticSubscription option', () => {
    ['missing', 'enabled', 'disabled'].forEach((option) => {
      const subscriptionOption = {
        missing: {},
        enabled: { automaticSubscription: true },
        disabled: { automaticSubscription: false },
      }[option];

      const expectSubscriptionsEnabled = subscriptionOption.automaticSubscription !== false;

      let thisRoom;
      before(async () => {
        [, thisRoom] = await setup({
          testOptions: subscriptionOption,
          waitForSubscriptions: false,
          topology: 'group-small',
        });
      });

      it(`when automaticSubscription is ${option}, subscriptions are ${expectSubscriptionsEnabled ? 'enabled' : 'disabled'}.`, async () => {
        const thoseParticipants = [...thisRoom.participants.values()];
        await Promise.all(thoseParticipants.map(participant => tracksPublished(participant, 2)));

        let subscribed = 0;
        let notsubscribed = 0;
        flatMap(thoseParticipants, participant => [...participant.tracks.values()]).forEach(publication => {
          if (publication.isSubscribed) {
            subscribed++;
          } else {
            notsubscribed++;
          }
        });
        if (expectSubscriptionsEnabled) {
          assert.equal(subscribed, 4, 'subscribed should be zero, but were: ' + subscribed);
          assert.equal(notsubscribed, 0, 'notsubscribed should be zero, but were: ' + notsubscribed);
        } else {
          assert.equal(subscribed, 0, 'subscribed should be zero, but were: ' + subscribed);
          assert.equal(notsubscribed, 4, 'notsubscribed should be zero, but were: ' + notsubscribed);
        }
      });
    });
  });

  describe('signaling region', async () => {
    const regions = ['invalid', 'without', 'gll'].concat(defaults.regions ? defaults.regions.split(',') : [
      'au1', 'br1', 'de1', 'ie1', 'in1', 'jp1', 'sg1', 'us1', 'us2'
    ]);

    regions.forEach(region => {
      const regionOptions = {
        invalid: { region: 'foo' },
        without: {}
      }[region] || { region };

      const scenario = `when called ${{
        invalid: 'with an invalid',
        without: 'without a',
      }[region] || `with "${region}" as the`} signaling region`;

      context(scenario, () => {
        let token;
        let cancelablePromise;

        beforeEach(() => {
          const identity = randomName();
          token = getToken(identity);
          cancelablePromise = connect(token, Object.assign({}, defaults, regionOptions, { tracks: [] }));
          assert(cancelablePromise instanceof CancelablePromise);
        });

        it(`should return a CancelablePromise that ${region === 'invalid' ? 'rejects with a SignalingConnectionError' : 'resolves with a Room'}`, async () => {
          let error = null;
          let room = null;
          try {
            room = await cancelablePromise;
          } catch (error_) {
            error = error_;
          } finally {
            if (room) {
              room.disconnect();
            }
            if (region === 'invalid') {
              assert.equal(room, null, `Connected to Room ${room && room.sid} with an invalid signaling region "${region}"`);
              assert(error instanceof SignalingConnectionError);
            } else {
              assert.equal(error, null);
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
        options.name = sid;
      }
      cancelablePromises = tokens.map(token => connect(token, options));
      rooms = await Promise.all(cancelablePromises);
    });

    after(() => {
      tracks.forEach(track => track.kind !== 'data' && track.stop());
      rooms.forEach(room => room.disconnect());
      sid = sid || (rooms[0] && rooms[0].sid);
      return sid ? completeRoom(sid) : Promise.resolve();
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
          it('should set each Participant\'s ._tracks Map to an empty Map', () => {
            rooms.forEach(room => [...room.participants.values()].map(participant => assert.equal(participant._tracks.size, 0)));
          });

          return;
        }

        it('should eventually update each Participant\'s ._tracks Map to contain a RemoteTrack for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          await Promise.all(flatMap(rooms, ({ participants }) => {
            return [...participants.values()].map(participant => tracksSubscribed(participant, 2));
          }));
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

        it('should eventually update each Participant\'s .tracks Map to contain a RemoteTrackPublication for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              const trackSids = [...participant.tracks.values()].map(publication => publication.trackSid).sort();
              const localTrackPublicationSids = [...localParticipant.tracks.values()].map(publication => publication.trackSid).sort();
              assert.equal(trackSids.length, localTrackPublicationSids.length);
              assert.deepEqual(trackSids, localTrackPublicationSids);
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
      rooms = await Promise.all(tokens.map(token => connect(token, options)));
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

  describe('called with EncodingParameters', () => {
    combinationContext([
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 20000],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
      ],
      [
        // eslint-disable-next-line no-undefined
        [undefined, null, 40000],
        x => `when .maxVideoBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
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
      });

      ['audio', 'video'].forEach(kind => {
        it(`should ${maxBitrates[kind] ? '' : 'not '}set the .max${capitalize(kind)}Bitrate`, () => {
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
          tracks = [...await getTracks(names), names ? new LocalDataTrack({ name: names.data }) : new LocalDataTrack()];
          [sid, thisRoom, thoseRooms] = await setup({
            testOptions: { tracks },
            otherOptions: { tracks: [] },
            nTracks: 0
          });

          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await Promise.all(thisParticipants.map(participant => tracksSubscribed(participant, tracks.length)));
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
          await Promise.all(thisParticipants.map(participant => tracksSubscribed(participant, thisParticipant._tracks.size)));
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
                return Promise.all([
                  createLocalAudioTrack({ name }),
                  createLocalVideoTrack(Object.assign({ name }, smallVideoConstraints)),
                  new LocalDataTrack()
                ]);
              },
              scenario: 'Tracks whose names are the same',
              TwilioError: TrackNameIsDuplicatedError
            },
            {
              createLocalTracks() {
                const name = '0'.repeat(129);
                return Promise.all([
                  createLocalAudioTrack(),
                  createLocalVideoTrack(Object.assign({ name }, smallVideoConstraints)),
                  new LocalDataTrack()
                ]);
              },
              scenario: 'a Track whose name is too long',
              TwilioError: TrackNameTooLongError
            }
          ],
          ({ scenario }) => `called with ${scenario}`
        ]
      ], ([{ createLocalTracks, scenario, TwilioError }]) => {
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
            roomOptions: true
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
              const trackSSRCs = new Set(section.match(/^a=ssrc:.+ msid:.+$/gm).map(line => {
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
              assert.equal(section.match(/^a=ssrc:.+ msid:.+$/gm), null);
            }
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

function getPayloadTypes(mediaSection) {
  return [...createPtToCodecName(mediaSection).keys()];
}

async function setup(setupOptions) {

  setupOptions = Object.assign({
    name: randomName(),
    nTracks: 2,
    alone: false,
    topology: defaults.topology,
    waitForSubscriptions: true,
  }, setupOptions);

  setupOptions.name = setupOptions.name || randomName();
  const options = Object.assign({
    audio: true,
    video: smallVideoConstraints
  }, setupOptions.testOptions, defaults);
  const token = getToken(randomName());
  options.name = await createRoom(setupOptions.name, setupOptions.topology, setupOptions.roomOptions);
  const thisRoom = await connect(token, options);
  if (setupOptions.alone) {
    return [options.name, thisRoom];
  }

  const otherOptions = Object.assign({
    audio: true,
    video: smallVideoConstraints
  }, setupOptions.otherOptions);
  const thoseOptions = Object.assign({ name: thisRoom.name }, otherOptions, defaults);
  const thoseTokens = [randomName(), randomName()].map(getToken);
  const thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

  await Promise.all([thisRoom].concat(thoseRooms).map(room => {
    return participantsConnected(room, thoseRooms.length);
  }));
  const thoseParticipants = [...thisRoom.participants.values()];
  if (setupOptions.waitForSubscriptions) {
    await Promise.all(thoseParticipants.map(participant => tracksSubscribed(participant, setupOptions.nTracks)));
  }

  const peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
  return [options.name, thisRoom, thoseRooms, peerConnections];
}
