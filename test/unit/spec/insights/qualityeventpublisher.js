'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const QualityEventPublisher = require('../../../../lib/insights/qualityeventpublisher');

describe('QualityEventPublisher', () => {
  let eventObserver;
  let mockLog;
  let publisher;
  let emittedEvents;

  beforeEach(() => {
    eventObserver = new EventEmitter();
    mockLog = {
      debug: sinon.stub(),
      error: sinon.stub(),
    };
    publisher = new QualityEventPublisher(eventObserver, mockLog, { publishIntervalMs: 0 });
    emittedEvents = [];

    eventObserver.on('event', event => {
      emittedEvents.push(event);
    });
  });

  function createMockStats(tracks) {
    const stats = new Map();

    tracks.forEach(({ trackId, qualityLimitationReason }) => {
      const statId = `outbound-rtp-${trackId}`;
      stats.set(statId, {
        type: 'outbound-rtp',
        trackId,
        qualityLimitationReason,
        isRemote: false,
      });
    });

    return stats;
  }

  it('should publish an event when a quality limitation reason is first detected', () => {
    const trackId = 'track1';
    const qualityLimitationReason = 'cpu';

    const stats = createMockStats([{ trackId, qualityLimitationReason }]);

    publisher.processStats(stats);

    assert.strictEqual(emittedEvents.length, 1);
    const event = emittedEvents[0];

    assert.strictEqual(event.group, 'quality');
    assert.strictEqual(event.name, 'quality-limitation-state-changed');
    assert.strictEqual(event.level, 'info');
    assert.deepStrictEqual(event.payload, {
      trackId,
      qualityLimitationReason,
    });
  });

  it('should not publish an event when the quality limitation reason stays the same', () => {
    const trackId = 'track1';
    const qualityLimitationReason = 'cpu';
    const stats = createMockStats([{ trackId, qualityLimitationReason }]);

    publisher.processStats(stats);
    publisher.processStats(stats);

    assert.strictEqual(emittedEvents.length, 1);
  });

  it('should publish an event when the quality limitation reason changes', () => {
    const trackId = 'track1';
    const initialReason = 'cpu';
    const newReason = 'bandwidth';

    publisher.processStats(createMockStats([{ trackId, qualityLimitationReason: initialReason }]));

    publisher.processStats(createMockStats([{ trackId, qualityLimitationReason: newReason }]));

    assert.strictEqual(emittedEvents.length, 2);

    const changeEvent = emittedEvents[1];
    assert.deepStrictEqual(changeEvent.payload, {
      trackId,
      qualityLimitationReason: newReason,
    });
  });

  it('should handle multiple tracks independently', () => {
    const track1 = 'track1';
    const track2 = 'track2';

    publisher.processStats(
      createMockStats([
        { trackId: track1, qualityLimitationReason: 'cpu' },
        { trackId: track2, qualityLimitationReason: 'bandwidth' },
      ])
    );

    assert.strictEqual(emittedEvents.length, 2);

    publisher.processStats(
      createMockStats([
        { trackId: track1, qualityLimitationReason: 'other' },
        { trackId: track2, qualityLimitationReason: 'bandwidth' },
      ])
    );

    assert.strictEqual(emittedEvents.length, 3);

    const changeEvent = emittedEvents[2];
    assert.strictEqual(changeEvent.payload.trackId, track1);
    assert.strictEqual(changeEvent.payload.qualityLimitationReason, 'other');
  });

  it('should reset the stored state when cleanup is called', () => {
    const trackId = 'track1';
    const qualityLimitationReason = 'cpu';
    const stats = createMockStats([{ trackId, qualityLimitationReason }]);

    publisher.processStats(stats);
    assert.strictEqual(emittedEvents.length, 1);

    publisher.cleanup();
    publisher.processStats(stats);
    assert.strictEqual(emittedEvents.length, 2);
  });
});
