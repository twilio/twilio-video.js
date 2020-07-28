'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fakeLog = require('../../lib/fakelog');
const { combinationContext } = require('../../lib/util');
const EventTarget = require('../../../lib/eventtarget');
const TwilioConnection = require('../../../lib/twilioconnection');

function FakeLog() {
  return fakeLog;
}

class FakeWebSocket extends EventTarget {
  constructor(arg) {
    super();
    this.readyState = FakeWebSocket.CONNECTING;
    this.url = arg;

    this.close = sinon.spy((code = 1000, reason) => {
      this.readyState = FakeWebSocket.CLOSED;
      this.dispatchEvent({ code, reason, type: 'close' });
    });

    this.open = sinon.spy(() => {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent({ type: 'open' });
    });

    this.receiveMessage = data => this.dispatchEvent({
      data: JSON.stringify(data),
      type: 'message'
    });

    this.send = sinon.spy(() => {});
  }
}

['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((readyState, i) => {
  FakeWebSocket[readyState] = i;
});

function makeTest(serverUrl, options, testOptions) {
  testOptions = testOptions || {};
  testOptions.eventObserver = testOptions.eventObserver || { emit: sinon.spy() };
  const test = testOptions || {};
  test.serverUrl = serverUrl || 'foo';

  test.options = Object.assign({
    Log: FakeLog,
    WebSocket: FakeWebSocket,
    eventObserver: testOptions.eventObserver
  }, options);

  if (testOptions.useFakeTimeout) {
    test.clock = sinon.useFakeTimers();
  }

  test.twilioConnection = new TwilioConnection(test.serverUrl, test.options);

  test.end = () => {
    if (test.clock) {
      test.clock.restore();
    }
  };

  return test;
}

