import * as EventTarget from '../../../../../lib/eventtarget';
import * as sinon from 'sinon';
import { inherits } from 'util';

export const WebSocket: any = sinon.spy(function MockWebSocket(url: string) {
  EventTarget.call(this);
  this.close = sinon.spy(() => {
    this.readyState = WebSocket.CLOSED;
    this.dispatchEvent({ type: 'close' });
  });
  this.send = sinon.spy(() => {});
  this.readyState = WebSocket.CONNECTING;
});

inherits(WebSocket, EventTarget);

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;
