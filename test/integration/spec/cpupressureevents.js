'use strict';

const assert = require('assert');
const { EventEmitter } = require('events');

const { connect } = require('../../../es5');
const defaults = require('../../lib/defaults');
const { createRoom, completeRoom } = require('../../lib/rest');
const getToken = require('../../lib/token');
const { randomName, waitFor } = require('../../lib/util');

class MockPressureObserver {
  static instances = [];
  static activeInstances = [];

  static simulatePressureChange(state) {
    MockPressureObserver.activeInstances.forEach(instance => {
      instance._simulatePressureChange(state);
    });
  }

  static getActiveCount() {
    return MockPressureObserver.activeInstances.length;
  }

  static reset() {
    MockPressureObserver.instances = [];
    MockPressureObserver.activeInstances = [];
  }

  constructor(callback) {
    this.callback = callback;
    this.isObserving = false;
    MockPressureObserver.instances.push(this);
  }

  observe(source, options) {
    this.isObserving = true;
    this.source = source;
    this.options = options;
    MockPressureObserver.activeInstances.push(this);
  }

  disconnect() {
    this.isObserving = false;
    const index = MockPressureObserver.activeInstances.indexOf(this);
    if (index > -1) {
      MockPressureObserver.activeInstances.splice(index, 1);
    }
  }

  _simulatePressureChange(state) {
    if (this.isObserving) {
      const mockRecord = {
        state,
        source: 'cpu',
        time: Date.now(),
      };
      this.callback([mockRecord]);
    }
  }
}

describe('CPU Pressure Events', function() {

  let room;
  let roomName;
  let token;
  let originalPressureObserver;

  beforeEach(async () => {
    roomName = randomName();
    await createRoom(roomName, defaults.topology);
    token = getToken(randomName());

    originalPressureObserver = globalThis.PressureObserver;
    globalThis.PressureObserver = MockPressureObserver;
  });

  afterEach(async () => {
    if (room) {
      room.disconnect();
      room = null;
    }

    if (globalThis.PressureObserver && globalThis.PressureObserver.reset) {
      globalThis.PressureObserver.reset();
    }

    globalThis.PressureObserver = originalPressureObserver;

    if (roomName) {
      await completeRoom(roomName);
    }
  });

  describe('when PressureObserver is supported', () => {
    it('should emit CPU pressure events with correct structure', async () => {
      const eventListener = new EventEmitter();
      const cpuEvents = [];
      eventListener.on('event', event => {
        if (event.group === 'cpu') {
          cpuEvents.push(event);
        }
      });

      room = await connect(token, {
        name: roomName,
        audio: false,
        video: false,
        eventListener
      });

      // Wait for pressure monitoring to start
      await waitFor(() => {
        return globalThis.PressureObserver.getActiveCount() > 0;
      }, 'CPU pressure monitoring should start');

      globalThis.PressureObserver.simulatePressureChange('critical');

      await waitFor(() => cpuEvents.length > 0, 'CPU pressure event should be emitted');

      const event = cpuEvents[0];
      assert.strictEqual(event.group, 'cpu');
      assert.strictEqual(event.name, 'pressure-changed');
      assert.strictEqual(event.level, 'info');
      assert.strictEqual(event.payload.pressure, 'critical');
    });

    it('should emit events for all CPU pressure states', async () => {
      const eventListener = new EventEmitter();
      const cpuEvents = [];
      eventListener.on('event', event => {
        if (event.group === 'cpu') {
          cpuEvents.push(event);
        }
      });

      room = await connect(token, {
        name: roomName,
        audio: false,
        video: false,
        eventListener
      });

      await waitFor(() => {
        return globalThis.PressureObserver.getActiveCount() > 0;
      }, 'CPU pressure monitoring should start');

      const expectedStates = ['nominal', 'fair', 'serious', 'critical'];

      for (const state of expectedStates) {
        globalThis.PressureObserver.simulatePressureChange(state);
      }

      await waitFor(() => cpuEvents.length === expectedStates.length, 'All CPU pressure events should be emitted');

      expectedStates.forEach((state, index) => {
        const event = cpuEvents[index];
        assert.strictEqual(event.group, 'cpu');
        assert.strictEqual(event.name, 'pressure-changed');
        assert.strictEqual(event.level, 'info');
        assert.strictEqual(event.payload.pressure, state);
      });
    });

    it('should stop emitting CPU pressure events when Room disconnects', async () => {
      const eventListener = new EventEmitter();
      const cpuEvents = [];
      eventListener.on('event', event => {
        if (event.group === 'cpu') {
          cpuEvents.push(event);
        }
      });

      room = await connect(token, {
        name: roomName,
        audio: false,
        video: false,
        eventListener
      });

      await waitFor(() => {
        return globalThis.PressureObserver.getActiveCount() > 0;
      }, 'CPU pressure monitoring should start');

      assert(globalThis.PressureObserver.getActiveCount() > 0, 'Should be observing initially');

      room.disconnect();

      await waitFor(() => globalThis.PressureObserver.getActiveCount() === 0, 'Should stop observing after disconnect');

      // Try to simulate pressure change after disconnect - should not emit events
      const initialEventCount = cpuEvents.length;
      globalThis.PressureObserver.simulatePressureChange('critical');

      // Wait a bit to ensure no event is emitted
      await new Promise(resolve => setTimeout(resolve, 100));

      assert.strictEqual(cpuEvents.length, initialEventCount, 'Should not emit events after disconnect');
    });
  });

  describe('when PressureObserver is not supported', () => {
    beforeEach(() => {
      delete globalThis.PressureObserver;
    });

    it('should not emit CPU pressure events', async () => {
      const eventListener = new EventEmitter();
      const cpuEvents = [];
      eventListener.on('event', event => {
        if (event.group === 'cpu') {
          cpuEvents.push(event);
        }
      });

      room = await connect(token, {
        name: roomName,
        audio: false,
        video: false,
        eventListener
      });

      assert.strictEqual(cpuEvents.length, 0, 'Should not emit CPU pressure events');
    });
  });

  describe('when insights are disabled', () => {
    it('should not emit CPU pressure events', async () => {
      const eventListener = new EventEmitter();
      const cpuEvents = [];
      eventListener.on('event', event => {
        if (event.group === 'cpu') {
          cpuEvents.push(event);
        }
      });

      room = await connect(token, {
        name: roomName,
        audio: false,
        video: false,
        insights: false,
        eventListener
      });

      globalThis.PressureObserver.simulatePressureChange('critical');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.strictEqual(cpuEvents.length, 0, 'Should not emit CPU pressure events when insights are disabled');
    });
  });
});
