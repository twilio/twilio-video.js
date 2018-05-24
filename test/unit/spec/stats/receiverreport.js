'use strict';

const assert = require('assert');

const ReceiverReport = require('../../../../lib/stats/receiverreport');

describe('ReceiverReport', () => {
  describe('constructor(id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived, fractionLost, jitter)', () => {
    it('sets .phonyFractionLost correctly', () => {
      const id = '1';
      const trackId = '2';
      const bitrate = 3;
      const deltaPacketsLost = 4;
      const fractionLost = 0.5;
      const jitter = 0.25;

      const deltaPacketsReceived1 = 5;
      const report1 = new ReceiverReport(id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived1, fractionLost, jitter);
      assert.equal(report1.phonyFractionLost, deltaPacketsLost / deltaPacketsReceived1);

      const deltaPacketsReceived2 = 0;
      const report2 = new ReceiverReport(id, trackId, bitrate, deltaPacketsLost, deltaPacketsReceived2, fractionLost, jitter);
      assert.equal(report2.phonyFractionLost, 0);
    });
  });

  describe('.of(trackId, olderStats, newerStats)', () => {
    describe('when the RTCStats IDs do not match', () => {
      it('throws an Error', () => {
        assert.throws(() => ReceiverReport.of('1', { id: '1' }, { id: '2' }));
      });
    });

    describe('when the RTCStats IDs match', () => {
      const trackId = '1';

      const olderStats = {
        timestamp: 1000,
        id: '2',
        bytesReceived: 1,
        packetsLost: 3,
        packetsReceived: 4,
      };

      const newerStats = {
        timestamp: 2000,
        id: '2',
        bytesReceived: 3,
        packetsLost: 4,
        packetsReceived: 9,
      };

      it('returns a ReceiveReport', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert(report instanceof ReceiverReport);
      });

      it('returns a ReceiverReport with .id set to the RTCStats ID', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.equal(report.id, '2');
      });

      it('returns a ReceiverReport with .trackId set to trackId', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.equal(report.trackId, '1');
      });

      it('returns a ReceiverReport with .bitrate set correctly', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.equal(report.bitrate, 16);
      });

      it('returns a ReceiverReport with .deltaPacketsLost set correctly', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.equal(report.deltaPacketsLost, 1);
      });

      it('returns a ReceiverReport with .deltaPacketsReceived set correctly', () => {
        const report = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.equal(report.deltaPacketsReceived, 5);
      });

      it('returns a ReceiverReport with .fractionLost set to the newerStats\' .fractionLost', () => {
        const report1 = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.strictEqual(report1.fractionLost, undefined);

        const report2 = ReceiverReport.of(trackId,
          Object.assign({ fractionLost: 0.4 }, olderStats),
          Object.assign({ fractionLost: 0.3 }, newerStats));
        assert.equal(report2.fractionLost, 0.3);
      });

      it('returns a ReceiverReport with .jitter set to the newerStats\' .jitter', () => {
        const report1 = ReceiverReport.of(trackId, olderStats, newerStats);
        assert.strictEqual(report1.jitter, undefined);

        const report2 = ReceiverReport.of(trackId,
          Object.assign({ jitter: 0.4 }, olderStats),
          Object.assign({ jitter: 0.3 }, newerStats));
        assert.strictEqual(report2.jitter, 0.3);
      });
    });
  });

  describe('.summarize()', () => {
    it('sets .bitrate correctly', () => {
      const report = new ReceiverReport('1', '2', 3, 0, 0);
      const summary = report.summarize();
      assert.equal(summary.bitrate, report.bitrate);
    });

    it('sets .fractionLost to .fractionLost when .fractionLost is not undefined', () => {
      const report = new ReceiverReport('1', '2', 3, 1, 2);
      const summary = report.summarize();
      assert.equal(summary.fractionLost, report.phonyFractionLost);
    });

    it('sets .fractionLost to .phonyFractionLost when .fractionLost is undefined', () => {
      const report = new ReceiverReport('1', '2', 3, 1, 2, 0.3);
      const summary = report.summarize();
      assert.equal(summary.fractionLost, report.fractionLost);
    });

    it('sets .jitter to .jitter', () => {
      const report1 = new ReceiverReport('1', '2', 0, 0, 0, 0);
      const summary1 = report1.summarize();
      assert.strictEqual(summary1.jitter, undefined);

      const report2 = new ReceiverReport('1', '2', 0, 0, 0, 0, 0.5);
      const summary2 = report2.summarize();
      assert.strictEqual(summary2.jitter, 0.5);
    });
  });

  describe('.summarize(reports)', () => {
    it('sums each report\'s ReceiverSummary .bitrate', () => {
      const summary = ReceiverReport.summarize([
        new ReceiverReport('1', '2', 10, 0, 0),
        new ReceiverReport('3', '4', 20, 0, 0)
      ]);
      assert.equal(summary.bitrate, 30);
    });

    it('averages each report\'s ReceiverSummary .fractionLost', () => {
      const summary = ReceiverReport.summarize([
        // { fractionLost: 10, phonyFractionLost: 0 }
        new ReceiverReport('1', '2', 0, 0, 0, 10),
        // { fractionLost: undefined, phonyFractionLost: 20 }
        new ReceiverReport('3', '4', 0, 20, 1)
      ]);
      assert.equal(summary.fractionLost, 15);
    });

    it('averages each report\'s ReceiverSummary .jitter, ignoring undefined', () => {
      const summary = ReceiverReport.summarize([
        // { jitter: 10 }
        new ReceiverReport('1', '2', 0, 0, 0, 0, 10),
        // { jitter: undefined }
        new ReceiverReport('3', '4', 0, 0, 0, 0),
        // { jitter: 20 }
        new ReceiverReport('5', '6', 0, 0, 0, 0, 20)
      ]);
      assert.equal(summary.jitter, 15);
    });
  });
});
