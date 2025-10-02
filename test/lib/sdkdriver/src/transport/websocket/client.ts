import * as WebSocket from 'ws';
import { EventEmitter } from 'events';
import Transport from '../';

/**
 * WebSocket client {@link Transport}.
 * @fires Transport#close
 * @fires Transport#message
 */
export default class WSClientTransport extends EventEmitter implements Transport {
  private readonly  _deps: any;
  private readonly _sendBuffer: Array<string>;
  private readonly _wsUrl: string;
  private _wsClient: WebSocket | null;

  /**
   * Constructor.
   * @param {string} wsUrl - WebSocket URL
   */
  constructor(wsUrl: string, deps: any = {}) {
    super();
    this._deps = {
      WebSocket,
      ...deps
    };
    this._sendBuffer = [];
    this._wsClient = null;
    this._wsUrl = wsUrl;
    this.setMaxListeners(Infinity);
  }

  /**
   * Close the {@link WSClientTransport}.
   * @returns {void}
   */
  close(): void {
    if (this._wsClient) {
      this._wsClient.close();
      this._wsClient = null;
    }
  }

  /**
   * Open the {@link WSClientTransport}.
   * @returns {Promise<void>}
   */
  open(): Promise<void> {
    const { WebSocket } = this._deps;
    const wsClient: WebSocket = this._wsClient || new WebSocket(this._wsUrl);
    this._wsClient = wsClient;

    return wsClient.readyState === WebSocket.OPEN ? Promise.resolve() : new Promise((resolve, reject) => {
      const onopenfailed: (event: any) => void = event => {
        const { code, reason: message } = event;
        wsClient.removeEventListener('close', onopenfailed);
        reject({ code, message });
      };
      wsClient.addEventListener('close', onopenfailed);

      wsClient.addEventListener('open', () => {
        this._sendBuffer.splice(0).forEach(item => wsClient.send(item));
        wsClient.removeEventListener('close', onopenfailed);
        wsClient.addEventListener('close', () => this.emit('close'));
        wsClient.addEventListener('message', event => this.emit('message', JSON.parse(event.data.toString())));
        resolve();
      });
    });
  }

  /**
   * Send data if {@link WSClientTransport} is open, enqueue otherwise.
   * @param {*} data
   * @returns {void}
   */
  send(data: any): void {
    if (this._wsClient) {
      const { WebSocket: { CONNECTING, OPEN } } = this._deps;
      const wsClient: WebSocket = this._wsClient;
      const { readyState } = wsClient;

      const sendOrEnqueue: (data: any) => void = {
        [CONNECTING]: (data: any) => this._sendBuffer.push(JSON.stringify(data)),
        [OPEN]: (data: any) => wsClient.send(JSON.stringify(data))
      }[readyState];

      if (sendOrEnqueue) {
        sendOrEnqueue(data);
      }
    }
  }
}
