'use strict';

const assert = require('assert');
const sinon = require('sinon');
const telemetry = require('../../../../lib/insights/telemetry');

describe('Telemetry', () => {
  let mockPublisher;
  let mockLog;
  let connectTimestamp;

  beforeEach(() => {
    connectTimestamp = Date.now();
    mockPublisher = { publish: sinon.spy() };
    mockLog = {
      debug: sinon.spy(),
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy()
    };
  });

  afterEach(() => {
    telemetry.unregisterPublisher();
  });

  describe('event publishing', () => {
    it('should publish events with enriched payload and log at correct level', () => {
      telemetry.registerPublisher(mockPublisher, connectTimestamp, mockLog);

      telemetry.info({ group: 'network', name: 'type-changed', payload: { type: 'wifi' } });
      telemetry.warning({ group: 'quality', name: 'degraded', payload: { reason: 'cpu' } });
      telemetry.error({ group: 'connection', name: 'failed' });

      sinon.assert.calledThrice(mockPublisher.publish);
      sinon.assert.calledWith(mockPublisher.publish.getCall(0), 'network', 'type-changed', sinon.match({
        level: 'info',
        type: 'wifi',
        elapsedTime: sinon.match.number
      }));
      sinon.assert.calledWith(mockPublisher.publish.getCall(1), 'quality', 'degraded', sinon.match({
        level: 'warning',
        reason: 'cpu',
        elapsedTime: sinon.match.number
      }));
      sinon.assert.calledWith(mockPublisher.publish.getCall(2), 'connection', 'failed', sinon.match({
        level: 'error',
        elapsedTime: sinon.match.number
      }));

      sinon.assert.calledOnce(mockLog.info);
      sinon.assert.calledOnce(mockLog.warn);
      sinon.assert.calledOnce(mockLog.error);
    });

    it('should not publish when no publisher is registered', () => {
      telemetry.info({ group: 'test', name: 'event' });
      telemetry.warning({ group: 'test', name: 'event' });
      telemetry.error({ group: 'test', name: 'event' });

      sinon.assert.notCalled(mockPublisher.publish);
    });
  });

  describe('lifecycle', () => {
    it('should stop publishing after unregister', () => {
      telemetry.registerPublisher(mockPublisher, connectTimestamp, mockLog);
      telemetry.info({ group: 'test', name: 'event1' });

      sinon.assert.calledOnce(mockPublisher.publish);

      telemetry.unregisterPublisher();
      telemetry.info({ group: 'test', name: 'event2' });

      sinon.assert.calledOnce(mockPublisher.publish);
      assert.strictEqual(telemetry.isEnabled, false);
    });
  });
});
