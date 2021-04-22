'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const createCancelableRoomSignalingPromise = require('../../../../../lib/signaling/v2/cancelableroomsignalingpromise');
const CancelablePromise = require('../../../../../lib/util/cancelablepromise');
const { defer } = require('../../../../../lib/util');
const { SignalingConnectionDisconnectedError } = require('../../../../../lib/util/twilio-video-errors');
const { makeEncodingParameters } = require('../../../../lib/util');
const fakeLog = require('../../../../lib/fakelog');

describe('createCancelableRoomSignalingPromise', () => {
  it('returns a CancelablePromise', () => {
    const test = makeTest();
    assert(test.cancelableRoomSignalingPromise instanceof CancelablePromise);
  });

  it('constructs a new PeerConnectionManager', () => {
    const test = makeTest();
    assert(test.peerConnectionManager);
  });

  it('calls .setTrackSenders with the LocalParticipantSignaling\'s Tracks\' MediaStreamTracks on the newly-constructed PeerConnectionManager', () => {
    const track1 = {
      trackTransceiver: {}
    };
    const track2 = {
      trackTransceiver: {}
    };
    const test = makeTest({
      tracks: [
        track1,
        track2
      ]
    });
    assert.deepEqual([track1.trackTransceiver, track2.trackTransceiver],
      test.peerConnectionManager.setTrackSenders.args[0][0]);
  });

  context('when the underlying Transport calls the onIced callback', () => {
    const iceServers = [{ urls: 'foo' }];
    let test;

    beforeEach(() => {
      test = makeTest();
      test.onIced(iceServers);
    });

    it('calls .setConfiguration on the newly-constructed PeerConnectionManager', () => {
      assert.deepEqual(test.peerConnectionManager.setConfiguration.args[0][0].iceServers, iceServers);
    });

    it('calls .createAndOffer on the newly-constructed PeerConnectionManager', () => {
      sinon.assert.calledOnce(test.peerConnectionManager.createAndOffer);
    });

    context('when the Promise returned by .createAndOffer is rejected', () => {
      let error;

      beforeEach(() => {
        error = new Error('foo');
        test.createAndOfferDeferred.reject(error);
      });

      it('should reject the CancelablePromise with the given Error', () => {
        test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }).catch(err => {
          assert.equal(err, error);
        });
      });
    });
  });

  context('when the CancelablePromise is canceled before .createAndOffer resolves', () => {
    it('the CancelablePromise rejects with a cancelation Error', () => {
      const test = makeTest();
      test.onIced();
      test.cancelableRoomSignalingPromise.cancel();
      const promise = test.cancelableRoomSignalingPromise.then(() => {
        throw new Error('Unexpected resolution');
      }, error => {
        assert.equal(
          'Canceled',
          error.message);
      });
      test.createAndOfferDeferred.resolve();
      return promise;
    });

    it('calls .close on the PeerConnectionManager', () => {
      const test = makeTest();
      test.onIced();
      test.cancelableRoomSignalingPromise.cancel();
      const promise = test.cancelableRoomSignalingPromise.then(() => {
        throw new Error('Unexpected resolution');
      }, () => {
        assert(test.peerConnectionManager.close.calledOnce);
      });
      test.createAndOfferDeferred.resolve();
      return promise;
    });
  });

  it('constructs a Transport', () => {
    const test = makeTest();
    test.createAndOfferDeferred.resolve();
    return test.createAndOfferDeferred.promise.then(() => {
      assert(test.transport);
    });
  });

  [
    {
      name: 'case 1: no bandwidth profile specified',
      options: {
        bandwidthProfile: undefined,
        subscribedTrackSwitchOffMode: 'auto',
        contentPreferencesMode: 'auto',
      },
      expected: {
        trackPriority: false,
        trackSwitchOff: false,
        renderHints: false,
      }
    },
    {
      name: 'case 2: subscribedTrackSwitchOffMode(manual) contentPreferencesMode(auto)',
      options: {
        bandwidthProfile: {},
        subscribedTrackSwitchOffMode: 'manual',
        contentPreferencesMode: 'auto',
      },
      expected: {
        trackPriority: true,
        trackSwitchOff: true,
        renderHints: true
      }
    },
    {
      name: 'case 2: subscribedTrackSwitchOffMode(manual) contentPreferencesMode(disabled)',
      options: {
        bandwidthProfile: {},
        subscribedTrackSwitchOffMode: 'manual',
        contentPreferencesMode: 'disabled',
      },
      expected: {
        trackPriority: true,
        trackSwitchOff: true,
        renderHints: true
      }
    },
    {
      name: 'case 3: subscribedTrackSwitchOffMode(disabled) contentPreferencesMode(disabled)',
      options: {
        bandwidthProfile: {},
        subscribedTrackSwitchOffMode: 'disabled',
        contentPreferencesMode: 'disabled',
      },
      expected: {
        trackPriority: true,
        trackSwitchOff: true,
        renderHints: false,
      }
    },
  ].forEach(testCase => {
    it('passes correct option to transport for msp channels : ' + testCase.name, () => {
      const test = makeTest(testCase.options);
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        assert(test.transport);
        assert(test.transport.options.trackPriority === testCase.expected.trackPriority);
        assert(test.transport.options.renderHints === testCase.expected.renderHints);
        assert(test.transport.options.trackSwitchOff === testCase.expected.trackSwitchOff);
      });
    });
  });

  context('when the Transport emits a "connected" event with an initial Room state', () => {
    context('and the CancelablePromise was canceled', () => {
      it('the CancelablePromise rejects with a cancelation error', () => {
        const test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.transport.emit('connected');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert.equal(
              'Canceled',
              error.message);
          });
        });
      });

      it('calls .disconnect on the Transport', () => {
        const test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.transport.emit('connected');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(test.transport.disconnect.calledOnce);
          });
        });
      });

      it('calls .close on the PeerConnectionManager', () => {
        const test = makeTest();
        test.createAndOfferDeferred.resolve();
        return test.createAndOfferDeferred.promise.then(() => {
          test.cancelableRoomSignalingPromise.cancel();
          test.transport.emit('connected');
          return test.cancelableRoomSignalingPromise.then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(test.peerConnectionManager.close.calledOnce);
          });
        });
      });
    });

    context('and the CancelablePromise was not canceled', () => {
      context('but the .participant property is missing', () => {
        it('the CancelablePromise rejects with an error', () => {
          const test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.transport.emit('connected', {});
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              // Do nothing.
            });
          });
        });

        it('calls .disconnect on the Transport', () => {
          const test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.transport.emit('connected', {});
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              assert(test.transport.disconnect.calledOnce);
            });
          });
        });

        it('calls .close on the PeerConnectionManager', () => {
          const test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            test.transport.emit('connected', {});
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              assert(test.peerConnectionManager.close.calledOnce);
            });
          });
        });
      });

      context('and the .participant property is present', () => {
        it('constructs a new RoomV2', () => {
          const test = makeTest();
          test.createAndOfferDeferred.resolve();
          return test.createAndOfferDeferred.promise.then(() => {
            const identity = makeIdentity();
            const sid = makeParticipantSid();
            test.transport.emit('connected', {
              participant: {
                sid: sid,
                identity: identity
              },
              options: {
                // eslint-disable-next-line camelcase
                signaling_region: 'foo'
              }
            });
            assert(test.RoomV2.calledOnce);
          });
        });

        it('the CancelablePromise resolves to the newly-constructed RoomV2', () => {
          const test = makeTest();
          test.createAndOfferDeferred.resolve();
          test.createAndOfferDeferred.promise.then(() => {
            const identity = makeIdentity();
            const sid = makeParticipantSid();
            test.transport.emit('connected', {
              participant: {
                sid: sid,
                identity: identity
              },
              options: {
                // eslint-disable-next-line camelcase
                signaling_region: 'foo'
              }
            });
          });
          return test.cancelableRoomSignalingPromise.then(room => {
            assert.equal(test.room, room);
          });
        });
      });
    });
  });

  context('when the Transport emits a "stateChanged" event in state "failed"', () => {
    it('the CancelablePromise rejects with a SignalingConnectionDisconnectedError', () => {
      const test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.transport.emit('stateChanged', 'disconnected');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, error => {
          assert(error instanceof SignalingConnectionDisconnectedError);
          assert.equal(error.code, 53001);
        });
      });
    });

    it('does not call .disconnect on the Transport', () => {
      const test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.transport.emit('stateChanged', 'disconnected');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, () => {
          assert(!test.transport.disconnect.calledOnce);
        });
      });
    });

    it('calls .close on the PeerConnectionManager', () => {
      const test = makeTest();
      test.createAndOfferDeferred.resolve();
      return test.createAndOfferDeferred.promise.then(() => {
        test.transport.emit('stateChanged', 'disconnected');
        return test.cancelableRoomSignalingPromise.then(() => {
          throw new Error('Unexpected resolution');
        }, () => {
          assert(test.peerConnectionManager.close.calledOnce);
        });
      });
    });
  });
});

