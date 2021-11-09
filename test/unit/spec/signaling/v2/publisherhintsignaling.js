'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const PublisherHintSignaling = require('../../../../../lib/signaling/v2/publisherhintsignaling.js');
const log = require('../../../../lib/fakelog');
const { waitForSometime } = require('../../../../../lib/util');

describe('PublisherHintSignaling', () => {
  describe('constructor', () => {
    it('sets ._transport to null', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      assert.strictEqual(subject._transport, null);
    });

    it('_transport assigned after ready', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      return new Promise(resolve => {
        subject.on('ready', () => {
          assert(subject._transport !== null);
          resolve();
        });
      });
    });

    it('emits "updated" when a hint request is received', async () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      await waitForSometime(10);

      const serverMessage = {
        'type': 'publisher_hints',
        'publisher': {
          'id': 42,
          'hints': [
            {
              'track': 'foo',
              'encodings': []
            },
            {
              'track': 'boo',
              'encodings': []
            }
          ]
        }
      };

      const updatedPromise = new Promise(resolve => {
        subject.on('updated', (hints, id) => {
          assert.deepStrictEqual(hints, serverMessage.publisher.hints);
          assert.strictEqual(id, serverMessage.publisher.id);
          resolve();
        });
      });

      mst.emit('message', serverMessage);
      await updatedPromise;
    });
  });

  describe('sendHintResponse', () => {
    it('does nothing when transport is not ready', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.sendHintResponse({ id: 100, hints: [{ track: 'foo', result: 'OK' }] });
    });

    it('sends response provided', async () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      await new Promise(resolve => subject.on('ready', resolve));
      subject.sendHintResponse({ id: 100, hints: [{ track: 'foo', result: 'OK' }] });
      sinon.assert.calledWith(mst.publish, {
        type: 'publisher_hints',
        id: 100,
        hints: [{
          track: 'foo',
          result: 'OK'
        }]
      });
    });
  });

  describe('sendTrackReplaced', () => {
    it('does not crash when transport is not ready', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.sendTrackReplaced({ trackSid: 'bar' });
    });

    it('sends client_reset message', async () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      await new Promise(resolve => subject.on('ready', resolve));
      subject.sendTrackReplaced({ trackSid: 'bar' });
      sinon.assert.calledWith(mst.publish, {
        type: 'client_reset',
        id: sinon.match.number,
        track: 'bar'
      });
    });
  });
});

function makeTransport(onPublish) {
  const transport = new EventEmitter();
  transport.publish = onPublish || sinon.stub();
  return transport;
}

function makeTest(mst) {
  const getReceiver = () => {
    return Promise.resolve({
      kind: 'data',
      toDataTransport: () => mst,
      once: () => {}
    });
  };

  const subject = new PublisherHintSignaling(getReceiver, { log });
  subject.setup('foo');
  return subject;
}
