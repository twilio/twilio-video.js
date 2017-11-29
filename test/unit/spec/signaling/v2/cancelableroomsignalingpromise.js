'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const createCancelableRoomSignalingPromise = require('../../../../../lib/signaling/v2/cancelableroomsignalingpromise');
const CancelablePromise = require('../../../../../lib/util/cancelablepromise');
const { defer } = require('../../../../../lib/util');
const { SignalingConnectionDisconnectedError } = require('../../../../../lib/util/twilio-video-errors');

const MockIceServerSource = require('../../../../lib/mockiceserversource');
const { makeEncodingParameters } = require('../../../../lib/util');

describe('createCancelableRoomSignalingPromise', () => {
  it('returns a CancelablePromise', () => {
    const test = makeTest();
    assert(test.cancelableRoomSignalingPromise instanceof CancelablePromise);
  });

  it('constructs a new PeerConnectionManager', () => {
    const test = makeTest();
    assert(test.peerConnectionManager);
  });

  it('calls .setConfiguration on the newly-constructed PeerConnectionManager', () => {
    const test = makeTest();
    assert(test.peerConnectionManager.setConfiguration.calledOnce);
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

  it('calls .createAndOffer on the newly-constructed PeerConnectionManager', () => {
    const test = makeTest();
    assert(test.peerConnectionManager.createAndOffer.calledOnce);
  });

  context('when the CancelablePromise is canceled before .createAndOffer resolves', () => {
    it('the CancelablePromise rejects with a cancelation Error', () => {
      const test = makeTest();
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
              }
            });
            assert(test.RoomV2.calledOnce);
          });
        });

        context('when the CancelablePromise has not been canceled', () => {
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
                }
              });
            });
            return test.cancelableRoomSignalingPromise.then(room => {
              assert.equal(test.room, room);
            });
          });
        });

        context('when the CancelablePromise has been canceled', () => {
          it('the CancelablePromise rejects with a cancelation error', () => {
            const test = makeTest();
            test.createAndOfferDeferred.resolve();
            test.createAndOfferDeferred.promise.then(() => {
              const identity = makeIdentity();
              const sid = makeParticipantSid();
              test.transport.emit('connected', {
                participant: {
                  sid: sid,
                  identity: identity
                }
              });
              test.cancelableRoomSignalingPromise.cancel();
            });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert.equal(
                'Canceled',
                error.message);
            });
          });

          it('calls .disconnect on the newly-constructed RoomV2', () => {
            const test = makeTest();
            test.createAndOfferDeferred.resolve();
            test.createAndOfferDeferred.promise.then(() => {
              const identity = makeIdentity();
              const sid = makeParticipantSid();
              test.transport.emit('connected', {
                participant: {
                  sid: sid,
                  identity: identity
                }
              });
              test.cancelableRoomSignalingPromise.cancel();
            });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              assert(test.room.disconnect.calledOnce);
            });
          });

          it('does not call .disconnect on the Transport', () => {
            const test = makeTest();
            test.createAndOfferDeferred.resolve();
            test.createAndOfferDeferred.promise.then(() => {
              const identity = makeIdentity();
              const sid = makeParticipantSid();
              test.transport.emit('connected', {
                participant: {
                  sid: sid,
                  identity: identity
                }
              });
              test.cancelableRoomSignalingPromise.cancel();
            });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              assert(!test.transport.disconnect.calledTwice);
            });
          });

          it('calls .close on the PeerConnectionManager', () => {
            const test = makeTest();
            test.createAndOfferDeferred.resolve();
            test.createAndOfferDeferred.promise.then(() => {
              const identity = makeIdentity();
              const sid = makeParticipantSid();
              test.transport.emit('connected', {
                participant: {
                  sid: sid,
                  identity: identity
                }
              });
              test.cancelableRoomSignalingPromise.cancel();
            });
            return test.cancelableRoomSignalingPromise.then(() => {
              throw new Error('Unexpected resolution');
            }, () => {
              assert(test.peerConnectionManager.close.calledOnce);
            });
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

function makeUA() {
  return {};
}

function makeTest(options) {
  options = options || {};
  options.token = options.token || makeToken(options);
  options.ua = options.ua || makeUA(options);
  options.tracks = options.tracks || [];
  options.localParticipant = options.localParticipant || makeLocalParticipantSignaling(options);
  options.createAndOfferDeferred = defer();
  options.PeerConnectionManager = options.PeerConnectionManager || makePeerConnectionManagerConstructor(options);
  options.room = options.room || {
    disconnect: sinon.spy(() => {})
  };
  options.RoomV2 = options.RoomV2 || sinon.spy(function RoomV2() { return options.room; });
  options.Transport = options.Transport || makeTransportConstructor(options);

  const mockIceServerSource = new MockIceServerSource();
  options.iceServerSource = options.iceServerSource || mockIceServerSource;

  options.cancelableRoomSignalingPromise = createCancelableRoomSignalingPromise(
    options.token,
    options.ua,
    options.localParticipant,
    options.iceServerSource,
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
  localParticipant.connect = sinon.spy((sid, identity) => {
    localParticipant.sid = sid;
    localParticipant.identity = identity;
  });
  return localParticipant;
}

function makeTransportConstructor(testOptions) {
  return function Transport(name, accessToken, localParticipant, peerConnectionManager, ua) {
    const transport = new EventEmitter();
    this.name = name;
    this.accessToken = accessToken;
    this.localParticipant = localParticipant;
    this.peerConnectionManager = peerConnectionManager;
    this.ua = ua;
    testOptions.transport = transport;
    transport.disconnect = sinon.spy(() => {});
    return transport;
  };
}
