'use strict';

var EventEmitter = require('events').EventEmitter;

function EventTarget() {
  Object.defineProperties(this, {
    _eventEmitter: {
      value: new EventEmitter()
    }
  });
}

EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
  return this._eventEmitter.emit(event.type, event);
};

EventTarget.prototype.addEventListener = function addEventListener() {
  return this._eventEmitter.addListener.apply(this._eventEmitter, arguments);
};

EventTarget.prototype.removeEventListener = function removeEventListener() {
  return this._eventEmitter.removeListener.apply(this._eventEmitter, arguments);
};

module.exports = EventTarget;
