'use strict';

const assert = require('assert');

const SenderReport = require('../../../../lib/stats/senderreport');
const SenderReportFactory = require('../../../../lib/stats/senderreportfactory');

describe('SenderReportFactory', () => {
  describe('constructor(trackId, initialStats)', () => {
    const trackId = '1';
    const initialStats = { id: '2' };

    it('sets .id to the RTCStats ID', () => {
      const factory = new SenderReportFactory(trackId, initialStats);
      assert.equal(factory.id, initialStats.id);
    });

    it('sets .trackId to trackId', () => {
      const factory = new SenderReportFactory(trackId, initialStats);
      assert.equal(factory.trackId, trackId);
    });

    it('sets .lastStats to initialStats', () => {
      const factory = new SenderReportFactory(trackId, initialStats);
      assert.equal(factory.lastStats, initialStats);
    });

    it('sets .lastReport to null', () => {
      const factory = new SenderReportFactory(trackId, initialStats);
      assert.strictEqual(factory.lastReport, null);
    });
  });

  describe('.next(trackId, newerStats, newerRemoteStats)', () => {
    const trackId = '1';

    const initialStats = {
      timestamp: 1000,
      id: '2',
      bytesSent: 0
    };

    const newerStats = {
      timestamp: 2000,
      id: '2',
      bytesSent: 2
    };

    const newerRemoteStats = {
      roundTripTime: 3000
    };

    let factory;

    beforeEach(() => {
      factory = new SenderReportFactory('0', initialStats);
    });

    it('returns a SenderReport', () => {
      const report = factory.next(trackId, initialStats);
      assert(report instanceof SenderReport);
    });

    it('returns a SenderReport equal to SenderReport.of(trackId, initialStats, newerStats, newerRemoteStats)', () => {
      const actualReport1 = factory.next(trackId, newerStats);
      const expectedReport1 = SenderReport.of(trackId, initialStats, newerStats);
      assert.deepEqual(actualReport1, expectedReport1);

      factory = new SenderReportFactory('0', initialStats);
      const actualReport2 = factory.next(trackId, newerStats, newerRemoteStats);
      const expectedReport2 = SenderReport.of(trackId, initialStats, newerStats, newerRemoteStats);
      assert.deepEqual(actualReport2, expectedReport2);
    });

    it('sets .lastReport equal to the returned SenderReport', () => {
      const report = factory.next(trackId, newerStats);
      assert.equal(report, factory.lastReport);
    });

    it('sets .lastStats to newerStats', () => {
      factory.next(trackId, newerStats);
      assert.equal(factory.lastStats, newerStats);
    });

    it('sets .trackId to trackId', () => {
      factory.next(trackId, newerStats);
      assert.equal(factory.trackId, trackId);
    });
  });
});
