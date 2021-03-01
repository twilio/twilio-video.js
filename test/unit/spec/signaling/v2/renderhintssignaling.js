'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');
const sinon = require('sinon');

const RenderHintsSignaling = require('../../../../../lib/signaling/v2/renderhintssignaling.js');
const log = require('../../../../lib/fakelog');
const { defer, waitForSometime } = require('../../../../../lib/util');

describe('RenderHintsSignaling', () => {
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
  });

  describe('setTrackHint', () => {
    it('updates track state', () => {
      const subject = makeTest(makeTransport());
      subject.setTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      assert(subject._trackSidsToRenderHints.has('foo'));
      assert(subject._dirtyTrackSids.has('foo'));
    });

    it('flattens and sends updated track states ', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.setTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      subject.setTrackHint('bar', { enabled: false, renderDimension: { width: 100, height: 100 } });
      subject.setTrackHint('foo', { enabled: true, renderDimension: { width: 101, height: 101 } });

      assert(subject._trackSidsToRenderHints.has('foo'));
      assert(subject._trackSidsToRenderHints.has('bar'));
      assert(subject._dirtyTrackSids.has('foo'));
      assert(subject._dirtyTrackSids.has('bar'));

      const deferred = defer();
      mst.publish.callsFake(() => {
        deferred.resolve();
      });

      return deferred.promise.then(() => {
        sinon.assert.calledWith(mst.publish, {
          type: 'render_hints',
          subscriber: {
            id: sinon.match.number,
            hints: [{
              'track_sid': 'foo',
              'enabled': true,
              'render_dimension': { height: 101, width: 101 },
            }, {
              'track_sid': 'bar',
              'enabled': false,
              'render_dimension': { height: 100, width: 100 },
            }]
          }
        });

        // once published tracks shouldn't be dirty anymore.
        //  but state must be preserved.
        assert(subject._trackSidsToRenderHints.has('foo'));
        assert(subject._trackSidsToRenderHints.has('bar'));
        assert(!subject._dirtyTrackSids.has('foo'));
        assert(!subject._dirtyTrackSids.has('bar'));
      });
    });

    it('processes subsequent messages only after a reply is received', async () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.setTrackHint('foo', { enabled: true });
      subject.setTrackHint('boo', { enabled: false });

      let publishCalls = 0;
      let deferred = defer();
      mst.publish.callsFake(() => {
        publishCalls++;
        deferred.resolve();
      });

      // wait for message to get published.
      await deferred.promise;
      assert(publishCalls, 1);
      sinon.assert.calledWith(mst.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'foo',
            'enabled': true,
          }, {
            'track_sid': 'boo',
            'enabled': false,
          }]
        }
      });

      // send another hint
      subject.setTrackHint('bar', { enabled: true, renderDimension: { width: 200, height: 200 } });
      await waitForSometime(10);
      assert(publishCalls, 1);

      const serverMessage = {
        'type': 'render_hints',
        'subscriber': {
          'id': 42,
          'hints': [
            {
              'track_sid': 'foo',
              'result': 'OK'
            },
            {
              'track_sid': 'boo',
              'result': 'INVALID_RENDER_HINT'
            }
          ]
        }
      };

      deferred = defer();
      mst.emit('message', serverMessage);
      await deferred.promise;
      assert(publishCalls, 2);
      sinon.assert.calledWith(mst.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'bar',
            'enabled': true,
            'render_dimension': { height: 200, width: 200 },
          }]
        }
      });
    });
  });

  describe('clearTrackHint', () => {
    it('deletes stored track state.', () => {
      let subject = makeTest(makeTransport());
      subject.setTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      assert(subject._trackSidsToRenderHints.has('foo'));
      assert(subject._dirtyTrackSids.has('foo'));

      subject.clearTrackHint('foo');
      assert(!subject._trackSidsToRenderHints.has('foo'));
      assert(!subject._dirtyTrackSids.has('foo'));
    });
  });
});

function makeTransport(onPublish) {
  const transport = new EventEmitter();
  transport.publish = onPublish || sinon.stub();
  transport.mak = 1;
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

  const subject = new RenderHintsSignaling(getReceiver, { log });
  subject.setup('foo');
  return subject;
}
