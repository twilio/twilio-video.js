/* eslint-disable require-atomic-updates */
/* eslint-disable no-prototype-builtins */
'use strict';

const assert = require('assert');
const sinon = require('sinon');

const EventTarget = require('../../../../lib/eventtarget');
const { defer } = require('../../../../lib/util');
const InsightsPublisher = require('../../../../lib/util/insightspublisher');
const browserdetection = require('../../../../lib/util/browserdetection');

let fakeWebSocketConstructed = 0;
let socketCreationDeferred = null;
class FakeWebSocket extends EventTarget {
  constructor(arg) {
    fakeWebSocketConstructed++;
    socketCreationDeferred.resolve();
    super();

    this.readyState = FakeWebSocket.OPEN;
    this.close = sinon.spy(() => {});
    this.send = sinon.spy(() => {});

    if (typeof arg === 'function') {
      arg.apply(this, [].slice.call(arguments, 1));
    }
  }
}

['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach((readyState, i) => {
  FakeWebSocket[readyState] = i;
});

describe('InsightsPublisher', () => {
  let publisher;
  beforeEach(() => {
    socketCreationDeferred = defer();
    publisher = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', {
      WebSocket: FakeWebSocket
    });
  });

  describe('constructor', () => {
    context('when called with the "new" keyword', () => {
      it('should return an instance of InsightsPublisher', () => {
        assert(publisher instanceof InsightsPublisher);
      });

      it('does not construct an WebSocket', () => {
        assert(fakeWebSocketConstructed === 0);
      });
    });
  });

  describe('connect', () => {
    it('should result in web socket being created', async () => {
      assert(fakeWebSocketConstructed === 0);
      publisher.connect('roomSid', 'participantSid');
      await socketCreationDeferred.promise;
      assert(fakeWebSocketConstructed === 1);
    });
  });

  describe('#disconnect', () => {
    beforeEach(async () => {
      publisher.connect('roomSid', 'participantSid');
      await socketCreationDeferred.promise;
    });

    ['CLOSING', 'CLOSED'].forEach(readyState => {
      context(`when the underlying WebSocket is ${readyState}`, () => {
        it('should return false', () => {
          publisher._ws.readyState = FakeWebSocket[readyState];
          assert(!publisher.disconnect());
        });
      });
    });

    ['CONNECTING', 'OPEN'].forEach(readyState => {
      context(`when the underlying WebSocket is ${readyState}`, () => {
        beforeEach(() => {
          publisher._ws.readyState = FakeWebSocket[readyState];
        });

        it('should return true', () => {
          assert(publisher.disconnect());
        });

        it('should call .close() the underlying WebSocket', () => {
          publisher.disconnect();
          assert(publisher._ws.close.calledOnce);
        });

        it('should emit "disconnected" without any Error', async () => {
          const error = await new Promise(resolve => {
            publisher.once('disconnected', resolve);
            publisher.disconnect();
          });
          assert(!error);
        });
      });
    });
  });

  describe('#publish', () => {
    beforeEach(async () => {
      publisher = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', {
        WebSocket: FakeWebSocket
      });
      publisher.connect('roomSid', 'participantSid');
      await socketCreationDeferred.promise;
    });

    it('should return false if the underlying WebSocket is CLOSING or CLOSED', () => {
      publisher._ws.readyState = FakeWebSocket.CLOSING;
      assert(!publisher.publish('foo', 'bar', { baz: 1 }));
      publisher._ws.readyState = FakeWebSocket.CLOSED;
      assert(!publisher.publish('foo', 'bar', { baz: 1 }));
    });

    context('when the ._session of the InsightsPublisher is null', () => {
      ['CONNECTING', 'OPEN'].forEach(readyState => {
        const contextDesc = `when the underlying WebSocket is ${readyState}`;
        context(contextDesc, () => {
          let payload;
          let ret;

          beforeEach(() => {
            payload = { baz: 1 };
            publisher._ws.readyState = FakeWebSocket[readyState];
            ret = publisher.publish('foo', 'bar', payload);
          });

          it('should enqueue the given payload', () => {
            assert.equal(publisher._eventQueue.length, 1);
            assert.deepEqual(publisher._eventQueue[0].payload, payload);
            assert(!publisher._ws.send.calledOnce);
          });

          it('event should have version, type, group, name, timestamp', () => {
            const event = publisher._eventQueue[0];
            assert(event.hasOwnProperty('version'));
            assert(event.hasOwnProperty('timestamp'));
            assert.equal(event.type, 'event');
            assert.equal(event.group, 'foo');
            assert.equal(event.name, 'bar');
          });

          it('should return true', () => {
            assert(ret);
          });

          afterEach(() => {
            ret = null;
          });
        });
      });
    });

    context('when the ._session of the InsightsPublisher is not null', () => {
      let payload;
      let ret;

      beforeEach(() => {
        payload = { baz: 1 };
        publisher._session = 'xyz';
        publisher._ws.readyState = FakeWebSocket.OPEN;
        ret = publisher.publish('foo', 'bar', payload);
      });

      it('should call .send() on the underlying WebSocket with the given payload', () => {
        const event = JSON.parse(publisher._ws.send.args[0][0]);
        assert.equal(publisher._eventQueue.length, 0);
        assert.deepEqual(event.payload, payload);
      });

      it('published event should have version, type, group, name, timestamp, session', () => {
        const event = JSON.parse(publisher._ws.send.args[0][0]);
        assert(event.hasOwnProperty('version'));
        assert(event.hasOwnProperty('timestamp'));
        assert.equal(event.type, 'event');
        assert.equal(event.group, 'foo');
        assert.equal(event.name, 'bar');
        assert.equal(event.session, publisher._session);
      });

      it('should return true', () => {
        assert(ret);
      });

      afterEach(() => {
        ret = null;
      });
    });
  });

  describe('connect/reconnect', () => {
    context('when the WebSocket gateway is specified in the options', () => {
      it('should call the WebSocket constructor with the provided gateway', async () => {
        let wsUrl;
        const options = {
          gateway: 'somegateway',
          WebSocket: customizedWebSocket(FakeWebSocket, url => {
            wsUrl = url;
          })
        };
        const pub = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', options);
        pub.connect('roomSid', 'partcipantSid');
        await socketCreationDeferred.promise;
        assert.equal(wsUrl, 'somegateway');
      });
    });

    context('when the WebSocket gateway is not specified in the options', () => {
      it('should call the WebSocket constructor with the gateway created from environment and realm', async () => {
        let wsUrl;
        const options = {
          WebSocket: customizedWebSocket(FakeWebSocket, url => {
            wsUrl = url;
          })
        };
        const pub = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', options);
        pub.connect('roomSid', 'partcipantSid');
        await socketCreationDeferred.promise;
        assert.equal(wsUrl, 'wss://sdkgw.baz-zee.twilio.com/v1/VideoEvents');
      });
    });

    context('when WebSocket emits an "open" event', () => {
      context('should call .send() with a "connect" RSP message including ', () => {
        let isIpadStub;
        let isIphoneStub;

        beforeEach(() => {
          isIpadStub = sinon.stub(browserdetection, 'isIpad');
          isIphoneStub = sinon.stub(browserdetection, 'isIphone');
        });

        afterEach(() => {
          isIpadStub.restore();
          isIphoneStub.restore();
        });
        [
          [
            'Default',
            false,
            false,
            null
          ],
          [
            'iPad',
            true,
            false,
            { hwDeviceManufacturer: 'Apple',
              hwDeviceModel: 'iPad',
              hwDeviceType: 'tablet',
              platformName: 'iOS' },
          ],
          [
            'iPhone',
            false,
            true,
            { hwDeviceManufacturer: 'Apple',
              hwDeviceModel: 'iPhone',
              hwDeviceType: 'mobile',
              platformName: 'iOS' },
          ]
        ].forEach(([device, isIpadBool, isIphoneBool, hwFields]) => {
          it(`${device} device parameters`, async () => {
            const connectRequest = {
              publisher: {
                name: 'foo',
                participantSid: 'partcipantSid',
                roomSid: 'roomSid',
                sdkVersion: 'bar',
                userAgent: 'baz',
              },
              type: 'connect',
              token: 'token',
              version: 1
            };
            isIpadStub.returns(isIpadBool);
            isIphoneStub.returns(isIphoneBool);
            if (hwFields) {
              connectRequest.publisher = { ...connectRequest.publisher, ...hwFields };
            }
            const publisher = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', {
              userAgent: 'baz',
              WebSocket: FakeWebSocket,
            });
            publisher.connect('roomSid', 'partcipantSid');
            await socketCreationDeferred.promise;

            publisher._ws.dispatchEvent({ type: 'open' });
            assert.deepEqual(JSON.parse(publisher._ws.send.args[0][0]), connectRequest);
            isIpadStub.resetHistory();
            isIphoneStub.resetHistory();
          });
        });
      });
    });

    context('when the underlying WebSocket emits a "message" event with a "connected" RSP message', () => {
      let publisher;
      let connectedEmitted;

      before(async () => {
        publisher = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', {
          maxReconnectAttempts: 10,
          WebSocket: FakeWebSocket
        });

        publisher.once('connected', () => { connectedEmitted = true; });

        publisher.connect('roomSid', 'partcipantSid');
        await socketCreationDeferred.promise;

        publisher._eventQueue.push({ foo: 1 });
        publisher._eventQueue.push({ bar: 'baz' });
        publisher._reconnectAttemptsLeft = 1;
        publisher._ws.readyState = FakeWebSocket.OPEN;

        publisher._ws.dispatchEvent({
          type: 'message',
          data: JSON.stringify({
            type: 'connected',
            session: 'foo'
          })
        });
      });

      it('should set the ._session property of the InsightsPublisher', () => {
        assert.equal(publisher._session, 'foo');
      });

      it('should call .send() on the underlying WebSocket for each event in the ._eventQueue and clear it', () => {
        assert.equal(publisher._ws.send.callCount, 2);
        assert.equal(publisher._eventQueue.length, 0);
        assert.deepEqual(JSON.parse(publisher._ws.send.args[0][0]), {
          foo: 1,
          session: 'foo'
        });
        assert.deepEqual(JSON.parse(publisher._ws.send.args[1][0]), {
          bar: 'baz',
          session: 'foo'
        });
      });

      it('should emit "connected" on the InsightsPublisher', () => {
        assert(connectedEmitted);
      });

      it('should reset ._reconnectAttemptsLeft to options.maxReconnectAttemptsLeft', () => {
        assert.equal(publisher._reconnectAttemptsLeft, 10);
      });
    });

    context('when the underlying WebSocket emits a "message" event with an "error" message', () => {
      ['> 0', '=== 0'].forEach((scenario, i) => {
        const reconnectDeferreds = [defer(), defer()];
        const timestamps = [];

        let publisher;
        let disconnectedError;
        let reconnectingEmitted;
        let reconnectAttemptsLeft;
        let reconnectedDeferredsIdx = 0;

        context(`when the ._reconnectAttemptsLeft ${scenario}`, () => {
          before(async () => {
            publisher = new InsightsPublisher('token', 'foo', 'bar', 'baz', 'zee', {
              maxReconnectAttempts: 10,
              reconnectIntervalMs: 100,
              userAgent: 'baz',
              WebSocket: customizedWebSocket(FakeWebSocket, () => {
                reconnectDeferreds[reconnectedDeferredsIdx++].resolve();
                timestamps.push(Date.now());
              })
            });

            publisher.once('disconnected', error => { disconnectedError = error; });
            publisher.once('reconnecting', () => { reconnectingEmitted = true; });

            publisher.connect('roomSid', 'partcipantSid');
            await socketCreationDeferred.promise;

            publisher._reconnectAttemptsLeft = i === 1 ? 0 : 10;
            reconnectAttemptsLeft = publisher._reconnectAttemptsLeft;
            publisher._ws.readyState = FakeWebSocket.OPEN;

            publisher._ws.dispatchEvent({
              type: 'message',
              data: JSON.stringify({
                type: 'error',
                code: 9000,
                message: 'foo'
              })
            });
          });

          it('should call .close() on the underlying WebSocket', () => {
            assert(publisher._ws.close.calledOnce);
          });

          it('should emit a "disconnected" event with an Error', () => {
            assert(disconnectedError instanceof Error);
            assert.equal(disconnectedError.message, 'foo');
          });

          if (i === 1) {
            it('should not emit a "reconnecting" event', () => {
              assert(!reconnectingEmitted);
            });
            return;
          }

          it('should emit a "reconnecting" event', () => {
            assert(reconnectingEmitted);
          });

          it('should decrement the ._reconnectAttemptsLeft', async () => {
            await reconnectDeferreds[1].promise;
            assert.equal(publisher._reconnectAttemptsLeft, reconnectAttemptsLeft - 1);
          });
        });
      });
    });
  });
});

function customizedWebSocket(ctor, init) {
  const customized = ctor.bind(null, init);
  Object.keys(ctor).forEach(key => { customized[key] = ctor[key]; });
  return customized;
}
