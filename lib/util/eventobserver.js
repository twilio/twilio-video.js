/* eslint-disable no-console */
'use strict';

const { EventEmitter } = require('events');

const VALID_GROUPS = [
  'signaling',
  'room',
  'media',
  'quality',
  'video-processor'
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
   * @param {InsightsPublisher} publisher
   * @param {number} connectTimestamp
   * @param {Log} log
   * @param {EventListener} [eventListener]
   */
  constructor(publisher, connectTimestamp, log, eventListener = null) {
    super();
    if (!publisher.publish) {
      console.trace('makarand wrong publsher');
      throw new Error('makarand wrong publsher');
    }

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

      const publisherPayload = Object.assign({ elapsedTime, level }, payload ? payload : {});
      publisher.publish(group, name, publisherPayload);

      const event = Object.assign({
        elapsedTime,
        group,
        level,
        name,
        timestamp
      }, payload ? { payload } : {});

      const logLevel = {
        debug: 'debug',
        error: 'error',
        info: 'info',
        warning: 'warn',
      }[level];
      log[logLevel]('event', event);

      if (eventListener && group === 'signaling') {
        eventListener.emit('event', event);
      }
    });
  }
}

/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */

module.exports = EventObserver;
