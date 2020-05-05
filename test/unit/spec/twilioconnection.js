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

    this.open = () => {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent({ type: 'open' });
    };

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

describe.only('TwilioConnection', function() {
  describe('constructor', () => {
    let eventObserver;
    let twilioConnection;

    before(() => {
      eventObserver = { emit: sinon.spy() };
      twilioConnection = new TwilioConnection('foo', {
        Log: FakeLog,
        WebSocket: FakeWebSocket,
        eventObserver
      });
    });

    after(() => {
      twilioConnection.close();
    });

    it('should return an instance of TwilioConnection', () => {
      assert(twilioConnection instanceof TwilioConnection);
    });

    it('should set the .state to "early"', () => {
      assert.equal(twilioConnection.state, 'early');
    });

    it('should emit "event" on the EventObserver', () => {
      sinon.assert.calledWith(eventObserver.emit, 'event', { name: 'early' });
    });
  });

  describe('#close', () => {
    ['closed', 'connecting', 'early', 'open', ['wait', true], ['wait', false]].forEach(args => {
      const [state, keepAlive] = Array.isArray(args) ? args : [args];

      const expectedEvents = {
        closed: ['early', 'connecting', 'closed'],
        connecting: ['early', 'connecting', 'closed'],
        early: ['early', 'closed'],
        open: ['early', 'connecting', 'open'],
        wait: ['early', 'connecting', 'wait', 'closed']
      }[state];

      context(`when the TwilioConnection's .state is "${state}"${state === 'wait' ? ` with keepAlive = ${keepAlive}` : ''}`, () => {
        let closeEventError;
        let eventObserver;
        let twilioConnection;

        before(() => {
          eventObserver = { emit: sinon.spy() };

          twilioConnection = new TwilioConnection('foo', {
            Log: FakeLog,
            WebSocket: FakeWebSocket,
            eventObserver
          });

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
          } else if (state === 'wait') {
            twilioConnection._ws.receiveMessage({
              keepAlive,
              retryAfter: 100,
              type: 'busy'
            });
            twilioConnection._ws.close.resetHistory();
          }

          assert.equal(twilioConnection.state, state);

          twilioConnection.on('close', error => {
            closeEventError = error;
          });
          twilioConnection.close();
        });

        after(() => {
          twilioConnection.close();
        });

        it('should set the TwilioConnection\'s .state to "closed"', () => {
          assert.equal(twilioConnection.state, 'closed');
        });

        it(`should emit "event" for each of the following states: ${expectedEvents.join(', ')}`, () => {
          expectedEvents.forEach(name => sinon.assert.calledWith(eventObserver.emit, 'event', { name }));
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

        if (state === 'closed' || (state === 'wait' && !keepAlive)) {
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
            assert.equal(typeof closeEventError, 'undefined');
          });
        } else {
          it('should emit "close" on the TwilioConnection with a null Error', () => {
            assert.equal(closeEventError, null);
          });
        }
      });
    });
  });

  describe('#sendMessage', () => {
    ['closed', 'connecting', 'early', 'open', ['wait', true], ['wait', false]].forEach(args => {
      const [state, keepAlive] = Array.isArray(args) ? args : [args];
      context(`when the TwilioConnection's .state is "${state}"${state === 'wait' ? ` with keepAlive = ${keepAlive}` : ''}`, () => {
        const body = { foo: 'bar' };
        let twilioConnection;

        before(() => {
          twilioConnection = new TwilioConnection('foo', {
            Log: FakeLog,
            WebSocket: FakeWebSocket,
            eventObserver: { emit: () => {} }
          });

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
          } else if (state === 'wait') {
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
          wait: 'should enqueue the given "msg" body'
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
          wait: () => {
            assert.deepEqual(twilioConnection._messageQueue[0], { body, type: 'msg' });
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          }
        }[state]);
      });
    });
  });

  describe('connect', () => {
    let origSetTimeout;
    let twilioConnection;

    [{}, { helloBody: null }, { helloBody: 'bar' }].forEach(options => {
      options = Object.assign({
        maxConsecutiveFailedHellos: 3,
        maxConsecutiveMissedHeartbeats: 2,
        welcomeTimeout: 200,
        Log: FakeLog,
        WebSocket: FakeWebSocket,
        eventObserver: { emit: () => {} }
      }, options);

      context(`when TwilioConnectionOptions.helloBody ${options.helloBody ? 'exists' : options.helloBody === null ? 'is null' : 'does not exist'}`, () => {
        beforeEach(() => {
          origSetTimeout = setTimeout;
          // eslint-disable-next-line
          setTimeout = sinon.spy((...args) => origSetTimeout.apply(null, args));
          twilioConnection = new TwilioConnection('foo', options);
        });

        afterEach(() => {
          // eslint-disable-next-line
          setTimeout = origSetTimeout;
          twilioConnection.close();
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

            context('when the TwilioConnection fails to receive the allowed number of "heartbeat" messages', () => {
              let error;

              beforeEach(async () => {
                error = await new Promise(resolve => {
                  twilioConnection.once('close', error => {
                    assert.equal(twilioConnection.consecutiveHeartbeatsMissed,
                      twilioConnection._options.maxConsecutiveMissedHeartbeats);
                    resolve(error);
                  });
                });
              });

              it('should set the TwilioConnection\'s .state to "closed', () => {
                assert.equal(twilioConnection.state, 'closed');
              });

              it('should call .close on the underlying WebSocket', () => {
                sinon.assert.callCount(twilioConnection._ws.close, 1);
              });

              it('should emit "close" on the TwilioConnection with the appropriate Error', () => {
                assert(error instanceof Error);
                assert.equal(error.code, 3001);
              });
            });

            [
              { reason: 'foo', type: 'bad' },
              { type: 'heartbeat' },
              { body: { foo: 'bar' }, type: 'msg' }
            ].forEach(msg => {
              context(`when the TwilioConnection receives a "${msg.type}" message`, () => {
                let error;
                let message;

                beforeEach(() => {
                  twilioConnection.once('error', err => {
                    error = err;
                  });
                  twilioConnection.once('message', msg => {
                    message = msg;
                  });
                  twilioConnection._consecutiveHeartbeatsMissed = 1;
                  twilioConnection._ws.receiveMessage(msg);
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
                    assert.equal(twilioConnection.consecutiveHeartbeatsMissed, 0);
                  },
                  msg: () => {
                    assert.deepEqual(message, msg.body);
                  }
                }[msg.type]);
              });
            });
          });

          context('when a "bad" message is received while waiting for the "welcome" message', () => {
            let error;

            beforeEach(async () => {
              const promise = new Promise(resolve => {
                twilioConnection.once('close', resolve);
              });
              twilioConnection._ws.receiveMessage({
                reason: 'foo',
                type: 'bad'
              });
              error = await promise;
            });

            it('should set the TwilioConnection\'s .state to "closed"', () => {
              assert.equal(twilioConnection.state, 'closed');
            });

            it('should call .close on the underlying WebSocket', () => {
              sinon.assert.callCount(twilioConnection._ws.close, 1);
            });

            it('should emit "close" on the TwilioConnection with the appropriate Error', () => {
              assert(error instanceof Error);
              assert.equal(error.code, 3002);
            });
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
              let error;
              let waitArgs;
              let wsCloseCallCount;

              beforeEach(async () => {
                twilioConnection.once('wait', (...args) => {
                  waitArgs = args;
                  wsCloseCallCount = twilioConnection._ws.close.callCount;
                });
                const stateChanged = new Promise(resolve => {
                  twilioConnection.once('stateChanged', (...args) => resolve(args));
                });

                // Clear the call to setTimeout for welcome timeout.
                setTimeout.resetHistory();

                twilioConnection._ws.receiveMessage(Object.assign(cookie ? { cookie } : {}, {
                  keepAlive,
                  retryAfter,
                  type: 'busy'
                }));

                [changedState, error] = await stateChanged;
              });

              if (retryAfter < 0) {
                it('should set the TwilioConnection\'s .state to "closed"', () => {
                  assert.equal(twilioConnection.state, 'closed');
                });

                it('should not call setTimeout', () => {
                  sinon.assert.notCalled(setTimeout);
                });

                it('should call .close on the underlying WebSocket', () => {
                  sinon.assert.callCount(twilioConnection._ws.close, 1);
                });

                it('should emit "close" on the TwilioConnection with the appropriate Error', () => {
                  assert(error instanceof Error);
                  assert.equal(error.code, 3006);
                });
              } else {
                it('should set the TwilioConnection\'s .state to "wait"', () => {
                  assert.deepEqual(waitArgs, [keepAlive, retryAfter]);
                });

                it('should call setTimeout with the retryAfter value', () => {
                  assert.equal(setTimeout.args[0][1], retryAfter);
                });

                it(`should ${keepAlive ? 'not ' : ''}call .close on the underlying WebSocket`, () => {
                  assert.equal(wsCloseCallCount, keepAlive ? 0 : 1);
                });

                if (keepAlive) {
                  it(`should eventually transition to "connecting" state and send a "hello" message with the requested heartbeat timeout${cookie ? ' and the cookie' : ''}`, async () => {
                    changedState = await new Promise(resolve => twilioConnection.once('stateChanged', resolve));
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
                } else {
                  context('should eventually transition to "early" state and when a new WebSocket is opened', () => {
                    beforeEach(async () => {
                      changedState = await new Promise(resolve => twilioConnection.once('stateChanged', resolve));
                      assert.equal(changedState, 'early');
                      assert.equal(twilioConnection.state, 'early');
                      const stateChanged = new Promise(resolve => twilioConnection.once('stateChanged', resolve));
                      twilioConnection._ws.open();
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
                  });
                }
              }
            });
          });

          context('when a "welcome" message is not received within the "welcome" timeout', () => {
            context('when all handshake attempts fail', () => {
              let error;

              beforeEach(async () => {
                error = await new Promise(resolve => {
                  twilioConnection.once('close', resolve);
                });
              });

              it('should set the TwilioConnection\'s .state to "closed', () => {
                assert.equal(twilioConnection.state, 'closed');
              });

              it('should call .close on the underlying WebSocket', () => {
                sinon.assert.callCount(twilioConnection._ws.close, 1);
              });

              it('should emit "close" on the TwilioConnection with the appropriate Error', () => {
                assert(error instanceof Error);
                assert.equal(error.code, 3000);
              });
            });

            context('when one of the subsequent handshake attempts result in a "welcome" message', () => {
              const messagesToEnqueue = [{
                body: JSON.stringify({ foo: 'bar' }),
                type: 'msg'
              }, {
                body: JSON.stringify({ baz: 'zee' }),
                type: 'msg'
              }];

              beforeEach(() => {
                messagesToEnqueue.forEach(message => {
                  twilioConnection._messageQueue.push(message);
                });

                const { maxConsecutiveFailedHellos, welcomeTimeout } = options;
                setTimeout(() => {
                  twilioConnection._ws.receiveMessage({
                    negotiatedTimeout: welcomeTimeout,
                    type: 'welcome'
                  });
                }, (maxConsecutiveFailedHellos - 1) * welcomeTimeout);

                return new Promise(resolve => twilioConnection.once('open', resolve));
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
            });
          });
        });
      });
    });
  });
});