describe('TwilioConnection', function() {
  let test;
  describe('constructor', () => {
    let eventObserver;
    let twilioConnection;

    before(() => {
      test = makeTest();
      twilioConnection = test.twilioConnection;
      eventObserver = test.eventObserver;
    });

    after(() => {
      twilioConnection.close();
      if (test) {
        test.end();
      }
    });

    it('should return an instance of TwilioConnection', () => {
      assert(twilioConnection instanceof TwilioConnection);
    });

    it('should set the .state to "early"', () => {
      assert.equal(twilioConnection.state, 'early');
    });

    it('should emit "event" on the EventObserver', () => {
      sinon.assert.calledWith(eventObserver.emit, 'event', { name: 'early', group: 'signaling', level: 'info' });
    });
  });

  describe('#close', () => {
    ['closed', 'connecting', 'early', 'open', ['waiting', true], ['waiting', false]].forEach(args => {
      const [state, keepAlive] = Array.isArray(args) ? args : [args];

      const expectedEvents = {
        closed: [
          { name: 'early', group: 'signaling', level: 'info' },
          { name: 'connecting', group: 'signaling', level: 'info' },
          { name: 'closed', group: 'signaling', level: 'info', payload: { reason: 'local' } }
        ],
        connecting: [
          { name: 'early', group: 'signaling', level: 'info' },
          { name: 'connecting', group: 'signaling', level: 'info' },
          { name: 'closed', group: 'signaling', level: 'info', payload: { reason: 'local' } }
        ],
        early: [
          { name: 'early', group: 'signaling', level: 'info' },
          { name: 'closed', group: 'signaling', level: 'info', payload: { reason: 'local' } }
        ],
        open: [
          { name: 'early', group: 'signaling', level: 'info' },
          { name: 'connecting', group: 'signaling', level: 'info' },
          { name: 'open', group: 'signaling', level: 'info' },
          { name: 'closed', group: 'signaling', level: 'info', payload: { reason: 'local' } }
        ],
        waiting: [
          { name: 'early', group: 'signaling', level: 'info' },
          { name: 'connecting', group: 'signaling', level: 'info' },
          { name: 'waiting', group: 'signaling', level: 'warning' },
          { name: 'closed', group: 'signaling', level: 'info', payload: { reason: 'local' } }
        ]
      }[state];

      context(`when the TwilioConnection's .state is "${state}"${state === 'waiting' ? ` with keepAlive = ${keepAlive}` : ''}`, () => {
        let closeEventReason;
        let eventObserver;
        let twilioConnection;

        before(() => {
          test = makeTest();
          twilioConnection = test.twilioConnection;
          eventObserver = test.eventObserver;
          if (state !== 'early') {
            twilioConnection._ws.open();
            twilioConnection._ws.send.resetHistory();
          }
          if (state === 'closed') {
            twilioConnection.close();
            twilioConnection._ws.close.resetHistory();
          } else if (state === 'open') {
            twilioConnection._ws.receiveMessage({
              negotiatedTimeout: 100,
              type: 'welcome'
            });
          } else if (state === 'waiting') {
            twilioConnection._ws.receiveMessage({
              keepAlive,
              retryAfter: 100,
              type: 'busy'
            });
            twilioConnection._ws.close.resetHistory();
          }

          assert.equal(twilioConnection.state, state);

          twilioConnection.on('close', reason => {
            closeEventReason = reason;
          });
          twilioConnection.close();
        });

        after(() => {
          twilioConnection.close();
        });

        it('should set the TwilioConnection\'s .state to "closed"', () => {
          assert.equal(twilioConnection.state, 'closed');
        });

        if (state === 'open') {
          it('should send a "bye" message using the underlying WebSocket', () => {
            sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify({ type: 'bye' }));
          });
        } else {
          it('should not send a "bye" message using the underlying WebSocket', () => {
            sinon.assert.notCalled(twilioConnection._ws.send);
          });
        }

        if (state === 'closed' || (state === 'waiting' && !keepAlive)) {
          it('should not call .close on the underlying WebSocket', () => {
            sinon.assert.callCount(twilioConnection._ws.close, 0);
          });
        } else {
          it('should call .close on the underlying WebSocket', () => {
            sinon.assert.callCount(twilioConnection._ws.close, 1);
          });
        }

        if (state === 'closed') {
          it('should not emit "close" on the TwilioConnection', () => {
            assert.equal(typeof closeEventReason, 'undefined');
          });
        } else {
          it('should emit "close" on the TwilioConnection with a "local" CloseReason', () => {
            assert.equal(closeEventReason, 'local');
          });
        }

        testEventObserverEvents(() => eventObserver, expectedEvents);
      });
    });
  });

  describe('#sendMessage', () => {
    ['closed', 'connecting', 'early', 'open', ['waiting', true], ['waiting', false]].forEach(args => {
      const [state, keepAlive] = Array.isArray(args) ? args : [args];
      context(`when the TwilioConnection's .state is "${state}"${state === 'waiting' ? ` with keepAlive = ${keepAlive}` : ''}`, () => {
        const body = { foo: 'bar' };
        let twilioConnection;

        before(() => {
          test = makeTest();
          twilioConnection = test.twilioConnection;
          twilioConnection._ws.send.resetHistory();

          if (state !== 'early') {
            twilioConnection._ws.open();
            twilioConnection._ws.send.resetHistory();
          }

          if (state === 'closed') {
            twilioConnection.close();
          } else if (state === 'open') {
            twilioConnection._ws.receiveMessage({
              negotiatedTimeout: 100,
              type: 'welcome'
            });
          } else if (state === 'waiting') {
            twilioConnection._ws.receiveMessage({
              keepAlive,
              retryAfter: 100,
              type: 'busy'
            });
          }
          assert.equal(twilioConnection.state, state);
          twilioConnection.sendMessage(body);
        });

        after(() => {
          twilioConnection.close();
        });

        it({
          closed: 'should do nothing',
          connecting: 'should enqueue the given "msg" body',
          early: 'should enqueue the given "msg" body',
          open: 'should send a "msg" with the given body',
          waiting: 'should enqueue the given "msg" body'
        }[state], {
          closed: () => {
            assert.equal(twilioConnection._messageQueue.length, 0);
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          },
          connecting: () => {
            assert.deepEqual(twilioConnection._messageQueue[0], { body, type: 'msg' });
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          },
          early: () => {
            assert.deepEqual(twilioConnection._messageQueue[0], { body, type: 'msg' });
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          },
          open: () => {
            assert.equal(twilioConnection._messageQueue.length, 0);
            sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify({ body, type: 'msg' }));
          },
          waiting: () => {
            assert.deepEqual(twilioConnection._messageQueue[0], { body, type: 'msg' });
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          }
        }[state]);
      });
    });
  });

  describe('connect', () => {
    let eventObserver;
    let twilioConnection;
    [{}, { helloBody: null }, { helloBody: 'bar' }].forEach(options => {
      options = Object.assign({
        maxConsecutiveFailedHellos: 3,
        maxConsecutiveMissedHeartbeats: 2,
        welcomeTimeout: 200,
      }, options);

      context(`when TwilioConnectionOptions.helloBody ${options.helloBody ? 'exists' : options.helloBody === null ? 'is null' : 'does not exist'}`, () => {
        beforeEach(() => {
          test = makeTest('foo', options, { useFakeTimeout: true });
          eventObserver = test.eventObserver;
          twilioConnection = test.twilioConnection;
        });

        afterEach(() => {
          twilioConnection.close();
          test.end();
        });

        context('when the WebSocket fails to open in 15 seconds, closes it and transitions to .state "closed", and', () => {
          beforeEach(() => {
            sinon.assert.callCount(twilioConnection._ws.close, 0);

            // simulate 10 seconds have passed
            test.clock.tick(10000);

            // it should not close the socket yet.
            sinon.assert.callCount(twilioConnection._ws.close, 0);

            // simulate 5 more seconds have passed
            test.clock.tick(5000);

            // now we expect socket to have closed.
            sinon.assert.callCount(twilioConnection._ws.close, 1);

            // transitions to closed state.
            assert.equal(twilioConnection.state, 'closed');
          });

          testEventObserverEvents(() => eventObserver, [
            { name: 'early', group: 'signaling', level: 'info' },
            { name: 'closed', group: 'signaling', level: 'error', payload: { reason: 'timeout' } }
          ]);
        });

        context('when the underlying WebSocket is "open"', () => {
          beforeEach(() => {
            twilioConnection._ws.open();
          });

          it('should transition to "connecting" state and send a "hello" message with the requested heartbeat timeout', () => {
            assert.equal(twilioConnection.state, 'connecting');
            const hello = JSON.parse(twilioConnection._ws.send.args[0][0]);
            assert.equal(typeof hello.id, 'string');
            assert.equal(hello.timeout, twilioConnection._options.requestedHeartbeatTimeout);
            assert.equal(hello.type, 'hello');
            assert.equal(hello.version, 2);
            assert.equal('cookie' in hello, false);
            if (options.helloBody) {
              assert.equal(hello.body, options.helloBody);
            } else {
              assert.equal('body' in hello, false);
            }
          });

          testEventObserverEvents(() => eventObserver, [
            { name: 'early', group: 'signaling', level: 'info' },
            { name: 'connecting', group: 'signaling', level: 'info' }
          ]);

          context('when a "welcome" message is received within the "welcome" timeout', () => {
            const messagesToEnqueue = [{
              body: JSON.stringify({ foo: 'bar' }),
              type: 'msg'
            }, {
              body: JSON.stringify({ baz: 'zee' }),
              type: 'msg'
            }];

            const negotiatedTimeout = 100;
            let openEmitted;

            beforeEach(() => {
              messagesToEnqueue.forEach(message => {
                twilioConnection._messageQueue.push(message);
              });

              twilioConnection.once('open', () => {
                openEmitted = true;
              });

              twilioConnection._ws.receiveMessage({
                negotiatedTimeout,
                type: 'welcome'
              });
              assert.equal(twilioConnection._messageQueue.length, 0);
            });

            it('should send any enqueued messages using the underlying WebSocket', () => {
              messagesToEnqueue.forEach(message => {
                sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify(message));
              });
              assert.equal(twilioConnection._messageQueue.length, 0);
            });

            it('should set the TwilioConnection\'s .state to "open"', () => {
              assert.equal(twilioConnection.state, 'open');
            });

            it('should emit "open" on the TwilioConnection', () => {
              assert(openEmitted);
            });

            testEventObserverEvents(() => eventObserver, [
              { name: 'early', group: 'signaling', level: 'info' },
              { name: 'connecting', group: 'signaling', level: 'info' },
              { name: 'open', group: 'signaling', level: 'info' }
            ]);

            context('when the TwilioConnection fails to receive any "heartbeat" messages', () => {
              let closeReason;

              beforeEach(async () => {
                const closeReasonPromise = new Promise(resolve => {
                  twilioConnection.once('close', resolve);
                });
                test.clock.tick(30000);
                closeReason = await closeReasonPromise;
              });

              it('should set the TwilioConnection\'s .state to "closed', () => {
                assert.equal(twilioConnection.state, 'closed');
              });

              it('should call .close on the underlying WebSocket', () => {
                sinon.assert.callCount(twilioConnection._ws.close, 1);
              });

              it('should emit "close" on the TwilioConnection with the "timeout" CloseReason', () => {
                assert.equal(closeReason, 'timeout');
              });

              testEventObserverEvents(() => eventObserver, [
                { name: 'early', group: 'signaling', level: 'info' },
                { name: 'connecting', group: 'signaling', level: 'info' },
                { name: 'open', group: 'signaling', level: 'info' },
                { name: 'closed', group: 'signaling', level: 'error', payload: { reason: 'timeout' } }
              ]);
            });

            [
              { reason: 'foo', type: 'bad' },
              { type: 'heartbeat' },
              { body: { foo: 'bar' }, type: 'msg' }
            ].forEach(msg => {
              context(`when the TwilioConnection receives a "${msg.type}" message`, () => {
                let error;
                let message;
                let clearTimeoutSpy;
                let setTimeoutSpy;

                beforeEach(() => {
                  twilioConnection.once('error', err => {
                    error = err;
                  });
                  twilioConnection.once('message', msg => {
                    message = msg;
                  });
                  twilioConnection._consecutiveHeartbeatsMissed = 1;
                  clearTimeoutSpy = sinon.spy(test.clock, 'clearTimeout');
                  setTimeoutSpy = sinon.spy(test.clock, 'setTimeout');
                  sinon.assert.callCount(clearTimeoutSpy, 0);
                  sinon.assert.callCount(setTimeoutSpy, 0);
                  twilioConnection._ws.receiveMessage(msg);
                });
                afterEach(() => test.end());

                it('should reset the heartbeat timer for msg or heartbeat', () => {
                  if (msg.type === 'heartbeat' || msg.type === 'msg') {
                    sinon.assert.callCount(clearTimeoutSpy, 1);
                    sinon.assert.callCount(setTimeoutSpy, 1);
                  }
                });

                it({
                  bad: 'should emit "error" on the TwilioConnection',
                  heartbeat: 'should reset the missed heartbeat messages count',
                  msg: 'should emit "message" on the TwilioConnection'
                }[msg.type], {
                  bad: () => {
                    assert(error instanceof Error);
                    assert.equal(error.message, msg.reason);
                  },
                  heartbeat: () => {
                    // should not emit the message or error
                    assert.equal(message, undefined);
                    assert.equal(error, undefined);
                  },
                  msg: () => {
                    assert.deepEqual(message, msg.body);
                  }
                }[msg.type]);
              });
            });
          });

          context('when a "bad" message is received while waiting for the "welcome" message', () => {
            let closeReason;

            beforeEach(async () => {
              const promise = new Promise(resolve => {
                twilioConnection.once('close', resolve);
              });
              twilioConnection._ws.receiveMessage({
                reason: 'foo',
                type: 'bad'
              });
              test.clock.tick(30000);
              closeReason = await promise;
            });
            afterEach(() => test.end());

            it('should set the TwilioConnection\'s .state to "closed"', () => {
              assert.equal(twilioConnection.state, 'closed');
            });

            it('should call .close on the underlying WebSocket', () => {
              sinon.assert.callCount(twilioConnection._ws.close, 1);
            });

            it('should emit "close" on the TwilioConnection with the "failed" CloseReason', () => {
              assert.equal(closeReason, 'failed');
            });

            testEventObserverEvents(() => eventObserver, [
              { name: 'early', group: 'signaling', level: 'info' },
              { name: 'connecting', group: 'signaling', level: 'info' },
              { name: 'closed', group: 'signaling', level: 'error', payload: { reason: 'failed' } }
            ]);
          });

          context('when a "busy" message is received while waiting for the "welcome" message', () => {
            combinationContext([
              [
                [true, false],
                x => `.keepAlive = ${x}`
              ],
              [
                [100, -1],
                x => `.retryAfter ${x < 0 ? '<' : '>='} 0`
              ],
              [
                ['foo', undefined],
                x => `.cookie ${x ? 'exists' : 'does not exist'}`
              ]
            ], ([keepAlive, retryAfter, cookie]) => {
              let changedState;
              let closeReason;
              let waitingArgs;
              let wsCloseCallCount;
              let setTimeoutSpy;

              beforeEach(async () => {
                twilioConnection.once('waiting', (...args) => {
                  waitingArgs = args;
                  wsCloseCallCount = twilioConnection._ws.close.callCount;
                });
                const stateChanged = new Promise(resolve => {
                  twilioConnection.once('stateChanged', (...args) => resolve(args));
                });

                // Clear the call to setTimeout for welcome timeout.
                setTimeoutSpy = sinon.spy(test.clock, 'setTimeout');

                twilioConnection._ws.receiveMessage(Object.assign(cookie ? { cookie } : {}, {
                  keepAlive,
                  retryAfter,
                  type: 'busy'
                }));

                test.clock.tick(1);
                [changedState, closeReason] = await stateChanged;
              });

              if (retryAfter < 0) {
                it('should set the TwilioConnection\'s .state to "closed"', () => {
                  assert.equal(twilioConnection.state, 'closed');
                });

                it('should not call setTimeout', () => {
                  sinon.assert.notCalled(setTimeoutSpy);
                });

                it('should call .close on the underlying WebSocket', () => {
                  sinon.assert.callCount(twilioConnection._ws.close, 1);
                });

                it('should emit "close" on the TwilioConnection with the "busy" CloseReason', () => {
                  assert.equal(closeReason, 'busy');
                });

                testEventObserverEvents(() => eventObserver, [
                  { name: 'early', group: 'signaling', level: 'info' },
                  { name: 'connecting', group: 'signaling', level: 'info' },
                  { name: 'closed', group: 'signaling', level: 'error', payload: { reason: 'busy' } }
                ]);
              } else {
                it('should set the TwilioConnection\'s .state to "waiting"', () => {
                  assert.deepEqual(waitingArgs, [keepAlive, retryAfter]);
                });

                it('should call setTimeout with the retryAfter value', () => {
                  assert.equal(setTimeoutSpy.args[0][1], retryAfter);
                });

                it(`should ${keepAlive ? 'not ' : ''}call .close on the underlying WebSocket`, () => {
                  assert.equal(wsCloseCallCount, keepAlive ? 0 : 1);
                });

                testEventObserverEvents(() => eventObserver, [
                  { name: 'early', group: 'signaling', level: 'info' },
                  { name: 'connecting', group: 'signaling', level: 'info' },
                  { name: 'waiting', group: 'signaling', level: 'warning' }
                ]);

                if (keepAlive) {
                  context('when a "welcome" message is received within the retryAfter period', () => {
                    const messagesToEnqueue = [{
                      body: JSON.stringify({ foo: 'bar' }),
                      type: 'msg'
                    }, {
                      body: JSON.stringify({ baz: 'zee' }),
                      type: 'msg'
                    }];

                    const negotiatedTimeout = 100;
                    let openEmitted;

                    beforeEach(() => {
                      messagesToEnqueue.forEach(message => {
                        twilioConnection._messageQueue.push(message);
                      });

                      twilioConnection.once('open', () => {
                        openEmitted = true;
                      });

                      twilioConnection._ws.receiveMessage({
                        negotiatedTimeout,
                        type: 'welcome'
                      });
                      assert.equal(twilioConnection._messageQueue.length, 0);
                    });

                    it('should send any enqueued messages using the underlying WebSocket', () => {
                      messagesToEnqueue.forEach(message => {
                        sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify(message));
                      });
                      assert.equal(twilioConnection._messageQueue.length, 0);
                    });

                    it('should set the TwilioConnection\'s .state to "open"', () => {
                      assert.equal(twilioConnection.state, 'open');
                    });

                    it('should emit "open" on the TwilioConnection', () => {
                      assert(openEmitted);
                    });

                    testEventObserverEvents(() => eventObserver, [
                      { name: 'early', group: 'signaling', level: 'info' },
                      { name: 'connecting', group: 'signaling', level: 'info' },
                      { name: 'waiting', group: 'signaling', level: 'warning' },
                      { name: 'open', group: 'signaling', level: 'info' }
                    ]);
                  });

                  context('when a "welcome" message is not received within the retryAfter period, should transition to "connecting" state and', () => {
                    beforeEach(async () => {
                      const changedStatePromise = new Promise(resolve => twilioConnection.once('stateChanged', resolve));
                      test.clock.tick(retryAfter + 1);
                      changedState = await changedStatePromise;
                    });

                    it(`should send a "hello" message with the requested heartbeat timeout${cookie ? ' and the cookie' : ''}`, () => {
                      assert.equal(changedState, 'connecting');
                      assert.equal(twilioConnection.state, 'connecting');
                      const hello = JSON.parse(twilioConnection._ws.send.args[1][0]);
                      assert.equal(typeof hello.id, 'string');
                      assert.equal(hello.timeout, twilioConnection._options.requestedHeartbeatTimeout);
                      assert.equal(hello.type, 'hello');
                      assert.equal(hello.version, 2);
                      if (cookie) {
                        assert.equal(hello.cookie, cookie);
                      } else {
                        assert(!('cookie' in hello));
                      }
                      if (options.helloBody) {
                        assert.equal(hello.body, options.helloBody);
                      } else {
                        assert.equal('body' in hello, false);
                      }
                    });

                    testEventObserverEvents(() => eventObserver, [
                      { name: 'early', group: 'signaling', level: 'info' },
                      { name: 'connecting', group: 'signaling', level: 'info' },
                      { name: 'waiting', group: 'signaling', level: 'warning' },
                      { name: 'connecting', group: 'signaling', level: 'info' }
                    ]);
                  });
                } else {
                  context('should eventually transition to "early" state and when a new WebSocket is opened', () => {
                    beforeEach(async () => {
                      const changedStatePromise = new Promise(resolve => twilioConnection.once('stateChanged', resolve));
                      test.clock.tick(retryAfter + 1);
                      changedState = await changedStatePromise;
                      assert.equal(changedState, 'early');
                      assert.equal(twilioConnection.state, 'early');
                      const stateChanged = new Promise(resolve => twilioConnection.once('stateChanged', resolve));
                      twilioConnection._ws.open();
                      test.clock.tick(1);
                      changedState = await stateChanged;
                    });

                    it(`should eventually transition to "connecting" state and send a "hello" message with the requested heartbeat timeout${cookie ? ' and the cookie' : ''}`, () => {
                      assert.equal(changedState, 'connecting');
                      assert.equal(twilioConnection.state, 'connecting');
                      const hello = JSON.parse(twilioConnection._ws.send.args[0][0]);
                      assert.equal(typeof hello.id, 'string');
                      assert.equal(hello.timeout, twilioConnection._options.requestedHeartbeatTimeout);
                      assert.equal(hello.type, 'hello');
                      assert.equal(hello.version, 2);
                      if (cookie) {
                        assert.equal(hello.cookie, cookie);
                      } else {
                        assert(!('cookie' in hello));
                      }
                      if (options.helloBody) {
                        assert.equal(hello.body, options.helloBody);
                      } else {
                        assert.equal('body' in hello, false);
                      }
                    });

                    testEventObserverEvents(() => eventObserver, [
                      { name: 'early', group: 'signaling', level: 'info' },
                      { name: 'connecting', group: 'signaling', level: 'info' },
                      { name: 'waiting', group: 'signaling', level: 'warning' },
                      { name: 'early', group: 'signaling', level: 'info' },
                      { name: 'connecting', group: 'signaling', level: 'info' }
                    ]);
                  });
                }
              }
            });
          });

          context('when a "welcome" message is not received within the "welcome" timeout', () => {
            context('when all handshake attempts fail', () => {
              let closeReason;

              beforeEach(async () => {
                const closePromise = new Promise(resolve => {
                  twilioConnection.once('close', resolve);
                });
                test.clock.tick(40000);
                closeReason = await closePromise;
              });

              it('should set the TwilioConnection\'s .state to "closed', () => {
                assert.equal(twilioConnection.state, 'closed');
              });

              it('should call .close on the underlying WebSocket', () => {
                sinon.assert.callCount(twilioConnection._ws.close, 1);
              });

              it('should emit "close" on the TwilioConnection with the "timeout" CloseReason', () => {
                assert.equal(closeReason, 'timeout');
              });

              testEventObserverEvents(() => eventObserver, [
                { name: 'early', group: 'signaling', level: 'info' },
                { name: 'connecting', group: 'signaling', level: 'info' },
                { name: 'closed', group: 'signaling', level: 'error', payload: { reason: 'timeout' } }
              ]);
            });

            context('when one of the subsequent handshake attempts result in a "welcome" message', () => {
              const messagesToEnqueue = [{
                body: JSON.stringify({ foo: 'bar' }),
                type: 'msg'
              }, {
                body: JSON.stringify({ baz: 'zee' }),
                type: 'msg'
              }];

              beforeEach(async () => {
                messagesToEnqueue.forEach(message => {
                  twilioConnection._messageQueue.push(message);
                });

                const { maxConsecutiveFailedHellos, welcomeTimeout } = options;
                const openPromise = new Promise(resolve => twilioConnection.once('open', resolve));

                test.clock.tick((maxConsecutiveFailedHellos - 1) * welcomeTimeout);

                twilioConnection._ws.receiveMessage({
                  negotiatedTimeout: welcomeTimeout,
                  type: 'welcome'
                });

                test.clock.tick(1);
                await openPromise;
              });

              it('should send any enqueued messages using the underlying WebSocket', () => {
                messagesToEnqueue.forEach(message => {
                  sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify(message));
                });
                assert.equal(twilioConnection._messageQueue.length, 0);
              });

              it('should set the TwilioConnection\'s .state to "open"', () => {
                assert.equal(twilioConnection.state, 'open');
              });

              testEventObserverEvents(() => eventObserver, [
                { name: 'early', group: 'signaling', level: 'info' },
                { name: 'connecting', group: 'signaling', level: 'info' },
                { name: 'open', group: 'signaling', level: 'info' }
              ]);
            });
          });
        });
      });
    });
  });
});

function testEventObserverEvents(getEventObserver, events) {
  const expectedEventNames = events.map(({ name, payload }) =>
    `"${name}${name === 'closed' ? ` (${payload.reason})` : ''}"`).join(', ');

  it(`should emit the following events on the EventObserver: ${expectedEventNames}`, () => {
    const eventObserver = getEventObserver();
    assert.equal(events.length, eventObserver.emit.callCount);
    events.forEach((event, i) => {
      const [name, evt] = eventObserver.emit.args[i];
      assert.equal(name, 'event');
      assert.deepEqual(evt, event);
    });
  });
}
