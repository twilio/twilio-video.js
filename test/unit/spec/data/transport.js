'use strict';

const assert = require('assert');
const sinon = require('sinon');

const DataTransport = require('../../../../lib/data/transport');
const EventTarget = require('../../../../lib/eventtarget');

describe('DataTransport', () => {
  describe('"message"', () => {
    describe('when the underlying RTCDataChannel emits a "message" event containing a JSON string', () => {
      it('emits a "message" event with the result of JSON.parse', () => {
        const dataChannel = new EventTarget();
        const dataTransport = new DataTransport(dataChannel);
        const expectedMessage = { foo: 'bar' };
        let actualMessage;
        dataTransport.once('message', message => { actualMessage = message; });
        dataChannel.dispatchEvent({ type: 'message', data: JSON.stringify(expectedMessage) });
        assert.deepEqual(actualMessage, expectedMessage);
      });
    });

    describe('when the underlying RTCDataChannel emits a "message" event containing something other than a JSON string', () => {
      it('does not emit a "message" event', () => {
        const dataChannel = new EventTarget();
        const dataTransport = new DataTransport(dataChannel);
        let didEmitMessage = false;
        dataTransport.once('message', () => { didEmitMessage = true; });
        dataChannel.dispatchEvent({ type: 'message', data: 'not json' });
        assert(!didEmitMessage);
      });
    });
  });

  describe('#publish', () => {
    it('calls #send on the RTCDataChannel with the result of JSON.stringify', () => {
      const dataChannel = new EventTarget();
      dataChannel.send = sinon.spy();
      const dataTransport = new DataTransport(dataChannel);
      const message = { foo: 'bar' };
      dataTransport.publish(message);
      assert(dataChannel.send.calledWith(JSON.stringify(message)));
    });
  });
});
