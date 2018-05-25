'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const NetworkQualityMonitor = require('../../../../../lib/signaling/v2/networkqualitymonitor');

describe('NetworkQualityMonitor', () => {
  describe('constructor(manager, signaling)', () => {
    it('sets .levels to null', () => {
      const signaling = new EventEmitter();
      const monitor = new NetworkQualityMonitor(null, signaling);
      assert.strictEqual(monitor.levels, null);
    });

    it('starts listening to signaling\'s "networkQualityLevelsChanged" and updating .levels', () => {
      const signaling = new EventEmitter();
      const monitor = new NetworkQualityMonitor(null, signaling);
      const levels = {};
      signaling.emit('networkQualityLevelsChanged', levels);
      assert.equal(monitor.levels, levels);
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
