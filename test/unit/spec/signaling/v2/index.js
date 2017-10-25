'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
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

    it('constructs a new SIP.js UA', () => {
      const test = makeTest();
      assert(test.ua);
    });

    context('the newly-constructed SIP.js UA', () => {
      it('has extra Supported option tags "room-signaling" and "timer"', () => {
        const test = makeTest();
        const optionTags = new Set(test.UA.args[0][0].extraSupported);
        assert(optionTags.has('room-signaling'));
        assert(optionTags.has('timer'));
      });

      it('allows unregistered option tags', () => {
        const test = makeTest();
        assert(test.UA.args[0][0].hackAllowUnregisteredOptionTags);
      });
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

      it('does not call .disconnect on the SIP.js UA\'s .transport', async () => {
        const test = makeTest();
        await test.signaling.close();
        assert(!test.ua.transport.disconnect.calledOnce);
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

      it('does not call .close on the SIP.js UA again', async () => {
        const test = makeTest();
        const promise = test.when('closing', async () => {
          await test.signaling.close();
          assert(test.ua.stop.calledOnce);
        });
        await test.signaling.open();
        await test.signaling.close();
        return promise;
      });

      it('does not call .disconnect on the SIP.js UA\'s .transport again', async () => {
        const test = makeTest();
        const promise = test.when('closing', async () => {
          await test.signaling.close();
          assert(test.ua.transport.disconnect.calledOnce);
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

      it('calls .close on the SIP.js UA', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.close();
        }).then(() => {
          assert(test.ua.stop.calledOnce);
        });
      });

      it('calls .disconnect on the SIP.js UA\'s .transport', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.close();
        }).then(() => {
          assert(test.ua.transport.disconnect.calledOnce);
        });
      });
    });

    context('"opening"', () => {
      context('and the call to .start on the SIP.js UA fails', () => {
        it('returns a Promise that resolves to the SignalingV2', async () => {
          const test = makeTest({ uaConnectSucceeds: false });
          const promise = test.when('opening', async () => {
            const signaling = await test.signaling.close();
            assert.equal(test.signaling, signaling);
          });
          try {
            await test.signaling.open();
          } catch (error) {
            // Expected rejection
          }
          return promise;
        });

        it('does not transition after transitioning to "closed"', async () => {
          const test = makeTest({ uaConnectSucceeds: false });
          const promise = test.when('opening', async () => {
            test.transitions = [];
            await test.signaling.close();
            assert.deepEqual(
              [
                'closed'
              ],
              test.transitions);
          });
          try {
            await test.signaling.open();
          } catch (error) {
            // Expected rejection
          }
          return promise;
        });

        it('does not call .close on the SIP.js UA', async () => {
          const test = makeTest({ uaConnectSucceeds: false });
          const promise = test.when('opening', async () => {
            await test.signaling.close();
            assert(!test.ua.stop.calledOnce);
          });
          try {
            await test.signaling.open();
          } catch (error) {
            // Expected rejection
          }
          return promise;
        });

        it('does not call .disconnect on the SIP.js UA\'s .transport', async () => {
          const test = makeTest({ uaConnectSucceeds: false });
          const promise = test.when('opening', async () => {
            await test.signaling.close();
            assert(!test.ua.transport.disconnect.calledOnce);
          });
          try {
            await test.signaling.open();
          } catch (error) {
            // Expected rejection
          }
          return promise;
        });
      });

      context('and the call to .start on the SIP.js UA succeeds', () => {
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

        it('calls .stop on the SIP.js UA', () => {
          const test = makeTest();
          const promise = test.when('opening', () => {
            test.transitions = [];
            return test.signaling.close().then(() => {
              assert(test.ua.stop.calledOnce);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('calls .disconnect on the SIP.js UA\'s .transport', () => {
          const test = makeTest();
          const promise = test.when('opening', () => {
            test.transitions = [];
            return test.signaling.close().then(() => {
              assert(test.ua.transport.disconnect.calledOnce);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });
      });
    });
  });

  describe('#connect, when the SignalingV2 .state is', () => {
    context('"closed"', () => {
      context('and the call to .start on the SIP.js UA fails', () => {
        it('returns a Promise that rejects with an Error', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.connect().then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert(error instanceof Error);
          });
        });

        it('transitions through state "opening" to state "closed"', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.connect().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert.deepEqual(
              [
                'opening',
                'closed'
              ],
              test.transitions);
          });
        });

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.connect().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(test.ua.start.calledOnce);
          });
        });

        it('does not call .stop on the SIP.js UA', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.connect().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(!test.ua.stop.calledOnce);
          });
        });

        it('does not call .disconnect on the SIP.js UA\'s .transport', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.connect().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(!test.ua.transport.disconnect.calledOnce);
          });
        });
      });

      context('and the call to .start on the SIP.js UA succeeds', () => {
        // TODO(mroberts): ...
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

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          return test.signaling.connect().then(() => {
            assert(test.ua.start.calledOnce);
          });
        });
      });
    });

    context('"closing"', () => {
      context('and the call to .start on the SIP.js UA fails', () => {
        it('returns a Promise that rejects with an Error', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.connect().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(error instanceof Error);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('transitions through state "opening" to state "closed" after "closed"', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            test.transitions = [];
            return test.signaling.connect().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert.deepEqual(
                [
                  'closed',
                  'opening',
                  'closed'
                ],
                test.transitions);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.connect().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(test.ua.start.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('does not call .stop on the SIP.js UA again', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.connect().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(!test.ua.stop.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('does not call .disconnect on the SIP.js UA\'s .transport again', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.connect().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(!test.ua.transport.disconnect.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });
      });

      context('and the call to .start on the SIP.js UA succeeds', () => {
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

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            return test.signaling.connect().then(() => {
              assert(test.ua.start.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });
      });
    });

    context('"open"', () => {
      // TODO(mroberts):
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

      it('does not call .start on the SIP.js UA', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.connect();
        }).then(() => {
          assert(!test.ua.start.calledTwice);
        });
      });
    });

    context('"opening"', () => {
      context('the initial call to .start on the SIP.js UA fails', () => {
        context('but the subsequent one succeeds', () => {
          // TODO(mroberts): ...
          it('returns a Promise that resolves to a function that returns a CancelablePromise<RoomV2>', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.connect().then(fun => {
                assert.equal(test.cancelableRoomSignalingPromise, fun());
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('transitions through state "opening" to state "open" after "closed"', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              test.transitions = [];
              return test.signaling.connect().then(signaling => {
                assert.deepEqual(
                  [
                    'closed',
                    'opening',
                    'open'
                  ],
                  test.transitions);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('calls .start on the SIP.js UA again', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.connect().then(signaling => {
                assert(test.ua.start.calledTwice);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('does not call .stop on the SIP.js UA', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.connect().then(signaling => {
                assert(!test.ua.stop.calledOnce);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('does not call .disconnect on the SIP.js UA\'s .transport', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.connect().then(signaling => {
                assert(!test.ua.transport.disconnect.calledOnce);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });
        });

        context('and the subsequent one fails', () => {
          it('returns a Promise that rejects with an Error', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.connect();
              } catch (error) {
                // Expected rejection
                assert(error instanceof Error);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resoltuion');
          });

          it('transitions through state "opening" to state "closed" after "closed"', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              test.transitions = [];
              try {
                await test.signaling.connect();
              } catch (error) {
                // Expected rejection
                assert.deepEqual(
                  [
                    'closed',
                    'opening',
                    'closed'
                  ],
                  test.transitions);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('calls .start on the SIP.js UA again', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.connect();
              } catch (error) {
                // Expected rejection
                assert(test.ua.start.calledTwice);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('does not call .stop on the SIP.js UA', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.connect();
              } catch(error) {
                // Expected rejection
                assert(!test.ua.stop.calledOnce);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('does not call .disconnect on the SIP.js UA\'s .transport', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.connect();
              } catch (error) {
                // Expected rejection
                assert(!test.ua.transport.disconnect.calledOnce);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });
        });
      });

      context('the initial call to .start on the SIP.js UA succeeds', () => {
        // TODO(mroberts):
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

        it('does not call .start on the SIP.js UA again', () => {
          const test = makeTest();
          const promise = test.when('opening', () => {
            return test.signaling.connect().then(() => {
              assert(test.ua.start.calledOnce);
            });
          });
          test.signaling.open();
          return promise;
        });
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
      context('and the call to .start on the SIP.js UA fails', () => {
        it('returns a Promise that rejects with an Error', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.open().then(() => {
            throw new Error('Unexpected resolution');
          }, error => {
            assert(error instanceof Error);
          });
        });

        it('transitions through state "opening" to state "closed"', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.open().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert.deepEqual(
              [
                'opening',
                'closed'
              ],
              test.transitions);
          });
        });

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.open().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(test.ua.start.calledOnce);
          });
        });

        it('does not call .stop on the SIP.js UA', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.open().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(!test.ua.stop.calledOnce);
          });
        });

        it('does not call .disconnect on the SIP.js UA\'s .transport', () => {
          const test = makeTest({ uaConnectSucceeds: false });
          return test.signaling.open().then(() => {
            throw new Error('Unexpected resolution');
          }, () => {
            assert(!test.ua.transport.disconnect.calledOnce);
          });
        });
      });

      context('and the call to .start on the SIP.js UA succeeds', () => {
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

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          return test.signaling.open().then(() => {
            assert(test.ua.start.calledOnce);
          });
        });
      });
    });

    context('"closing"', () => {
      context('and the call to .start on the SIP.js UA fails', () => {
        it('returns a Promise that rejects with an Error', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.open().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(error instanceof Error);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('transitions through state "opening" to state "closed" after "closed"', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            test.transitions = [];
            return test.signaling.open().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert.deepEqual(
                [
                  'closed',
                  'opening',
                  'closed'
                ],
                test.transitions);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.open().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(test.ua.start.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('does not call .stop on the SIP.js UA again', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.open().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(!test.ua.stop.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });

        it('does not call .disconnect on the SIP.js UA\'s .transport again', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            test.uaConnectSucceeds = false;
            return test.signaling.open().then(() => {
              throw new Error('Unexpected resolution');
            }, error => {
              assert(!test.ua.transport.disconnect.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });
      });

      context('and the call to .start on the SIP.js UA succeeds', () => {
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

        it('calls .start on the SIP.js UA', () => {
          const test = makeTest();
          const promise = test.when('closing', () => {
            return test.signaling.open().then(() => {
              assert(test.ua.start.calledTwice);
            });
          });
          test.signaling.open().then(() => test.signaling.close());
          return promise;
        });
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

      it('does not call .start on the SIP.js UA', () => {
        const test = makeTest();
        return test.signaling.open().then(() => {
          return test.signaling.open();
        }).then(() => {
          assert(!test.ua.start.calledTwice);
        });
      });
    });

    context('"opening"', () => {
      context('the initial call to .start on the SIP.js UA fails', () => {
        context('but the subsequent one succeeds', () => {
          it('returns a Promise that resolves to the SignalingV2', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.open().then(signaling => {
                assert.equal(test.signaling, signaling);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('transitions through state "opening" to state "open" after "closed"', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              test.transitions = [];
              return test.signaling.open().then(signaling => {
                assert.deepEqual(
                  [
                    'closed',
                    'opening',
                    'open'
                  ],
                  test.transitions);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('calls .start on the SIP.js UA again', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.open().then(signaling => {
                assert(test.ua.start.calledTwice);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('does not call .stop on the SIP.js UA', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.open().then(signaling => {
                assert(!test.ua.stop.calledOnce);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });

          it('does not call .disconnect on the SIP.js UA\'s .transport', () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', () => {
              return test.signaling.open().then(signaling => {
                assert(!test.ua.transport.disconnect.calledOnce);
              });
            });
            test.signaling.open().catch(() => test.uaConnectSucceeds = true);
            return promise;
          });
        });

        context('and the subsequent one fails', () => {
          it('returns a Promise that rejects with an Error', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.open();
              } catch (error) {
                // Expected rejection
                assert(error instanceof Error);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('transitions through state "opening" to state "closed" after "closed"', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              test.transitions = [];
              try {
                await test.signaling.open();
              } catch (error) {
                // Expected rejection
                assert.deepEqual(
                  [
                    'closed',
                    'opening',
                    'closed'
                  ],
                  test.transitions);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('calls .start on the SIP.js UA again', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.open();
              } catch (error) {
                // Expected rejection
                assert(test.ua.start.calledTwice);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('does not call .stop on the SIP.js UA', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.open();
              } catch (error) {
                // Expected rejection
                assert(!test.ua.stop.calledOnce);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });

          it('does not call .disconnect on the SIP.js UA\'s .transport', async () => {
            const test = makeTest({ uaConnectSucceeds: false });
            const promise = test.when('opening', async () => {
              try {
                await test.signaling.open();
              } catch (error) {
                // Expected rejection
                assert(!test.ua.transport.disconnect.calledOnce);
                return;
              }
              throw new Error('Unexpected resolution');
            });
            try {
              await test.signaling.open();
            } catch (error) {
              // Expected rejection
              return promise;
            }
            throw new Error('Unexpected resolution');
          });
        });
      });

      context('the initial call to .start on the SIP.js UA succeeds', () => {
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

        it('does not call .start on the SIP.js UA again', () => {
          const test = makeTest();
          const promise = test.when('opening', () => {
            return test.signaling.open().then(() => {
              assert(test.ua.start.calledOnce);
            });
          });
          test.signaling.open();
          return promise;
        });
      });
    });
  });
});

function makeTest(options) {
  options = options || {};

  options.encodingParameters = options.encodingParameters || makeEncodingParameters(options);
  options.uaConnectSucceeds = 'uaConnectSucceeds' in options
    ? options.uaConnectSucceeds : true;
  options.UA = options.UA || sinon.spy(function UA() {
    const ua = new EventEmitter();
    ua.start = sinon.spy(() => {
      setImmediate(() => {
        if (options.uaConnectSucceeds) {
          ua.emit('connected');
        } else {
          ua.emit('disconnected');
        }
      });
    });
    ua.stop = sinon.spy(() => {});
    ua.transport = {
      disconnect: sinon.spy(() => {})
    };
    options.ua = ua;
    return ua;
  });

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
