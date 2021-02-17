'use strict';

const assert = require('assert');
const sinon = require('sinon');

const MediaSignalingTransport = require('../../../../../lib/data/transport');
const RenderHintsController = require('../../../../../lib/signaling/v2/renderhintscontroller.js');
const fakeLog = require('../../../../lib/fakelog');

describe('RenderHintsController', () => {
  describe('constructor', () => {
    it('sets ._mspTransport to null', () => {
      const subject = makeTest();
      assert.strictEqual(subject._mspTransport, null);
    });
  });

  describe('sendTrackHint', () => {
    it('updates track state', () => {
      let subject = makeTest();
      subject.sendTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      assert(subject._trackHints.has('foo'));
      assert(subject._dirtyTracks.has('foo'));
    });

    it('if transport is set sends out the updated track state', () => {
      let subject = makeTest();
      let mspTransport = sinon.createStubInstance(MediaSignalingTransport);
      subject.setTransport(mspTransport);
      subject.sendTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });

      sinon.assert.calledWith(mspTransport.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'foo',
            'enabled': true,
            'render_dimension': { height: 100, width: 100 },
          }]
        }
      });

      assert(subject._trackHints.has('foo'));
      assert(!subject._dirtyTracks.has('foo'));
    });
  });

  describe('deleteTrackState', () => {
    it('deletes stored track state.', () => {
      let subject = makeTest();
      subject.sendTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      assert(subject._trackHints.has('foo'));
      assert(subject._dirtyTracks.has('foo'));

      subject.deleteTrackState('foo');
      assert(!subject._trackHints.has('foo'));
      assert(!subject._dirtyTracks.has('foo'));
    });
  });

  describe('setTransport', () => {
    let mspTransport = sinon.createStubInstance(MediaSignalingTransport);
    let subject = makeTest();
    let messageCallback = null;

    it('hooks up for message callback', () => {
      subject.setTransport(mspTransport);
      assert(mspTransport.addListener.callCount === 1);
      sinon.assert.calledWith(mspTransport.addListener, 'message');
      subject.setTransport(null);
      mspTransport.addListener.resetHistory();
    });

    it('sends latest state of the tracks', () => {
      // queue some hints.
      subject.sendTrackHint('foo', { enabled: true, renderDimension: { width: 100, height: 100 } });
      subject.sendTrackHint('bar', { enabled: true, renderDimension: { width: 200, height: 200 } });
      subject.sendTrackHint('baz', { enabled: false, renderDimension: { width: 0, height: 0 } });

      mspTransport.addListener.callsFake((event, callback) => { messageCallback = callback; });

      // and then set transport.
      subject.setTransport(mspTransport);
      sinon.assert.callCount(mspTransport.addListener, 1);
      sinon.assert.calledWith(mspTransport.addListener, 'message');

      sinon.assert.callCount(mspTransport.publish, 1);
      sinon.assert.calledWith(mspTransport.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'foo',
            'enabled': true,
            'render_dimension': { height: 100, width: 100 },
          }, {
            'track_sid': 'bar',
            'enabled': true,
            'render_dimension': { height: 200, width: 200 },
          }, {
            'track_sid': 'baz',
            'enabled': false,
            'render_dimension': { height: 0, width: 0 },
          }],
        }
      });
    });

    it('waits for answer from server and then sends next update', () => {
      // update some tracks
      subject.sendTrackHint('baz', { enabled: true, renderDimension: { width: 20, height: 20 } });
      subject.sendTrackHint('foo', { enabled: false, renderDimension: { width: 0, height: 0 } });

      // this wont be sent yet, since last message is outstanding.
      sinon.assert.callCount(mspTransport.publish, 1);

      mspTransport.publish.resetHistory();
      sinon.assert.callCount(mspTransport.publish, 0);

      messageCallback({ type: 'render_hints', foo: 1 });

      sinon.assert.callCount(mspTransport.publish, 1);
      sinon.assert.calledWith(mspTransport.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'baz',
            'enabled': true,
            'render_dimension': { height: 20, width: 20 },
          }, {
            'track_sid': 'foo',
            'enabled': false,
            'render_dimension': { height: 0, width: 0 },
          }]
        }
      });
    });

    it('sends complete state when transport is set again', () => {
      subject.setTransport(null);
      mspTransport.publish.resetHistory();

      subject.setTransport(mspTransport);
      sinon.assert.callCount(mspTransport.publish, 1);
      sinon.assert.calledWith(mspTransport.publish, {
        type: 'render_hints',
        subscriber: {
          id: sinon.match.number,
          hints: [{
            'track_sid': 'foo',
            'enabled': false,
            'render_dimension': { height: 0, width: 0 },
          }, {
            'track_sid': 'bar',
            'enabled': true,
            'render_dimension': { height: 200, width: 200 },
          }, {
            'track_sid': 'baz',
            'enabled': true,
            'render_dimension': { height: 20, width: 20 },
          }]
        }
      });
    });
  });
});

function makeTest(log) {
  // mspTransport = mspTransport || sinon.createStubInstance(MediaSignalingTransport);
  //
  log = log || fakeLog;
  return new RenderHintsController({ log });
}
