'use strict';

const EventEmitter = require('events').EventEmitter;

class EventTarget {
  constructor() {
    Object.defineProperties(this, {
      _eventEmitter: {
        value: new EventEmitter()
      }
    });
  }

  dispatchEvent(event) {
    return this._eventEmitter.emit(event.type, event);
  }

  addEventListener() {
    return this._eventEmitter.addListener(...arguments);
  }

  removeEventListener() {
    return this._eventEmitter.removeListener(...arguments);
  }
}

module.exports = EventTarget;
