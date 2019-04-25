'use strict';

const assert = require('assert');
const sinon = require('sinon');

const SignalingV2 = require('../../../../../lib/signaling/v2');
const LocalParticipantV2 = require('../../../../../lib/signaling/v2/localparticipant');

const { makeEncodingParameters } = require('../../../../lib/util');

describe('SignalingV2', () => {
  // SignalingV2
  // -----------

  describe('constructor', () => {
    it('sets the .state to "closed"', () => {
      const test = makeTest();
      assert.equal(
        'closed',
        test.signaling.state);
    });
  });

  // Signaling
  // ---------

  describe('#close, when the SignalingV2 .state is', () => {
    context('"closed"', () => {
      it('returns a Promise that resolves to the SignalingV2', async () => {
        const test = makeTest();
        const signaling = await test.signaling.close();
        assert.equal(test.signaling, signaling);
      });

      it('does not transition', async () => {
        const test = makeTest();
        await test.signaling.close();
        assert.deepEqual(
          [],
          test.transitions);
      });
    });

    context('"closing"', () => {
      it('returns a Promise that resolves to the SignalingV2', async () => {
        const test = makeTest();
        const promise = test.when('closing', async () => {
          const signaling = await test.signaling.close();
          assert.equal(test.signaling, signaling);
        });
        await test.signaling.open();
        await test.signaling.close();
        return promise;
      });

      it('does not transition after transitioning to state "closed"', async () => {
        const test = makeTest();
        const promise = test.when('closing', async () => {
          test.transitions = [];
          await test.signaling.close();
          assert.deepEqual(
            [
              'closed'
            ],
            test.transitions);
        });
        await test.signaling.open();
        await test.signaling.close();
        return promise;
      });
    });

    context('"open"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.close();
        }).then(signaling => {
          assert.equal(test.signaling, signaling);
        });
      });

      it('transitions through state "closing" to state "closed"', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          test.transitions = [];
          return test.signaling.close();
        }).then(() => {
          assert.deepEqual(
            [
              'closing',
              'closed'
            ],
            test.transitions);
        });
      });
    });

    context('"opening"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          return test.signaling.close().then(signaling => {
            assert.equal(test.signaling, signaling);
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });

      it('transitions through state "closing" to state "closed" after transitioning to "open"', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          test.transitions = [];
          return test.signaling.close().then(() => {
            assert.deepEqual(
              [
                'open',
                'closing',
                'closed'
              ],
              test.transitions);
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });
    });
  });

  describe('#connect, when the SignalingV2 .state is', () => {
    context('"closed"', () => {
      it('returns a Promise that resolves to a function that returns a CancelablePromise<RoomV2>', () => {
        const test = makeTest();
        return test.signaling.connect().then(fun => {
          assert.equal(test.cancelableRoomSignalingPromise, fun());
        });
      });

      it('transitions through state "opening" to state "open"', () => {
        const test = makeTest();
        return test.signaling.connect().then(() => {
          assert.deepEqual(
            [
              'opening',
              'open'
            ],
            test.transitions);
        });
      });
    });

    context('"closing"', () => {
      it('returns a Promise that resolves to a function that returns a CancelablePromise<RoomV2>', () => {
        const test = makeTest();
        const promise = test.when('closing', () => {
          return test.signaling.connect().then(fun => {
            assert.equal(test.cancelableRoomSignalingPromise, fun());
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });

      it('transitions through state "opening" to state "open" after "closed"', () => {
        const test = makeTest();
        const promise = test.when('closing', () => {
          test.transitions = [];
          return test.signaling.connect().then(() => {
            assert.deepEqual(
              [
                'closed',
                'opening',
                'open'
              ],
              test.transitions);
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });
    });

    context('"open"', () => {
      it('returns a Promise that resolves to a function that returns a CancelablePromise<RoomV2>', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.connect();
        }).then(fun => {
          assert.equal(test.cancelableRoomSignalingPromise, fun());
        });
      });

      it('does not transition', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          test.transitions = [];
          return test.signaling.connect();
        }).then(() => {
          assert.deepEqual(
            [],
            test.transitions);
        });
      });
    });

    context('"opening"', () => {
      it('returns a Promise that resolves to a function that returns a CancelablePromise<RoomV2>', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          return test.signaling.connect().then(fun => {
            assert.equal(test.cancelableRoomSignalingPromise, fun());
          });
        });
        test.signaling.open();
        return promise;
      });

      it('does not transition after "open"', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          test.transitions = [];
          return test.signaling.connect().then(() => {
            assert.deepEqual(
              [
                'open'
              ],
              test.transitions);
          });
        });
        test.signaling.open();
        return promise;
      });
    });
  });

  describe('#createLocalParticipantSignaling', () => {
    it('returns a new LocalParticipantV2', () => {
      const test = makeTest();
      const lp1 = test.signaling.createLocalParticipantSignaling(test.encodingParameters);
      const lp2 = test.signaling.createLocalParticipantSignaling(test.encodingParameters);
      assert(lp1 instanceof LocalParticipantV2);
      assert(lp2 instanceof LocalParticipantV2);
      assert(lp1 !== lp2);
    });
  });

  describe('#open, when the SignalingV2 .state is', () => {
    context('"closed"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        return test.signaling.open().then(signaling => {
          assert.equal(test.signaling, signaling);
        });
      });

      it('transitions through state "opening" to state "open"', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          assert.deepEqual(
            [
              'opening',
              'open'
            ],
            test.transitions);
        });
      });
    });

    context('"closing"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        const promise = test.when('closing', () => {
          return test.signaling.open().then(signaling => {
            assert.equal(test.signaling, signaling);
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });

      it('transitions through state "opening" to state "open" after "closed"', () => {
        const test = makeTest();
        const promise = test.when('closing', () => {
          test.transitions = [];
          return test.signaling.open().then(() => {
            assert.deepEqual(
              [
                'closed',
                'opening',
                'open'
              ],
              test.transitions);
          });
        });
        test.signaling.open().then(() => test.signaling.close());
        return promise;
      });
    });

    context('"open"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.open();
        }).then(signaling => {
          assert.equal(test.signaling, signaling);
        });
      });

      it('does not transition', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          test.transitions = [];
          return test.signaling.open();
        }).then(() => {
          assert.deepEqual(
            [],
            test.transitions);
        });
      });
    });

    context('"opening"', () => {
      it('returns a Promise that resolves to the SignalingV2', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          return test.signaling.open().then(signaling => {
            assert.equal(test.signaling, signaling);
          });
        });
        test.signaling.open();
        return promise;
      });

      it('does not transition after "open"', () => {
        const test = makeTest();
        const promise = test.when('opening', () => {
          test.transitions = [];
          return test.signaling.open().then(() => {
            assert.deepEqual(
              [
                'open'
              ],
              test.transitions);
          });
        });
        test.signaling.open();
        return promise;
      });
    });
  });
});

function makeTest(options) {
  options = options || {};

  options.encodingParameters = options.encodingParameters || makeEncodingParameters(options);
  options.cancelableRoomSignalingPromise = options.cancelableRoomSignalingPromise || {};
  options.createCancelableRoomSignalingPromise = sinon.spy(() => options.cancelableRoomSignalingPromise);

  options.wsServer = options.wsServer || 'wss://127.0.0.1';
  options.signaling = new SignalingV2(options.wsServer, options);

  options.transitions = [];
  options.signaling.on('stateChanged', state => {
    options.transitions.push(state);
  });

  options.when = function when(state, createPromise) {
    return new Promise((resolve, reject) => {
      options.signaling.on('stateChanged', function stateChanged(newState) {
        if (state === newState) {
          options.signaling.removeListener('stateChanged', stateChanged);
          try {
            resolve(createPromise());
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  };

  return options;
}
