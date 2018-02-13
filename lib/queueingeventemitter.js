'use strict';

const EventEmitter = require('events').EventEmitter;

/**
 * A {@link QueueingEventEmitter} can queue events until a listener has been
 * added.
 * @extends EventEmitter
 */
class QueueingEventEmitter extends EventEmitter {
  /**
   * Construct a {@link QueueingEventEmitter}
   */
  constructor() {
    super();
    Object.defineProperties(this, {
      _queuedEvents: {
        value: new Map()
      }
    });
  }

  /**
   * Emit any queued events.
   * @returns {boolean} true if every event had listeners, false otherwise
  *//**
   * Emit any queued events matching the event name.
   * @param {string} event
   * @returns {boolean} true if every event had listeners, false otherwise
   */
  dequeue(event) {
    let result = true;
    if (!event) {
      this._queuedEvents.forEach(function(_, queuedEvent) {
        result = this.dequeue(queuedEvent) && result;
      }, this);
      return result;
    }
    const queue = this._queuedEvents.get(event) || [];
    this._queuedEvents.delete(event);
    return queue.reduce((result, args) => this.emit(...[event].concat(args)) && result, result);
  }

  /**
   * If the event has listeners, emit the event; otherwise, queue the event.
   * @param {string} event
   * @param {...*} args
   * @returns {boolean} true if the event had listeners, false if the event was queued
   */
  queue() {
    const args = [].slice.call(arguments);
    if (this.emit(...args)) {
      return true;
    }
    const event = args[0];
    if (!this._queuedEvents.has(event)) {
      this._queuedEvents.set(event, []);
    }
    this._queuedEvents.get(event).push(args.slice(1));
    return false;
  }
}

module.exports = QueueingEventEmitter;
