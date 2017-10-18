'use strict';

if (typeof window === 'undefined') {
  require('../../lib/mockwebrtc')();
}

const assert = require('assert');
const connect = require('../../../lib/connect');
const { audio: createLocalAudioTrack, video: createLocalVideoTrack } = require('../../../lib/createlocaltrack');
const createLocalTracks = require('../../../lib/createlocaltracks');
const getToken = require('../../lib/token');
const { guessBrowser } = require('../../../lib/util');
const { getMediaSections } = require('../../../lib/util/sdp');
const CancelablePromise = require('../../../lib/util/cancelablepromise');
const { capitalize, combinationContext, participantsConnected, pairs, randomName, tracksAdded, tracksPublished } = require('../../lib/util');
const env = require('../../env');
const Room = require('../../../lib/room');
const { flatMap } = require('../../../lib/util');
const LocalAudioTrack = require('../../../lib/media/track/localaudiotrack');
const LocalDataTrack = require('../../../lib/media/track/localdatatrack');
const LocalVideoTrack = require('../../../lib/media/track/localvideotrack');
const TwilioError = require('../../../lib/util/twilioerror');
const sinon = require('sinon');

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
      20106
    ]
  ].forEach(([description, extraOptions, expectedCode]) => {
    describe(`called ${description}`, () => {
      let token;
      let cancelablePromise;

      beforeEach(() => {
        const identity = randomName();
        token = getToken(identity, Object.assign({}, defaultOptions, extraOptions));
        // NOTE(mroberts): We expect this to print errors, so disable logging.
        cancelablePromise = connect(token, Object.assign({}, defaultOptions, extraOptions, { logLevel: 'off', tracks: [] }));
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
    let tracks;

    before(async () => {
      identities = Array.from(Array(n).keys()).map(() => randomName());
      tracks = await createLocalTracks();
      const tokens = identities.map(getToken);
      const options = Object.assign({ tracks }, defaultOptions);
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

      it(`should set ${n === 1 ? 'the' : 'each'} Room\'s LocalParticipant's .state to "connected"`, () => {
        rooms.forEach(room => assert.equal(room.localParticipant.state, 'connected'));
      });

      it(`should set ${n === 1 ? 'the' : 'each'} Room\'s LocalParticipant's .sid to a ${n === 1 ? '' : 'unique '}Participant SID`, () => {
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

        [ 'tracks', 'audioTracks', 'videoTracks' ].forEach(tracks => {
          var trackPublications = `${tracks.slice(0, tracks.length - 1)}Publications`;

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

          it(`should set ${n === 1 ? 'the' : 'each'} Room\'s LocalParticipant's ${capitalize(trackPublications)}' .trackSid to a unique Track SID`, () => {
            rooms.forEach(room => {
              var publications = room.localParticipant[trackPublications];
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

        // NOTE(mroberts): We don't actually raise Track events in Node, so skip these.
        (navigator.userAgent === 'Node'
          ? it.skip
          : it
        )('should eventually update each Participant\'s .tracks Map to contain a RemoteTrack for every one of its corresponding LocalParticipant\'s LocalTracks', async () => {
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

  [ true, false ].forEach(insights => {
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
        }, defaultOptions);

        room = await connect(getToken(randomName()), options);
      });

      it(`should ${insights ? '' : 'not'} publish events to the Insights gateway`, () => {
        const EventPublisher = insights ? InsightsPublisher : NullInsightsPublisher;
        const TheOtherEventPublisher = insights ? NullInsightsPublisher : InsightsPublisher;
        sinon.assert.calledOnce(EventPublisher);
        sinon.assert.callCount(TheOtherEventPublisher, 0);
      });
    });
  });

  (navigator.userAgent === 'Node'
    ? describe.skip
    : describe)('called with EncodingParameters', () => {
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
      }, {});

      const maxBitrates = {
        audio: encodingParameters.maxAudioBitrate,
        video: encodingParameters.maxVideoBitrate
      };

      let peerConnections;
      let thisRoom;
      let thoseRooms;

      before(async () => {
        [thisRoom, thoseRooms, peerConnections] = await setup(encodingParameters);
      });

      ['audio', 'video'].forEach(kind => {
        it(`should ${maxBitrates[kind] ? '' : 'not '}set the .max${capitalize(kind)}Bitrate`, () => {
          flatMap(peerConnections, pc => {
            assert(pc.remoteDescription.sdp);
            return getMediaSections(pc.remoteDescription.sdp, kind, '(recvonly|sendrecv)');
          }).forEach(section => {
            const modifier = guessBrowser() === 'firefox'
              ? 'TIAS'
              : 'AS';
            const maxBitrate = maxBitrates[kind]
              ? guessBrowser() === 'firefox'
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

  (navigator.userAgent === 'Node'
    ? describe.skip
    : describe)('called with preferred audio and video codecs', () => {
    let peerConnections;
    let thisRoom;
    let thoseRooms;

    const testOptions = {
      preferredAudioCodecs: ['PCMU', 'invalid', 'PCMA'],
      preferredVideoCodecs: ['invalid', 'H264', 'VP8']
    };

    before(async () => {
      [thisRoom, thoseRooms, peerConnections] = await setup(testOptions);
    });

    it('should apply the codec preferences to all remote descriptions', () => {
      flatMap(peerConnections, pc => {
        assert(pc.remoteDescription.sdp);
        return getMediaSections(pc.remoteDescription.sdp);
      }).forEach(section => {
        const codecMap = createCodecMap(section);
        const expectedPayloadTypes = /m=audio/.test(section)
          ? flatMap(testOptions.preferredAudioCodecs, codecName => codecMap.get(codecName.toLowerCase()) || [])
          : flatMap(testOptions.preferredVideoCodecs, codecName => codecMap.get(codecName.toLowerCase()) || []);
        const actualPayloadTypes = getCodecPayloadTypes(section);
        expectedPayloadTypes.forEach((expectedPayloadType, i) => assert.equal(expectedPayloadType, actualPayloadTypes[i]));
      });
    });

    after(() => {
      [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
    });
  });

  (navigator.userAgent === 'Node'
    ? describe.skip
    : describe)('when called with a fixed bitrate preferred audio codec', () => {
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
        const codecMap = createCodecMap(section);
        const payloadTypes = getCodecPayloadTypes(section);
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

  (navigator.userAgent === 'Node' ? describe.skip : describe)('Track names', () => {
    describe('when called with pre-created Tracks', () => {
      combinationContext([
        [
          [{audio: 'foo', video: 'bar', data: 'baz'}, null],
          x => `when called with${x ? '' : 'out'} Track names`
        ],
        [
          [
            {
              source: 'createLocalTracks',
              async getTracks(names) {
                const options = names && {audio: {name: names.audio}, video: {name: names.video}};
                return await (options ? createLocalTracks(options) : createLocalTracks());
              }
            },
            {
              source: 'MediaStreamTracks from getUserMedia()',
              async getTracks() {
                const mediaStream = await navigator.mediaDevices.getUserMedia({audio: true, video: true});
                return mediaStream.getAudioTracks().concat(mediaStream.getVideoTracks());
              }
            }
          ],
          ({ source }) => `when Tracks are pre-created using ${source}`
        ]
      ], ([ names, { source, getTracks } ]) => {
        if (source === 'MediaStreamTracks from getUserMedia()' && !!names) {
          return;
        }

        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;

        before(async () => {
          const tracks = [...await getTracks(names), names ? new LocalDataTrack({name: names.data}) : new LocalDataTrack()];

          [ thisRoom, thoseRooms ] = await setup({name: randomName(), tracks}, {tracks: []}, 0);
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

        it(`should set each RemoteTrack's .name to its ${names ? 'given name' : 'ID'}`, () => {
          flatMap(thisParticipants, participant => [...participant.tracks.values()]).forEach(track => {
            assert.equal(track.name, names ? names[track.kind] : track.id);
          });
        });

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
        });
      });
    });

    describe('when called with constraints', () => {
      combinationContext([
        [
          [{}, {audio: 'foo'}, {video: 'bar'}, {audio: 'foo', video: 'bar'}],
          x => [
            () => `when called without Track names`,
            () => `when called with only ${x.audio ? 'an audio' : 'a video'} Track name`,
            () => `when called with both audio and video Track names`
          ][Object.keys(x).length]()
        ]
      ], ([ names ]) => {
        let thisRoom;
        let thoseRooms;
        let thisParticipant;
        let thisParticipants;

        before(async () => {
          const options = {
            audio: names.audio ? { name: names.audio } : true,
            video: names.video ? { name: names.video } : true,
            name: randomName()
          };
          [ thisRoom, thoseRooms ] = await setup(options, {tracks: []}, 0);
          thisParticipant = thisRoom.localParticipant;
          thisParticipants = thoseRooms.map(room => room.participants.get(thisParticipant.sid));
          await Promise.all(thisParticipants.map(participant => tracksAdded(participant, 2)));
        });

        ['audio', 'video'].forEach(kind => {
          it(`should set the Local${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`${kind}Tracks`].forEach(track => {
              assert.equal(track.name, names[kind] || track.id);
            });
          });

          it(`should set the Local${capitalize(kind)}TrackPublication's .name to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            thisParticipant[`${kind}TrackPublications`].forEach(trackPublication => {
              assert.equal(trackPublication.trackName, names[kind] || trackPublication.track.id);
            });
          });

          it(`should set each Remote${capitalize(kind)}Track's .name to its ${names[kind] ? 'given name' : 'ID'}`, () => {
            flatMap(thisParticipants, participant => [...participant[`${kind}Tracks`].values()]).forEach(track => {
              assert.equal(track.name, names[kind] || track.id);
            });
          });
        });

        after(() => {
          [thisRoom, ...thoseRooms].forEach(room => room.disconnect());
        });
      });
    });
  });

  describe('called with a single LocalDataTrack in the tracks Array', () => {
    let room;
    let dataTrack;

    before(async () => {
      const identity = randomName();
      const token = getToken(identity);
      dataTrack = new LocalDataTrack();
      const options = Object.assign({ tracks: [dataTrack] }, defaultOptions);
      room = await connect(token, options);
    });

    after(() => {
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
});

function createCodecMap(mediaSection) {
  return getCodecPayloadTypes(mediaSection).reduce((codecMap, payloadType) => {
    const rtpmapPattern = new RegExp('a=rtpmap:' + payloadType + ' ([^/]+)');
    const codecName = mediaSection.match(rtpmapPattern)[1].toLowerCase();
    const payloadTypes = codecMap.get(codecName) || [];
    codecMap.set(codecName, payloadTypes.concat(payloadType));
    return codecMap;
  }, new Map());
}

function getCodecPayloadTypes(mediaSection) {
  return mediaSection.split('\r\n')[0].match(/([0-9]+)/g).slice(1);
}

async function setup(testOptions, otherOptions, nTracks) {
  const options = Object.assign({name: randomName()}, testOptions, defaultOptions);
  const token = getToken(randomName());
  const thisRoom = await connect(token, options);

  const thoseOptions = Object.assign({name: options.name}, otherOptions || {}, defaultOptions);
  const thoseTokens = [randomName(), randomName()].map(getToken);
  const thoseRooms = await Promise.all(thoseTokens.map(token => connect(token, thoseOptions)));

  await participantsConnected(thisRoom, thoseRooms.length);
  const thoseParticipants = [...thisRoom.participants.values()];
  await Promise.all(thoseParticipants.map(participant => tracksAdded(participant, typeof nTracks === 'number' ? nTracks : 2)));
  const peerConnections = [...thisRoom._signaling._peerConnectionManager._peerConnections.values()].map(pcv2 => pcv2._peerConnection);
  return [thisRoom, thoseRooms, peerConnections];
}
