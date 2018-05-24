'use strict';

const assert = require('assert');

const ReceiverReport = require('../../../../lib/stats/receiverreport');
const ReceiverReportFactory = require('../../../../lib/stats/receiverreportfactory');

describe('ReceiverReportFactory', () => {
  describe('constructor(trackId, initialStats)', () => {
    const trackId = '1';
    const initialStats = { id: '2' };

    it('sets .id to the RTCStats ID', () => {
      const factory = new ReceiverReportFactory(trackId, initialStats);
      assert.equal(factory.id, initialStats.id);
    });

    it('sets .trackId to trackId', () => {
      const factory = new ReceiverReportFactory(trackId, initialStats);
      assert.equal(factory.trackId, trackId);
    });

    it('sets .lastStats to initialStats', () => {
      const factory = new ReceiverReportFactory(trackId, initialStats);
      assert.equal(factory.lastStats, initialStats);
    });

    it('sets .lastReport to null', () => {
      const factory = new ReceiverReportFactory(trackId, initialStats);
      assert.equal(factory.lastReport, null);
    });
  });

  describe('.next(trackId, newerStats)', () => {
    const trackId = '1';

    const initialStats = {
      timestamp: 1000,
      id: '2',
      bytesReceived: 0,
      packetsLost: 0,
      packetsReceived: 0
    };

    const newerStats = {
      timestamp: 2000,
      id: '2',
      bytesReceived: 1,
      packetsLost: 0,
      packetsReceived: 0
    };

    let factory;

    beforeEach(() => {
      factory = new ReceiverReportFactory('0', initialStats);
    });

    it('returns a ReceiverReport', () => {
      const report = factory.next(trackId, newerStats);
      assert(report instanceof ReceiverReport);
    });

    it('returns a ReceiverReport equal to ReceiverReport.of(trackId, initialStats, newerStats)', () => {
      const actualReport = factory.next(trackId, newerStats);
      const expectedReport = ReceiverReport.of(trackId, initialStats, newerStats);
      assert.deepEqual(actualReport, expectedReport);
    });

    it('sets .lastReport equal to the returned ReceiverReport', () => {
      const report = factory.next(trackId, newerStats);
      assert.deepEqual(factory.lastReport, report);
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
