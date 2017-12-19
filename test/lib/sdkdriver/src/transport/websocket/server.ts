import Transport from '../';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';

/**
 * WebSocket server {@link Transport}.
 * @class
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
   * @param {number} wsPort - The WebSocket server port.
   * @param {TestDriver} testDriver - The {@link TestDriver} that connects
   *   to the {@link WSServerTransport}
   */
  constructor(wsPort: number, deps: any = {}) {
    super();
    this._deps = {
      WebSocket,
      ...deps
    };
    this._sendBuffer = [];
    this._wsConnection = null;
    this._wsServer = new this._deps.WebSocket.Server({ port: wsPort });
  }

  /**
   * Close the {@link WSServerTransport}.
   * @returns {void}
   */
  close(): void {
    if (this._wsConnection) {
      try {
        this._wsConnection.close();
      } catch (e) {
        // Do nothing.
      }
      this._wsConnection = null;
    }

    try {
      this._wsServer.close();
    } catch (e) {
      // Do nothing.
    }
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
        wsConnection.on('message', (data: string) => this.emit('message', JSON.parse(data)));
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
