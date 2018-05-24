'use strict';

const assert = require('assert');

const IceReport = require('../../../../lib/stats/icereport');
const IceReportFactory = require('../../../../lib/stats/icereportfactory');

describe('IceReportFactory', () => {
  describe('constructor()', () => {
    it('sets .lastStats to null', () => {
      const factory = new IceReportFactory();
      assert.strictEqual(factory.lastStats, null);
    });

    it('sets .lastReport to an empty IceReport', () => {
      const factory = new IceReportFactory();
      assert.deepEqual(factory.lastReport, new IceReport(0, 0));
    });
  });

  describe('.next(newerStats)', () => {
    describe('when .lastStats is null', () => {
      const newerStats = {};

      it('sets .lastStats to newerStats', () => {
        const factory = new IceReportFactory();
        factory.next(newerStats);
        assert.equal(factory.lastStats, newerStats);
      });

      it('leaves .lastReport set to an empty IceReport', () => {
        const factory = new IceReportFactory();
        const lastReport = factory.lastReport;
        factory.next(newerStats);
        assert.equal(factory.lastReport, lastReport);
      });

      it('returns .lastReport', () => {
        const factory = new IceReportFactory();
        const result = factory.next(newerStats);
        assert.equal(result, factory.lastReport);
      });
    });

    describe('when .lastStats is not null', () => {
      describe('and the RTCStats IDs match', () => {
        const olderStats = { timestamp: 1000, id: 1, bytesSent: 0, bytesReceived: 0 };
        const newerStats = { timestamp: 2000, id: 1, bytesSent: 1, bytesReceived: 1 };

        it('sets .lastStats to newerStats', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          factory.next(newerStats);
          assert.equal(factory.lastStats, newerStats);
        });

        it('updates .lastReport', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          factory.next(newerStats);
          assert.deepEqual(factory.lastReport, new IceReport(8, 8));
        });

        it('returns .lastReport', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          const result = factory.next(newerStats);
          assert.equal(result, factory.lastReport);
        });
      });

      describe('and the RTCStats IDs do not match', () => {
        const olderStats = { timestamp: 1000, id: 1, bytesSent: 0, bytesReceived: 0 };
        const newerStats = { timestamp: 2000, id: 2, bytesSent: 1, bytesReceived: 1 };

        it('sets .lastStats to newerStats', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          factory.next(newerStats);
          assert.equal(factory.lastStats, newerStats);
        });

        it('resets .lastReport to an empty IceReport', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          factory.next(newerStats);
          assert.deepEqual(factory.lastReport, new IceReport(0, 0));
        });

        it('returns .lastReport', () => {
          const factory = new IceReportFactory();
          factory.next(olderStats);
          const result = factory.next(newerStats);
          assert.equal(result, factory.lastReport);
        });
      });
    });
  });
});
