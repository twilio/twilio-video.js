'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');
const { inherits } = require('util');

const { a } = require('../../lib/util');
const connect = require('../../../lib/connect');

const {
  DEFAULT_LOGGER_NAME,
  DEFAULT_LOG_LEVEL,
  WS_SERVER,
  DEFAULT_REGION,
  subscriptionMode,
  clientTrackSwitchOffControl,
  trackSwitchOffMode,
  trackPriority,
  videoContentPreferencesMode,
} = require('../../../lib/util/constants');

const Log = require('../../../lib/util/log');
const Signaling = require('../../../lib/signaling');
const RoomSignaling = require('../../../lib/signaling/room');

const { FakeMediaStreamTrack, fakeGetUserMedia } = require('../../lib/fakemediastream');

const token = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiIsImN0eSI6InR3aWxpby1mcGE7dj0xIn0.eyJqdGkiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmLTE0NzUxOTAzNDgiLCJncmFudHMiOnsiaWRlbnRpdHkiOiJhc2QiLCJydGMiOnsiY29uZmlndXJhdGlvbl9wcm9maWxlX3NpZCI6IlZTM2Y3NWUwZjE0ZTdjOGIyMDkzOGZjNTA5MmU4MmYyM2EifX0sImlhdCI6MTQ3NTE5MDM0OCwiZXhwIjoxNDc1MTkzOTQ4LCJpc3MiOiJTSzY3NGIxODg2OWYxMWZhY2M2NjVhNjVmZDRkZGYyZjRmIiwic3ViIjoiQUM5NmNjYzkwNDc1M2IzMzY0ZjI0MjExZThkOTc0NmE5MyJ9.N0UuZSblqb7MknNuiRkiEVVEdmztm5AdYIhQp7zU2PI';

