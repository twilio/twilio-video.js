'use strict';

const assert = require('assert');

const SenderReport = require('../../../../lib/stats/senderreport');

describe('SenderReport', () => {
  describe('constructor(id, trackId, bitrate, rtt)', () => {
    it('sets .rtt correctly', () => {
      const id = '1';
      const trackId = '2';
      const bitrate = 3;
      const rtt = 4;

      const report1 = new SenderReport(id, trackId, bitrate, rtt);
      assert.equal(report1.rtt, rtt);

      const report2 = new SenderReport(id, trackId, bitrate);
      assert.strictEqual(report2.rtt, undefined);
    });
  });

  describe('.of(trackId, olderStats, newerStats, newerRemoteStats)', () => {
    describe('when the RTCStats IDs do not match', () => {
      it('throws an Error', () => {
        assert.throws(() => SenderReport.of('1', { id: '1' }, { id: '2' }));
      });
    });

    describe('when the RTCStats IDs match', () => {
      const trackId = '1';

      const olderStats = {
        timestamp: 1000,
        id: '2',
        bytesSent: 0
      };

      const newerStats = {
        timestamp: 2000,
        id: '2',
        bytesSent: 2
      };

      it('returns a SenderReport', () => {
        const report = SenderReport.of(trackId, olderStats, newerStats);
        assert(report instanceof SenderReport);
      });

      it('returns a SenderReport with .id set to the RTCStats ID', () => {
        const report = SenderReport.of(trackId, olderStats, newerStats);
        assert.equal(report.id, '2');
      });

      it('returns a SenderReport with .trackId set to trackId', () => {
        const report = SenderReport.of(trackId, olderStats, newerStats);
        assert.equal(report.trackId, trackId);
      });

      it('returns a SenderReport with .bitrate set correctly', () => {
        const report = SenderReport.of(trackId, olderStats, newerStats);
        assert.equal(report.bitrate, 16);
      });

      it('returns a SenderReport with .rtt set to the newerRemoteStats\' .roundTripTime / 1000', () => {
        const report1 = SenderReport.of(trackId, olderStats, newerStats);
        assert.strictEqual(report1.rtt, undefined);

        const report2 = SenderReport.of(trackId,
          olderStats,
          newerStats,
          { roundTripTime: 3000 });
        assert.strictEqual(report2.rtt, 3);

        const report3 = SenderReport.of(trackId,
          olderStats,
          newerStats,
          {});
        assert.strictEqual(report3.rtt, undefined);
      });
    });
  });

  describe('.summarize(reports)', () => {
    it('sums each report\'s .bitrate', () => {
      const summary = SenderReport.summarize([
        new SenderReport('1', '2', 10),
        new SenderReport('3', '4', 10)
      ]);
      assert.equal(summary.bitrate, 20);
    });

    it('averages each report\'s .rtt, ignoring undefined', () => {
      const summary = SenderReport.summarize([
        // { rtt: 10 }
        new SenderReport('1', '2', 0, 10),
        // { rtt: undefined }
        new SenderReport('3', '4', 0),
        // { rtt: 20 }
        new SenderReport('5', '6', 0, 20),
      ]);
      assert.equal(summary.rtt, 15);
    });
  });
});
