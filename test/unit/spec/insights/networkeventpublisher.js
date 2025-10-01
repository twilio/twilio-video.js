'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');
const NetworkEventPublisher = require('../../../../lib/insights/networkeventpublisher');

describe('NetworkEventPublisher', () => {
  let eventObserver;
  let mockLog;
  let publisher;
  let emittedEvents;
  let mockConnection;
  let originalNavigator;

  beforeEach(() => {
    eventObserver = new EventEmitter();
    mockLog = {
      warn: sinon.stub(),
      error: sinon.stub()
    };
    emittedEvents = [];

    eventObserver.on('event', event => {
      emittedEvents.push(event);
    });

    originalNavigator = globalThis.navigator;

    mockConnection = {
      downlink: 10,
      downlinkMax: 20,
      effectiveType: '4g',
      rtt: 50,
      saveData: false,
      type: 'wifi',
      addEventListener: sinon.stub(),
      removeEventListener: sinon.stub()
    };
  });

  afterEach(() => {
    if (publisher) {
      publisher.cleanup();
    }
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true
    });
  });

  describe('when NetworkInformation API is supported', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: { connection: mockConnection },
        writable: true,
        configurable: true
      });
    });

    it('should setup network monitoring', () => {
      publisher = new NetworkEventPublisher(eventObserver, mockLog);

      assert(mockConnection.addEventListener.calledTwice);
      assert(mockConnection.addEventListener.calledWith('change'));
      assert(mockConnection.addEventListener.calledWith('typechange'));
      sinon.assert.notCalled(mockLog.warn);
    });

    it('should publish network-information-changed event', () => {
      publisher = new NetworkEventPublisher(eventObserver, mockLog);
      const changeHandler = mockConnection.addEventListener.args[0][1];

      changeHandler();

      assert.strictEqual(emittedEvents.length, 1);
      const event = emittedEvents[0];
      assert.strictEqual(event.group, 'network');
      assert.strictEqual(event.name, 'network-information-changed');
      assert.strictEqual(event.level, 'info');
      assert.strictEqual(event.payload.downlink, 10);
      assert.strictEqual(event.payload.downlinkMax, 20);
      assert.strictEqual(event.payload.effectiveType, '4g');
      assert.strictEqual(event.payload.rtt, 50);
      assert.strictEqual(event.payload.saveData, 'false');
      assert.strictEqual(event.payload.type, 'wifi');
    });

    it('should convert saveData to string', () => {
      mockConnection.saveData = true;
      publisher = new NetworkEventPublisher(eventObserver, mockLog);
      const changeHandler = mockConnection.addEventListener.args[0][1];

      changeHandler();

      assert.strictEqual(emittedEvents[0].payload.saveData, 'true');
    });

    it('should cleanup event listeners', () => {
      publisher = new NetworkEventPublisher(eventObserver, mockLog);

      publisher.cleanup();

      assert(mockConnection.removeEventListener.calledTwice);
      assert(mockConnection.removeEventListener.calledWith('change'));
      assert(mockConnection.removeEventListener.calledWith('typechange'));
    });
  });

  describe('when NetworkInformation API is not supported', () => {
    beforeEach(() => {
      Object.defineProperty(globalThis, 'navigator', {
        value: {},
        writable: true,
        configurable: true
      });
    });

    it('should log a warning', () => {
      publisher = new NetworkEventPublisher(eventObserver, mockLog);

      sinon.assert.calledOnce(mockLog.warn);
      sinon.assert.calledWith(mockLog.warn, 'NetworkInformation not supported');
      assert.strictEqual(publisher._networkMonitor, null);
    });
  });
});
