'use strict';

const { EventEmitter } = require('events');

const { CloseReason: { LOCAL } } = require('../twilioconnection');

const GROUPS = {
  SIGNALING: 'signaling'
};

const LEVELS = {
  DEBUG: 'debug',
  ERROR: 'error',
  INFO: 'info',
  WARNING: 'warning'
};

const eventNamesToGroups = {
  closed: GROUPS.SIGNALING,
  connecting: GROUPS.SIGNALING,
  early: GROUPS.SIGNALING,
  open: GROUPS.SIGNALING,
  waiting: GROUPS.SIGNALING
};

const eventNamesToLevels = {
  closed(payload) {
    return payload.reason === LOCAL ? LEVELS.INFO : LEVELS.ERROR;
  },
  connecting: LEVELS.INFO,
  early: LEVELS.INFO,
  open: LEVELS.INFO,
  waiting: LEVELS.WARNING
};

/**
 * EventObserver listens to SDK events and re-emits them on the
 * @link EventListener} with some additional information.
 * @extends EventEmitter
 * @emits EventObserver#event
 */
class EventObserver extends EventEmitter {
  /**
   * Constructor.
   * @param {number} connectTimestamp
   * @param {EventListener} eventListener
   */
  constructor(connectTimestamp, eventListener = null) {
    super();

    if (eventListener) {
      this.on('event', ({ name, payload }) => {
        const timestamp = Date.now();
        const elapsedTime = timestamp - connectTimestamp;
        const group = eventNamesToGroups[name];

        const level = typeof eventNamesToLevels[name] === 'function'
          ? eventNamesToLevels[name](payload)
          : eventNamesToLevels[name];

        const event = Object.assign(payload ? { payload } : {}, {
          elapsedTime,
          group,
          level,
          name,
          timestamp
        });

        eventListener.emit('event', event);
      });
    }
  }
}

/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */

module.exports = EventObserver;