function makeParticipantSid() {
  let sid = 'PA';
  for (let i = 0; i < 32; i++) {
    sid += 'abcdef0123456789'.split('')[Math.floor(Math.random() * 16)];
  }
  return sid;
}

function makeIdentity() {
  return Math.random().toString(36).slice(2);
}

function makeToken() {
  return 'fake-token';
}

function makeWsServer() {
  return 'wss://foo/bar';
}

function makeTest(options) {
  options = options || {};
  options.log = fakeLog;
  options.eventObserver = options.eventObserver || { emit: sinon.spy() };
  options.token = options.token || makeToken(options);
  options.wsServer = options.wsServer || makeWsServer(options);
  options.tracks = options.tracks || [];
  options.localParticipant = options.localParticipant || makeLocalParticipantSignaling(options);
  options.createAndOfferDeferred = defer();
  options.PeerConnectionManager = options.PeerConnectionManager || makePeerConnectionManagerConstructor(options);
  options.room = options.room || {
    disconnect: sinon.spy(() => {})
  };
  options.RoomV2 = options.RoomV2 || sinon.spy(function RoomV2() { return options.room; });
  options.Transport = options.Transport || makeTransportConstructor(options);

  options.cancelableRoomSignalingPromise = createCancelableRoomSignalingPromise(
    options.token,
    options.wsServer,
    options.localParticipant,
    makeEncodingParameters(options),
    { audio: [], video: [] },
    options);

  return options;
}

