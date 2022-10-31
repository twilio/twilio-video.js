// 'use strict';

// const EventEmitter = require('events').EventEmitter;

// /**
//  * Event target.
//  * @class
//  */
// class EventTarget {
//   constructor() {
//     Object.defineProperties(this, {
//       _eventEmitter: {
//         value: new EventEmitter()
//       }
//     });
//   }

//   /**
//    * Dispatch an Event to the {@link EventTarget}.
//    * @param {Event} event
//    */
//   dispatchEvent(event) {
//     return this._eventEmitter.emit(event.type, event);
//   }

//   /**
//    * Add an Event listener to the {@link EventTarget}.
//    */
//   addEventListener() {
//     return this._eventEmitter.addListener.apply(this._eventEmitter, arguments);
//   }

//   /**
//    * Remove an Event listener to the {@link EventTarget}.
//    */
//   removeEventListener() {
//     return this._eventEmitter.removeListener.apply(this._eventEmitter, arguments);
//   }
// }

// module.exports = EventTarget;
