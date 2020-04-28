'use strict';

const assert = require('assert');
const sinon = require('sinon');
const fakeLog = require('../../lib/fakelog');
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
  const test = testOptions || {};
  test.serverUrl = serverUrl || 'foo';
  test.options = Object.assign({
    Log: FakeLog,
    WebSocket: FakeWebSocket
  }, options);

  if (testOptions.useFakeTimeout) {
    test.clock = sinon.useFakeTimers();
  }

  test.twilioConnection = new TwilioConnection(test.serverUrl, test.options);

  test.end = () => {
    test.clock.restore();
  };

  return test;
}


describe('TwilioConnection', function() {
  describe('constructor', () => {
    let twilioConnection;

    before(() => {
      twilioConnection = makeTest().twilioConnection;
    });

    it('should return an instance of TwilioConnection', () => {
      assert(twilioConnection instanceof TwilioConnection);
    });

    it('should set the .state to "connecting"', () => {
      assert.equal(twilioConnection.state, 'connecting');
    });
  });

  describe('#close', () => {
    ['closed', 'connecting', 'open'].forEach(state => {
      context(`when the TwilioConnection's .state is "${state}"`, () => {
        let twilioConnection;
        let closeEventError;

        before(() => {
          twilioConnection = makeTest().twilioConnection;
          twilioConnection._ws.open();

          if (state === 'closed') {
            twilioConnection.close();
            twilioConnection._ws.close.resetHistory();
          } else if (state === 'open') {
            twilioConnection._ws.receiveMessage({
              negotiatedTimeout: 100,
              type: 'welcome'
            });
          }
          assert.equal(twilioConnection.state, state);

          twilioConnection.on('close', error => {
            closeEventError = error;
          });
          twilioConnection.close();
        });

        it('should set the TwilioConnection\'s .state to "closed"', () => {
          assert.equal(twilioConnection.state, 'closed');
        });

        if (state === 'closed') {
          it('should not call .close on the underlying WebSocket', () => {
            sinon.assert.callCount(twilioConnection._ws.close, 0);
          });

          it('should not emit "close" on the TwilioConnection', () => {
            assert.equal(typeof closeEventError, 'undefined');
          });
          return;
        }

        if (state === 'open') {
          it('should send a "bye" message using the underlying WebSocket', () => {
            sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify({ type: 'bye' }));
          });
        }

        it('should call .close on the underlying WebSocket', () => {
          sinon.assert.callCount(twilioConnection._ws.close, 1);
        });

        it('should emit "close" on the TwilioConnection with a null Error', () => {
          assert.equal(closeEventError, null);
        });
      });
    });
  });

  describe('#sendMessage', () => {
    ['closed', 'connecting', 'open'].forEach(state => {
      context(`when the TwilioConnection's .state is "${state}"`, () => {
        const body = { foo: 'bar' };
        let twilioConnection;

        before(() => {
          twilioConnection = makeTest().twilioConnection;
          twilioConnection._ws.open();
          twilioConnection._ws.send.resetHistory();

          if (state === 'closed') {
            twilioConnection.close();
          } else if (state === 'open') {
            twilioConnection._ws.receiveMessage({
              negotiatedTimeout: 100,
              type: 'welcome'
            });
          }
          assert.equal(twilioConnection.state, state);
          twilioConnection.sendMessage(body);
        });

        it({
          closed: 'should do nothing',
          connecting: 'should enqueue the given "msg" body',
          open: 'should send a "msg" with the given body'
        }[state], {
          closed: () => {
            assert.equal(twilioConnection._messageQueue.length, 0);
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          },
          connecting: () => {
            assert.deepEqual(twilioConnection._messageQueue[0], { body, type: 'msg' });
            sinon.assert.callCount(twilioConnection._ws.send, 0);
          },
          open: () => {
            assert.equal(twilioConnection._messageQueue.length, 0);
            sinon.assert.calledWith(twilioConnection._ws.send, JSON.stringify({ body, type: 'msg' }));
          }
        }[state]);
      });
    });
  });

  describe('connect', () => {
    context('when websocket fails to open in 15 seconds', () => {
      let test;
      let twilioConnection;
      beforeEach(() => {
        test = makeTest('foo', {}, { useFakeTimeout: true });
        twilioConnection = test.twilioConnection;
      });

      afterEach(() => {
        test.end();
      });

      it('closes the socket if it fails to open in 15 seconds', () => {
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
    });

    context('when the underlying WebSocket is "open"', () => {
      let test;
      let twilioConnection;
      beforeEach(() => {
        test = makeTest('foo', {
          maxConsecutiveMissedHeartbeats: 2,
          welcomeTimeout: 500
        });
        twilioConnection = test.twilioConnection;
        twilioConnection._ws.open();
      });

      it('should send a "hello" message with requested heartbeat timeout value of 5000 ms ', () => {
        const hello = JSON.parse(twilioConnection._ws.send.args[0][0]);
        assert.equal(typeof hello.id, 'string');
        assert.equal(hello.timeout, 5000);
        assert.equal(hello.type, 'hello');
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

        context('when the TwilioConnection fails to receive any "heartbeat" messages', () => {
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
            assert(/^WebSocket Error 3001/.test(error.message));
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
            let clearTimeoutSpy;
            let setTimeoutSpy;

            beforeEach(() => {
              twilioConnection.once('error', err => {
                error = err;
              });
              twilioConnection.once('message', msg => {
                message = msg;
              });
              test.clock = sinon.useFakeTimers();
              clearTimeoutSpy = sinon.spy(test.clock, 'clearTimeout');
              setTimeoutSpy = sinon.spy(test.clock, 'setTimeout');
              sinon.assert.callCount(clearTimeoutSpy, 0);
              sinon.assert.callCount(setTimeoutSpy, 0);
              twilioConnection._ws.receiveMessage(msg);
            });
            afterEach(() => test.end());

            it('should reset the heartbeat timer', () => {
              sinon.assert.callCount(clearTimeoutSpy, 1);
              sinon.assert.callCount(setTimeoutSpy, 1);
            });

            it({
              bad: 'should emit "error" on the TwilioConnection',
              heartbeat: 'should reset the missed heartbeat messages count',
              msg: 'should emit "message" on the TwilioConnection, and reset heartbeat messages count'
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

        it('should set the TwilioConnection\'s .state to "closed', () => {
          assert.equal(twilioConnection.state, 'closed');
        });

        it('should call .close on the underlying WebSocket', () => {
          sinon.assert.callCount(twilioConnection._ws.close, 1);
        });

        it('should emit "close" on the TwilioConnection with the appropriate Error', () => {
          assert(error instanceof Error);
          assert(/^WebSocket Error 3002/.test(error.message));
        });
      });

      context('when a "welcome" message is not received within the "welcome" timeout', () => {
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
          assert(/^WebSocket Error 3000/.test(error.message));
        });
      });
    });
  });
});
