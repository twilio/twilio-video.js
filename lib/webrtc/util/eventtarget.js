'use strict';

var EventEmitter = require('events').EventEmitter;

/**
 * Event target.
 * @class
 */
function EventTarget() {
  Object.defineProperties(this, {
    _eventEmitter: {
      value: new EventEmitter()
    }
  });
}

/**
 * Dispatch an Event to the {@link EventTarget}.
 * @param {Event} event
 */
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
  return this._eventEmitter.emit(event.type, event);
};

/**
 * Add an Event listener to the {@link EventTarget}.
 */
EventTarget.prototype.addEventListener = function addEventListener() {
  return this._eventEmitter.addListener.apply(this._eventEmitter, arguments);
};

/**
 * Remove an Event listener to the {@link EventTarget}.
 */
EventTarget.prototype.removeEventListener = function removeEventListener() {
  return this._eventEmitter.removeListener.apply(this._eventEmitter, arguments);
};

module.exports = EventTarget;
