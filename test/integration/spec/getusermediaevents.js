'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const { connect, createLocalTracks } = require('../../../es5');

const getToken = require('../../lib/token');
const { randomName, waitFor } = require('../../lib/util');

describe('getUserMedia Event Reporting', function() {
  let room;

  afterEach(() => {
    if (room) {
      room.disconnect();
      room = null;
    }
  });

  function createEventCollector() {
    const eventListener = new EventEmitter();
    const events = [];

    eventListener.on('event', event => {
      if (event.group === 'get-user-media') {
        events.push(event);
      }
    });

    return { eventListener, events };
  }

  function assertEventStructure(event, expectedName, expectedLevel = 'info') {
    assert.strictEqual(event.group, 'get-user-media');
    assert.strictEqual(event.name, expectedName);
    assert.strictEqual(event.level, expectedLevel);
  }

  describe('successful getUserMedia flow', () => {
    it('should publish succeeded event during connect', async function() {
      const { eventListener, events } = createEventCollector();

      room = await connect(getToken(randomName()), {
        name: randomName(),
        audio: true,
        video: true,
        insights: true,
        eventListener
      });

      await waitFor(() => events.length > 0, 'getUserMedia succeeded event to be published');

      assert.strictEqual(events.length, 1, `Expected 1 event but got ${events.length}`);
      assertEventStructure(events[0], 'succeeded');
    });
  });

  describe('getUserMedia failure scenarios', () => {
    it('should publish denied event on permission error', async function() {
      const { eventListener, events } = createEventCollector();
      const permissionError = Object.assign(new Error('Permission denied'), {
        name: 'NotAllowedError'
      });

      let connectError;
      try {
        await connect(getToken(randomName()), {
          name: randomName(),
          audio: true,
          video: true,
          insights: true,
          eventListener,
          getUserMedia: sinon.stub().rejects(permissionError)
        });
      } catch (error) {
        connectError = error;
      }

      assert(connectError, 'Connect should have failed due to getUserMedia permission error');

      await waitFor(() => events.length > 0, 'denied event to be published');

      assert.strictEqual(events.length, 1);
      assertEventStructure(events[0], 'denied');
    });

    it('should publish failed event with error details on technical failure', async function() {
      const { eventListener, events } = createEventCollector();
      const expectedError = Object.assign(new Error('Camera not available'), {
        name: 'NotReadableError'
      });

      let connectError;
      try {
        await connect(getToken(randomName()), {
          name: randomName(),
          audio: true,
          video: true,
          insights: true,
          eventListener,
          getUserMedia: sinon.stub().rejects(expectedError)
        });
      } catch (error) {
        connectError = error;
      }

      assert(connectError, 'Connect should have failed due to getUserMedia expected error');

      await waitFor(() => events.length > 0, 'failed event to be published');

      assert.strictEqual(events.length, 1);
      assertEventStructure(events[0], 'failed');

      const { payload } = events[0];
      assert(payload && payload.error, 'Failed event should include error payload');
      assert.strictEqual(payload.error.name, 'NotReadableError');
      assert.strictEqual(payload.error.message, 'Camera not available');
    });
  });

  describe('insights configuration', () => {
    it('should not publish events when insights are disabled', async function() {
      const { eventListener, events } = createEventCollector();

      room = await connect(getToken(randomName()), {
        name: randomName(),
        audio: true,
        video: true,
        insights: false,
        eventListener
      });

      await waitFor(() => room.state === 'connected', 'room to be connected');

      assert.strictEqual(events.length, 0,
        'No getUserMedia events should be published when insights are disabled');
    });
  });

  describe('standalone createLocalTracks behavior', () => {
    it('should not publish events when called outside connect flow', async function() {
      const { eventListener, events } = createEventCollector();

      const tracks = await createLocalTracks({
        audio: true,
        video: true,
        eventListener
      });

      tracks.forEach(track => track.stop());
      await waitFor(() => tracks.every(track => track.isStopped), 'all tracks to be stopped');

      assert.strictEqual(events.length, 0,
        'No getUserMedia events should be published for standalone createLocalTracks calls');
    });
  });
});
