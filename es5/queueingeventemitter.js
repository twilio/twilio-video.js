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
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from) {
    for (var i = 0, il = from.length, j = to.length; i < il; i++, j++)
        to[j] = from[i];
    return to;
};
var EventEmitter = require('events').EventEmitter;
/**
 * A {@link QueueingEventEmitter} can queue events until a listener has been
 * added.
 * @extends EventEmitter
 */
var QueueingEventEmitter = /** @class */ (function (_super) {
    __extends(QueueingEventEmitter, _super);
    /**
     * Construct a {@link QueueingEventEmitter}
     */
    function QueueingEventEmitter() {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _queuedEvents: {
                value: new Map()
            }
        });
        return _this;
    }
    /**
     * Emit any queued events.
     * @returns {boolean} true if every event had listeners, false otherwise
    */ /**
     * Emit any queued events matching the event name.
     * @param {string} event
     * @returns {boolean} true if every event had listeners, false otherwise
     */
    QueueingEventEmitter.prototype.dequeue = function (event) {
        var _this = this;
        var result = true;
        if (!event) {
            this._queuedEvents.forEach(function (_, queuedEvent) {
                result = this.dequeue(queuedEvent) && result;
            }, this);
            return result;
        }
        var queue = this._queuedEvents.get(event) || [];
        this._queuedEvents.delete(event);
        return queue.reduce(function (result, args) { return _this.emit.apply(_this, __spreadArray([], __read([event].concat(args)))) && result; }, result);
    };
    /**
     * If the event has listeners, emit the event; otherwise, queue the event.
     * @param {string} event
     * @param {...*} args
     * @returns {boolean} true if the event had listeners, false if the event was queued
     */
    QueueingEventEmitter.prototype.queue = function () {
        var args = [].slice.call(arguments);
        if (this.emit.apply(this, __spreadArray([], __read(args)))) {
            return true;
        }
        var event = args[0];
        if (!this._queuedEvents.has(event)) {
            this._queuedEvents.set(event, []);
        }
        this._queuedEvents.get(event).push(args.slice(1));
        return false;
    };
    return QueueingEventEmitter;
}(EventEmitter));
module.exports = QueueingEventEmitter;
//# sourceMappingURL=queueingeventemitter.js.map