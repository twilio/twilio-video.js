'use strict';

const assert = require('assert');
const sinon = require('sinon');
const StatsMonitor = require('../../../../lib/insights/statsmonitor');

describe('StatsMonitor', () => {
  let eventObserver;
  let log;
  let statsMonitor;
  let clock;
  let getStatsStub;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    eventObserver = {
      emit: sinon.spy()
    };

    log = {
      debug: sinon.spy(),
      warn: sinon.spy()
    };

    getStatsStub = sinon.stub().resolves(new Map());
  });

  afterEach(() => {
    if (statsMonitor) {
      statsMonitor.cleanup();
      statsMonitor = null;
    }
    clock.restore();
  });

  describe('stats collection', () => {
    it('should collect stats periodically', async () => {
      statsMonitor = new StatsMonitor(eventObserver, log, {
        getStats: getStatsStub,
        collectionIntervalMs: 1000
      });

      clock.tick(1000);
      await Promise.resolve();

      sinon.assert.calledOnce(getStatsStub);
    });

    it('should handle stats collection errors gracefully', async () => {
      getStatsStub.rejects(new Error('Stats error'));
      statsMonitor = new StatsMonitor(eventObserver, log, { getStats: getStatsStub });

      clock.tick(1000);
      await Promise.resolve();

      assert.strictEqual(statsMonitor._statsCollectionCount, 0);
    });
  });

  describe('network type change detection', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor(eventObserver, log, { getStats: getStatsStub });
      eventObserver.emit.resetHistory();
    });

    it('should publish event on first active pair', () => {
      const response = {
        activeIceCandidatePair: {
          localCandidate: { networkType: 'wifi' }
        }
      };

      statsMonitor._checkNetworkTypeChanges(response);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'network',
        name: 'network-type-changed',
        level: 'info',
        payload: { networkType: 'wifi' }
      });
    });

    it('should publish event when network type changes', () => {
      statsMonitor._checkNetworkTypeChanges({
        activeIceCandidatePair: { localCandidate: { networkType: 'wifi' } }
      });
      eventObserver.emit.resetHistory();

      statsMonitor._checkNetworkTypeChanges({
        activeIceCandidatePair: { localCandidate: { networkType: 'cellular' } }
      });

      sinon.assert.calledWith(eventObserver.emit, 'event', sinon.match({
        payload: { networkType: 'cellular' }
      }));
    });

    it('should not publish event when network type stays the same', () => {
      const response = {
        activeIceCandidatePair: { localCandidate: { networkType: 'wifi' } }
      };

      statsMonitor._checkNetworkTypeChanges(response);
      eventObserver.emit.resetHistory();
      statsMonitor._checkNetworkTypeChanges(response);

      sinon.assert.notCalled(eventObserver.emit);
    });
  });

  describe('quality limitation tracking', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor(eventObserver, log, { getStats: getStatsStub });
      eventObserver.emit.resetHistory();
    });

    it('should publish event when quality limitation reason changes', () => {
      const trackStats = [{ trackSid: 'MT123', qualityLimitationReason: 'bandwidth' }];

      statsMonitor._checkQualityLimitations(trackStats);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'quality',
        name: 'quality-limitation-state-changed',
        level: 'info',
        payload: {
          trackSid: 'MT123',
          qualityLimitationReason: 'bandwidth'
        }
      });
    });

    it('should not publish event when reason stays the same', () => {
      const trackStats = [{ trackSid: 'MT123', qualityLimitationReason: 'bandwidth' }];

      statsMonitor._checkQualityLimitations(trackStats);
      eventObserver.emit.resetHistory();
      statsMonitor._checkQualityLimitations(trackStats);

      sinon.assert.notCalled(eventObserver.emit);
    });
  });

  describe('track stall detection', () => {
    beforeEach(() => {
      statsMonitor = new StatsMonitor(eventObserver, log, { getStats: getStatsStub });
      eventObserver.emit.resetHistory();
    });

    it('should publish track-stalled event when frame rate drops below threshold', () => {
      statsMonitor._checkTrackStalls([{ trackSid: 'MT123', frameRateReceived: 0.3 }]);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'track-warning-raised',
        name: 'track-stalled',
        level: 'warning',
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
      eventObserver.emit.resetHistory();

      statsMonitor._checkTrackStalls([{ trackSid: 'MT123', frameRateReceived: 10 }]);

      sinon.assert.calledWith(eventObserver.emit, 'event', {
        group: 'track-warning-cleared',
        name: 'track-stalled',
        level: 'info',
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
      statsMonitor = new StatsMonitor(eventObserver, log, { getStats: getStatsStub });
      statsMonitor._stalledTrackSids.add('MT456');

      statsMonitor.cleanup();

      assert.strictEqual(statsMonitor._interval, null);
      assert.strictEqual(statsMonitor._stalledTrackSids.size, 0);
    });
  });
});
