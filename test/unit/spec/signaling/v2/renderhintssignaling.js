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

      // update enabled state.
      subject.setTrackHint('foo', { enabled: false });
      assert(subject._trackSidsToRenderHints.has('foo'));
      const trackState = subject._trackSidsToRenderHints.get('foo');
      assert.deepStrictEqual(trackState, {
        enabled: false,
        isEnabledDirty: true,
        isDimensionDirty: false
      });

      // update render dimensions.
      subject.setTrackHint('foo', { renderDimensions: { width: 100, height: 100 } });
      const trackState2 = subject._trackSidsToRenderHints.get('foo');
      assert.deepStrictEqual(trackState2, {
        enabled: false,
        renderDimensions: { width: 100, height: 100 },
        isEnabledDirty: true,
        isDimensionDirty: true
      });

    });

    it('flattens and sends updated track states ', () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 100, height: 100 } });
      subject.setTrackHint('bar', { enabled: false, renderDimensions: { width: 100, height: 100 } });
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 101, height: 101 } });

      assert(subject._trackSidsToRenderHints.has('foo'));
      assert(subject._trackSidsToRenderHints.has('bar'));

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
              'track': 'foo',
              'enabled': true,
              'render_dimensions': { height: 101, width: 101 },
            }, {
              'track': 'bar',
              'enabled': false,
              'render_dimensions': { height: 100, width: 100 },
            }]
          }
        });

        // once published tracks shouldn't be dirty anymore.
        //  but state must be preserved.
        assert(subject._trackSidsToRenderHints.has('foo'));
        assert(subject._trackSidsToRenderHints.has('bar'));
        assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, false);
        assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, false);
      });
    });

    it('does nothing if track state did not change', async () => {
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 100, height: 100 } });
      assert(subject._trackSidsToRenderHints.has('foo'));
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, true);
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, true);


      const published = defer();
      mst.publish.callsFake(() => {
        published.resolve();
      });

      await published.promise;

      // once published tracks shouldn't be dirty anymore.
      //  but state must be preserved.
      assert(subject._trackSidsToRenderHints.has('foo'));
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, false);
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, false);

      // subsequent setTrackHint with same values does not mark track as dirty
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 100, height: 100 } });
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, false);
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, false);

      // but any changes causes it be marked dirty
      subject.setTrackHint('foo', { renderDimensions: { width: 101, height: 100 } });
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, true);
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, false);

      // but any changes causes it be marked dirty
      subject.setTrackHint('foo', { enabled: false });
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isDimensionDirty, true);
      assert.strictEqual(subject._trackSidsToRenderHints.get('foo').isEnabledDirty, true);

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
            'track': 'foo',
            'enabled': true,
          }, {
            'track': 'boo',
            'enabled': false,
          }]
        }
      });

      // send another hint
      subject.setTrackHint('bar', { enabled: true, renderDimensions: { width: 200, height: 200 } });
      await waitForSometime(10);
      assert(publishCalls, 1);

      const serverMessage = {
        'type': 'render_hints',
        'subscriber': {
          'id': 42,
          'hints': [
            {
              'track': 'foo',
              'result': 'OK'
            },
            {
              'track': 'boo',
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
            'track': 'bar',
            'enabled': true,
            'render_dimensions': { height: 200, width: 200 },
          }]
        }
      });
    });
  });

  describe('clearTrackHint', () => {
    it('deletes stored track state.', () => {
      let subject = makeTest(makeTransport());
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 100, height: 100 } });
      assert(subject._trackSidsToRenderHints.has('foo'));

      subject.clearTrackHint('foo');
      assert(!subject._trackSidsToRenderHints.has('foo'));
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
