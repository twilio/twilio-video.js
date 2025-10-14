import WSClientTransport from '../../../../../src/transport/websocket/client';
import { WebSocket } from '../../../mocks';
import * as assert from 'assert';
import * as sinon from 'sinon';

describe('WSClientTransport', () => {
  describe('#close', () => {
    let closeEventPromise: Promise<void>;
    let transport: WSClientTransport;
    let wsClient: WebSocket;

    before(async () => {
      transport = new WSClientTransport('foo', { WebSocket });
      const openPromise: Promise<void> = transport.open();
      wsClient = WebSocket.client;
      wsClient.readyState = WebSocket.OPEN;
      wsClient.dispatchEvent({ type: 'open' });
      await openPromise;
      closeEventPromise = new Promise(resolve => transport.on('close', resolve));
      transport.close();
    });

    it('should call .close on the underlying WebSocket', () => {
      sinon.assert.calledOnce(wsClient.close);
    });

    it('should emit "close" on the WSClientTransport', () => {
      return closeEventPromise;
    });
  });

  describe('#open', () => {
    let transport: WSClientTransport;

    beforeEach(() => {
      transport = new WSClientTransport('foo', { WebSocket });
    });

    it('should return a Promise', () => {
      assert(transport.open() instanceof Promise);
    });

    it('should create a new WebSocket with the url passed to the constructor', () => {
      transport.open();
      sinon.assert.calledWith(WebSocket, 'foo');
    });

    [
      { event: 'open', readyState: 'OPEN' },
      { event: 'close', readyState: 'CLOSED' }
    ].forEach(({ event, readyState }) => {
      context(`when the WebSocket ${event === 'open' ? 'opens' : 'fails to open'}`, () => {
        let promise: Promise<void>;
        let wsClient: any;

        beforeEach(() => {
          promise = transport.open();
          transport.send('foo');
          transport.send('bar');

          wsClient = WebSocket.client;
          wsClient.readyState = WebSocket[readyState];

          const wsEvent = {
            type: event,
            ...{ close: { code: 1, reason: 'bar' }, open: {} }[event]
          };
          wsClient.dispatchEvent(wsEvent);
        });

        if (event === 'open') {
          it('should send any buffered messages', async () => {
            await promise;
            sinon.assert.callCount(wsClient.send, 2);
            sinon.assert.calledWith(wsClient.send, '"foo"');
            sinon.assert.calledWith(wsClient.send, '"bar"');
          });

          it('should resolve the returned Promise', () => {
            return promise;
          });

          return;
        }

        it('should not send any buffered messages', async () => {
          try {
            await promise;
          } catch {
            sinon.assert.notCalled(wsClient.send);
            return;
          }
          throw new Error('Unexpected resolution');
        });

        it('should reject the returned Promise', async () => {
          try {
            await promise;
          } catch (e) {
            assert.equal(e.code, 1);
            assert.equal(e.message, 'bar');
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });
  });

  describe('#send', () => {
    ['CONNECTING', 'OPEN'].forEach(wsState => {
      context(`when the underlying WebSocket is ${wsState}`, () => {
        const action: string = {
          CONNECTING: 'enqueue',
          OPEN: 'send'
        }[wsState];

        it(`should ${action} the given data`, async () => {
          const data: any = { bar: 'baz' };
          const transport: WSClientTransport = new WSClientTransport('foo', { WebSocket });
          const openPromise: Promise<void> = transport.open();
          const wsClient: WebSocket = WebSocket.client;

          if (wsState === 'OPEN') {
            wsClient.readyState = WebSocket.OPEN;
            wsClient.dispatchEvent({ type: 'open' });
            await openPromise;
          }
          transport.send(data);

          wsState === 'OPEN'
            ? sinon.assert.calledWith(wsClient.send, JSON.stringify(data))
            : assert.equal(transport._sendBuffer.pop(), JSON.stringify(data));
        });
      });
    });
  });

  describe('"message" event', () => {
    context('when the underlying WebSocket receives a message', () => {
      it('should emit a "message" event with the received JSON data on the WSClientTransport', async () => {
        const transport: WSClientTransport = new WSClientTransport('foo', { WebSocket });
        const openPromise: Promise<void> = transport.open();
        const wsClient: WebSocket = WebSocket.client;

        wsClient.readyState = WebSocket.OPEN;
        wsClient.dispatchEvent({ type: 'open' });
        await openPromise;

        const messageEventPromise: Promise<void> = new Promise(resolve => transport.on('message', resolve));
        wsClient.dispatchEvent({ type: 'message', data: '{"foo": "bar"}' });
        const data: any = await messageEventPromise;
        assert.deepEqual(data, { foo: 'bar' });
      });
    });
  });
});
