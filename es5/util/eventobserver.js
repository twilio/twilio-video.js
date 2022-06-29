/* eslint-disable no-console */
'use strict';
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var EventEmitter = require('events').EventEmitter;
var VALID_GROUPS = [
    'signaling',
    'room',
    'media',
    'quality',
    'video-processor',
    'preflight'
];
var VALID_LEVELS = [
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
var EventObserver = /** @class */ (function (_super) {
    __extends(EventObserver, _super);
    /**
     * Constructor.
     * @param {InsightsPublisher} publisher
     * @param {number} connectTimestamp
     * @param {Log} log
     * @param {EventListener} [eventListener]
     */
    function EventObserver(publisher, connectTimestamp, log, eventListener) {
        if (eventListener === void 0) { eventListener = null; }
        var _this = _super.call(this) || this;
        _this.on('event', function (_a) {
            var name = _a.name, group = _a.group, level = _a.level, payload = _a.payload;
            if (typeof name !== 'string') {
                log.error('Unexpected name: ', name);
                throw new Error('Unexpected name: ', name);
            }
            if (!VALID_GROUPS.includes(group)) {
                log.error('Unexpected group: ', group);
                throw new Error('Unexpected group: ', group);
            }
            if (!VALID_LEVELS.includes(level)) {
                log.error('Unexpected level: ', level);
                throw new Error('Unexpected level: ', level);
            }
            var timestamp = Date.now();
            var elapsedTime = timestamp - connectTimestamp;
            var publisherPayload = Object.assign({ elapsedTime: elapsedTime, level: level }, payload ? payload : {});
            publisher.publish(group, name, publisherPayload);
            var event = Object.assign({
                elapsedTime: elapsedTime,
                group: group,
                level: level,
                name: name,
                timestamp: timestamp
            }, payload ? { payload: payload } : {});
            var logLevel = {
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
        return _this;
    }
    return EventObserver;
}(EventEmitter));
/**
 * An SDK event.
 * @event EventObserver#event
 * @param {{name: string, payload: *}} event
 */
module.exports = EventObserver;
//# sourceMappingURL=eventobserver.js.map