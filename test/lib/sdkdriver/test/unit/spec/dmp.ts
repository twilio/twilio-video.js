import { a } from '../../../../util';
import DMP from '../../../src/dmp';
import { Transport } from '../mocks';
import * as assert from 'assert';
import * as sinon from 'sinon';

describe('DMP', () => {
  describe('#close', () => {
    let transport: any;
    let dmp: DMP;
    let waitForClose: Promise<void>;

    before(() => {
      transport = new Transport();
      dmp = new DMP(transport);
      waitForClose = new Promise(resolve => dmp.once('close', resolve));
      dmp.close();
    });

    it('should call .close on the underlying Transport', () => {
      sinon.assert.calledOnce(transport.close);
    });

    it('should emit "close" on the DMP', () => {
      return waitForClose;
    });
  });

  describe('#sendEvent', () => {
    it('should send an "event" message with the given data over the underlying Transport', () => {
      const data: any = { foo: 'bar' };
      const transport: any = new Transport();
      const dmp: DMP = new DMP(transport);
      dmp.sendEvent(data);
      sinon.assert.calledWith(transport.send, { data, type: 'event' });
    });
  });

  describe('#sendRequest', () => {
    let data: any;
    let dmp: DMP;
    let promise: Promise<any>;
    let transport: any;

    before(() => {
      data = { foo: 'bar' };
      transport = new Transport();
      dmp = new DMP(transport);
      promise = dmp.sendRequest(data);
    });

    it('should return a Promise', () => {
      assert(promise instanceof Promise);
    });

    it('should send a "request" message with the given data over the underlying Transport', () => {
      sinon.assert.calledWith(transport.send, { data, id: 0, type: 'request' });
    });

    context('when a corresponding "response" message is received from the underlying Transport', () => {
      let responseData: any;

      before(async () => {
        responseData = { baz: 'zee' };

        // The Promise should ignore this "response" as the id is not the same as that of the "request".
        transport.emit('message', { data: { zee: 'foo' }, id: 1, type: 'response' });

        // The Promise should resolve for this "response" as the id is the same as that of the "request".
        transport.emit('message', { data: responseData, id: 0, type: 'response' });
      });

      it('should resolve the returned Promise with the response data', async () => {
        assert.equal(await promise, responseData);
      });
    });
  });

  describe('events', () => {
    ['event', 'request'].forEach(type => {
      let data: any;
      let dmp: DMP;
      let payload: any;
      let promise: Promise<any>;
      let transport: any;

      context(`when ${a(type)} "${type}" message is received from the underlying Transport`, () => {
        before(() => {
          data = { foo: 'bar' };
          transport = new Transport();
          dmp = new DMP(transport);
          promise = new Promise(resolve => dmp.once(type, resolve));
          transport.emit('message', {
            data,
            type,
            ...{ event: {}, request: { id: 0 } }[type]
          });
        });

        it(`should emit ${a(type)} "${type}" event`, async () => {
          payload = await promise;
          assert(payload);
        });

        context('the event payload should be an object that has', () => {
          it(`the "${type}" data`, () => {
            assert.equal(type === 'request' ? payload.data : payload, data);
          });

          if (type === 'request') {
            it('a method to send a corresponding "response" message over the underlying Transport', () => {
              const data: any = { bar: 'baz' };
              assert.equal(typeof payload.sendResponse, 'function');
              payload.sendResponse(data);
              sinon.assert.calledWith(transport.send, { data, id: 0, type: 'response' });
            });
          }
        });
      });
    });
  });
});
