'use strict';

/**
 * MediaStreamEventPublisher handles publishing getUserMedia events to the Twilio Video SDK insights.
 *
 * @example
 * const mediaStreamPublisher = new MediaStreamEventPublisher(eventObserver, log);
 *
 * // Report events directly from createLocalTracks
 * mediaStreamPublisher.reportSuccess();
 * mediaStreamPublisher.reportPermissionDenied();
 * mediaStreamPublisher.reportFailure(error);
 *
 * // Events published:
 * // On success: { group: 'get-user-media', name: 'succeeded', level: 'info' }
 * // On permission denied: { group: 'get-user-media', name: 'denied', level: 'info' }
 * // On media acquisition failure: { group: 'get-user-media', name: 'failed', level: 'info', payload: { error: { name, message } } }
 */
class MediaStreamEventPublisher {
  /**
   * Create a MediaStreamEventPublisher
   * @param {EventObserver} eventObserver - The event observer for publishing insights
   * @param {Log} log - Logger instance
   */
  constructor(eventObserver, log) {
    this._eventObserver = eventObserver;
    this._log = log;
  }

  /**
   * Report successful getUserMedia call
   */
  reportSuccess() {
    this._publishEvent('succeeded', 'info');
  }

  /**
   * Report permission denied getUserMedia call
   */
  reportPermissionDenied() {
    this._publishEvent('denied', 'info');
  }

  /**
   * Report failed getUserMedia call (non-permission related)
   * @param {Error} error - The error that occurred
   */
  reportFailure(error) {
    this._publishEvent('failed', 'info', {
      error: {
        name: error.name,
        message: error.message
      }
    });
  }

  /**
   * Publish an event to the observer
   * @param {string} name - Event name
   * @param {string} level - Event level
   * @param {Object} [payload] - Event payload
   * @private
   */
  _publishEvent(name, level, payload) {
    this._eventObserver.emit('event', {
      group: 'get-user-media',
      name,
      level,
      payload
    });
  }
}

module.exports = MediaStreamEventPublisher;
