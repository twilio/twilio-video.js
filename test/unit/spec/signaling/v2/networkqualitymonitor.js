'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const NetworkQualityMonitor = require('../../../../../lib/signaling/v2/networkqualitymonitor');

describe('NetworkQualityMonitor', () => {
  describe('constructor(manager, signaling)', () => {
    it('sets .levels to NetworkQualitySignaling\'s .levels', () => {
      const signaling = new EventEmitter();

      const monitor = new NetworkQualityMonitor(null, signaling);

      signaling.levels = null;
      assert.strictEqual(monitor.levels, signaling.levels);

      signaling.levels = { level: 1 };
      assert.strictEqual(monitor.levels, signaling.levels);

      signaling.levels = { level: 5 };
      assert.strictEqual(monitor.levels, signaling.levels);
    });

    it('sets .remoteLevels to NetworkQualitySignaling\'s .remoteLevels', () => {
      const signaling = new EventEmitter();

      const monitor = new NetworkQualityMonitor(null, signaling);

      signaling.remoteLevels = new Map();
      assert.deepEqual(monitor.remoteLevels, signaling.remoteLevels);

      signaling.remoteLevels = new Map().set('PA9bcf2c26f2f1ba197b06ead6ec8b1f01',
        { sid: 'PA9bcf2c26f2f1ba197b06ead6ec8b1f01', level: 3 });
      assert.deepEqual(monitor.remoteLevels, signaling.remoteLevels);
    });

    it('re-emits NetworkQualitySignaling\'s "updated" event', () => {
      const signaling = new EventEmitter();
      const monitor = new NetworkQualityMonitor(null, signaling);
      let didEmitEvent;
      monitor.once('updated', () => { didEmitEvent = true; });
      signaling.emit('updated');
      assert(didEmitEvent);
    });
  });

  describe('.start()', () => {
    it('constructs a PeerConnectionReportFactory for each RTCPeerConnection contained within PeerConnectionManager', () => {
      // TODO(mroberts): ...
    });

    it('.put()s summaries of each of the PeerConnectionReportFactory\'s PeerConnectionReports', () => {
      // TODO(mroberts): ...
    });
  });
});
