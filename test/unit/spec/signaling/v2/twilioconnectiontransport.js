'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const { name, version } = require('../../../../../package.json');
const EventObserver = require('../../../../../lib/util/eventobserver');
const TwilioConnectionTransport = require('../../../../../lib/signaling/v2/twilioconnectiontransport');
const { RoomCompletedError, SignalingConnectionError } = require('../../../../../lib/util/twilio-video-errors');
const TwilioError = require('../../../../../lib/util/twilioerror');
const { defer } = require('../../../../../lib/util');

const { combinations, waitForSometime } = require('../../../../lib/util');
const log = require('../../../../lib/fakelog');

describe('TwilioConnectionTransport', () => {
  combinations([
    [true, false], // iceServers
    [true, false], // networkQuality
    [true, false], // dominantSpeaker
    [true, false], // receiveTranscriptions
    [true, false], // automaticSubscription
    [true, false], // trackPriority
    [true, false], // trackSwitchOff
    [              // notifyWarnings
      [['recording-media-lost'], ['recordings']],
      [[], []],
      [undefined, undefined]
    ],
    [              // bandwidthProfile
      [undefined],
      [{}, {}],
      [{ video: {} }, { video: {} }],
      [{ video: { mode: 'foo' } }, { video: { mode: 'foo' } }],
      // eslint-disable-next-line
      [{ video: { maxSubscriptionBitrate: 2048 } }, { video: { max_subscription_bandwidth: 2048 } }],
      // eslint-disable-next-line
      [{ video: { maxTracks: 2 } }, { video: { max_tracks: 2 } }],
      // eslint-disable-next-line
      [{ video: { maxTracks: 2, trackSwitchOffMode: 'predicted' } }, { video: { max_tracks: 2, track_switch_off: 'predicted' } }],
      // eslint-disable-next-line
      [{ video: { maxTracks: 2, trackSwitchOffMode: 'detected' } }, { video: { max_tracks: 2, track_switch_off: 'detected' } }],
      // eslint-disable-next-line
      [{ video: { maxTracks: 2, trackSwitchOffMode: 'disabled' } }, { video: { max_tracks: 2, track_switch_off: 'disabled' } }],
      // eslint-disable-next-line
      // eslint-disable-next-line
      [{ video: { dominantSpeakerPriority: 'zee' } }, { video: { active_speaker_priority: 'zee' } }],
      // eslint-disable-next-line
      [{ video: { renderDimensions: { high: { width: 200, height: 400 } } } }, { video: { render_dimensions: { high: { width: 200, height: 400 } } } }],
      // eslint-disable-next-line
      [{ video: { renderDimensions: { low: { width: 600, height: 800 } } } }, { video: { render_dimensions: { low: { width: 600, height: 800 } } } }],
      // eslint-disable-next-line
      [{ video: { renderDimensions: { standard: { width: 1000, height: 1200 } } } }, { video: { render_dimensions: { standard: { width: 1000, height: 1200 } } } }],
      // eslint-disable-next-line
      [
        {
          video: {
            dominantSpeakerPriority: 'baz',
            maxSubscriptionBitrate: 4096,
            maxTracks: 5,
            mode: 'bar',
            renderDimensions: {
              high: { width: 2, height: 3 },
              low: { width: 4, height: 5 },
              standard: { width: 6, height: 7 }
            }
          }
        },
        {
          video: {
            // eslint-disable-next-line
            active_speaker_priority: 'baz',
            // eslint-disable-next-line
            max_subscription_bandwidth: 4096,
            // eslint-disable-next-line
            max_tracks: 5,
            mode: 'bar',
            // eslint-disable-next-line
            render_dimensions: {
              high: { width: 2, height: 3 },
              low: { width: 4, height: 5 },
              standard: { width: 6, height: 7 }
            }
          }
        }
      ]
    ]
  ]).forEach(([
    iceServers,
    networkQuality,
    dominantSpeaker,
    receiveTranscriptions,
    automaticSubscription,
    trackPriority,
    trackSwitchOff,
    notifyWarnings,
    expectedMediaWarningsRspPayload,
    bandwidthProfile,
    expectedBandwidthProfileRspPayload
  ]) => {
    describe(`constructor, called with
      .iceServers ${iceServers ? '' : 'not '}provided
      .networkQuality flag ${networkQuality ? 'enabled' : 'disabled'},
      .dominantSpeaker flag ${dominantSpeaker ? 'enabled' : 'disabled'},
      .receiveTranscriptions flag ${receiveTranscriptions ? 'enabled' : 'disabled'},
      .automaticSubscription flag ${automaticSubscription ? 'enabled' : 'disabled'},
      .trackPriority flag ${trackPriority ? 'enabled' : 'disabled'},
      .trackSwitchOff flag ${trackSwitchOff ? 'enabled' : 'disabled'},
      .notifyWarnings ${JSON.stringify(notifyWarnings)}, and
      .bandwidthProfile ${JSON.stringify(bandwidthProfile)}`, () => {
      let test;

      beforeEach(async () => {
        test = makeTest(Object.assign(iceServers ? {
          iceServers: [{ urls: 'foo' }]
        } : {}, bandwidthProfile ? {
          bandwidthProfile
        } : {}, {
          automaticSubscription,
          networkQuality,
          dominantSpeaker,
          receiveTranscriptions,
          trackPriority,
          trackSwitchOff,
          notifyWarnings
        }));
        if (iceServers) {
          await waitForSometime(1);
        }
      });

      it('should set the .state to "connecting"', () => {
        assert.equal('connecting', test.transport.state);
      });

      it('should set the _sessionTimeoutMS to zero initially', () => {
        assert.equal(0, test.transport._sessionTimeoutMS);
      });

      const testConnect = (isFirstRSPMessage, iceServersStatus) => {
        it('should call onIced with the given RTCIceServers', () => {
          sinon.assert.calledWith(test.onIced, [{ urls: 'foo' }]);
        });

        const action = isFirstRSPMessage
          ? 'set TwilioConnectionOptions.helloBody to'
          : 'call .sendMessage on the underlying TwilioConnection with';

        it(`should ${action} a Connect RSP message that
          ${networkQuality ? 'contains' : 'does not contain'} the "network_quality" payload,
          ${dominantSpeaker ? 'contains' : 'does not contain'} the "active_speaker" payload,
          ${receiveTranscriptions ? 'contains' : 'does not contain'} the "extension_transcriptions" payload,
          the "subscribe-${automaticSubscription ? 'all' : 'none'}" subscription rule,
          ${trackPriority ? 'contains' : 'does not contain'} the "track_priority" payload,
          ${trackSwitchOff ? 'contains' : 'does not contain'} the "track_switch_off" payload, and
          ${bandwidthProfile ? 'contains' : 'does not contain'} the "bandwidth_profile" payload`, () => {
          const message = isFirstRSPMessage
            ? test.twilioConnection.helloBody
            : test.twilioConnection.sendMessage.args[0][0];

          assert.equal(typeof message.format, 'string');
          assert.equal(message.ice_servers, iceServersStatus);
          assert.equal(message.name, test.name);

          if (networkQuality) {
            assert.deepEqual(message.media_signaling.network_quality.transports, [{ type: 'data-channel' }]);
          } else {
            assert(!('network_quality' in message.media_signaling));
          }

          if (dominantSpeaker) {
            assert.deepEqual(message.media_signaling.active_speaker.transports, [{ type: 'data-channel' }]);
          } else {
            assert(!('active_speaker' in message.media_signaling));
          }

          if (receiveTranscriptions) {
            assert.deepEqual(message.media_signaling.extension_transcriptions.transports, [{ type: 'data-channel' }]);
          } else {
            assert(!('extension_transcriptions' in message.media_signaling));
          }

          if (trackPriority) {
            assert.deepEqual(message.media_signaling.track_priority.transports, [{ type: 'data-channel' }]);
          } else {
            assert(!('track_priority' in message.media_signaling));
          }

          if (trackSwitchOff) {
            assert.deepEqual(message.media_signaling.track_switch_off.transports, [{ type: 'data-channel' }]);
          } else {
            assert(!('track_switch_off' in message.media_signaling));
          }

          assert.deepEqual(message.subscribe, {
            rules: [{
              type: automaticSubscription ? 'include' : 'exclude',
              all: true
            }],
            revision: 1
          });

          if (bandwidthProfile) {
            assert.deepEqual(message.bandwidth_profile, expectedBandwidthProfileRspPayload);
          } else {
            assert(!('bandwidth_profile' in message));
          }

          if (notifyWarnings) {
            assert.deepEqual(message.participant.media_warnings, expectedMediaWarningsRspPayload);
          } else {
            assert(!('media_warnings' in message.participant));
          }

          assert.equal(message.participant, test.localParticipantState);
          assert.deepEqual(message.peer_connections, test.peerConnectionManager.getStates());
          assert.equal(message.token, test.accessToken);
          assert.equal(message.type, 'connect');
          assert.equal(message.version, 2);
          assert.equal(message.publisher.name, `${name}.js`);
          assert.equal(message.publisher.sdk_version, version);
          assert.equal(typeof message.publisher.user_agent, 'string');
        });
      };
      if (iceServers) {
        testConnect(true, 'overrode');
      } else {
        it('should set TwilioConnectionOptions.helloBody to an Ice RSP message', () => {
          const message = test.twilioConnection.helloBody;
          assert.deepEqual(message, {
            edge: 'roaming',
            token: test.accessToken,
            type: 'ice',
            version: 1
          });
        });

        context('and after an Iced RSP message is received', () => {
          beforeEach(() => {
            test.open();
            test.ice();
            return waitForSometime(1);
          });

          testConnect(false, 'acquire');
        });
      }
    });
  });

  describe('#disconnect, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          session: test.transport._session,
          type: 'disconnect',
          version: 2
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          session: test.transport._session,
          type: 'disconnect',
          version: 2
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.disconnect();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should not call .close on the underlying TwilioConnection', () => {
        assert(!test.twilioConnection.close.calledTwice);
      });

    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.connect();
        test.transport.sync();
        ret = test.transport.disconnect();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "disconnected"', () => {
        assert.deepEqual([
          'connected',
          'syncing',
          'disconnected'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          session: test.transport._session,
          type: 'disconnect',
          version: 2
        });
      });

      it('should call .close on the underlying TwilioConnection', () => {
        sinon.assert.calledOnce(test.twilioConnection.close);
      });

    });
  });

  describe('#publish, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    // NOTE(mroberts): These are used to test .publish in the "connecting" and
    // "syncing" states below.
    const extraPublishes = [
      {
        participant: {
          revision: 1,
          tracks: []
        },
        // eslint-disable-next-line camelcase
        peer_connections: [
          {
            id: 'a',
            description: {
              revision: 1,
              type: 'alpha'
            },
            ice: {
              candidates: [
                { candidate: 'candidate1' },
                { candidate: 'candidate2' }
              ],
              revision: 2
            }
          }
        ]
      },
      {
        participant: {
          revision: 2,
          tracks: [
            { fizz: 'buzz' }
          ]
        },
        // eslint-disable-next-line camelcase
        peer_connections: [
          {
            id: 'a',
            description: {
              revision: 2,
              type: 'beta'
            },
            ice: {
              candidates: [
                { candidate: 'candidate1' }
              ],
              revision: 1
            }
          },
          {
            id: 'b',
            description: {
              revision: 1,
              type: 'gamma'
            }
          },
          {
            id: 'c'
          }
        ]
      },
    ];

    const expectedPublish = {
      participant: {
        revision: 2,
        tracks: [
          { fizz: 'buzz' }
        ]
      },
      // eslint-disable-next-line camelcase
      peer_connections: [
        {
          id: 'a',
          description: {
            revision: 2,
            type: 'beta'
          },
          ice: {
            candidates: [
              { candidate: 'candidate1' },
              { candidate: 'candidate2' }
            ],
            revision: 2
          }
        },
        {
          id: 'b',
          description: {
            revision: 1,
            type: 'gamma'
          }
        },
        {
          id: 'c'
        }
      ],
      type: 'update',
      version: 2
    };

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should call .sendMessage on the underlying TwilioConnection with an Update RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          foo: 'bar',
          session: test.transport._session,
          type: 'update',
          version: 2
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should enqueue the Update RSP message', () => {
        assert.deepEqual(test.transport._updatesToSend[0], { foo: 'bar' });
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.notCalled(test.twilioConnection.sendMessage);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.open();
            test.connect();
          });

          it('should call .sendMessage on the underlying TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.calledWith(test.twilioConnection.sendMessage, Object.assign({
              session: test.transport._session
            }, expectedPublish));
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('should not call .sendMessage on the TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
          });
        });
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        test.transport.sync();
        ret = test.transport.publish({ foo: 'bar' });
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should enqueue the Update RSP message', () => {
        assert.deepEqual(test.transport._updatesToSend[0], { foo: 'bar' });
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });

      context('when the .state transitions to', () => {
        beforeEach(() => {
          extraPublishes.forEach(test.transport.publish, test.transport);
        });

        context('"connected"', () => {
          beforeEach(() => {
            test.sync();
          });

          it('should call .sendMessage on the underlying TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.calledWith(test.twilioConnection.sendMessage, Object.assign({
              session: test.transport._session
            }, expectedPublish));
          });
        });

        context('"disconnected"', () => {
          beforeEach(() => {
            test.transport.disconnect();
          });

          it('should not call .sendMessage on the TwilioConnection with the reduced Update RSP message', () => {
            sinon.assert.callCount(test.twilioConnection.sendMessage, 2);
          });
        });
      });
    });
  });

  describe('#publishEvent', () => {
    let OrigDate;
    let test;

    before(() => {
      OrigDate = global.Date;
      global.Date = { now() { return 5; } };
      test = makeTest();
      test.connect();
    });

    after(() => {
      global.Date = OrigDate;
    });

    it('should emit an event on underlying ._eventObserver', () => {
      let eventWasEmitted = false;
      test.eventObserver.on('event', ({ group, name, level, payload }) => {
        eventWasEmitted = true;
        assert(group, 'quality');
        assert(name, 'bar');
        assert(level, 'info');
        assert(payload, { baz: 1, elapsedTime: 5, level: 'info' });
      });
      test.transport.publishEvent('quality', 'bar', 'info', { baz: 1 });
      assert(eventWasEmitted);
    });
  });

  describe('#sync, called when the Transport\'s .state is', () => {
    let test;
    let ret;

    context('"connected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        ret = test.transport.sync();
      });

      it('should return true', () => {
        assert.equal(true, ret);
      });

      it('should transition to .state "syncing"', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('should call .sendMessage on the underlying TwilioConnection with a Sync RSP message', () => {
        sinon.assert.calledWith(test.twilioConnection.sendMessage, {
          name: test.name,
          participant: test.localParticipantState,
          // eslint-disable-next-line
          peer_connections: test.peerConnectionManager.getStates(),
          session: test.transport._session,
          token: test.accessToken,
          type: 'sync',
          version: 2
        });
      });
    });

    context('"connecting"', () => {
      beforeEach(() => {
        test = makeTest();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.notCalled(test.twilioConnection.sendMessage);
      });
    });

    context('"disconnected"', () => {
      beforeEach(() => {
        test = makeTest();
        test.transport.disconnect();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'disconnected'
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });
    });

    context('"syncing"', () => {
      beforeEach(() => {
        test = makeTest();
        test.open();
        test.connect();
        test.transport.sync();
        ret = test.transport.sync();
      });

      it('should return false', () => {
        assert.equal(false, ret);
      });

      it('should not transition .state', () => {
        assert.deepEqual([
          'connected',
          'syncing'
        ], test.transitions);
      });

      it('should not call .sendMessage on the underlying TwilioConnection', () => {
        sinon.assert.callCount(test.twilioConnection.sendMessage, 1);
      });
    });
  });

  describe('the underlying TwilioConnection emits', () => {
    let test;

    beforeEach(() => {
      test = makeTest();
    });

    context('a "close" event, and the Transport\'s .state is', () => {
      context('"connected"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
        });

        context('when closed with a CloseReason not equal to "local"', () => {
          context('when the re-connect attempts haven\'t been exhausted', () => {
            beforeEach(() => {
              test.transport._sessionTimeoutMS = 1000;
              test.twilioConnection.close('timeout');
            });

            it('should transition .state to "syncing"', () => {
              assert.deepEqual([
                'connected',
                'syncing'
              ], test.transitions);
            });

            it('should attempt multiple times before transitioning to disconnected', () => {
              let connectRequests  = 0;
              // set reasonable timeout so that,
              // it ends up in multiple attempts.
              test.autoOpen = true;
              test.onTwilioConnectionCreated = twilioConnection => {
                connectRequests++;
                twilioConnection.once('open', () => twilioConnection.close('failed'));
              };
              return new Promise(resolve => {
                test.transport.on('stateChanged', state => {
                  if ('disconnected' === state) {
                    assert(connectRequests > 2);
                    test.sendMessageSpy = null;
                    resolve();
                  }
                });
              });
            });
          });

          context('when the re-connect attempts have been exhausted', () => {
            beforeEach(() => {
              test.transport._sessionTimeoutMS = 0;
              test.twilioConnection.close('failed');
            });

            it('should transition .state to "disconnected"', () => {
              assert.deepEqual([
                'connected',
                'disconnected'
              ], test.transitions);
              assert(disconnectedError instanceof SignalingConnectionError);
            });

            it('should not emit either "connected" or "message" events', () => {
              assert(!connectedOrMessageEventEmitted);
            });
          });
        });

        context('when closed with a "local" CloseReason', () => {
          beforeEach(() => {
            test.twilioConnection.close('local');
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual([
              'connected',
              'disconnected'
            ], test.transitions);
            assert.equal(disconnectedError, null);
          });

          it('should not emit either "connected" or "message" events', () => {
            assert(!connectedOrMessageEventEmitted);
          });
        });
      });

      context('"connecting"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
        });

        context('when closed with a CloseReason not equal to "local"', () => {
          beforeEach(() => {
            test.twilioConnection.close('timeout');
          });
          it('should transition .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
            assert(disconnectedError instanceof SignalingConnectionError);
          });

          it('should not emit either "connected" or "message" events', () => {
            assert(!connectedOrMessageEventEmitted);
          });
        });

        context('when closed with a "local" CloseReason', () => {
          beforeEach(() => {
            test.twilioConnection.close('local');
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual([
              'disconnected'
            ], test.transitions);
            assert.equal(disconnectedError, null);
          });

          it('should not emit either "connected" or "message" events', () => {
            assert(!connectedOrMessageEventEmitted);
          });
        });
      });

      context('"disconnected"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.disconnect();

          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
          test.twilioConnection.close('failed');
        });

        it('should do nothing"', () => {
          assert.deepEqual([
            'connected',
            'disconnected'
          ], test.transitions);
          assert(!disconnectedError);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });

      context('"syncing"', () => {
        let connectedOrMessageEventEmitted;
        let disconnectedError;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.sync();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('stateChanged', (state, error) => {
            disconnectedError = error;
          });
        });

        context('when closed with a CloseReason not equal to "local"', () => {
          context('when the re-connect attempts haven\'t been exhausted', () => {
            beforeEach(() => {
              test.twilioConnection.close('failed');
            });

            it('should not transition states', () => {
              assert.deepEqual([
                'connected',
                'syncing'
              ], test.transitions);
            });
          });

          context('when the re-connect attempts have been exhausted', () => {
            beforeEach(() => {
              test.transport._sessionTimeoutMS = 0;
              test.twilioConnection.close('timeout');
            });

            it('should transition .state to "disconnected"', () => {
              assert.deepEqual([
                'connected',
                'syncing',
                'disconnected'
              ], test.transitions);
              assert(disconnectedError instanceof SignalingConnectionError);
            });

            it('should not emit either "connected" or "message" events', () => {
              assert(!connectedOrMessageEventEmitted);
            });
          });
        });

        context('when closed with a "local" CloseReason', () => {
          beforeEach(() => {
            test.twilioConnection.close('local');
          });

          it('should transition .state to "disconnected"', () => {
            assert.deepEqual([
              'connected',
              'syncing',
              'disconnected'
            ], test.transitions);
            assert.equal(disconnectedError, null);
          });

          it('should not emit either "connected" or "message" events', () => {
            assert(!connectedOrMessageEventEmitted);
          });
        });
      });
    });

    context('an "open" event, and the Transport\'s .state is', () => {
      context('"connected"', () => {
        [true, false].forEach(isReconnecting => {
          context(`when ${!isReconnecting ? 'not ' : ''}re-connecting`, () => {
            let connectedOrMessageEventEmitted;

            beforeEach(() => {
              test.open();
              test.connect();
              test.transport.once('connected', () => {
                connectedOrMessageEventEmitted = true;
              });
              test.transport.once('message', () => {
                connectedOrMessageEventEmitted = true;
              });

              const deferred = defer();
              if (isReconnecting) {
                test.autoOpen = true;
                test.onTwilioConnectionCreated = twilioConnection => {
                  twilioConnection.once('open', () => deferred.resolve());
                };
                // this should kick off reconnect attempt async
                test.close('timeout');
              } else {
                deferred.resolve();
              }
              return deferred.promise;
            });

            it('should not emit either "connected" or "message" events', () => {
              assert(!connectedOrMessageEventEmitted);
            });

            if (isReconnecting) {
              it('should transition .state to "syncing"', () => {
                assert.deepEqual([
                  'connected',
                  'syncing'
                ], test.transitions);
              });

              it('should set TwilioConnectionOptions.helloBody to a Sync RSP message', () => {
                assert.deepEqual(test.twilioConnection.helloBody, {
                  name: test.name,
                  participant: test.localParticipantState,
                  // eslint-disable-next-line
                  peer_connections: test.peerConnectionManager.getStates(),
                  session: test.transport._session,
                  token: test.accessToken,
                  type: 'sync',
                  version: 2
                });
              });
            } else {
              it('should not transition .state', () => {
                assert.deepEqual([
                  'connected'
                ], test.transitions);
              });
            }
          });
        });
      });

      context('"connecting"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });
      });

      context('"disconnected"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.transport.disconnect();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([
            'disconnected'
          ], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should call .sendMessage on the underlying TwilioConnection with a Disconnect RSP message', () => {
          sinon.assert.calledWith(test.twilioConnection.sendMessage, {
            session: test.transport._session,
            type: 'disconnect',
            version: 2
          });
        });
      });

      context('"syncing"', () => {
        let connectedOrMessageEventEmitted;

        beforeEach(() => {
          test.open();
          test.connect();
          test.transport.sync();
          test.transport.once('connected', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.transport.once('message', () => {
            connectedOrMessageEventEmitted = true;
          });
          test.open();
        });

        it('should not transition .state', () => {
          assert.deepEqual([
            'connected',
            'syncing'
          ], test.transitions);
        });

        it('should not emit either "connected" or "message" events', () => {
          assert(!connectedOrMessageEventEmitted);
        });

        it('should call .sendMessage on the underlying TwilioConnection with a Sync RSP message', () => {
          sinon.assert.calledWith(test.twilioConnection.sendMessage, {
            name: test.name,
            participant: test.localParticipantState,
            // eslint-disable-next-line
            peer_connections: test.peerConnectionManager.getStates(),
            session: test.transport._session,
            token: test.accessToken,
            type: 'sync',
            version: 2
          });
        });
      });
    });

    context('a "message" event, and the Transport\'s .state is', () => {
      context('"connected", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'synced' },
          { type: 'update' },
          { type: 'warning' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should emit "message"', () => {
              assert.deepEqual(message, expectedMessage);
            });
          });
        });

        [
          { code: 1, message: 'foo', type: 'error' },
          { type: 'disconnected' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let disconnectedError;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.on('stateChanged', function stateChanged(state, error) {
                if (state === 'disconnected') {
                  disconnectedError = error;
                  test.transport.removeListener('stateChanged', stateChanged);
                }
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should transition .state to "disconnected"', () => {
              assert.deepEqual(test.transitions, [
                'disconnected'
              ]);
            });

            if (expectedMessage.type === 'error') {
              it('should transition to .state "disconnected" with a TwilioError', () => {
                assert(disconnectedError instanceof TwilioError);
                assert.equal(disconnectedError.code, expectedMessage.code);
                assert.equal(disconnectedError.message, expectedMessage.message);
              });
            }

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });
          });
        });

        context('"disconnected" with status "completed"', () => {
          let connected;
          let disconnectedError;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.on('stateChanged', function stateChanged(state, error) {
              if (state === 'disconnected') {
                disconnectedError = error;
                test.transport.removeListener('stateChanged', stateChanged);
              }
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ status: 'completed', type: 'disconnected' });
          });

          it('should transition .state to "disconnected" with a RoomCompletedError', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
            assert(disconnectedError instanceof RoomCompletedError);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });
      });

      context('"connecting", and the message\'s .type is', () => {
        let test;
        const sessionTimeout = 10;

        beforeEach(() => {
          test = makeTest();
          test.open();
          assert.equal(0, test.transport._sessionTimeoutMS);
        });

        context('"connected"', () => {
          let connected;
          let message;
          const connectMessage = {
            session: 'foo',
            type: 'connected',
            sid: 'roomSid',
            participant: {
              sid: 'mySid'
            },
            options: {
              // eslint-disable-next-line camelcase
              session_timeout: 10
            }
          };
          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage(connectMessage);
          });

          it('should transition .state to "connected"', () => {
            assert.deepEqual(test.transitions, [
              'connected'
            ]);
          });

          it('should set _sessionTimeoutMS', () => {
            assert.equal(sessionTimeout * 1000, test.transport._sessionTimeoutMS);
          });

          it('should emit "connected"', () => {
            assert.deepEqual(connected, connectMessage);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });

        });

        [
          { code: 1, message: 'foo', type: 'error' },
          { type: 'disconnected' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let disconnectedError;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.on('stateChanged', function stateChanged(state, error) {
                if (state === 'disconnected') {
                  disconnectedError = error;
                  test.transport.removeListener('stateChanged', stateChanged);
                }
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should transition .state to "disconnected"', () => {
              assert.deepEqual(test.transitions, [
                'disconnected'
              ]);
            });

            if (expectedMessage.type === 'error') {
              it('should transition to .state "disconnected" with a TwilioError', () => {
                assert(disconnectedError instanceof TwilioError);
                assert.equal(disconnectedError.code, expectedMessage.code);
                assert.equal(disconnectedError.message, expectedMessage.message);
              });
            }

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });
          });
        });

        context('"disconnected" with status "completed"', () => {
          let connected;
          let disconnectedError;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.on('stateChanged', function stateChanged(state, error) {
              if (state === 'disconnected') {
                disconnectedError = error;
                test.transport.removeListener('stateChanged', stateChanged);
              }
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ status: 'completed', type: 'disconnected' });
          });

          it('should transition .state to "disconnected" with a RoomCompletedError', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
            assert(disconnectedError instanceof RoomCompletedError);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        ['synced', 'update'].forEach(type => {
          context(`"${type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage({ type });
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });

            context('after transition to .state "connected"', () => {
              beforeEach(() => {
                test.connect();
              });

              it('should emit "message"', () => {
                assert.deepEqual(message, { type });
              });
            });
          });
        });
      });

      context('"disconnected", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transport.disconnect();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'disconnected' },
          { code: 1000, message: 'foo', type: 'error' },
          { type: 'synced' },
          { type: 'update' }
        ].forEach(expectedMessage => {
          let connected;
          let message;

          context(`"${expectedMessage.type}"`, () => {
            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });
          });
        });
      });

      context('"syncing", and the message\'s .type is', () => {
        let test;

        beforeEach(() => {
          test = makeTest();
          test.open();
          test.connect();
          test.transport.sync();
          test.transitions = [];
        });

        [
          { session: 'foo', type: 'connected' },
          { type: 'update' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.on('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should not transition .state', () => {
              assert.deepEqual(test.transitions, []);
            });

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });

            context('after transition to .state "connected"', () => {
              beforeEach(() => {
                test.sync();
              });

              it('should emit "message"', () => {
                assert.deepEqual(message, expectedMessage);
              });
            });
          });
        });

        [
          { code: 1, message: 'foo', type: 'error' },
          { type: 'disconnected' }
        ].forEach(expectedMessage => {
          context(`"${expectedMessage.type}"`, () => {
            let connected;
            let disconnectedError;
            let message;

            beforeEach(() => {
              test.transport.once('connected', msg => {
                connected = msg;
              });
              test.transport.on('stateChanged', function stateChanged(state, error) {
                if (state === 'disconnected') {
                  disconnectedError = error;
                  test.transport.removeListener('stateChanged', stateChanged);
                }
              });
              test.transport.once('message', msg => {
                message = msg;
              });
              test.twilioConnection.receiveMessage(expectedMessage);
            });

            it('should transition .state to "disconnected"', () => {
              assert.deepEqual(test.transitions, [
                'disconnected'
              ]);
            });

            if (expectedMessage.type === 'error') {
              it('should transition to .state "disconnected" with a TwilioError', () => {
                assert(disconnectedError instanceof TwilioError);
                assert.equal(disconnectedError.code, expectedMessage.code);
                assert.equal(disconnectedError.message, expectedMessage.message);
              });
            }

            it('should not emit "connected"', () => {
              assert(!connected);
            });

            it('should not emit "message"', () => {
              assert(!message);
            });
          });
        });

        context('"disconnected" with status "completed"', () => {
          let connected;
          let disconnectedError;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.on('stateChanged', function stateChanged(state, error) {
              if (state === 'disconnected') {
                disconnectedError = error;
                test.transport.removeListener('stateChanged', stateChanged);
              }
            });
            test.transport.once('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ status: 'completed', type: 'disconnected' });
          });

          it('should transition .state to "disconnected" with a RoomCompletedError', () => {
            assert.deepEqual(test.transitions, [
              'disconnected'
            ]);
            assert(disconnectedError instanceof RoomCompletedError);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should not emit "message"', () => {
            assert(!message);
          });
        });

        context('"synced"', () => {
          let connected;
          let message;

          beforeEach(() => {
            test.transport.once('connected', msg => {
              connected = msg;
            });
            test.transport.on('message', msg => {
              message = msg;
            });
            test.twilioConnection.receiveMessage({ type: 'synced' });
          });

          it('should transition .state to "connected"', () => {
            assert.deepEqual(test.transitions, [
              'connected'
            ]);
          });

          it('should not emit "connected"', () => {
            assert(!connected);
          });

          it('should emit "message"', () => {
            assert.deepEqual(message, {
              type: 'synced'
            });
          });
        });
      });
    });
  });
});

function createTwilioConnection(options) {
  class FakeTwilioConnection extends EventEmitter {
    constructor(url, twilioConnectionOptions) {
      super();
      this.close = sinon.spy(reason => this.emit('close', reason));
      this.helloBody = twilioConnectionOptions.helloBody;
      this.open = () => this.emit('open');
      this.receiveMessage = message => this.emit('message', message);
      this.sendMessage =  sinon.spy(message => {
        if (options.sendMessageSpy) {
          options.sendMessageSpy(message);
        }
      });
      options.twilioConnection = this;

      if (options.onTwilioConnectionCreated) {
        options.onTwilioConnectionCreated(this);
      }
      if (options.autoOpen) {
        setTimeout(() => this.open(), 0);
      }
    }
  }

  FakeTwilioConnection.CloseReason = {
    BUSY: 'busy',
    LOCAL: 'local'
  };

  return FakeTwilioConnection;
}

/**
 * Mock Backoff.
 * @returns {void}
 */
function Backoff() {
  this.backoff = fn => {
    fn();
  };
  this.reset = () => {
    sinon.spy(() => {});
  };
}

function makeTest(options) {
  options = options || {};
  options.eventObserver = options.eventObserver || new EventObserver(makeInsightsPublisher(), 0, log);
  options.reconnectBackOffJitter = options.reconnectBackOffJitter || 0;
  options.reconnectBackOffMs = options.reconnectBackOffMs || 0;
  options.name = 'name' in options ? options.name : makeName();
  options.accessToken = options.accessToken || makeAccessToken();
  options.sdpFormat = options.sdpFormat || 'foo';
  options.wsServer = options.wsServer || makeName();
  options.localParticipantState = options.localParticipantState || {
    revision: 1,
    tracks: [
      { whiz: 'bang' }
    ]
  };
  options.localParticipant = options.localParticipant || makeLocalParticipant(options);
  options.onIced = options.onIced || sinon.spy(() => Promise.resolve());
  options.peerConnectionManager = options.peerConnectionManager || makePeerConnectionManager(options);
  options.TwilioConnection = options.TwilioConnection || createTwilioConnection(options);
  options.Backoff = options.Backoff || Backoff;
  options.transport = options.transport || new TwilioConnectionTransport(
    options.name,
    options.accessToken,
    options.localParticipant,
    options.peerConnectionManager,
    options.wsServer,
    options);
  options.transitions = [];
  options.transport.on('stateChanged', state => {
    options.transitions.push(state);
  });
  options.receiveMessage = message => options.twilioConnection.receiveMessage(message);

  options.close = reason => {
    options.twilioConnection.close(reason);
  };

  options.open = () => options.twilioConnection.open();
  // eslint-disable-next-line camelcase
  options.connect = () => options.receiveMessage({ session: makeName(), type: 'connected', sid: 'roomSid', participant: { sid: 'mySid' }, options: { session_timeout: 10 } });
  // eslint-disable-next-line camelcase
  options.ice = () => options.receiveMessage({ ice_servers: [{ urls: 'foo' }], type: 'iced' });
  options.sync = () => options.receiveMessage({ type: 'synced' });
  return options;
}

function makeName() {
  return Math.random().toString(36).slice(2);
}

function makeAccessToken() {
  return Math.random().toString(36).slice(2);
}

function makeLocalParticipant(options) {
  const localParticipant = {};
  localParticipant.getState = sinon.spy(() => options.localParticipantState);
  return localParticipant;
}

function makePeerConnectionManager() {
  return { getStates: () => [] };
}

function makeInsightsPublisher() {
  return {
    disconnect: sinon.spy(() => {}),
    connect: sinon.spy(() => {}),
    publish: sinon.spy(() => {}),
  };
}
