/* eslint-disable no-console */
'use strict';

const { EventEmitter } = require('events');

const VALID_GROUPS = [
  'signaling',
  'room'
];

const VALID_LEVELS = [
  'debug',
  'error',
  'info',
  'warning'
];

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
   * @param {log} Log
   * @param {EventListener} eventListener
   */
  constructor(connectTimestamp, log, eventListener = null) {
    super();

    Object.defineProperties(this, {
      _publisher: {
        value: null,
        writable: true
      }
    });

    this.on('event', ({ name, group, level, payload }) => {
      if (typeof name !== 'string') {
        throw new Error('Unexpected name: ', name);
      }

      if (!VALID_GROUPS.includes(group)) {
        throw new Error('Unexpected group: ', group);
      }

      if (!VALID_LEVELS.includes(level)) {
        throw new Error('Unexpected level: ', level);
      }

      const timestamp = Date.now();
      const elapsedTime = timestamp - connectTimestamp;

      if (this._publisher) {
        const publisherPayload = Object.assign(payload ? payload : {}, { elapsedTime, level });
        this._publisher.publish(group, name, publisherPayload);
      }
      const event = Object.assign(payload ? { payload } : {}, {
        elapsedTime,
        group,
        level,
        name,
        timestamp
      });

      const logLevel = {
        debug: 'debug',
        error: 'error',
        info: 'info',
        warning: 'warn',
      }[level];
      log[logLevel]('event', event);

      if (eventListener && group === 'signaling') {
        const event = Object.assign(payload ? { payload } : {}, {
          elapsedTime,
          group,
          level,
          name,
          timestamp
        });
        eventListener.emit('event', event);
      }
    });
  }

  /**
   * sets the publisher object. Once set events will be send to publisher.
   * @param {InsightsPublisher} publisher
  */
  setPublisher(publisher) {
    this._publisher = publisher;
  }
}

/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */

module.exports = EventObserver;
