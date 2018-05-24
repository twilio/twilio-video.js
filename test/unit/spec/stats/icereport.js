'use strict';

const assert = require('assert');

const IceReport = require('../../../../lib/stats/icereport');

describe('IceReport', () => {
  describe('.of(olderStats, newerStats)', () => {
    const olderStats = {
      timestamp: 1000,
      bytesSent: 1,
      bytesReceived: 3
    };

    const newerStats = {
      timestamp: 2000,
      bytesSent: 2,
      bytesReceived: 5
    };

    it('returns an instance of IceReport', () => {
      const report = IceReport.of(olderStats, newerStats);
      assert(report instanceof IceReport);
    });

    it('computes .send in bps correctly', () => {
      const report = IceReport.of(olderStats, newerStats);
      assert.equal(report.send, 8);
    });

    it('computes .recv in bps correctly', () => {
      const report = IceReport.of(olderStats, newerStats);
      assert.equal(report.recv, 16);
    });

    describe('when .currentRoundTripTime is defined', () => {
      it('sets .rtt to the newer .currentRoundTripTime', () => {
        const report = IceReport.of(
          Object.assign({ currentRoundTripTime: 10 }, olderStats),
          Object.assign({ currentRoundTripTime: 9 }, newerStats));
        assert.equal(report.rtt, 9);
      });
    });

    describe('when .currentRoundTripTime is undefined', () => {
      it('sets .rtt to undefined', () => {
        const report = IceReport.of(olderStats, newerStats);
        assert.strictEqual(report.availableSend, undefined);
      });
    });

    describe('when .availableOutgoingBitrate is defined', () => {
      it('sets .availableSend to the newer .availableOutgongBitrate', () => {
        const report = IceReport.of(
          Object.assign({ availableOutgoingBitrate: 10 }, olderStats),
          Object.assign({ availableOutgoingBitrate: 9 }, newerStats));
        assert.equal(report.availableSend, 9);
      });
    });

    describe('when .availableOutgoingBitrate is undefined', () => {
      it('sets .availableSend to undefined', () => {
        const report = IceReport.of(olderStats, newerStats);
        assert.strictEqual(report.availableSend, undefined);
      });
    });
  });
});
