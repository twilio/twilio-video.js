import Transport from '../';
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';

/**
 * WebSocket client {@link Transport}.
 * @class
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
  }

  /**
   * Close the {@link WSClientTransport}.
   * @returns {void}
   */
  close(): void {
    if (!this._wsClient) {
      return;
    }
    try {
      this._wsClient.close();
    } catch (e) {
      // Do nothing.
    }
    this._wsClient = null;
  }

  /**
   * Open the {@link WSClientTransport}.
   * @returns {Promise<void>}
   */
  open(): Promise<void> {
    const { WebSocket } = this._deps;
    if (!this._wsClient) {
      this._wsClient = new WebSocket(this._wsUrl);
    }
    const wsClient: WebSocket = this._wsClient as WebSocket;

    if (wsClient.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
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
        wsClient.addEventListener('message', event => this.emit('message', JSON.parse(event.data)));
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
    if (!this._wsClient) {
      return;
    }
    const { WebSocket: { CONNECTING, OPEN } } = this._deps;
    const wsClient: WebSocket = this._wsClient as WebSocket;
    const { readyState } = wsClient;

    const sendOrEnqueue: (data: any) => void = {
      [CONNECTING]: (data: any) => this._sendBuffer.push(JSON.stringify(data)),
      [OPEN]: (data: any) => wsClient.send(JSON.stringify(data))
    }[readyState];

    sendOrEnqueue(data);
  }
}
