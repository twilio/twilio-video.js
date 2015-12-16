'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

/**
 * Construct a {@link QueueingEventEmitter}
 * @class
 * @classdesc A {@link QueueingEventEmitter} can queue events until a listener
 *   has been added.
 * @extends EventEmitter
 */
function QueueingEventEmitter() {
  EventEmitter.call(this);
  Object.defineProperties(this, {
    _queuedEvents: {
      value: new Map()
    }
  });
}

inherits(QueueingEventEmitter, EventEmitter);

/**
 * Emit any queued events.
 * @returns {boolean} true if every event had listeners, false otherwise
*//**
 * Emit any queued events matching the event name.
 * @param {string} event
 * @returns {boolean} true if every event had listeners, false otherwise
 */
QueueingEventEmitter.prototype.dequeue = function dequeue(event) {
  var result = true;
  if (!event) {
    this._queuedEvents.forEach(function(_, queuedEvent) {
      result = this.dequeue(queuedEvent) && result;
    }, this);
    return result;
  }
  var queue = this._queuedEvents.get(event) || [];
  this._queuedEvents.delete(event);
  var self = this;
  return queue.reduce(function(result, args) {
    return self.emit.apply(self, [event].concat(args)) && result;
  }, result);
};

/**
 * If the event has listeners, emit the event; otherwise, queue the event.
 * @param {string} event
 * @param {...*} args
 * @returns {boolean} true if the event had listeners, false if the event was queued
 */
QueueingEventEmitter.prototype.queue = function queue() {
  var args = [].slice.call(arguments);
  if (this.emit.apply(this, args)) {
    return true;
  }
  var event = args[0];
  if (!this._queuedEvents.has(event)) {
    this._queuedEvents.set(event, []);
  }
  this._queuedEvents.get(event).push(args.slice(1));
  return false;
};

module.exports = QueueingEventEmitter;
