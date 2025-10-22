'use strict';

const assert = require('assert');
const sinon = require('sinon');
const StatsMonitor = require('../../../../lib/insights/statsmonitor');
const telemetry = require('../../../../lib/insights/telemetry');

describe('StatsMonitor', () => {
  let log;
  let statsMonitor;
  let clock;
  let getStatsStub;
  let telemetryInfoSpy;
  let telemetryWarningSpy;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    log = {
      debug: sinon.spy(),
      warn: sinon.spy()
    };

    getStatsStub = sinon.stub().resolves(new Map());
    telemetryInfoSpy = sinon.spy(telemetry, 'info');
    telemetryWarningSpy = sinon.spy(telemetry, 'warning');
  });

  afterEach(() => {
    if (statsMonitor) {
      statsMonitor.cleanup();
      statsMonitor = null;
    }
    clock.restore();
    telemetryInfoSpy.restore();
    telemetryWarningSpy.restore();
  });

  describe('stats collection', () => {
    it('should collect stats periodically', async () => {
      statsMonitor = new StatsMonitor({
        log,
        getStats: getStatsStub,
        collectionIntervalMs: 1000
      });

      clock.tick(1000);
      await Promise.resolve();

      sinon.assert.calledOnce(getStatsStub);
    });

    it('should handle stats collection errors gracefully', async () => {
      getStatsStub.rejects(new Error('Stats error'));
      statsMonitor = new StatsMonitor({ log, getStats: getStatsStub });

      clock.tick(1000);
      await Promise.resolve();

      assert.strictEqual(statsMonitor._statsCollectionCount, 0);
    });
  });

  describe('network type change detection', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor({ log, getStats: getStatsStub });
      telemetryInfoSpy.resetHistory();
    });

    it('should publish event on first active pair', () => {
      const response = {
        activeIceCandidatePair: {
          localCandidate: { networkType: 'wifi' }
        }
      };

      statsMonitor._checkNetworkTypeChanges(response);

      sinon.assert.calledWith(telemetryInfoSpy, {
        group: 'network',
        name: 'network-type-changed',
        payload: { networkType: 'wifi' }
      });
    });

    it('should publish event when network type changes', () => {
      statsMonitor._checkNetworkTypeChanges({
        activeIceCandidatePair: { localCandidate: { networkType: 'wifi' } }
      });
      telemetryInfoSpy.resetHistory();

      statsMonitor._checkNetworkTypeChanges({
        activeIceCandidatePair: { localCandidate: { networkType: 'cellular' } }
      });

      sinon.assert.calledWith(telemetryInfoSpy, sinon.match({
        payload: { networkType: 'cellular' }
      }));
    });

    it('should not publish event when network type stays the same', () => {
      const response = {
        activeIceCandidatePair: { localCandidate: { networkType: 'wifi' } }
      };

      statsMonitor._checkNetworkTypeChanges(response);
      telemetryInfoSpy.resetHistory();
      statsMonitor._checkNetworkTypeChanges(response);

      sinon.assert.notCalled(telemetryInfoSpy);
    });
  });

  describe('quality limitation tracking', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor({ log, getStats: getStatsStub });
      telemetryInfoSpy.resetHistory();
    });

    it('should publish event when quality limitation reason changes', () => {
      const trackStats = [{ trackSid: 'MT123', qualityLimitationReason: 'bandwidth' }];

      statsMonitor._checkQualityLimitations(trackStats);

      sinon.assert.calledWith(telemetryInfoSpy, {
        group: 'quality',
        name: 'quality-limitation-state-changed',
        payload: {
          trackSid: 'MT123',
          qualityLimitationReason: 'bandwidth'
        }
      });
    });

    it('should not publish event when reason stays the same', () => {
      const trackStats = [{ trackSid: 'MT123', qualityLimitationReason: 'bandwidth' }];

      statsMonitor._checkQualityLimitations(trackStats);
      telemetryInfoSpy.resetHistory();
      statsMonitor._checkQualityLimitations(trackStats);

      sinon.assert.notCalled(telemetryInfoSpy);
    });
  });

  describe('track stall detection', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor({ log, getStats: getStatsStub });
      telemetryInfoSpy.resetHistory();
      telemetryWarningSpy.resetHistory();
    });

    it('should publish track-stalled event when frame rate drops below threshold', () => {
      statsMonitor._checkTrackStalls([{ trackSid: 'MT123', frameRateReceived: 0.3 }]);

      sinon.assert.calledWith(telemetryWarningSpy, {
        group: 'track-warning-raised',
        name: 'track-stalled',
        payload: {
          trackSid: 'MT123',
          frameRate: 0.3,
          threshold: 0.5,
          trackType: 'video'
        }
      });
    });

    it('should publish cleared event when frame rate recovers', () => {
      statsMonitor._checkTrackStalls([{ trackSid: 'MT123', frameRateReceived: 0.3 }]);
      telemetryInfoSpy.resetHistory();
      telemetryWarningSpy.resetHistory();

      statsMonitor._checkTrackStalls([{ trackSid: 'MT123', frameRateReceived: 10 }]);

      sinon.assert.calledWith(telemetryInfoSpy, {
        group: 'track-warning-cleared',
        name: 'track-stalled',
        payload: {
          trackSid: 'MT123',
          frameRate: 10,
          threshold: 5,
          trackType: 'video'
        }
      });
    });
  });

  describe('cleanup', () => {
    it('should stop stats collection and clear state', () => {
      statsMonitor = new StatsMonitor({ log, getStats: getStatsStub });
      statsMonitor._stalledTrackSids.add('MT456');

      statsMonitor.cleanup();

      assert.strictEqual(statsMonitor._interval, null);
      assert.strictEqual(statsMonitor._stalledTrackSids.size, 0);
    });
  });
});
