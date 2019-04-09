'use strict';

const assert = require('assert');
const { getUserMedia } = require('@twilio/webrtc');
const sinon = require('sinon');

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
  TrackNameIsDuplicatedError,
  TrackNameTooLongError
} = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { isChrome, isFirefox, isSafari } = require('../../lib/guessbrowser');
const getToken = require('../../lib/token');
const { capitalize, combinationContext, participantsConnected, pairs, randomName, smallVideoConstraints, tracksAdded, tracksPublished } = require('../../lib/util');

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

  describe('called with an incorrect RTCIceServer url', () => {
    let cancelablePromise;

    beforeEach(() => {
      const iceServers = [{ url: 'turn159.148.17.9:3478', credential: 'foo' }];
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
        options.name = name;
      }
      cancelablePromises = tokens.map(token => connect(token, options));
      rooms = await Promise.all(cancelablePromises);
    });

    after(() => {
      tracks.forEach(track => track.kind !== 'data' && track.stop());
      rooms.forEach(room => room.disconnect());
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
        it(`should update ${n === 1 ? 'the' : 'each'} Room's LocalParticipant's .tracks Map with the LocalTracks`, () => {
          rooms.forEach(room => assert.deepEqual(Array.from(room.localParticipant.tracks.values()), tracks));
        });

        ['tracks', 'audioTracks', 'videoTracks'].forEach(tracks => {
          const trackPublications = `${tracks.slice(0, tracks.length - 1)}Publications`;

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
          it('should set each Participant\'s .tracks Map to an empty Map', () => {
            rooms.forEach(room => [...room.participants.values()].map(participant => assert.equal(participant.tracks.size, 0)));
          });

          return;
        }

        it('should eventually update each Participant\'s .tracks Map to contain a RemoteTrack for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          await Promise.all(flatMap(rooms, ({ participants }) => {
            return [...participants.values()].map(participant => tracksAdded(participant, 2));
          }));
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              const trackSids = [...participant.tracks.values()].map(track => track.sid).sort();
              const localTrackPublicationSids = [...localParticipant.trackPublications.values()].map(publication => publication.trackSid).sort();
              assert.equal(trackSids.length, localTrackPublicationSids.length);
              assert.deepEqual(trackSids, localTrackPublicationSids);
            });
          });
        });

        it('should eventually update each Participant\'s .trackPublications Map to contain a RemoteTrackPublication for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
          pairs(rooms).forEach(([{ participants }, otherRooms]) => {
            otherRooms.forEach(({ localParticipant }) => {
              const participant = participants.get(localParticipant.sid);
              assert(participant);
              const trackSids = [...participant.trackPublications.values()].map(publication => publication.trackSid).sort();
              const localTrackPublicationSids = [...localParticipant.trackPublications.values()].map(publication => publication.trackSid).sort();
              assert.equal(trackSids.length, localTrackPublicationSids.length);
              assert.deepEqual(trackSids, localTrackPublicationSids);
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
      const options = Object.assign({ name: randomName(), tracks: [] }, defaults);

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
      const options = Object.assign({ tracks: [] }, defaults);
      cancelablePromise = connect(getToken(randomName()), options);
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

  [true, false].forEach(insights => {
    describe(`called with isInsightsEnabled = ${insights}`, () => {
      let InsightsPublisher;
      let NullInsightsPublisher;
      let room;

      before(async () => {
        InsightsPublisher = sinon.spy(function InsightsPublisher() {
          this.disconnect = sinon.spy();
          this.publish = sinon.spy();
        });

        NullInsightsPublisher = sinon.spy(function NullInsightsPublisher() {
          this.disconnect = sinon.spy();
          this.publish = sinon.spy();
        });

        const options = Object.assign({
          tracks: [],
          insights,
          InsightsPublisher,
          NullInsightsPublisher
        }, defaults);

        room = await connect(getToken(randomName()), options);
      });

      after(() => {
        room.disconnect();
      });

      it(`should ${insights ? '' : 'not'} publish events to the Insights gateway`, () => {
        const EventPublisher = insights ? InsightsPublisher : NullInsightsPublisher;
        const TheOtherEventPublisher = insights ? NullInsightsPublisher : InsightsPublisher;
        sinon.assert.calledOnce(EventPublisher);
        sinon.assert.callCount(TheOtherEventPublisher, 0);
      });
    });
  });

  describe('called with EncodingParameters', () => {
    combinationContext([
      [
        [undefined, null, 20000],
        x => `when .maxAudioBitrate is ${typeof x === 'undefined' ? 'absent' : x ? 'present' : 'null'}`
      ],
      [
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
      let thisRoom;
      let thoseRooms;

      before(async () => {
        [thisRoom, thoseRooms, peerConnections] = await setup(encodingParameters, { tracks: [] }, 0);
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
        [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
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
      let thisRoom;
      let thoseRooms;

      const testOptions = {
        preferredAudioCodecs: ['PCMU', 'invalid', 'PCMA'],
        preferredVideoCodecs: codecType === 'name' ? ['invalid', 'H264', 'VP8'] : [
          { codec: 'invalid' }, { codec: 'H264' }, { codec: 'VP8' }
        ]
      };

      before(async () => {
        [thisRoom, thoseRooms, peerConnections] = await setup(testOptions);
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
        [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
      });
    });
  });

  describe('when called with a fixed bitrate preferred audio codec', () => {
    let peerConnections;
    let thisRoom;
    let thoseRooms;

    const testOptions = {
      maxAudioBitrate: 10000,
      preferredAudioCodecs: ['PCMA', 'isac', 'opus']
    };

    before(async () => {
      [thisRoom, thoseRooms, peerConnections] = await setup(testOptions);
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
      [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
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

        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;
        let tracks;

        before(async () => {
          tracks = [...await getTracks(names), names ? new LocalDataTrack({ name: names.data }) : new LocalDataTrack()];

          const name = randomName();
          [thisRoom, thoseRooms] = await setup({ name, tracks }, { tracks: [] }, 0);
          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await Promise.all(thisParticipants.map(participant => tracksAdded(participant, tracks.length)));
        });

        it(`should set each LocalTrack's .name to its ${names ? 'given name' : 'ID'}`, () => {
          thisParticipant.tracks.forEach(track => {
            assert.equal(track.name, names ? names[track.kind] : track.id);
          });
        });

        it(`should set each LocalTrackPublication's .trackName to its ${names ? 'given name' : 'ID'}`, () => {
          thisParticipant.trackPublications.forEach(trackPublication => {
            assert.equal(trackPublication.trackName, names ? names[trackPublication.kind] : trackPublication.track.id);
          });
        });

        it(`should set each RemoteTrackPublication's .trackName to its ${names ? 'given name' : 'corresponding LocalTrack\'s ID'}`, () => {
          flatMap(thisParticipants, participant => [...participant.trackPublications.values()]).forEach(publication => {
            const thisPublication = thisParticipant.trackPublications.get(publication.trackSid);
            assert.equal(publication.trackName, names ? names[publication.kind] : thisPublication.track.id);
          });
        });

        it(`should set each RemoteTrack's .name to its ${names ? 'given name' : 'corresponding LocalTrack\'s ID'}`, () => {
          flatMap(thisParticipants, participant => [...participant.tracks.values()]).forEach(track => {
            const thisPublication = thisParticipant.trackPublications.get(track.sid);
            assert.equal(track.name, names ? names[track.kind] : thisPublication.track.id);
          });
        });

        after(() => {
          if (tracks) {
            tracks.forEach(track => track.kind !== 'data' && track.stop());
          }
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room.disconnect());
          }
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
        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;

        before(async () => {
          const name = randomName();
          const options = {
            audio: names.audio ? { name: names.audio } : true,
            video: names.video ? { name: names.video } : true,
            name
          };
          [thisRoom, thoseRooms] = await setup(options, { tracks: [] }, 0);
          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await Promise.all(thisParticipants.map(participant => tracksAdded(participant, thisParticipant.tracks.size)));
        });

        ['audio', 'video'].forEach(kind => {
          it(`should set the Local${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`${kind}Tracks`].forEach(track => {
              assert.equal(track.name, names[kind] || track.id);
            });
          });

          it(`should set the Local${capitalize(kind)}TrackPublication's .trackName to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`${kind}TrackPublications`].forEach(trackPublication => {
              assert.equal(trackPublication.trackName, names[kind] || trackPublication.track.id);
            });
          });

          it(`should set each Remote${capitalize(kind)}TrackPublication's .trackName to its ${names[kind] ? 'given name' : 'corresponding LocalTrack\'s ID'}`, () => {
            flatMap(thisParticipants, participant => [...participant[`${kind}TrackPublications`].values()]).forEach(publication => {
              const thisPublication = thisParticipant[`${kind}TrackPublications`].get(publication.trackSid);
              assert.equal(publication.trackName, names[kind] || thisPublication.track.id);
            });
          });

          it(`should set each Remote${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'corresponding LocalTrack\'s ID'}`, () => {
            flatMap(thisParticipants, participant => [...participant[`${kind}Tracks`].values()]).forEach(track => {
              const thisPublication = thisParticipant[`${kind}TrackPublications`].get(track.sid);
              assert.equal(track.name, names[kind] || thisPublication.track.id);
            });
          });
        });

        after(() => {
          if (thisRoom) {
            thisRoom.disconnect();
          }
          if (thoseRooms) {
            thoseRooms.forEach(room => room.disconnect());
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
        let tracks;
        let trackPublicationFailed;

        before(async () => {
          tracks = await createLocalTracks();
          [room] = await setup({ tracks }, {}, 0, true);
          trackPublicationFailed = await new Promise(resolve => room.localParticipant.once('trackPublicationFailed', resolve));
        });

        it(`should emit "trackPublicationFailed on the Room's LocalParticipant with a ${TwilioError.name}`, () => {
          assert(trackPublicationFailed instanceof TwilioError);
        });

        after(() => {
          room.disconnect();
          tracks.forEach(track => track.stop && track.stop());
        });
      });
    });
  });

  describe('called with a single LocalDataTrack in the tracks Array', () => {
    let room;
    let dataTrack;
    let tracks;

    before(async () => {
      const identity = randomName();
      const token = getToken(identity);
      dataTrack = new LocalDataTrack();
      tracks = [dataTrack];
      const options = Object.assign({ tracks }, defaults);
      room = await connect(token, options);
    });

    after(() => {
      tracks.forEach(track => track.kind !== 'data' && track.stop());
      room.disconnect();
    });

    it('eventually results in a LocalDataTrackPublication', async () => {
      await tracksPublished(room.localParticipant, 1, 'data');
      const publication = Array.from(room.localParticipant.dataTrackPublications.values()).find(publication => {
        return publication.track === dataTrack;
      });
      assert(publication);
    });
  });

  (isChrome || safariVersion >= 12.1 ? describe : describe.skip)('VP8 simulcast', () => {
    let peerConnections;
    let thisRoom;
    let thoseRooms;

    before(async () => {
      [thisRoom, thoseRooms, peerConnections] = await setup({
        preferredVideoCodecs: [{ codec: 'VP8', simulcast: true }]
      });
    });

    it('should add Simulcast SSRCs to the video m= section of all local descriptions', () => {
      flatMap(peerConnections, pc => {
        assert(pc.localDescription.sdp);
        return getMediaSections(pc.localDescription.sdp, 'video', '(sendonly|sendrecv)');
      }).forEach(section => {
        const flowSSRCs = new Set(flatMap(section.match(/^a=ssrc-group:FID .+$/gm), line => {
          return line.split(' ').slice(1);
        }));
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
      });
    });

    after(() => {
      [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
    });
  });
});

function getPayloadTypes(mediaSection) {
  return [...createPtToCodecName(mediaSection).keys()];
}

async function setup(testOptions, otherOptions, nTracks, alone) {
  const options = Object.assign({
    name: randomName(),
    audio: true,
    video: smallVideoConstraints
  }, testOptions, defaults);
  const token = getToken(randomName());
  const thisRoom = await connect(token, options);
  if (alone) {
    return [thisRoom];
  }

  otherOptions = Object.assign({
    audio: true,
    video: smallVideoConstraints
  }, otherOptions);
  const thoseOptions = Object.assign({ name: options.name }, otherOptions, defaults);
  const thoseTokens = [randomName(), randomName()].map(getToken);
  const thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

  await Promise.all([thisRoom].concat(thoseRooms).map(room => {
    return participantsConnected(room, thoseRooms.length);
  }));
  const thoseParticipants = [...thisRoom.participants.values()];
  await Promise.all(thoseParticipants.map(participant => tracksAdded(participant, typeof nTracks === 'number' ? nTracks : 2)));
  const peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);

  await Promise.all(peerConnections.map(pc => pc.signalingState === 'stable' ? Promise.resolve() : new Promise(resolve => {
    pc.onsignalingstatechange = () => {
      if (pc.signalingState === 'stable') {
        pc.onsignalingstatechange = null;
        resolve();
      }
    };
  })));

  return [thisRoom, thoseRooms, peerConnections];
}