describe('connect', () => {
  describe('called with options that is not an object', () => {
    it('should return a rejected CancelablePromise', async () => {
      const invalidOptions = [1, 'foo', false, ['bar']];
      const failedConnectAttempts = invalidOptions.map(options => connect(token, options).then(() => {
        throw new Error('Unexpected resolution');
      }, error => error));
      const connectErrors = await Promise.all(failedConnectAttempts);
      assert.equal(connectErrors.length, invalidOptions.length);
      connectErrors.forEach(error => assert(error instanceof TypeError));
    });
  });

  describe('called with options with one or more keys explicitly set to undefined', () => {
    // eslint-disable-next-line require-await
    it('should set those keys to their default values', async () => {
      const mockSignaling = new Signaling();
      mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
      const signaling = sinon.spy(() => mockSignaling);

      // eslint-disable-next-line no-undefined
      connect(token, {
        iceServers: [],
        loggerName: undefined,
        signaling,
        wsServer: undefined
      });

      const options = signaling.args[0][1];
      assert.equal(options.loggerName, DEFAULT_LOGGER_NAME);
      assert.equal(options.region, DEFAULT_REGION);
      /* eslint new-cap:0 */
      assert.equal(options.wsServer, WS_SERVER(options.environment, options.region));
    });
  });

  describe('called with ConnectOptions#bandwidthProfile', () => {
    const subscriptionModes = Object.values(subscriptionMode);
    const trackPriorities = Object.values(trackPriority);
    const trackSwitchOffModes = Object.values(trackSwitchOffMode);
    const clientTrackSwitchOffControls = Object.values(clientTrackSwitchOffControl);
    const contentPreferencesModes = Object.values(videoContentPreferencesMode);

    let mockSignaling;
    let signaling;

    beforeEach(() => {
      mockSignaling = new Signaling();
      mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
      signaling = sinon.spy(() => mockSignaling);
    });
    [
      [null, 'that is null', TypeError, 'object'],
      ['foo', 'that is not an object', TypeError, 'object'],
      [['bar'], 'that is an Array', TypeError, 'object'],
      [{ video: null }, 'whose .video is null', TypeError, 'object'],
      [{ video: 'baz' }, 'whose .video is not an object', TypeError, 'object'],
      [{ video: ['zee'] }, 'whose .video is an Array', TypeError, 'object'],
      [{ video: { dominantSpeakerPriority: 2 } }, `whose .video.dominantSpeakerPriority is not one of ${trackPriorities.join(', ')}`, RangeError, trackPriorities],
      [{ video: { maxSubscriptionBitrate: false } }, 'whose .video.maxSubscriptionBitrate is not a number', TypeError, 'number'],
      [{ video: { mode: 'foo' } }, `whose .video.mode is not one of ${subscriptionModes.join(', ')}`, RangeError, subscriptionModes],
      [{ video: { trackSwitchOffMode: 'foo' } }, `whose .video.trackSwitchOffMode is not one of ${trackSwitchOffModes.join(', ')}`, RangeError, trackSwitchOffModes],
      [{ video: { clientTrackSwitchOffControl: 2 } }, `whose .video.clientTrackSwitchOffControl is not one of ${clientTrackSwitchOffControls.join(', ')}`, RangeError, clientTrackSwitchOffControls],
      [{ video: { clientTrackSwitchOffControl: 'foo' } }, `whose .video.clientTrackSwitchOffControl is not one of ${clientTrackSwitchOffControls.join(', ')}`, RangeError, clientTrackSwitchOffControls],
      [{ video: { contentPreferencesMode: 2 } }, `whose .video.videoContentPreferences is not one of ${contentPreferencesModes.join(', ')}`, RangeError, contentPreferencesModes],
      [{ video: { contentPreferencesMode: 'foo' } }, `whose .video.videoContentPreferences is not one of ${contentPreferencesModes.join(', ')}`, RangeError, contentPreferencesModes]
    ].forEach(([bandwidthProfile, scenario, ExpectedError, expectedTypeOrValues]) => {
      context(scenario, () => {
        it(`should reject the CancelablePromise with a ${ExpectedError.name}`, async () => {
          const cancelablePromise = connect(token, {
            bandwidthProfile,
            iceServers: [],
            signaling
          });
          let error;
          let expectedErrorMessage = 'options.bandwidthProfile';

          if (bandwidthProfile && typeof bandwidthProfile === 'object' && !Array.isArray(bandwidthProfile)) {
            expectedErrorMessage += '.video';
            if (bandwidthProfile.video && typeof bandwidthProfile.video === 'object' && !Array.isArray(bandwidthProfile.video)) {
              expectedErrorMessage += `.${Object.keys(bandwidthProfile.video)[0]}`;
            }
          }

          if (ExpectedError === TypeError) {
            expectedErrorMessage += ` must be ${a(expectedTypeOrValues)} ${expectedTypeOrValues}`;
          } else if (typeof expectedTypeOrValues === 'string') {
            expectedErrorMessage = expectedTypeOrValues;
          } else {
            expectedErrorMessage += ` must be one of ${expectedTypeOrValues.join(', ')}`;
          }

          try {
            await cancelablePromise;
          } catch (error_) {
            error = error_;
          } finally {
            assert(error instanceof ExpectedError);
            assert.equal(error.message, expectedErrorMessage);
          }
        });
      });
    });

    ['foo', ['bar']].forEach(bandwidthProfile => {
      context(`that is ${Array.isArray(bandwidthProfile) ? 'an Array' : 'not an object'}`, () => {
        it('should reject the CancelablePromise with a TypeError', async () => {
          const cancelablePromise = connect(token, {
            bandwidthProfile,
            iceServers: [],
            signaling
          });
          let error;

          try {
            await cancelablePromise;
          } catch (error_) {
            error = error_;
          } finally {
            assert(error instanceof TypeError);
          }
        });
      });
    });
  });

  describe('called with ConnectOptions#region', () => {
    ['de1', 'gll'].forEach(region => {
      it(`generates correct serverUrl for the region "${region}"`, () => {
        const mockSignaling = new Signaling();
        mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
        const signaling = sinon.spy(() => mockSignaling);

        connect(token, {
          iceServers: [],
          signaling,
          region
        });

        const options = signaling.args[0][1];
        assert.equal(options.wsServer, `wss://${region === 'gll'
          ? 'global' : region}.vss.twilio.com/signaling`);
      });
    });
  });

  describe('called with ConnectOptions#environment', () => {
    ['dev', 'prod'].forEach(environment => {
      it(`generates correct serverUrl for the environment "${environment}"`, () => {
        const mockSignaling = new Signaling();
        mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
        const signaling = sinon.spy(() => mockSignaling);

        connect(token, {
          iceServers: [],
          signaling,
          environment
        });

        const options = signaling.args[0][1];
        assert.equal(options.wsServer, `wss://global.vss.${environment === 'prod' ?
          '' : `${environment}.`}twilio.com/signaling`);
      });
    });
  });

  describe('called with ConnectOptions#preferredVideoCodecs = auto', () => {
    it('throws when ConnectOptions has maxVideoBitrate', async () => {
      const mockSignaling = new Signaling();
      mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
      function signaling() {
        return mockSignaling;
      }

      let errorThrown = null;
      try {
        await connect(token, {
          signaling,
          iceServers: [],
          tracks: [],
          preferredVideoCodecs: 'auto',
          maxVideoBitrate: 100
        });

        assert(false);
      } catch (error) {
        errorThrown = error;
      }

      assert(errorThrown);
      assert(errorThrown instanceof TypeError);
      assert(errorThrown.message, 'Illegal call to connect: ConnectOptions "maxVideoBitrate" is not compatible with "preferredVideoCodecs=auto"');
    });
  });

  describe('called without ConnectOptions#tracks', () => {
    it('automatically acquires LocalTracks', () => {
      const createLocalTracks = sinon.spy();
      connect(token, { createLocalTracks, iceServers: [] });
      assert(createLocalTracks.calledOnce);
    });

    describe('and then immediately canceled by calling .cancel()', () => {
      it('calls .stop() on the LocalTracks', async () => {
        const stream = await fakeGetUserMedia({ audio: true, video: true });
        const localTracks = stream.getTracks().map(track => new FakeLocalTrack(track));
        // eslint-disable-next-line require-await
        async function createLocalTracks() {
          return localTracks;
        }
        const promise = connect(token, { createLocalTracks, iceServers: [] });
        promise.cancel();
        try {
          await promise;
          throw new Error('Unexpected resolution');
        } catch (error) {
          localTracks.forEach(track => assert(track.stop.calledOnce));
        }
      });
    });

    describe('when it succeeds', () => {
      it('sets shouldStopLocalTracks on the LocalParticipant', async () => {
        const stream = await fakeGetUserMedia({ audio: true, video: true });
        const tracks = stream.getTracks().map(track => new FakeLocalTrack(track));
        // eslint-disable-next-line require-await
        async function createLocalTracks() {
          return tracks;
        }

        const mockSignaling = new Signaling();
        mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
        function signaling() {
          return mockSignaling;
        }

        let shouldStopLocalTracks;
        function LocalParticipant(localParticipantSignaling, localTracks, options) {
          shouldStopLocalTracks = options.shouldStopLocalTracks;
          this.on = () => {};
        }

        await connect(token, {
          LocalParticipant,
          createLocalTracks,
          iceServers: [],
          signaling
        });

        assert.equal(shouldStopLocalTracks, true);
      });
    });
  });

  describe('called with ConnectOptions#tracks', () => {
    function LocalTrack(track) {
      FakeLocalTrack.call(this, track, true);
    }

    describe('when ConnectOptions#tracks is', () => {
      [
        ['not an array', () => 'non-array argument', true],
        ['neither an array of LocalTracks nor an array of MediaStreamTracks', () => [{ foo: 'bar' }], true],
        ['an array of LocalTracks', () => [
          new LocalTrack(new FakeMediaStreamTrack('audio')),
          new LocalTrack(new FakeMediaStreamTrack('video'))
        ], false],
        ['an array of MediaStreamTracks', () => [
          new FakeMediaStreamTrack('audio'),
          new FakeMediaStreamTrack('video')
        ], false]
      ].forEach(([scenario, getTracks, shouldFail]) => {
        const mockSignaling = new Signaling();
        mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());

        let createLocalTracks;
        let tracks;

        function LocalParticipant() {
          this.on = () => {};
        }

        function signaling() {
          return mockSignaling;
        }

        context(scenario, () => {
          before(() => {
            tracks = getTracks();
            createLocalTracks = sinon.spy(() => Promise.resolve(tracks));
          });

          if (shouldFail) {
            it('should reject with a TypeError', async () => {
              try {
                await connect(token, {
                  createLocalTracks,
                  LocalAudioTrack: FakeLocalTrack,
                  LocalParticipant,
                  LocalVideoTrack: FakeLocalTrack,
                  MediaStreamTrack: FakeMediaStreamTrack,
                  iceServers: [],
                  signaling,
                  tracks
                });
              } catch (error) {
                assert(error instanceof TypeError);
                return;
              }
              throw new Error('Unexpected connect');
            });
            return;
          }

          it('should call createLocalTracks with the corresponding LocalTracks', async () => {
            await connect(token, {
              createLocalTracks,
              LocalAudioTrack: LocalTrack,
              LocalParticipant,
              LocalVideoTrack: LocalTrack,
              MediaStreamTrack: FakeMediaStreamTrack,
              iceServers: [],
              signaling,
              tracks
            });

            assert.deepEqual(createLocalTracks.args[0][0].tracks,
              tracks.map(track => track instanceof LocalTrack
                ? track : new LocalTrack(track)));
          });
        });
      });
    });

    describe('when it succeeds', () => {
      it('does not set shouldStopLocalTracks on the LocalParticipant', async () => {
        const stream = await fakeGetUserMedia({ audio: true, video: true });
        const tracks = stream.getTracks().map(track => new FakeLocalTrack(track));
        // eslint-disable-next-line require-await
        async function createLocalTracks() {
          return tracks;
        }

        const mockSignaling = new Signaling();
        mockSignaling.connect = () => Promise.resolve(() => new RoomSignaling());
        function signaling() {
          return mockSignaling;
        }

        let shouldStopLocalTracks;
        function LocalParticipant(localParticipantSignaling, localTracks, options) {
          shouldStopLocalTracks = options.shouldStopLocalTracks;
          this.on = () => {};
        }

        await connect(token, {
          createLocalTracks,
          LocalAudioTrack: FakeLocalTrack,
          LocalParticipant,
          LocalVideoTrack: FakeLocalTrack,
          iceServers: [],
          tracks,
          signaling
        });
        assert.equal(shouldStopLocalTracks, false);
      });
    });
  });
});

function FakeLocalTrack(mediaStreamTrack, shouldNotCreateStop) {
  EventEmitter.call(this);
  this.id = mediaStreamTrack.id;
  this.kind = mediaStreamTrack.kind;
  this.mediaStreamTrack = mediaStreamTrack;
  if (!shouldNotCreateStop) {
    this.stop = sinon.spy();
  }
  this._signaling = { id: mediaStreamTrack.id };
}
inherits(FakeLocalTrack, EventEmitter);
