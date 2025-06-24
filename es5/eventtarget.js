'use strict';
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
var EventTarget = /** @class */ (function () {
    function EventTarget() {
        Object.defineProperties(this, {
            _eventEmitter: {
                value: new EventEmitter()
            }
        });
    }
    EventTarget.prototype.dispatchEvent = function (event) {
        return this._eventEmitter.emit(event.type, event);
    };
    EventTarget.prototype.addEventListener = function () {
        var _a;
        return (_a = this._eventEmitter).addListener.apply(_a, __spreadArray([], __read(arguments)));
    };
    EventTarget.prototype.removeEventListener = function () {
        var _a;
        return (_a = this._eventEmitter).removeListener.apply(_a, __spreadArray([], __read(arguments)));
    };
    return EventTarget;
}());
module.exports = EventTarget;
//# sourceMappingURL=eventtarget.js.map