import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import { Server as HTTPServer } from 'http';
import Transport from '../';

/**
 * WebSocket server {@link Transport}.
 * @fires Transport#close
 * @fires Transport#message
 */
export default class WSServerTransport extends EventEmitter implements Transport {
  private readonly  _deps: any;
  private readonly _sendBuffer: Array<string>;
  private readonly _wsServer: WebSocket.Server;
  private _wsConnection: WebSocket | null;

  /**
   * Constructor.
   * @param {HTTP.Server} webServer - The HTTP server shared by the
   *   underlying WebSocket.Server
   */
  constructor(webServer: HTTPServer, deps: any = {}) {
    super();
    this._deps = {
      WebSocket,
      ...deps
    };
    this._sendBuffer = [];
    this._wsConnection = null;

    const { WebSocket: { Server: WSServer } } = this._deps;
    this._wsServer = new WSServer({ server: webServer });
    this.setMaxListeners(Infinity);
  }

  /**
   * Close the {@link WSServerTransport}.
   * @returns {void}
   */
  close(): void {
    if (this._wsConnection) {
      this._wsConnection.close();
      this._wsConnection = null;
    }
    this._wsServer.clients.forEach(client => client.terminate());
    this._wsServer.close();
  }

  /**
   * Open the {@link WSServerTransport}.
   * @returns {Promise<void>} Resolved when a {@link TestDriver} connects
   *   to the {@link WSServerTransport}
   */
  open(): Promise<void> {
    return this._wsConnection ? Promise.resolve() : new Promise((resolve, reject) => {
      this._wsServer.once('error', reject);
      this._wsServer.once('connection', wsConnection => {
        this._sendBuffer.splice(0).forEach(item => wsConnection.send(item));
        wsConnection.on('close', () => this.emit('close'));
        wsConnection.on('message', (data: Buffer) => this.emit('message', JSON.parse(data.toString())));
        this._wsConnection = wsConnection;
        resolve();
      });
    });
  }

  /**
   * Send data if {@link WSServerTransport} is open, enqueue otherwise.
   * @param {*} data
   * @returns {void}
   */
  send(data: any): void {
    if (this._wsConnection) {
      this._wsConnection.send(JSON.stringify(data));
      return;
    }
    this._sendBuffer.push(JSON.stringify(data));
  }
}
