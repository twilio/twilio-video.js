'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const NetworkQualityMonitor = require('../../../../../lib/signaling/v2/networkqualitymonitor');

describe('NetworkQualityMonitor', () => {
  describe('constructor(manager, signaling)', () => {
    it('sets .level to NetworkQualitySignaling\'s .level', () => {
      const signaling = new EventEmitter();

      const monitor = new NetworkQualityMonitor(null, signaling);

      signaling.level = null;
      assert.strictEqual(monitor.level, signaling.level);

      signaling.level = 1;
      assert.strictEqual(monitor.level, signaling.level);

      signaling.level = 5;
      assert.strictEqual(monitor.level, signaling.level);
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
