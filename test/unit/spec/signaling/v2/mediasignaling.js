'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const MediaSignaling = require('../../../../../lib/signaling/v2/mediasignaling');
const log = require('../../../../lib/fakelog');
const { defer } = require('../../../../../lib/util');

function makeTransport() {
  const transport = new EventEmitter();
  transport.publish = sinon.spy(() => {});
  return transport;
}

function makeTest(channel) {
  let mst = makeTransport();
  const receiver = new EventEmitter();
  receiver.kind = 'data';
  receiver.toDataTransport = () => mst;

  const getReceiver = sinon.spy(() => Promise.resolve(receiver));

  return {
    receiver,
    getReceiver,
    setTransport: newMST => { mst = newMST; },
    subject: new MediaSignaling(getReceiver, channel, { log })
  };
}

describe('MediaSignaling', () => {
  describe('constructor()', () => {
    it('initializes properties', () => {
      const { subject } = makeTest('foo_channel');
      assert.strictEqual(subject._transport, null);
      assert.strictEqual(subject.channel, 'foo_channel');
      assert.strictEqual(subject.isSetup, false);
    });
  });

  describe('setup', () => {
    const test = makeTest('foo_channel');
    const subject = test.subject;
    it('initializes transport and fires ready', () => {
      const gotReady = defer();
      subject.on('ready', transport => {
        assert(transport);
        gotReady.resolve();
      });
      subject.setup('id1');
      sinon.assert.calledOnce(test.getReceiver);
      return gotReady.promise;
    });

    it('when called again fires teardown and then ready', () => {
      const gotReady = defer();
      let gotTeardown = false;

      subject.on('teardown', () => {
        gotTeardown = true;
        gotReady.resolve();
      });

      subject.on('ready', transport => {
        assert(transport);
        assert(gotTeardown);
        gotReady.resolve();
      });

      subject.setup('id2');
      return gotReady.promise;
    });
  });

  it('tears down when receiver emits close', async () => {
    const test = makeTest('foo_channel');
    const subject = test.subject;

    const gotReady = defer();
    subject.on('ready', transport => {
      assert(transport);
      gotReady.resolve();
    });
    subject.setup('id1');
    await gotReady.promise;

    const gotTeardown = defer();
    subject.on('teardown',  () => {
      assert(subject.isSetup === false);
      gotTeardown.resolve();
    });

    test.receiver.emit('close');
    return gotTeardown.promise;
  });
});
