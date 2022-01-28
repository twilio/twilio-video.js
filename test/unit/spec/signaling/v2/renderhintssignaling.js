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
      assert.equal(publishCalls, 1);
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
      assert.equal(publishCalls, 1);

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
      assert.equal(publishCalls, 2);
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

    it('re-sends all hints with exponential backoff until server responds', async function() {
      let clock = sinon.useFakeTimers();
      const mst = makeTransport();
      const subject = makeTest(mst);
      subject.setTrackHint('foo', { enabled: true, renderDimensions: { width: 100, height: 100 } });
      subject.setTrackHint('boo', { enabled: false });

      let publishCalls = 0;
      let publishTimes = [];
      let deferred = defer();
      mst.publish.callsFake(() => {
        publishCalls++;
        publishTimes.push(Date.now());
        deferred.resolve();
      });

      clock.tick(1000);
      await deferred.promise;
      assert.equal(publishCalls, 1);
      sinon.assert.calledWith(mst.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track': 'foo',
            'render_dimensions': { height: 100, width: 100 },
            'enabled': true,
          }, {
            'track': 'boo',
            'enabled': false,
          }]
        }
      });

      // send another hint
      subject.setTrackHint('bar', { enabled: true, renderDimensions: { width: 200, height: 200 } });
      assert.equal(publishCalls, 1);

      clock.tick(2000); // simulate 2 seconds

      // we should expect 1st retry  now.
      assert.equal(publishCalls, 2);

      // expect publish to be called with all the hints.
      sinon.assert.calledWith(mst.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track': 'foo',
            'render_dimensions': { height: 100, width: 100 },
            'enabled': true,
          }, {
            'track': 'boo',
            'enabled': false,
          },
          {
            'track': 'bar',
            'enabled': true,
            'render_dimensions': { height: 200, width: 200 },
          }]
        }
      });

      clock.tick(40000); // simulate 40 seconds

      // we expect 2nd retry to be made 2 second after 1st, and subsequent retries at exponential intervals.
      assert.equal(publishCalls, 6);
      assert.equal(publishTimes[2] - publishTimes[1], 2000);
      assert.equal(publishTimes[3] - publishTimes[2], 4000);
      assert.equal(publishTimes[4] - publishTimes[3], 8000);
      assert.equal(publishTimes[5] - publishTimes[4], 16000);

      // simulate a server response.
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
            },
            {
              'track': 'bar',
              'result': 'OK'
            }
          ]
        }
      };
      mst.emit('message', serverMessage);

      // simulate more time and verify that timer stops retrying.
      clock.tick(100000); // simulate 100 seconds
      assert.equal(publishCalls, 6);
      clock.restore();
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
