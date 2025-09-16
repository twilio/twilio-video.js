'use strict';

/**
 * BufferedEventPublisher provides a base class for any publisher that needs to
 * collect events at one frequency but publish them at another frequency.
 *
 * @example
 * const bufferedPublisher = new BufferedEventPublisher(eventObserver, log, { publishIntervalMs: 5000 });
 * bufferedPublisher._bufferEvent({ group: 'example', name: 'event1', level: 'info', payload: {} });
 * bufferedPublisher._bufferEvent({ group: 'example', name: 'event2', level: 'info', payload: {} });
 *
 * // You can either wait for the next publish interval (5 seconds in this example) or
 * // immediately publish all buffered events using:
 * bufferedPublisher.flush();
 * // Or even disable buffered publishing and start publishing events immediately:
 * bufferedPublisher.disable(true); // Optional, pass true to flush remaining events before disabling
 *
 * // And of course, you can re-enable buffered publishing:
 * bufferedPublisher.enable();
 * // or set a different publish interval:
 * bufferedPublisher.setPublishInterval(2000); // Events will now be published every 2 seconds
 *
 * // Finally, when done, you can clean up resources and this will flush any remaining events and clean up timers:
 * bufferedPublisher.cleanup();
 */
class BufferedEventPublisher {
  /**
   * Create a BufferedEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   * @param {Object} [options] - Configuration options
   * @param {number} [options.publishIntervalMs=10000] - How often to publish buffered events (ms)
   */
  constructor(eventObserver, log, options = {}) {
    const { publishIntervalMs = 10000 } = options;

    this._eventObserver = eventObserver;
    this._log = log;
    this._publishIntervalMs = publishIntervalMs;
    this._pendingEvents = [];
    this._publishTimer = null;
    this._enabled = false;

    if (this._publishIntervalMs > 0) {
      this.enable();
    }
  }

  /**
   * Enable buffered publishing
   */
  enable() {
    if (this._enabled) {
      return;
    }

    this._enabled = true;
    this._scheduleNextPublish();
  }

  /**
   * Disable buffered publishing
   * @param {boolean} [flushRemaining=true] - Whether to flush remaining events
   */
  disable(flushRemaining = true) {
    if (!this._enabled) {
      return;
    }

    this._enabled = false;
    this._clearPublishTimer();

    if (flushRemaining) {
      this.flush();
    }
  }

  /**
   * Buffer an event for later publishing
   * @private
   * @param {Object} event - Event to buffer
   */
  _bufferEvent(event) {
    if (!this._enabled) {
      // If buffering is disabled, publish new events immediately
      this._publishEvent(event);
      return;
    }

    this._pendingEvents.push(event);
  }

  /**
   * Actually publish a single event through the EventObserver
   * @private
   * @param {Object} event - Event to publish
   */
  _publishEvent(event) {
    try {
      this._eventObserver.emit('event', event);
    } catch (error) {
      this._log.error(`Error publishing event ${event.name}:`, error);
    }
  }

  /**
   * Immediately publish all buffered events
   */
  flush() {
    if (this._pendingEvents.length === 0) {
      return;
    }

    this._log.debug(`Publishing ${this._pendingEvents.length} buffered events`);

    // Create a copy and clear the buffer
    const events = [...this._pendingEvents];
    this._pendingEvents = [];

    events.forEach(event => this._publishEvent(event));
  }

  /**
   * Schedule the next publish operation
   * @private
   */
  _scheduleNextPublish() {
    if (!this._enabled || this._publishTimer) {
      return;
    }

    this._publishTimer = setTimeout(() => {
      this._publishTimer = null;
      this.flush();
      this._scheduleNextPublish();
    }, this._publishIntervalMs);
  }

  /**
   * Clear the publish timer
   * @private
   */
  _clearPublishTimer() {
    if (this._publishTimer) {
      clearTimeout(this._publishTimer);
      this._publishTimer = null;
    }
  }

  /**
   * Set a new publish interval
   * @param {number} intervalMs - New interval in milliseconds
   */
  setPublishInterval(intervalMs) {
    this._publishIntervalMs = intervalMs;

    if (this._enabled) {
      // Restart the timer with the new interval
      this._clearPublishTimer();
      this._scheduleNextPublish();
    }
  }

  /**
   * Cleanup resources used by this publisher
   */
  cleanup() {
    this.disable(true);
  }
}

module.exports = BufferedEventPublisher;