function makePeerConnectionManagerConstructor(testOptions) {
  return function PeerConnectionManager() {
    const peerConnectionManager = new EventEmitter();
    peerConnectionManager.close = sinon.spy(() => {});
    peerConnectionManager.setConfiguration = sinon.spy(() => {});
    peerConnectionManager.setTrackSenders = sinon.spy(() => {});
    peerConnectionManager.getTrackReceivers = sinon.spy(() => []);
    peerConnectionManager.update = sinon.spy(() => {});
    peerConnectionManager.dequeue = sinon.spy(() => {});
    peerConnectionManager.createAndOffer = sinon.spy(() => {
      return testOptions.createAndOfferDeferred.promise;
    });
    testOptions.peerConnectionManager = peerConnectionManager;
    return peerConnectionManager;
  };
}

function makeLocalParticipantSignaling(options) {
  const localParticipant = new EventEmitter();
  localParticipant.sid = null;
  localParticipant.identity = null;
  localParticipant.revision = 0;
  localParticipant.getState = sinon.spy(() => ({ revision: localParticipant.revision }));
  localParticipant.update = sinon.spy(() => localParticipant.revision++);
  localParticipant.tracks = options.tracks;
  localParticipant.disconnect = sinon.spy(() => {});
  localParticipant.setSignalingRegion = sinon.spy(() => {});
  localParticipant.connect = sinon.spy((sid, identity) => {
    localParticipant.sid = sid;
    localParticipant.identity = identity;
  });
  return localParticipant;
}

function makeTransportConstructor(testOptions) {
  return function Transport(name, accessToken, localParticipant, peerConnectionManager, wsServer, options) {
    const transport = new EventEmitter();
    this.name = name;
    this.accessToken = accessToken;
    this.localParticipant = localParticipant;
    this.peerConnectionManager = peerConnectionManager;
    this.wsServer = wsServer;

    testOptions.onIced = options.onIced;
    testOptions.transport = transport;
    transport.disconnect = sinon.spy(() => {});
    transport.options = options;
    return transport;
  };
}
