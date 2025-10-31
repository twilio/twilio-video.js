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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
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
        return (_a = this._eventEmitter).addListener.apply(_a, __spreadArray([], __read(arguments), false));
    };
    EventTarget.prototype.removeEventListener = function () {
        var _a;
        return (_a = this._eventEmitter).removeListener.apply(_a, __spreadArray([], __read(arguments), false));
    };
    return EventTarget;
}());
module.exports = EventTarget;
//# sourceMappingURL=eventtarget.js.map