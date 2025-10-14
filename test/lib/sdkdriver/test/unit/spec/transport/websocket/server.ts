import WSServerTransport from '../../../../../src/transport/websocket/server';
import { WebSocket } from '../../../mocks';
import * as assert from 'assert';
import * as sinon from 'sinon';

describe('WSServerTransport', () => {
  const mockWebServer: any = { port: 2000 };

  describe('constructor', () => {
    let transport: WSServerTransport;

    it('should create an underlying WebSocket server with the given port', () => {
      transport = new WSServerTransport(mockWebServer, { WebSocket });
      sinon.assert.calledWith(WebSocket.Server, { server: mockWebServer });
    });
  });

  describe('#close', () => {
    let closeEventPromise: Promise<void>;
    let transport: WSServerTransport;
    let wsConnection: WebSocket;
    let wsServer: WebSocket.Server;

    before(async () => {
      transport = new WSServerTransport(mockWebServer, { WebSocket });
      const openPromise: Promise<void> = transport.open();
      wsConnection = new WebSocket('foo');
      wsServer = WebSocket.server;
      wsServer.emit('connection', wsConnection);
      await openPromise;
      closeEventPromise = new Promise(resolve => transport.on('close', resolve));
      transport.close();
    });

    it('should call .close on the underlying WebSocket connection', () => {
      sinon.assert.calledOnce(wsConnection.close);
    });

    it('should call .close on the underlying WebSocket server', async () => {
      sinon.assert.calledOnce(wsServer.close);
    });

    it('should emit "close" on the WSServerTransport', () => {
      return closeEventPromise;
    });
  });

  describe('#open', () => {
    let transport: WSServerTransport;

    beforeEach(() => {
      transport = new WSServerTransport(mockWebServer, { WebSocket });
    });

    it('should return a Promise', () => {
      assert(transport.open() instanceof Promise);
    });

    [true, false].forEach(didOpenSucceed => {
      context(`when the WSServerTransport did ${didOpenSucceed ? '' : 'not '}successfully open`, () => {
        let openError: Error = new Error('open error');
        let promise: Promise<void>;
        let wsConnection: WebSocket;
        let wsServer: WebSocket.Server;

        beforeEach(async () => {
          promise = transport.open();
          transport.send('foo');
          transport.send('bar');
          wsConnection = new WebSocket('foo');
          wsServer = WebSocket.server;
          if (didOpenSucceed) {
            wsServer.emit('connection', wsConnection);
          } else {
            wsServer.emit('error', openError);
          }
        });

        if (didOpenSucceed) {
          it('should send any buffered messages', async () => {
            await promise;
            sinon.assert.callCount(wsConnection.send, 2);
            sinon.assert.calledWith(wsConnection.send, '"foo"');
            sinon.assert.calledWith(wsConnection.send, '"bar"');
          });

          it('should resolve the returned Promise', () => {
            return promise;
          });

          return;
        }

        it('should reject the returned Promise', async () => {
          try {
            await promise;
          } catch (e) {
            assert.equal(e, openError);
            return;
          }
          throw new Error('Unexpected resolution');
        });
      });
    });
  });

  describe('#send', () => {
    ['opening', 'open'].forEach(state => {
      context(`when the WSServerTransport is ${state}`, () => {
        const action: string = {
          opening: 'enqueue',
          open: 'send'
        }[state];

        it(`should ${action} the given data`, async () => {
          const data: any = { bar: 'baz' };
          const transport: WSServerTransport = new WSServerTransport(mockWebServer, { WebSocket });
          const openPromise: Promise<void> = transport.open();
          const wsConnection: WebSocket = new WebSocket('foo');
          const wsServer: WebSocket.Server = WebSocket.server;

          if (state === 'open') {
            wsServer.emit('connection', wsConnection);
            await openPromise;
          }
          transport.send(data);

          state === 'open'
            ? sinon.assert.calledWith(wsConnection.send, JSON.stringify(data))
            : assert.equal(transport._sendBuffer.pop(), JSON.stringify(data));
        });
      });
    });
  });

  describe('"message" event', () => {
    context('when the underlying WebSocket receives a message', () => {
      it('should emit a "message" event with the received JSON data on the WSServerTransport', async () => {
        const transport: WSServerTransport = new WSServerTransport(mockWebServer, { WebSocket });
        const openPromise: Promise<void> = transport.open();
        const wsConnection: WebSocket = new WebSocket('foo');
        const wsServer: WebSocket.Server = WebSocket.server;

        wsServer.emit('connection', wsConnection);
        await openPromise;

        const messageEventPromise: Promise<void> = new Promise(resolve => transport.on('message', resolve));
        wsConnection.emit('message', JSON.stringify({ foo: 'bar' }));
        const data: any = await messageEventPromise;
        assert.deepEqual(data, { foo: 'bar' });
      });
    });
  });
});
