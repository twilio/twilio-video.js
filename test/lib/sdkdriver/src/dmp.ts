import { EventEmitter } from 'events';
import Transport from './transport';

/**
 * DMP Request.
 * @classdesc A {@link DMPRequest} contains the data associated with
 *   the incoming request message along with a method for sending a
 *   response.
 */
export class DMPRequest {
  private readonly _id: number;
  private readonly _transport: Transport;
  public readonly data: any;

  /**
   * Constructor.
   * @param {number} id - Request ID
   * @param {*} data - Request data
   * @param {Transport} transport - The {@link Transport} used for
   *   sending a response
   */
  constructor(id: number, data: any, transport: Transport) {
    this._id = id;
    this._transport = transport;
    this.data = data;
  }

  /**
   * Send a response over the underlying {@link Transport}.
   * @param {*} data - Response data
   * @returns {void}
   */
  sendResponse(data: any): void {
    const { _id: id, _transport: transport } = this;
    transport.send({ data, id, type: 'response' });
  }
}

/**
 * Driver Messaging Protocol (DMP).
 * @classdesc A {@link DMP} exchanges DMP messages with its counterpart;
 *   It can be instantiated in the mocha.js process that drives the test
 *   process as well as in the test process
 * @fires DMP#event
 * @fires DMP#request
 */
export default class DMP extends EventEmitter {
  private _requestId: number;
  protected readonly _transport: Transport;

  /**
   * Constructor.
   * @param {Transport} transport - The {@link Transport} used for
   *   exchanging DMP messages.
   */
  constructor(transport: Transport) {
    super();
    this._transport = transport;
    this._requestId = 0;

    this._transport.on('message', message => {
      const { data, id, type } = message;
      const transport: Transport = this._transport;

      switch (type) {
        case 'request':
          this.emit('request', new DMPRequest(id, data, transport));
          break;
        case 'event':
          this.emit('event', data);
          break;
      }
    });
  }

  /**
   * Close the underlying {@link Transport}.
   * @returns {void}
   */
  close(): void {
    this._transport.close();
  }

  /**
   * Send an event over the underlying {@link Transport}.
   * @param {*} data - Event data
   * @returns {void}
   */
  sendEvent(data: any): void {
    this._transport.send({
      data,
      type: 'event'
    });
  }

  /**
   * Send a request over the underlying {@link Transport}.
   * @param {*} data - Request data
   * @returns {Promise<*>} - Resolves with the response data
   */
  sendRequest(data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const requestId: number = this._requestId++;

      const onresponse: (response: any) => void = response => {
        const { id, type } = response;
        if (type === 'response' && id === requestId) {
          this._transport.removeListener('message', onresponse);
          resolve(response.data);
        }
      };

      this._transport.send({ data, id: requestId, type: 'request' });
      this._transport.on('message', onresponse);
      this._transport.once('close', reject);
    });
  }
}

/**
 * The {@link DMP} received an "event".
 * @event DMP#event
 * @param {*} data
 */

/**
 * The {@link DMP} received a "request".
 * @event DMP#request
 * @param {DMPRequest} request
 */
