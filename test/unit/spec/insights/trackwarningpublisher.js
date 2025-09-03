'use strict';

const assert = require('node:assert');
const { EventEmitter } = require('node:events');

const fakeLog = require('../../../lib/fakelog');
const TrackWarningPublisher = require('../../../../lib/insights/trackwarningpublisher');

describe('TrackWarningPublisher', () => {
  let eventObserver;
  let publisher;
  let emittedEvents;

  beforeEach(() => {
    eventObserver = new EventEmitter();
    publisher = new TrackWarningPublisher(eventObserver, fakeLog);
    emittedEvents = [];

    eventObserver.on('event', event => emittedEvents.push(event));
  });

  function createMockRemoteVideoStats(tracks) {
    const stats = {
      remoteVideoTrackStats: tracks.map(({ trackSid, frameRate }) => ({
        trackSid,
        frameRate,
      })),
    };
    return stats;
  }

  it('should detect and publish stalled track events', () => {
    const stalledStat = {
      trackSid: 'MT123',
      frameRate: 0.1,
    };
    publisher.processStats(
      createMockRemoteVideoStats([
        stalledStat,
      ])
    );

    assert.equal(emittedEvents.length, 1);
    const event = emittedEvents[0];

    assert.equal(event.group, 'track-warning-raised');
    assert.equal(event.name, 'track-stalled');
    assert.equal(event.level, 'warning');
    assert.equal(event.payload.trackSID, stalledStat.trackSid);
    assert.equal(event.payload.trackType, 'video');
    assert.equal(event.payload.frameRate, stalledStat.frameRate);
    assert.equal(event.payload.threshold, publisher._stallThreshold);
  });

  it('should not publish duplicate stalled events for the same track', () => {
    const trackSid = 'MT123';

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: 0.2 }]));
    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: 0.1 }]));
    assert.equal(emittedEvents.length, 1);
  });

  it('should publish cleared events when frame rate improves', () => {
    const trackSid = 'MT123';

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: 0.2 }]));

    publisher.processStats(
      createMockRemoteVideoStats([
        { trackSid, frameRate: 15 },
      ])
    );
    assert.equal(emittedEvents.length, 2);
    const event = emittedEvents[1];

    assert.equal(event.group, 'track-warning-cleared');
    assert.equal(event.name, 'track-stalled');
    assert.equal(event.level, 'info');
    assert.equal(event.payload.trackSID, trackSid);
    assert.equal(event.payload.trackType, 'video');
    assert.equal(event.payload.frameRate, 15);
    assert.equal(event.payload.threshold, publisher._stallThreshold);
  });

  it('should not publish cleared events for tracks that were not stalled', () => {
    const trackSid = 'MT123';

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: publisher._resumeThreshold }]));
    assert.equal(emittedEvents.length, 0);
  });

  it('should not publish events for undefined or null frame rates', () => {
    const trackSid = 'MT123';

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: undefined }]));
    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: null }]));
    assert.equal(emittedEvents.length, 0);
  });

  it('should handle boundary values correctly', () => {
    const trackSid = 'MT123';

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: publisher._stallThreshold }]));
    assert.equal(emittedEvents.length, 0);

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: publisher._stallThreshold - 0.1 }]));
    assert.equal(emittedEvents.length, 1);
    assert.equal(emittedEvents[0].group, 'track-warning-raised');

    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: publisher._resumeThreshold }]));

    assert.equal(emittedEvents.length, 2);
    assert.equal(emittedEvents[1].group, 'track-warning-cleared');
  });

  it('should track multiple tracks independently', () => {
    const track1 = 'MT123';
    const track2 = 'MT456';

    publisher.processStats(
      createMockRemoteVideoStats([
        { trackSid: track1, frameRate: 0.2 },
        { trackSid: track2, frameRate: 0.3 },
      ])
    );
    assert.equal(emittedEvents.length, 2);

    publisher.processStats(
      createMockRemoteVideoStats([
        { trackSid: track1, frameRate: 30 },
        { trackSid: track2, frameRate: 0.3 },
      ])
    );
    assert.equal(emittedEvents.length, 3);
    assert.equal(emittedEvents[2].payload.trackSID, track1);
    assert.equal(emittedEvents[2].group, 'track-warning-cleared');

    publisher.processStats(
      createMockRemoteVideoStats([
        { trackSid: track1, frameRate: 0.2 },
        { trackSid: track2, frameRate: 0.3 },
      ])
    );
    assert.equal(emittedEvents.length, 4);
    assert.equal(emittedEvents[3].payload.trackSID, track1);
    assert.equal(emittedEvents[3].group, 'track-warning-raised');
  });

  it('should reset the stored state when cleanup is called', () => {
    const trackSid = 'MT123';

    // Report a stalled track for the first time
    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: 0.2 }]));
    assert.equal(emittedEvents.length, 1);

    publisher.cleanup();

    // After cleanup, reporting the same stalled track should emit the event again
    publisher.processStats(createMockRemoteVideoStats([{ trackSid, frameRate: 0.2 }]));
    assert.equal(emittedEvents.length, 2);
  });

  it('should handle empty stats objects', () => {
    publisher.processStats({});
    publisher.processStats({ remoteVideoTrackStats: [] });
    publisher.processStats(null);
    publisher.processStats(undefined);

    assert.equal(emittedEvents.length, 0);
  });
});
