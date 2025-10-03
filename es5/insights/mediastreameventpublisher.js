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
 * // On media acquisition failure: { group: 'get-user-media', name: 'failed', level: 'info', payload: { name, message } }
 */
var MediaStreamEventPublisher = /** @class */ (function () {
    /**
     * Create a MediaStreamEventPublisher
     * @param {EventObserver} eventObserver - The event observer for publishing insights
     * @param {Log} log - Logger instance
     */
    function MediaStreamEventPublisher(eventObserver, log) {
        this._eventObserver = eventObserver;
        this._log = log;
    }
    /**
     * Report successful getUserMedia call
     */
    MediaStreamEventPublisher.prototype.reportSuccess = function () {
        this._publishEvent('succeeded', 'info');
    };
    /**
     * Report permission denied getUserMedia call
     */
    MediaStreamEventPublisher.prototype.reportPermissionDenied = function () {
        this._publishEvent('denied', 'info');
    };
    /**
     * Report failed getUserMedia call (non-permission related)
     * @param {DOMException} error - Error from getUserMedia
     */
    MediaStreamEventPublisher.prototype.reportFailure = function (error) {
        this._publishEvent('failed', 'info', {
            name: error.name,
            message: error.message
        });
    };
    /**
     * Publish an event to the observer
     * @param {string} name - Event name
     * @param {string} level - Event level
     * @param {Object} [payload] - Event payload
     * @private
     */
    MediaStreamEventPublisher.prototype._publishEvent = function (name, level, payload) {
        this._eventObserver.emit('event', {
            group: 'get-user-media',
            name: name,
            level: level,
            payload: payload
        });
    };
    return MediaStreamEventPublisher;
}());
module.exports = MediaStreamEventPublisher;
//# sourceMappingURL=mediastreameventpublisher.js.map