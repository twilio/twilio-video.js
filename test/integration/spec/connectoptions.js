/* eslint-disable no-undefined */
'use strict';

const assert = require('assert');

const connect = require('../../../lib/connect');
const Room = require('../../../lib/room');
const { flatMap } = require('../../../lib/util');
const CancelablePromise = require('../../../lib/util/cancelablepromise');
const TwilioError = require('../../../lib/util/twilioerror');

const {
  MediaConnectionError,
  SignalingConnectionError,
} = require('../../../lib/util/twilio-video-errors');

const defaults = require('../../lib/defaults');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { isChrome, isFirefox } = require('../../lib/guessbrowser');

const {
  capitalize,
  combinationContext,
  isRTCRtpSenderParamsSupported,
  randomName,
  setup,
  smallVideoConstraints,
  tracksSubscribed,
  tracksPublished,
} = require('../../lib/util');

const { createCodecMapForMediaSection, createPtToCodecName, getMediaSections } = require('../../../lib/util/sdp');

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
          await Promise.all(participants.map(participant => tracksPublished(participant, 2)));

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

    [true, false].forEach((insights) => {
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
    const regions = ['without', 'gll', ...invalidRegions, ...validRegions];

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
              return pc.getSenders().filter(sender => sender.track);
            }).forEach(sender => {
              const { encodings } = sender.getParameters();
              encodings.forEach(({ maxBitrate }) => assert.equal(maxBitrate, maxBitrates[sender.track.kind] || 0));
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
});

function getPayloadTypes(mediaSection) {
  return [...createPtToCodecName(mediaSection).keys()];
}

