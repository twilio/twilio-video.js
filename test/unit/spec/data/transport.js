'use strict';

const assert = require('assert');
const sinon = require('sinon');

const DataTransport = require('../../../../lib/data/transport');
const EventTarget = require('../../../../lib/eventtarget');

describe('DataTransport', () => {
  describe('"message"', () => {
    describe('when the underlying RTCDataChannel emits a "message" event containing a JSON string', () => {
      it('emits a "message" event with the result of JSON.parse', () => {
        const dataChannel = mockRTCDataChannel();
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
        const dataChannel = mockRTCDataChannel();
        const dataTransport = new DataTransport(dataChannel);
        let didEmitMessage = false;
        dataTransport.once('message', () => { didEmitMessage = true; });
        dataChannel.dispatchEvent({ type: 'message', data: 'not json' });
        assert(!didEmitMessage);
      });
    });
  });

  describe('#publish, called when the underlying RTCDataChannel\'s .readyState is', () => {
    ['connecting', 'open', 'closing', 'closed'].forEach(readyState => {
      context(`"${readyState}"`, () => {
        let dataChannel;
        let dataTransport;
        let ret;

        before(() => {
          dataChannel = mockRTCDataChannel(readyState);
          dataTransport = new DataTransport(dataChannel);
          ret = dataTransport.publish({ foo: 'bar' });
        });

        const expectedRet = readyState === 'connecting' || readyState === 'open';
        it(`should return ${expectedRet}`, () => {
          assert.equal(ret, expectedRet);
        });

        if (readyState === 'open') {
          it('should call #send on the underlying RTCDataChannel', () => {
            sinon.assert.calledWith(dataChannel.send, JSON.stringify({ foo: 'bar' }));
          });
          return;
        }

        it('should not call #send on the underlying RTCDataChannel', () => {
          sinon.assert.notCalled(dataChannel.send);
        });

        if (readyState === 'connecting') {
          context('when the underlying RTCDataChannel\'s .readyState transitions to "open"', () => {
            before(() => {
              dataChannel.open();
            });

            it('should call #send on the underlying RTCDataChannel', () => {
              sinon.assert.calledWith(dataChannel.send, JSON.stringify({ foo: 'bar' }));
            });
          });
        }
      });
    });
  });
});

function mockRTCDataChannel(readyState = 'open') {
  const dataChannel = new EventTarget();
  dataChannel.readyState = readyState;

  dataChannel.open = () => {
    if (dataChannel.readyState === 'open') {
      return;
    }
    dataChannel.readyState = 'open';
    dataChannel.dispatchEvent({ type: 'open' });
  };

  dataChannel.send = sinon.spy(() => {});
  return dataChannel;
}
